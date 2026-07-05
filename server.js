const express = require('express');
const next = require('next');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const chokidar = require('chokidar');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

// Check if node-pty is available
let pty;
try {
  pty = require('node-pty');
} catch (e) {
  console.warn("node-pty not available, using child_process fallback for terminal");
}

app.prepare().then(() => {
  const expressApp = express();
  const server = http.createServer(expressApp);
  
  expressApp.use(cors());
  expressApp.use(express.json());

  // Workspace filesystem APIs
  
  // List files/folders in a directory (lazy load style)
  expressApp.get('/api/workspace/files', (req, res) => {
    let dirPath = req.query.path;
    if (!dirPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    dirPath = path.resolve(dirPath);
    
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Directory does not exist' });
    }
    
    try {
      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }
      
      const files = fs.readdirSync(dirPath);
      const result = files.map(file => {
        const fullPath = path.join(dirPath, file);
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch (e) {
          // Handle broken symlinks or locked files
          return null;
        }
        
        return {
          name: file,
          path: fullPath.replace(/\\/g, '/'),
          isDirectory: stat.isDirectory(),
          size: stat.size,
          updatedAt: stat.mtime
        };
      }).filter(Boolean);
      
      // Sort: folders first, then files alphabetically
      result.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get file contents
  expressApp.get('/api/workspace/file', (req, res) => {
    let filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    filePath = path.resolve(filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File does not exist' });
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.json({ content });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save file content
  expressApp.post('/api/workspace/file', (req, res) => {
    const { path: filePath, content } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    const resolvedPath = path.resolve(filePath);
    
    try {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(resolvedPath, content || '', 'utf-8');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create file/folder
  expressApp.post('/api/workspace/file/create', (req, res) => {
    const { path: targetPath, type } = req.body;
    if (!targetPath || !type) {
      return res.status(400).json({ error: 'Path and type are required' });
    }
    const resolvedPath = path.resolve(targetPath);
    
    if (fs.existsSync(resolvedPath)) {
      return res.status(400).json({ error: 'File or folder already exists' });
    }
    
    try {
      if (type === 'folder') {
        fs.mkdirSync(resolvedPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        fs.writeFileSync(resolvedPath, '', 'utf-8');
      }
      res.json({ success: true, path: resolvedPath.replace(/\\/g, '/') });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete file/folder
  expressApp.post('/api/workspace/file/delete', (req, res) => {
    const { path: targetPath } = req.body;
    if (!targetPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    const resolvedPath = path.resolve(targetPath);
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'File or folder does not exist' });
    }
    
    try {
      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        fs.rmSync(resolvedPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(resolvedPath);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Rename file/folder
  expressApp.post('/api/workspace/file/rename', (req, res) => {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
      return res.status(400).json({ error: 'oldPath and newPath are required' });
    }
    const resolvedOld = path.resolve(oldPath);
    const resolvedNew = path.resolve(newPath);
    
    if (!fs.existsSync(resolvedOld)) {
      return res.status(404).json({ error: 'Source does not exist' });
    }
    if (fs.existsSync(resolvedNew)) {
      return res.status(400).json({ error: 'Destination already exists' });
    }
    
    try {
      fs.mkdirSync(path.dirname(resolvedNew), { recursive: true });
      fs.renameSync(resolvedOld, resolvedNew);
      res.json({ success: true, newPath: resolvedNew.replace(/\\/g, '/') });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Copy paste file/folder
  expressApp.post('/api/workspace/file/copy-paste', (req, res) => {
    const { srcPath, destPath } = req.body;
    if (!srcPath || !destPath) {
      return res.status(400).json({ error: 'srcPath and destPath are required' });
    }
    const resolvedSrc = path.resolve(srcPath);
    const resolvedDest = path.resolve(destPath);
    
    if (!fs.existsSync(resolvedSrc)) {
      return res.status(404).json({ error: 'Source file/folder does not exist' });
    }
    
    try {
      const stat = fs.statSync(resolvedSrc);
      fs.mkdirSync(path.dirname(resolvedDest), { recursive: true });
      
      if (stat.isDirectory()) {
        fs.cpSync(resolvedSrc, resolvedDest, { recursive: true });
      } else {
        fs.copyFileSync(resolvedSrc, resolvedDest);
      }
      res.json({ success: true, destPath: resolvedDest.replace(/\\/g, '/') });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Global project search
  expressApp.get('/api/workspace/search', (req, res) => {
    const { folder, query, isRegex, matchCase, include, exclude } = req.query;
    if (!folder || !query) {
      return res.status(400).json({ error: 'Folder and query are required' });
    }
    
    const rootPath = path.resolve(folder);
    const results = [];
    const maxResults = 1000;
    
    let regex;
    try {
      const flags = matchCase === 'true' ? 'g' : 'gi';
      regex = isRegex === 'true' ? new RegExp(query, flags) : new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), flags);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid regular expression' });
    }
    
    // Check if match is excluded or included
    const isExcluded = (filePath) => {
      const normalized = filePath.replace(/\\/g, '/');
      const excludePatterns = ['node_modules', '.git', '.next', 'dist', 'out', 'build', '.DS_Store'];
      if (exclude) {
        excludePatterns.push(...exclude.split(',').map(p => p.trim()));
      }
      return excludePatterns.some(pattern => normalized.includes(pattern));
    };

    const isIncluded = (filePath) => {
      if (!include) return true;
      const normalized = filePath.replace(/\\/g, '/');
      const includePatterns = include.split(',').map(p => p.trim());
      return includePatterns.some(pattern => normalized.includes(pattern));
    };

    function searchDir(dir) {
      if (results.length >= maxResults) return;
      
      let files;
      try {
        files = fs.readdirSync(dir);
      } catch (e) {
        return;
      }
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch (e) {
          continue;
        }
        
        if (stat.isDirectory()) {
          if (!isExcluded(fullPath)) {
            searchDir(fullPath);
          }
        } else if (stat.isFile()) {
          if (!isExcluded(fullPath) && isIncluded(fullPath)) {
            try {
              // Only search text files, skip binaries
              const buffer = fs.readFileSync(fullPath);
              // Simple check for binary files (null bytes)
              let isBinary = false;
              for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
                if (buffer[i] === 0) {
                  isBinary = true;
                  break;
                }
              }
              if (isBinary) continue;
              
              const content = buffer.toString('utf-8');
              const lines = content.split(/\r?\n/);
              lines.forEach((line, index) => {
                if (results.length >= maxResults) return;
                
                regex.lastIndex = 0;
                if (regex.test(line)) {
                  results.push({
                    path: fullPath.replace(/\\/g, '/'),
                    relative: path.relative(rootPath, fullPath).replace(/\\/g, '/'),
                    line: index + 1,
                    content: line.trim(),
                  });
                }
              });
            } catch (e) {
              // skip unreadable files
            }
          }
        }
      }
    }
    
    try {
      searchDir(rootPath);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Git APIs
  const runGitCmd = (cmd, dirPath) => {
    return new Promise((resolve, reject) => {
      exec(cmd, { cwd: dirPath }, (error, stdout, stderr) => {
        if (error) {
          resolve({ error: error.message, stderr, stdout });
        } else {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        }
      });
    });
  };

  expressApp.get('/api/git/status', async (req, res) => {
    const { folder } = req.query;
    if (!folder) return res.status(400).json({ error: 'Folder is required' });
    const resolvedPath = path.resolve(folder);
    
    try {
      // Check if git is initialized
      const isGit = await runGitCmd('git rev-parse --is-inside-work-tree', resolvedPath);
      if (isGit.error) {
        return res.json({ isRepository: false, branch: '', changes: [] });
      }
      
      const branchRes = await runGitCmd('git branch --show-current', resolvedPath);
      const statusRes = await runGitCmd('git status --porcelain', resolvedPath);
      
      const changes = [];
      if (statusRes.stdout) {
        const lines = statusRes.stdout.split('\n');
        for (const line of lines) {
          if (!line) continue;
          const status = line.slice(0, 2);
          const file = line.slice(3).trim();
          
          // Index status, Worktree status
          const x = status[0]; // Staged status
          const y = status[1]; // Unstaged status
          
          changes.push({
            file,
            status,
            staged: x !== ' ' && x !== '?',
            unstaged: y !== ' ' || x === '?'
          });
        }
      }
      
      res.json({
        isRepository: true,
        branch: branchRes.stdout || 'HEAD',
        changes
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  expressApp.get('/api/git/diff', async (req, res) => {
    const { folder, file, staged } = req.query;
    if (!folder) return res.status(400).json({ error: 'Folder is required' });
    const resolvedPath = path.resolve(folder);
    
    let cmd = 'git diff';
    if (staged === 'true') {
      cmd += ' --cached';
    }
    if (file) {
      cmd += ` -- "${file}"`;
    }
    
    const diffRes = await runGitCmd(cmd, resolvedPath);
    res.json({ diff: diffRes.stdout || '' });
  });

  expressApp.post('/api/git/commit', async (req, res) => {
    const { folder, message, files } = req.body;
    if (!folder || !message) return res.status(400).json({ error: 'Folder and message are required' });
    const resolvedPath = path.resolve(folder);
    
    try {
      if (files && files.length > 0) {
        // Stage specific files
        for (const file of files) {
          await runGitCmd(`git add "${file}"`, resolvedPath);
        }
      } else {
        // Stage everything
        await runGitCmd('git add .', resolvedPath);
      }
      
      // Commit
      const commitRes = await runGitCmd(`git commit -m "${message.replace(/"/g, '\\"')}"`, resolvedPath);
      if (commitRes.error) {
        return res.status(400).json({ error: commitRes.error, stdout: commitRes.stdout });
      }
      
      res.json({ success: true, output: commitRes.stdout });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  expressApp.post('/api/git/stage', async (req, res) => {
    const { folder, file, stage } = req.body;
    if (!folder || !file) return res.status(400).json({ error: 'Folder and file are required' });
    const resolvedPath = path.resolve(folder);
    
    try {
      const cmd = stage ? `git add -- "${file}"` : `git restore --staged -- "${file}"`;
      const stageRes = await runGitCmd(cmd, resolvedPath);
      if (stageRes.error) {
        return res.status(400).json({ error: stageRes.error, stdout: stageRes.stdout });
      }
      res.json({ success: true, output: stageRes.stdout });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  expressApp.post('/api/git/sync', async (req, res) => {
    const { folder, action } = req.body; // 'push' or 'pull'
    if (!folder || !action) return res.status(400).json({ error: 'Folder and action are required' });
    const resolvedPath = path.resolve(folder);
    
    try {
      const resCmd = await runGitCmd(`git ${action}`, resolvedPath);
      if (resCmd.error) {
        return res.status(400).json({ error: resCmd.error, stdout: resCmd.stdout, stderr: resCmd.stderr });
      }
      res.json({ success: true, output: resCmd.stdout || resCmd.stderr });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // AI Endpoint (Groq Stream or Local Fallback)
  expressApp.post('/api/ai/chat', async (req, res) => {
    const { messages, systemPrompt, customApiKey, model } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const apiKey = customApiKey || process.env.GROQ_API_KEY;

    if (apiKey) {
      try {
        const formattedMessages = [];
        if (systemPrompt) {
          formattedMessages.push({ role: 'system', content: systemPrompt });
        }
        
        messages.forEach(msg => {
          formattedMessages.push({
            role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
            content: msg.content
          });
        });

        const requestBody = {
          model: model || 'llama-3.3-70b-versatile',
          messages: formattedMessages,
          stream: true,
          temperature: 0.2
        };

        const response = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Groq API error: ${errText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          let lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('data:')) {
              const dataText = cleanLine.slice(5).trim();
              if (dataText === '[DONE]') {
                res.write('data: [DONE]\n\n');
                continue;
              }
              try {
                const parsed = JSON.parse(dataText);
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) {
                  res.write(`data: ${JSON.stringify({ text })}\n\n`);
                }
              } catch (e) {
                // Ignore parsing errors for empty or malformed data lines
              }
            }
          }
        }
        res.end();
        return;
      } catch (error) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
        return;
      }
    }

    // Fallback Mock AI Engine: A sophisticated developer assistant simulation
    // This allows the entire UI to function perfectly out-of-the-box and stream text
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    let mockResponse = '';
    
    // Choose realistic answers based on user input
    if (lastUserMessage.toLowerCase().includes('explain') || lastUserMessage.toLowerCase().includes('what does')) {
      mockResponse = `### Code Explanation

Here is a breakdown of the code you requested to explain:

1. **Architecture**: The code uses a clean, separation-of-concerns layout typical of modular systems.
2. **Key Functions**:
   - Spawns asynchronous tasks and routes them safely.
   - Leverages React bindings and local State to control redraw cycles.
3. **Optimizations**:
   - Uses memoization to avoid redundant cycles.
   - Includes fallback routines to handle environment variances.

Is there a specific part of the flow you'd like to dive deeper into?`;
    } else if (lastUserMessage.toLowerCase().includes('fix') || lastUserMessage.toLowerCase().includes('bug') || lastUserMessage.toLowerCase().includes('error')) {
      mockResponse = `### Bug Fix Recommendation

I detected the issue in the snippet you shared. The problem is caused by a race condition or standard type mismatch when handling dynamic properties.

Here is the corrected code:

\`\`\`typescript
// Fix: Added safety check and type gating
const handleAction = async (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    console.error('Invalid payload structure');
    return;
  }
  
  try {
    const response = await api.process(payload);
    return response.data;
  } catch (error) {
    console.error('Processing failed:', error instanceof Error ? error.message : error);
    throw error;
  }
};
\`\`\`

#### Changes Made:
- Added runtime assertion of the \`payload\` object shape.
- Switched \`catch(error)\` error checking to avoid \`any\`-type issues in strict TypeScript configs.`;
    } else if (lastUserMessage.toLowerCase().includes('agent') || lastUserMessage.toLowerCase().includes('create') || lastUserMessage.toLowerCase().includes('build')) {
      mockResponse = `### Agent Task Execution Plan

I have initialized **Agent Mode** to accomplish your project modification request.

#### Planned Steps:
1. **Analyze Context**: Verify workspace files and imports.
2. **Execute File Operations**:
   - Create helper utilities under \`src/utils/\`.
   - Update main view dependencies.
3. **Validation**: Test build compatibility.

Executing step 1... Done.
Executing step 2... Created file \`src/utils/helper.ts\`.
Executing step 3... Verification passed.

All modifications completed successfully. Let me know if you would like me to revert or make further changes!`;
    } else {
      mockResponse = `Hello! I am your AI Development Assistant. I'm integrated directly into this workspace.

I can help you:
- **Write and edit code** directly in the editor.
- **Explain complex logic** and refactor code.
- **Run terminal actions** and debug code.
- **Git version control** commands.

What would you like to build or check in the project today?`;
    }

    // Stream the mock response line by line or character by character
    const words = mockResponse.split(' ');
    let currentIdx = 0;

    const interval = setInterval(() => {
      if (currentIdx >= words.length) {
        res.write('data: [DONE]\n\n');
        clearInterval(interval);
        res.end();
      } else {
        const chunk = words.slice(currentIdx, currentIdx + 3).join(' ') + ' ';
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        currentIdx += 3;
      }
    }, 50);
  });

  // Serve Next.js Pages
  expressApp.all(/.*/, (req, res) => {
    return handle(req, res);
  });

  // Websocket Handling
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/api/terminal')) {
      const cols = parseInt(url.searchParams.get('cols') || '80');
      const rows = parseInt(url.searchParams.get('rows') || '24');
      const workingDir = url.searchParams.get('path') || process.cwd();
      
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'powershell.exe' : 'bash';
      
      let ptyProcess = null;
      let shellProcess = null;

      if (pty) {
        try {
          ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: cols,
            rows: rows,
            cwd: workingDir,
            env: process.env
          });

          ptyProcess.onData((data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'output', data }));
            }
          });

          ptyProcess.onExit(({ exitCode, signal }) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'exit', exitCode }));
              ws.close();
            }
          });
        } catch (e) {
          console.error("Failed to spawn node-pty process, falling back to child_process", e);
          ptyProcess = null;
        }
      }

      if (!ptyProcess) {
        // Fallback using child_process.spawn
        try {
          shellProcess = spawn(shell, [], {
            cwd: workingDir,
            env: process.env,
            shell: true
          });

          shellProcess.stdout.on('data', (data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
            }
          });

          shellProcess.stderr.on('data', (data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
            }
          });

          shellProcess.on('close', (exitCode) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'exit', exitCode }));
              ws.close();
            }
          });
        } catch (e) {
          ws.send(JSON.stringify({ type: 'output', data: `Error spawning terminal process: ${e.message}\r\n` }));
          ws.close();
          return;
        }
      }

      ws.on('message', (message) => {
        try {
          const msg = JSON.parse(message);
          if (msg.type === 'input') {
            if (ptyProcess) {
              ptyProcess.write(msg.data);
            } else if (shellProcess) {
              shellProcess.stdin.write(msg.data);
            }
          } else if (msg.type === 'resize') {
            if (ptyProcess) {
              ptyProcess.resize(msg.cols, msg.rows);
            }
          }
        } catch (e) {
          // Send raw text if JSON parsing fails
          if (ptyProcess) {
            ptyProcess.write(message.toString());
          } else if (shellProcess) {
            shellProcess.stdin.write(message.toString());
          }
        }
      });

      ws.on('close', () => {
        if (ptyProcess) {
          ptyProcess.kill();
        } else if (shellProcess) {
          shellProcess.kill();
        }
      });
    }

    // Live directory file watcher
    if (pathname === '/api/watch') {
      const watchPath = url.searchParams.get('path');
      if (!watchPath || !fs.existsSync(watchPath)) {
        ws.close();
        return;
      }
      
      const resolvedWatchPath = path.resolve(watchPath);
      const watcher = chokidar.watch(resolvedWatchPath, {
        ignored: [
          /(^|[\/\\])\../, // ignore dotfiles
          '**/node_modules/**',
          '**/.next/**',
          '**/dist/**',
          '**/out/**',
          '**/build/**'
        ],
        persistent: true,
        ignoreInitial: true
      });

      watcher.on('all', (event, filePath) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            event,
            path: filePath.replace(/\\/g, '/'),
            name: path.basename(filePath)
          }));
        }
      });

      ws.on('close', () => {
        watcher.close();
      });
    }
  });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;
    
    if (pathname.startsWith('/api/terminal') || pathname === '/api/watch') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  const port = process.env.PORT || 3000;
  server.listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
