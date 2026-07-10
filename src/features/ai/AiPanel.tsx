'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, Trash2, User, Bot, StopCircle, RefreshCw,
  Eye, FileCode, Terminal, FileEdit, ClipboardList, Paperclip,
  History, Plus, ChevronDown, ChevronRight, Zap, AlertCircle,
  GitCompare, FileSearch, CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { ChatMessage, AiAgentTask } from '../../types';
import MarkdownRenderer from './MarkdownRenderer';
import DiffModal from './DiffModal';
import ChatSessionManager from './ChatSessionManager';

// Groq models available
const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', badge: 'Fast' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', badge: 'Instant' },
  { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B', badge: 'Reasoning' },
  { id: 'gemma2-9b-it', label: 'Gemma 2 9B', badge: 'Compact' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', badge: '32K ctx' },
];

export default function AiPanel() {
  const {
    chatMessages, isAiGenerating,
    addChatMessage, updateLastChatMessage, setAiGenerating, clearChat,
    agentTasks, addAgentTask, updateAgentTaskStatus, clearAgentTasks,
    settings, updateSettings, workspacePath,
    setActiveFile, openTab,
    activeFile, activeFileContent,
    diffPreview, setDiffPreview,
    saveCurrentSession,
  } = useEditorStore();

  const [input, setInput] = useState('');
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [agentLoopCount, setAgentLoopCount] = useState(0);
  const [agentPaused, setAgentPaused] = useState(false);
  const [continueCallback, setContinueCallback] = useState<(() => void) | null>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [fileTree, setFileTree] = useState<string[]>([]);
  const [contextFile, setContextFile] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatController = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentContinueRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, agentTasks]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px';
    }
  }, [input]);

  // Load workspace file list for @ mentions
  useEffect(() => {
    if (workspacePath) {
      fetchAllFiles(workspacePath).then(setFileTree).catch(() => {});
    }
  }, [workspacePath]);

  const fetchAllFiles = async (dir: string, depth = 0): Promise<string[]> => {
    if (depth > 3) return [];
    try {
      const res = await fetch(`/api/workspace/files?path=${encodeURIComponent(dir)}`);
      if (!res.ok) return [];
      const items = await res.json();
      const results: string[] = [];
      for (const item of items) {
        if (item.isDirectory) {
          if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(item.name)) {
            const children = await fetchAllFiles(item.path, depth + 1);
            results.push(...children);
          }
        } else {
          results.push(item.path);
        }
      }
      return results;
    } catch {
      return [];
    }
  };

  const buildSystemPrompt = () => {
    let base = settings.systemPrompt;
    if (contextFile && activeFileContent) {
      const fileName = contextFile.split('/').pop() || contextFile.split('\\').pop();
      base += `\n\nYou have access to the following active file context:\n\n**File: ${fileName}**\n\`\`\`\n${activeFileContent.slice(0, 8000)}\n\`\`\``;
    }
    return base;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setShowMentionPicker(true);
      setMentionSearch('');
    } else if (lastAt !== -1 && showMentionPicker) {
      setMentionSearch(val.slice(lastAt + 1));
    } else {
      setShowMentionPicker(false);
    }
  };

  const handleMentionSelect = (filePath: string) => {
    const lastAt = input.lastIndexOf('@');
    const fileName = filePath.split('/').pop() || filePath;
    setInput(input.slice(0, lastAt) + `@${fileName} `);
    setContextFile(filePath);
    setShowMentionPicker(false);
    textareaRef.current?.focus();
  };

  const filteredFiles = fileTree
    .filter(f => mentionSearch === '' || f.toLowerCase().includes(mentionSearch.toLowerCase()))
    .slice(0, 12);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isAiGenerating) return;

    const userText = input.trim();
    setInput('');
    setShowMentionPicker(false);

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date()
    };
    addChatMessage(userMsg);

    const assistantMsgId = Math.random().toString();
    addChatMessage({
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    });
    setAiGenerating(true);

    if (isAgentMode) {
      runAgentWorkflow(userText, assistantMsgId);
      return;
    }

    // Standard streaming chat
    try {
      chatController.current = new AbortController();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          systemPrompt: buildSystemPrompt(),
          customApiKey: settings.apiKey,
          model: settings.aiModel
        }),
        signal: chatController.current.signal
      });

      if (!response.ok) throw new Error('Failed to start streaming');
      await streamResponse(response);
      updateLastChatMessage('', false);

      // Auto-save session
      if (chatMessages.length > 0) saveCurrentSession();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        updateLastChatMessage(`⚠️ Error: ${err.message}`, false);
      }
    } finally {
      setAiGenerating(false);
      chatController.current = null;
    }
  };

  const streamResponse = async (response: Response) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) return;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const clean = line.trim();
        if (clean.startsWith('data:')) {
          const data = clean.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) updateLastChatMessage(parsed.text, true);
          } catch {}
        }
      }
    }
  };

  const handleStopGeneration = () => {
    chatController.current?.abort();
    setAiGenerating(false);
    updateLastChatMessage('', false);
  };

  const resolvePath = (p: string) => {
    if (!workspacePath) return p;
    const clean = p.replace(/\\/g, '/');
    const ws = workspacePath.replace(/\\/g, '/');
    return clean.startsWith(ws) || clean.startsWith('/') || clean.includes(':') ? clean : `${ws}/${clean}`;
  };

  const runAgentWorkflow = async (userGoal: string, assistantMsgId: string) => {
    clearAgentTasks();
    setAiGenerating(true);
    setAgentLoopCount(0);
    setAgentPaused(false);

    const AGENT_SYSTEM_PROMPT = `You are an expert software engineering agent with full access to the user's workspace.
You can read files, write files, list directories, delete files, run commands, search across the workspace, and get diagnostics.

To take an action, output an XML action block. You can chain multiple actions per response.
Format actions EXACTLY like this (no deviation):

<action type="read_file" path="src/index.ts"></action>
<action type="write_file" path="src/utils.ts">
export const add = (a: number, b: number) => a + b;
</action>
<action type="list_dir" path="src"></action>
<action type="delete_file" path="src/old.ts"></action>
<action type="run_command" command="npm run build"></action>
<action type="search_project" query="export const"></action>
<action type="get_diagnostics"></action>

Rules:
- Always read files before editing them.
- When modifying files, the ENTIRE new file content must be inside the write_file action.
- File paths are relative to the workspace root.
- When you have no more actions, write a concise final summary to the user.
- Be decisive and complete tasks fully.`;

    let history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userGoal }
    ];

    const MAX_LOOPS = 15;
    let loop = 0;

    const runLoop = async () => {
      while (loop < MAX_LOOPS) {
        loop++;
        setAgentLoopCount(loop);
        let accumulated = '';

        try {
          const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: history,
              systemPrompt: AGENT_SYSTEM_PROMPT,
              customApiKey: settings.apiKey,
              model: settings.aiModel
            })
          });

          if (!response.ok) throw new Error('Agent fetch failed');

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
                const clean = line.trim();
                if (clean.startsWith('data:')) {
                  const data = clean.slice(5).trim();
                  if (data === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.text) {
                      accumulated += parsed.text;
                      updateLastChatMessage(parsed.text, true);
                    }
                  } catch {}
                }
              }
            }
          }
          updateLastChatMessage('', false);

          // Parse actions
          const actionRegex = /<action\s+type="([^"]+)"(?:\s+path="([^"]+)")?(?:\s+command="([^"]+)")?(?:\s+query="([^"]+)")?>([\s\S]*?)<\/action>/g;
          const actions: any[] = [];
          let match;
          while ((match = actionRegex.exec(accumulated)) !== null) {
            actions.push({ type: match[1], path: match[2] || '', command: match[3] || '', query: match[4] || '', content: match[5] || '' });
          }

          if (actions.length === 0) break; // Agent is done

          history.push({ role: 'assistant', content: accumulated });

          const results: string[] = [];
          for (const action of actions) {
            const taskId = Math.random().toString();
            const label = action.path || action.command || action.query || action.type;
            addAgentTask({ id: taskId, type: getTaskType(action.type), description: `${action.type}: ${label}`, status: 'running' });

            let outcome = '';
            try {
              outcome = await executeAction(action);
              updateAgentTaskStatus(taskId, 'completed', outcome.slice(0, 400));
            } catch (e: any) {
              outcome = `Error: ${e.message}`;
              updateAgentTaskStatus(taskId, 'failed', e.message);
            }
            results.push(`<action_result type="${action.type}" path="${action.path}" command="${action.command}">\n${outcome}\n</action_result>`);
          }

          history.push({ role: 'user', content: results.join('\n\n') });

          // Prepare next response bubble
          addChatMessage({ id: Math.random().toString(), role: 'assistant', content: '', timestamp: new Date(), isStreaming: true });

        } catch (err: any) {
          updateLastChatMessage(`⚠️ Agent error: ${err.message}`, false);
          break;
        }
      }

      if (loop >= MAX_LOOPS) {
        setAgentPaused(true);
        agentContinueRef.current = () => {
          setAgentPaused(false);
          runLoop();
        };
      }

      setAiGenerating(false);
    };

    runLoop();
  };

  const executeAction = async (action: any): Promise<string> => {
    const { type, path: p, command, query, content } = action;
    const resolvedPath = resolvePath(p);

    if (type === 'read_file') {
      const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(resolvedPath)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return `Contents of ${p}:\n${data.content}`;
    }

    if (type === 'write_file') {
      // Show diff preview if file exists
      let original = '';
      try {
        const existing = await fetch(`/api/workspace/file?path=${encodeURIComponent(resolvedPath)}`);
        if (existing.ok) {
          const d = await existing.json();
          original = d.content;
        }
      } catch {}

      if (original) {
        // Show diff and wait for user decision
        return await new Promise<string>((resolve) => {
          setDiffPreview({
            file: resolvedPath,
            original,
            modified: content,
            onAccept: async () => {
              setDiffPreview(null);
              const res = await fetch('/api/workspace/file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: resolvedPath, content })
              });
              if (!res.ok) throw new Error(await res.text());
              resolve(`File written: ${p}`);
            },
            onReject: () => {
              setDiffPreview(null);
              resolve(`File write rejected by user for: ${p}`);
            }
          });
        });
      }

      // New file - write directly
      const res = await fetch('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: resolvedPath, content })
      });
      if (!res.ok) throw new Error(await res.text());
      return `File created: ${p}`;
    }

    if (type === 'list_dir') {
      const res = await fetch(`/api/workspace/files?path=${encodeURIComponent(resolvedPath)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return `Contents of ${p}:\n${data.map((d: any) => `${d.isDirectory ? '[DIR]' : '[FILE]'} ${d.name}`).join('\n')}`;
    }

    if (type === 'delete_file') {
      const res = await fetch('/api/workspace/file/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: resolvedPath })
      });
      if (!res.ok) throw new Error(await res.text());
      return `Deleted: ${p}`;
    }

    if (type === 'run_command') {
      const res = await fetch('/api/workspace/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: workspacePath, command })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return `Exit: ${data.success ? 'success' : 'failed'}\nstdout:\n${data.stdout}\nstderr:\n${data.stderr}`;
    }

    if (type === 'search_project') {
      const res = await fetch(`/api/workspace/search?folder=${encodeURIComponent(workspacePath || '')}&query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return `Search results for "${query}":\n${data.map((d: any) => `${d.relative}:${d.line} - ${d.content}`).join('\n')}`;
    }

    if (type === 'get_diagnostics') {
      const res = await fetch(`/api/workspace/diagnostics?folder=${encodeURIComponent(workspacePath || '')}`);
      if (!res.ok) return 'No diagnostics available';
      const data = await res.json();
      return `TypeScript diagnostics:\n${data.map((d: any) => `${d.file}:${d.line} - ${d.message}`).join('\n') || 'No errors found.'}`;
    }

    throw new Error(`Unknown action type: ${type}`);
  };

  const getTaskType = (type: string): AiAgentTask['type'] => {
    if (type === 'read_file') return 'read';
    if (type === 'write_file') return 'write';
    if (type === 'delete_file') return 'delete';
    if (type === 'run_command') return 'command';
    if (type === 'search_project') return 'search';
    if (type === 'get_diagnostics') return 'diagnostics';
    return 'plan';
  };

  const toggleTaskExpand = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const currentModel = GROQ_MODELS.find(m => m.id === settings.aiModel) || GROQ_MODELS[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0f0f12] relative overflow-hidden">

      {/* Diff preview modal */}
      {diffPreview && (
        <DiffModal
          file={diffPreview.file}
          original={diffPreview.original}
          modified={diffPreview.modified}
          onAccept={diffPreview.onAccept}
          onReject={diffPreview.onReject}
        />
      )}

      {/* Chat session manager slide-over */}
      <ChatSessionManager isOpen={showHistory} onClose={() => setShowHistory(false)} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05] bg-[#0c0c0f]/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-violet-600/20 border border-violet-500/25 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <span className="text-[12.5px] font-bold text-white tracking-wide">AI Assistant</span>

          {/* Agent mode toggle */}
          <button
            onClick={() => setIsAgentMode(a => !a)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border transition-all ${
              isAgentMode
                ? 'bg-violet-600/25 border-violet-500/40 text-violet-300 shadow-[0_0_8px_rgba(124,58,237,0.2)]'
                : 'bg-transparent border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20'
            }`}
          >
            <Zap className="w-2.5 h-2.5" />
            Agent
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Context injection toggle */}
          <button
            onClick={() => {
              if (settings.contextInjectionEnabled) {
                updateSettings({ contextInjectionEnabled: false });
                setContextFile(null);
              } else {
                updateSettings({ contextInjectionEnabled: true });
                setContextFile(activeFile);
              }
            }}
            title={settings.contextInjectionEnabled ? `Context: ${contextFile?.split('/').pop()}` : 'Inject active file context'}
            className={`p-1.5 rounded-lg border transition-all ${
              settings.contextInjectionEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>

          {/* History */}
          <button
            onClick={() => setShowHistory(h => !h)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-200 border border-transparent hover:border-white/5 transition-all"
            title="Chat history"
          >
            <History className="w-3.5 h-3.5" />
          </button>

          {/* New chat */}
          <button
            onClick={() => { saveCurrentSession(); clearChat(); clearAgentTasks(); }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-200 border border-transparent hover:border-white/5 transition-all"
            title="New chat"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Clear */}
          <button
            onClick={() => { clearChat(); clearAgentTasks(); }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-rose-400 border border-transparent hover:border-white/5 transition-all"
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scroll-smooth">
        {chatMessages.length === 0 ? (
          <EmptyState isAgentMode={isAgentMode} />
        ) : (
          chatMessages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))
        )}

        {/* Agent task timeline */}
        {agentTasks.length > 0 && (
          <AgentTimeline
            tasks={agentTasks}
            loopCount={agentLoopCount}
            expandedTasks={expandedTasks}
            onToggle={toggleTaskExpand}
          />
        )}

        {/* Agent paused — continue button */}
        {agentPaused && !isAiGenerating && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
            <button
              onClick={() => agentContinueRef.current?.()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-[12px] font-medium transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Continue Agent (15 more steps)
            </button>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-3 pb-3 pt-2 border-t border-white/[0.05] bg-[#0c0c0f]/60 shrink-0">
        {/* Context badge */}
        {settings.contextInjectionEnabled && contextFile && (
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10.5px] text-emerald-400">
              <Paperclip className="w-2.5 h-2.5" />
              <span>{contextFile.split('/').pop()}</span>
              <button onClick={() => { setContextFile(null); updateSettings({ contextInjectionEnabled: false }); }}>
                <XCircle className="w-2.5 h-2.5 ml-0.5 hover:text-rose-400 transition-colors" />
              </button>
            </div>
          </div>
        )}

        {/* Model selector */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(p => !p)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px] text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all"
            >
              <Sparkles className="w-2.5 h-2.5 text-violet-400" />
              <span>{currentModel.label}</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showModelPicker && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute bottom-full mb-1.5 left-0 z-50 bg-[#17171b] border border-white/10 rounded-xl shadow-2xl p-1.5 min-w-[200px]"
              >
                {GROQ_MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { updateSettings({ aiModel: m.id }); setShowModelPicker(false); }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[11.5px] transition-colors ${
                      m.id === settings.aiModel
                        ? 'bg-violet-600/20 text-violet-300'
                        : 'hover:bg-white/5 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <span>{m.label}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-500">{m.badge}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
          {isAgentMode && (
            <span className="text-[10px] text-violet-400 font-medium">Agent Mode Active</span>
          )}
        </div>

        {/* Mention picker */}
        {showMentionPicker && filteredFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 bg-[#17171b] border border-white/10 rounded-xl shadow-xl p-1.5 max-h-40 overflow-y-auto"
          >
            {filteredFiles.map((f) => (
              <button
                key={f}
                onClick={() => handleMentionSelect(f)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-left"
              >
                <FileCode className="w-3 h-3 text-zinc-500 shrink-0" />
                <span className="truncate">{f.replace(workspacePath || '', '').replace(/^\//, '')}</span>
              </button>
            ))}
          </motion.div>
        )}

        {/* Textarea */}
        <form onSubmit={handleSend}>
          <div className="relative flex items-end bg-[#17171b] border border-white/[0.07] focus-within:border-violet-500/40 rounded-2xl p-3 shadow-lg transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
                if (e.key === 'Escape') setShowMentionPicker(false);
              }}
              placeholder={isAgentMode ? 'Give the agent a task… (e.g. "add error handling to all API routes")' : 'Ask anything… type @ to mention a file'}
              rows={1}
              className="w-full bg-transparent text-[12.5px] text-white placeholder-zinc-600 outline-none resize-none leading-relaxed pr-10 select-text"
              style={{ maxHeight: '140px', overflowY: 'auto' }}
            />
            <div className="absolute right-3 bottom-2.5 flex items-center gap-1.5">
              {isAiGenerating ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 cursor-pointer transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-white transition-all hover:shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className="text-center text-[10px] text-zinc-700 mt-1.5">
            Enter to send · Shift+Enter for new line · @ to mention file
          </p>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function EmptyState({ isAgentMode }: { isAgentMode: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-6">
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="w-14 h-14 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-4"
      >
        {isAgentMode ? <Zap className="w-7 h-7 text-violet-400" /> : <Sparkles className="w-7 h-7 text-violet-400" />}
      </motion.div>
      <h3 className="text-[14px] font-bold text-white mb-1.5">
        {isAgentMode ? 'Agent Ready' : 'AI Assistant'}
      </h3>
      <p className="text-[11.5px] text-zinc-600 max-w-[220px] leading-relaxed">
        {isAgentMode
          ? 'Give me a task and I will autonomously read, write, and run commands to complete it.'
          : 'Ask me to write, explain, fix, or refactor code. Type @ to attach a file for context.'}
      </p>
      {!isAgentMode && (
        <div className="mt-5 flex flex-col gap-1.5 w-full max-w-[220px]">
          {['Explain this code', 'Fix the bugs', 'Add TypeScript types', 'Write unit tests'].map(s => (
            <div key={s} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-[11px] text-zinc-500 text-left">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  const { activeFile } = useEditorStore();

  const handleApply = async (code: string, lang: string) => {
    if (!activeFile) return;
    try {
      await fetch('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFile, content: code })
      });
    } catch {}
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse self-end max-w-[92%]' : 'self-start max-w-full'}`}
    >
      {/* Avatar */}
      <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
        isUser ? 'bg-zinc-700' : 'bg-violet-600/20 border border-violet-500/30'
      }`}>
        {isUser ? <User className="w-3.5 h-3.5 text-zinc-300" /> : <Bot className="w-3.5 h-3.5 text-violet-400" />}
      </div>

      {/* Bubble */}
      <div className={`rounded-2xl px-4 py-3 text-[12.5px] max-w-full ${
        isUser
          ? 'bg-violet-600/15 border border-violet-500/25 text-white rounded-tr-sm'
          : 'bg-[#17171b] border border-white/[0.05] text-zinc-200 rounded-tl-sm'
      }`}>
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        ) : (
          <>
            <MarkdownRenderer content={msg.content} onApplyCode={handleApply} />
            {msg.isStreaming && (
              <span className="inline-flex items-center gap-1 mt-1 text-violet-400">
                <span className="w-1 h-3.5 bg-violet-400 rounded-sm animate-pulse" />
              </span>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function AgentTimeline({ tasks, loopCount, expandedTasks, onToggle }: {
  tasks: AiAgentTask[];
  loopCount: number;
  expandedTasks: Set<string>;
  onToggle: (id: string) => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    read: <Eye className="w-3 h-3" />,
    write: <FileEdit className="w-3 h-3" />,
    delete: <Trash2 className="w-3 h-3" />,
    search: <FileSearch className="w-3 h-3" />,
    command: <Terminal className="w-3 h-3" />,
    plan: <ClipboardList className="w-3 h-3" />,
    diff: <GitCompare className="w-3 h-3" />,
    diagnostics: <AlertCircle className="w-3 h-3" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3.5 bg-[#13131a] border border-white/[0.06] rounded-2xl flex flex-col gap-0.5 shadow-lg"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-violet-400" />
          Agent Timeline
        </span>
        <span className="text-[10px] text-zinc-700 font-mono">loop {loopCount}/15</span>
      </div>

      {tasks.map((task) => {
        const isExpanded = expandedTasks.has(task.id);
        return (
          <div key={task.id} className="flex flex-col">
            <button
              onClick={() => onToggle(task.id)}
              className="flex items-center gap-2.5 py-1.5 text-left w-full hover:bg-white/[0.02] rounded-lg px-1 transition-colors"
            >
              {/* Status icon */}
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                {task.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {task.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />}
                {task.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                {task.status === 'pending' && <div className="w-2 h-2 rounded-full bg-zinc-600" />}
              </div>
              {/* Type icon */}
              <span className="text-zinc-600 shrink-0">{icons[task.type] || <ClipboardList className="w-3 h-3" />}</span>
              {/* Description */}
              <span className={`text-[11.5px] flex-1 truncate ${
                task.status === 'completed' ? 'text-zinc-400' :
                task.status === 'running' ? 'text-zinc-200' :
                task.status === 'failed' ? 'text-rose-400' : 'text-zinc-600'
              }`}>
                {task.description}
              </span>
              {task.output && (
                isExpanded ? <ChevronDown className="w-3 h-3 text-zinc-600 shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
              )}
            </button>
            {isExpanded && task.output && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="ml-8 mb-1 px-2 py-1.5 bg-black/30 rounded-lg"
              >
                <code className="text-[10.5px] font-mono text-zinc-500 break-all whitespace-pre-wrap">
                  {task.output}
                </code>
              </motion.div>
            )}
          </div>
        );
      })}
    </motion.div>
  );
}
