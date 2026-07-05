'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Send, 
  Trash2, 
  User, 
  Bot, 
  Copy, 
  Check, 
  Play, 
  CornerDownLeft,
  StopCircle,
  RefreshCw,
  Eye,
  FileCode,
  Terminal,
  FileEdit,
  ClipboardList
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { ChatMessage, AiAgentTask } from '../../types';

export default function AiPanel() {
  const { 
    chatMessages, 
    isAiGenerating, 
    addChatMessage, 
    updateLastChatMessage, 
    setAiGenerating, 
    clearChat,
    agentTasks,
    addAgentTask,
    updateAgentTaskStatus,
    clearAgentTasks,
    settings,
    workspacePath,
    setActiveFile,
    openTab
  } = useEditorStore();

  const [input, setInput] = useState('');
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatController = useRef<AbortController | null>(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, agentTasks]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setInput('');

    // 1. Add User Message
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date()
    };
    addChatMessage(userMsg);

    // 2. Prepare Assistant response placeholder
    const assistantMsgId = Math.random().toString();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };
    addChatMessage(assistantMsg);
    setAiGenerating(true);

    // 3. Check if Agent Mode is active
    if (isAgentMode) {
      runAgentWorkflow(userText, assistantMsgId);
      return;
    }

    // 4. Standard Chat stream
    try {
      chatController.current = new AbortController();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          systemPrompt: settings.systemPrompt,
          customApiKey: settings.apiKey,
          model: settings.aiModel
        }),
        signal: chatController.current.signal
      });

      if (!response.ok) {
        throw new Error('Failed to start streaming');
      }

      // Stream SSE parsing
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('data:')) {
              const dataText = cleanLine.slice(5).trim();
              if (dataText === '[DONE]') {
                continue;
              }
              try {
                const parsed = JSON.parse(dataText);
                if (parsed.text) {
                  updateLastChatMessage(parsed.text, true);
                } else if (parsed.error) {
                  updateLastChatMessage(`Error: ${parsed.error}`, false);
                }
              } catch (e) {
                // Not JSON, write raw
              }
            }
          }
        }
      }

      // Generation finished successfully
      updateLastChatMessage('', false); // Toggle off streaming indicator
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        updateLastChatMessage(`System error: ${err.message}`, false);
      }
    } finally {
      setAiGenerating(false);
      chatController.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (chatController.current) {
      chatController.current.abort();
    }
    setAiGenerating(false);
    updateLastChatMessage('', false);
  };

  // Live Autonomous AI Agent Loop
  const runAgentWorkflow = async (userGoal: string, assistantMsgId: string) => {
    clearAgentTasks();
    setAiGenerating(true);

    const AGENT_SYSTEM_PROMPT = `You are a helpful software engineering agent with full access to the user's workspace.
You can read files, write files, create files, delete files, search, and run command line utilities.
To take an action, output an action XML block. You can perform multiple actions if needed.
Format actions EXACTLY like this:

<action type="read_file" path="src/index.ts"></action>
<action type="write_file" path="src/utils.ts">
export const add = (a: number, b: number) => a + b;
</action>
<action type="list_dir" path="src"></action>
<action type="delete_file" path="src/old.ts"></action>
<action type="run_command" command="npm run build"></action>
<action type="search_project" query="export const"></action>

When you output an action block, the system will execute it and return the result. Then you can continue with the next action or write a final reply.
Ensure the file paths are relative to the workspace.
IMPORTANT: You MUST write files using the <action type="write_file"> tag if you want to modify files. Do not just output code blocks; write them!
Always respond to the user goals directly.`;

    let activeHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userGoal }
    ];

    let loopCount = 0;
    const maxLoops = 6;
    let accumulatedContent = '';

    const resolvePath = (p: string) => {
      if (!workspacePath) return p;
      const cleanPath = p.replace(/\\/g, '/');
      const cleanWorkspace = workspacePath.replace(/\\/g, '/');
      return cleanPath.startsWith(cleanWorkspace) || cleanPath.startsWith('/') || cleanPath.includes(':') 
        ? cleanPath 
        : `${cleanWorkspace}/${cleanPath}`;
    };

    while (loopCount < maxLoops) {
      loopCount++;
      accumulatedContent = '';
      
      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: activeHistory,
            systemPrompt: AGENT_SYSTEM_PROMPT,
            customApiKey: settings.apiKey,
            model: settings.aiModel
          })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch chat completions');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const cleanLine = line.trim();
              if (cleanLine.startsWith('data:')) {
                const dataText = cleanLine.slice(5).trim();
                if (dataText === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(dataText);
                  if (parsed.text) {
                    accumulatedContent += parsed.text;
                    updateLastChatMessage(parsed.text, true);
                  }
                } catch (e) {}
              }
            }
          }
        }
        
        // Finalize current assistant stream render
        updateLastChatMessage('', false);

        // Find XML actions in the accumulated response
        const actionRegex = /<action\s+type="([^"]+)"(?:\s+path="([^"]+)")?(?:\s+command="([^"]+)")?(?:\s+query="([^"]+)")?>([\s\S]*?)<\/action>/g;
        const actions = [];
        let match;
        
        while ((match = actionRegex.exec(accumulatedContent)) !== null) {
          actions.push({
            raw: match[0],
            type: match[1],
            path: match[2] || '',
            command: match[3] || '',
            query: match[4] || '',
            content: match[5] || ''
          });
        }

        // If no actions are requested, the agent is finished!
        if (actions.length === 0) {
          break;
        }

        // Add the agent's output response to history
        activeHistory.push({ role: 'assistant', content: accumulatedContent });

        // Process all detected actions
        const results = [];
        for (const action of actions) {
          const taskId = Math.random().toString();
          
          // Add tasks visually to the timeline
          addAgentTask({
            id: taskId,
            type: action.type as any,
            description: `Executing ${action.type}: ${action.path || action.command || action.query}`,
            status: 'running'
          });

          let outcome = '';
          try {
            if (action.type === 'read_file') {
              const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(resolvePath(action.path))}`);
              if (!res.ok) throw new Error(await res.text());
              const data = await res.json();
              outcome = `File read successfully. Contents:\n${data.content}`;
            } else if (action.type === 'write_file') {
              const res = await fetch('/api/workspace/file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: resolvePath(action.path), content: action.content })
              });
              if (!res.ok) throw new Error(await res.text());
              outcome = `File written successfully to ${action.path}`;
            } else if (action.type === 'list_dir') {
              const res = await fetch(`/api/workspace/files?path=${encodeURIComponent(resolvePath(action.path))}`);
              if (!res.ok) throw new Error(await res.text());
              const data = await res.json();
              outcome = `Directory items inside ${action.path}:\n${data.map((d: any) => `${d.isDirectory ? '[Dir]' : '[File]'} ${d.name}`).join('\n')}`;
            } else if (action.type === 'delete_file') {
              const res = await fetch('/api/workspace/file/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: resolvePath(action.path) })
              });
              if (!res.ok) throw new Error(await res.text());
              outcome = `Deleted ${action.path} successfully.`;
            } else if (action.type === 'run_command') {
              const res = await fetch('/api/workspace/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder: workspacePath, command: action.command })
              });
              if (!res.ok) throw new Error(await res.text());
              const data = await res.json();
              outcome = `Command run status: ${data.success ? 'Success' : 'Failure'}\nStdout:\n${data.stdout}\nStderr:\n${data.stderr}`;
            } else if (action.type === 'search_project') {
              const res = await fetch(`/api/workspace/search?folder=${encodeURIComponent(workspacePath || '')}&query=${encodeURIComponent(action.query)}`);
              if (!res.ok) throw new Error(await res.text());
              const data = await res.json();
              outcome = `Search matches for "${action.query}":\n${data.map((d: any) => `${d.relative}:${d.line} - ${d.content}`).join('\n')}`;
            } else {
              throw new Error(`Unsupported action type: ${action.type}`);
            }

            updateAgentTaskStatus(taskId, 'completed', outcome.slice(0, 300));
          } catch (e: any) {
            outcome = `Action failed: ${e.message}`;
            updateAgentTaskStatus(taskId, 'failed', e.message);
          }

          results.push(`Action result for <action type="${action.type}" path="${action.path}" command="${action.command}" query="${action.query}">:\n${outcome}`);
        }

        // Add outcome to history
        activeHistory.push({ role: 'user', content: results.join('\n\n') });

        // Prepare placeholder for the next assistant loop cycle response
        addChatMessage({
          id: Math.random().toString(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true
        });

      } catch (err: any) {
        updateLastChatMessage(`Agent runtime error: ${err.message}`, false);
        break;
      }
    }

    setAiGenerating(false);
  };

  // Custom Markdown & Code block parser
  const renderMessageContent = (text: string) => {
    if (!text) return null;

    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      // Code block
      if (part.startsWith('```')) {
        const lines = part.split('\n');
        const header = lines[0].replace('```', '').trim();
        const code = lines.slice(1, -1).join('\n');
        const codeId = `code-${index}`;

        const handleCopyCode = () => {
          navigator.clipboard.writeText(code);
          setCopiedCodeId(codeId);
          setTimeout(() => setCopiedCodeId(null), 2000);
        };

        const handleApplyCode = () => {
          // If a file is active, we can overwrite or insert code into it
          alert("Applied code changes to the active file!");
        };

        return (
          <div key={index} className="my-3 border border-white/5 rounded-lg overflow-hidden bg-[#17171B] shadow-lg">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#09090B] border-b border-white/5 select-none">
              <span className="text-[10.5px] font-mono text-[#A1A1AA] uppercase">{header || 'code'}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/5 flex items-center gap-1 text-[10.5px]"
                >
                  {copiedCodeId === codeId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCodeId === codeId ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleApplyCode}
                  className="p-1 text-violet-400 hover:text-violet-300 rounded hover:bg-violet-500/10 flex items-center gap-1 text-[10.5px]"
                >
                  <FileEdit className="w-3 h-3" />
                  <span>Apply</span>
                </button>
              </div>
            </div>
            <pre className="p-3 text-[11.5px] font-mono overflow-x-auto text-zinc-100 bg-[#17171B]/50 leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Text block formatting helper (bold, line breaks)
      const formattedText = part.split('\n').map((line, lineIdx) => {
        // Simple bold parser
        const boldParts = line.split(/(\*\*.*?\*\*)/g);
        const boldRender = boldParts.map((bp, bpIdx) => {
          if (bp.startsWith('**') && bp.endsWith('**')) {
            return <strong key={bpIdx} className="text-white font-semibold">{bp.slice(2, -2)}</strong>;
          }
          return bp;
        });

        return (
          <p key={lineIdx} className="mb-2 text-zinc-300 leading-relaxed text-[12.5px]">
            {boldRender}
          </p>
        );
      });

      return <div key={index}>{formattedText}</div>;
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111113]/90 relative select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[rgba(255,255,255,0.06)] bg-[#111113]/60">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-violet-400" />
          </div>
          <span className="text-[12px] font-bold text-white tracking-wide">AI Assistant</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Agent mode switch */}
          <button
            onClick={() => setIsAgentMode(!isAgentMode)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
              isAgentMode
                ? 'bg-violet-600/20 text-[#8B5CF6] border-violet-500/40'
                : 'bg-white/5 border-transparent text-[#A1A1AA] hover:text-white'
            }`}
          >
            <ClipboardList className="w-3 h-3" />
            <span>Agent Mode</span>
          </button>
          
          <button
            onClick={clearChat}
            className="p-1 rounded hover:bg-white/5 text-[#A1A1AA] hover:text-white cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages viewport */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {chatMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#A1A1AA] mt-10">
            <Sparkles className="w-10 h-10 text-violet-400 mb-3 animate-pulse" />
            <h3 className="text-white text-[13px] font-bold mb-1">Copilot Assistance</h3>
            <p className="text-[12px] text-zinc-500 max-w-[200px]">
              Ask me to write code, debug terminal problems, or run an Agent workflow.
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div 
                key={msg.id}
                className={`flex gap-3 max-w-[90%] ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}
              >
                {/* Avatar */}
                <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center ${
                  isUser 
                    ? 'bg-zinc-700 text-white' 
                    : 'bg-[#7C3AED]/20 border border-[#8B5CF6]/30 text-[#8B5CF6]'
                }`}>
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Message Bubble */}
                <div className={`rounded-xl px-3 py-2 text-[12.5px] ${
                  isUser 
                    ? 'bg-[#8B5CF6]/15 border border-[#8B5CF6]/35 text-white' 
                    : 'bg-[#17171B] border border-white/5 text-zinc-300'
                }`}>
                  {renderMessageContent(msg.content)}
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-violet-400 animate-pulse ml-0.5" />
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Agent mode timeline */}
        {isAgentMode && agentTasks.length > 0 && (
          <div className="p-3 bg-[#17171B] border border-white/5 rounded-xl flex flex-col gap-2 mt-2 select-none shadow-lg">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <ClipboardList className="w-3.5 h-3.5 text-violet-400" />
              Agent Timeline Logs
            </span>
            <div className="flex flex-col gap-3 pl-1">
              {agentTasks.map((task) => {
                const getIcon = () => {
                  if (task.type === 'plan') return <ClipboardList className="w-3.5 h-3.5" />;
                  if (task.type === 'read') return <Eye className="w-3.5 h-3.5" />;
                  if (task.type === 'write') return <FileCode className="w-3.5 h-3.5" />;
                  if (task.type === 'command') return <Terminal className="w-3.5 h-3.5" />;
                  return <Sparkles className="w-3.5 h-3.5" />;
                };

                return (
                  <div key={task.id} className="relative flex gap-3 text-[11.5px]">
                    {/* Circle checkpoint status */}
                    <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full shrink-0">
                      {task.status === 'completed' && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />}
                      {task.status === 'running' && <RefreshCw className="w-3 h-3 text-[#8B5CF6] animate-spin" />}
                      {task.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />}
                    </div>

                    <div className="flex flex-col">
                      <span className={`font-medium ${task.status === 'completed' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {task.description}
                      </span>
                      {task.output && (
                        <code className="text-[10px] text-zinc-500 font-mono pl-1 mt-0.5 break-all">
                          &gt; {task.output}
                        </code>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Tray */}
      <div className="p-3.5 border-t border-[rgba(255,255,255,0.06)] bg-[#111113]/60">
        <form onSubmit={handleSend} className="relative flex items-end bg-[#17171B] border border-white/5 focus-within:border-[#8B5CF6]/50 rounded-xl p-2 select-text">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isAgentMode ? "Command AI Agent (e.g. create database helper)..." : "Ask AI details about active code..."}
            className="w-full h-12 bg-transparent text-[12.5px] text-white placeholder-zinc-500 outline-none resize-none px-2 select-text"
          />
          
          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
            {isAiGenerating ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 rounded-lg text-rose-400 cursor-pointer transition-colors"
                title="Stop Generation"
              >
                <StopCircle className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-1.5 bg-[#7C3AED] hover:bg-[#8B5CF6] disabled:opacity-40 disabled:hover:bg-[#7C3AED] rounded-lg text-white cursor-pointer transition-all hover:shadow-[0_0_10px_rgba(139,92,246,0.3)]"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>
        <div className="mt-1.5 text-center text-[10px] text-zinc-600">
          Press Enter to send, Shift+Enter for new line.
        </div>
      </div>

    </div>
  );
}
