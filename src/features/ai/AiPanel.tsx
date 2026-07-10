'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, Trash2, StopCircle, RefreshCw,
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
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [fileTree, setFileTree] = useState<string[]>([]);
  const [contextFile, setContextFile] = useState<string | null>(null);

  // Multi-Agent System State
  const [activeAgent, setActiveAgent] = useState<'architect' | 'developer' | 'security' | null>(null);
  const [agentPhase, setAgentPhase] = useState<'idle' | 'planning' | 'approval_required' | 'development' | 'reviewing' | 'completed' | 'failed'>('idle');
  const [proposedPlan, setProposedPlan] = useState<string | null>(null);
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);
  const [agentProgress, setAgentProgress] = useState<number>(0);
  const [gitBranchName, setGitBranchName] = useState<string | null>(null);
  const [securityReport, setSecurityReport] = useState<{ performance: number; security: number; maintainability: number; status: 'APPROVED' | 'NEEDS FIXES'; content: string } | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<{ id: string; type: string; label: string; resolve: (allowed: boolean) => void } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatController = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentContinueRef = useRef<(() => void) | null>(null);
  const currentGoalRef = useRef<string>('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, agentTasks, activeAgent, agentPhase, permissionRequest, securityReport]);

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

  // Memory utilities
  const loadProjectMemory = async (): Promise<string> => {
    if (!workspacePath) return '';
    try {
      const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(workspacePath + '/.agent_memory.json')}`);
      if (res.ok) {
        const data = await res.json();
        const mem = JSON.parse(data.content);
        return `\n\n[PROJECT MEMORY]\nFramework/Stack: ${mem.stack || 'Unknown'}\nKey decisions: ${mem.decisions || 'None'}\nPrevious edits:\n${mem.changes || 'None'}`;
      }
    } catch {}
    return '';
  };

  const saveProjectMemory = async (summary: string) => {
    if (!workspacePath) return;
    const memoryPath = workspacePath + '/.agent_memory.json';
    let mem = { stack: 'Next.js + Monaco Web IDE', decisions: 'Groq Multi-Agent system integrated', changes: '' };
    try {
      const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(memoryPath)}`);
      if (res.ok) {
        const data = await res.json();
        mem = JSON.parse(data.content);
      }
    } catch {}
    mem.changes = (mem.changes ? mem.changes + '\n' : '') + `- ${summary} (${new Date().toLocaleDateString()})`;
    try {
      await fetch('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: memoryPath, content: JSON.stringify(mem, null, 2) })
      });
    } catch {}
  };

  // Git Branch checkout
  const initGitBranch = async (goal: string) => {
    if (!workspacePath) return;
    const taskSlug = goal.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 22);
    const branchName = `ai-change/${taskSlug}-${Math.floor(100 + Math.random() * 900)}`;
    try {
      const res = await fetch('/api/workspace/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: workspacePath, command: `git checkout -b ${branchName}` })
      });
      if (res.ok) {
        setGitBranchName(branchName);
      }
    } catch {}
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
      currentGoalRef.current = userText;
      runArchitectWorkflow(userText, assistantMsgId);
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
    setActiveAgent(null);
    setAgentPhase('idle');
    setCurrentActivity(null);
    setPermissionRequest(null);
    updateLastChatMessage('', false);
  };

  const resolvePath = (p: string) => {
    if (!workspacePath) return p;
    const clean = p.replace(/\\/g, '/');
    const ws = workspacePath.replace(/\\/g, '/');
    return clean.startsWith(ws) || clean.startsWith('/') || clean.includes(':') ? clean : `${ws}/${clean}`;
  };

  // ==========================================
  // 1. Architect Agent Workflow
  // ==========================================
  const runArchitectWorkflow = async (userGoal: string, assistantMsgId: string) => {
    clearAgentTasks();
    setSecurityReport(null);
    setGitBranchName(null);
    setProposedPlan(null);
    setActiveAgent('architect');
    setAgentPhase('planning');
    setCurrentActivity('Analyzing codebase and designing implementation plan...');
    setAgentProgress(20);

    const memoryContext = await loadProjectMemory();

    const ARCHITECT_SYSTEM_PROMPT = `You are a Senior Software Architect. Your job is to analyze the user's request, examine the workspace context, and construct a detailed implementation plan.
You must NEVER write or modify files, run command operations, or perform deletions.
You CAN read files, search project, or get compile diagnostics if needed.

Your response must contain a detailed Markdown plan:
# PROJECT ANALYSIS
Current architecture: (brief explanation)
Problem identified: (summary)
Recommended solution: (details)
Implementation steps: (step-by-step)
Files affected: (list paths)
Database/API/Dependency changes: (outline)
Estimated complexity & risks: (summary)

End your response with EXACTLY this line:
WAITING FOR USER APPROVAL${memoryContext}`;

    let history = [
      { role: 'system', content: ARCHITECT_SYSTEM_PROMPT },
      { role: 'user', content: userGoal }
    ];

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          systemPrompt: ARCHITECT_SYSTEM_PROMPT,
          customApiKey: settings.apiKey,
          model: settings.aiModel
        })
      });

      if (!response.ok) throw new Error('Architect agent request failed');

      let accumulated = '';
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

      // Parse planning actions if any (though Architect shouldn't make code edits)
      const actionRegex = /<action\s+type="([^"]+)"(?:\s+path="([^"]+)")?(?:\s+command="([^"]+)")?(?:\s+query="([^"]+)")?>([\s\S]*?)<\/action>/g;
      const actions = [];
      let match;
      while ((match = actionRegex.exec(accumulated)) !== null) {
        actions.push({ type: match[1], path: match[2] || '', command: match[3] || '', query: match[4] || '', content: match[5] || '' });
      }

      // Execute read-only actions
      if (actions.length > 0) {
        const results = [];
        for (const action of actions) {
          if (['write_file', 'delete_file', 'run_command'].includes(action.type)) {
            results.push(`<action_result type="${action.type}">Error: Architect is not permitted to modify files or run terminal commands.</action_result>`);
            continue;
          }
          const taskId = Math.random().toString();
          addAgentTask({ id: taskId, type: getTaskType(action.type), description: `Architect: ${action.type}`, status: 'running' });
          try {
            const outcome = await executeAction(action);
            updateAgentTaskStatus(taskId, 'completed', outcome.slice(0, 400));
            results.push(`<action_result type="${action.type}">\n${outcome}\n</action_result>`);
          } catch (e: any) {
            updateAgentTaskStatus(taskId, 'failed', e.message);
            results.push(`<action_result type="${action.type}">\nError: ${e.message}\n</action_result>`);
          }
        }
        history.push({ role: 'assistant', content: accumulated });
        history.push({ role: 'user', content: results.join('\n\n') });

        // Generate final plan
        addChatMessage({ id: Math.random().toString(), role: 'assistant', content: '', timestamp: new Date(), isStreaming: true });
        // Recurse to let architect finish plan
        runArchitectWorkflow(userGoal, assistantMsgId);
        return;
      }

      setProposedPlan(accumulated);
      setAgentPhase('approval_required');
      setActiveAgent(null);
      setCurrentActivity(null);
      setAiGenerating(false);

    } catch (e: any) {
      updateLastChatMessage(`⚠️ Architect Error: ${e.message}`, false);
      setAiGenerating(false);
      setAgentPhase('failed');
    }
  };

  // ==========================================
  // 2. Developer Agent Workflow
  // ==========================================
  const approvePlanAndDevelop = async () => {
    if (!proposedPlan) return;
    setAgentPhase('development');
    setActiveAgent('developer');
    setAiGenerating(true);
    setCurrentActivity('Initializing Git checkout branch...');
    setAgentProgress(10);

    const goal = currentGoalRef.current;
    await initGitBranch(goal);

    setCurrentActivity('Starting code modifications based on approved plan...');
    setAgentProgress(25);

    const DEVELOPER_SYSTEM_PROMPT = `You are a Senior Full-Stack Developer. Your goal is to implement the approved Architect Plan.
Read existing files fully before editing, maintain existing code architecture, and implement minimal clean changes.

To make changes, output XML action blocks:
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
- You must write the ENTIRE file content inside the write_file content.
- Git branch has already been initialized. Write code and check build status.
- Once implementation is complete, output a detailed summary of changes. Do not output any more action blocks.`;

    let history = [
      { role: 'system', content: DEVELOPER_SYSTEM_PROMPT },
      { role: 'user', content: `APPROVED PLAN:\n${proposedPlan}\n\nGOAL: Please implement this plan.` }
    ];

    const MAX_LOOPS = 15;
    let loop = 0;

    const runDevLoop = async () => {
      while (loop < MAX_LOOPS) {
        loop++;
        setAgentLoopCount(loop);
        setAgentProgress(Math.min(25 + loop * 5, 80));

        // Prepare new chat bubble for Developer
        const devMsgId = Math.random().toString();
        addChatMessage({ id: devMsgId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true });

        try {
          const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: history,
              systemPrompt: DEVELOPER_SYSTEM_PROMPT,
              customApiKey: settings.apiKey,
              model: settings.aiModel
            })
          });

          if (!response.ok) throw new Error('Developer fetch failed');

          let accumulated = '';
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

          const actionRegex = /<action\s+type="([^"]+)"(?:\s+path="([^"]+)")?(?:\s+command="([^"]+)")?(?:\s+query="([^"]+)")?>([\s\S]*?)<\/action>/g;
          const actions = [];
          let match;
          while ((match = actionRegex.exec(accumulated)) !== null) {
            actions.push({ type: match[1], path: match[2] || '', command: match[3] || '', query: match[4] || '', content: match[5] || '' });
          }

          if (actions.length === 0) {
            // Developer completed coding tasks
            history.push({ role: 'assistant', content: accumulated });
            break;
          }

          history.push({ role: 'assistant', content: accumulated });
          const results = [];

          for (const action of actions) {
            const taskId = Math.random().toString();
            const label = action.path || action.command || action.query || action.type;
            addAgentTask({ id: taskId, type: getTaskType(action.type), description: `Dev: ${action.type}: ${label}`, status: 'running' });
            setCurrentActivity(`Developer: Executing ${action.type} (${label})`);

            // Permission Verification (Level 3 - System operations require human confirmation)
            const isLevel3 = ['run_command', 'delete_file'].includes(action.type);
            let outcome = '';

            try {
              if (isLevel3) {
                const allowed = await requestHumanPermission(action.type, label);
                if (!allowed) {
                  updateAgentTaskStatus(taskId, 'failed', 'Permission Denied');
                  outcome = `Error: User denied execution permission for ${action.type} on: ${label}`;
                  results.push(`<action_result type="${action.type}">\n${outcome}\n</action_result>`);
                  continue;
                }
              }

              outcome = await executeAction(action);
              updateAgentTaskStatus(taskId, 'completed', outcome.slice(0, 400));
            } catch (e: any) {
              updateAgentTaskStatus(taskId, 'failed', e.message);
              outcome = `Error: ${e.message}`;
            }

            results.push(`<action_result type="${action.type}">\n${outcome}\n</action_result>`);
          }

          history.push({ role: 'user', content: results.join('\n\n') });

        } catch (e: any) {
          updateLastChatMessage(`⚠️ Developer Error: ${e.message}`, false);
          break;
        }
      }

      setAgentProgress(85);
      runSecurityWorkflow(history);
    };

    runDevLoop();
  };

  // Interactive Permission Prompter
  const requestHumanPermission = (type: string, label: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setPermissionRequest({
        id: Math.random().toString(),
        type,
        label: `${type === 'delete_file' ? 'Delete File' : 'Execute Command'}: ${label}`,
        resolve: (allowed: boolean) => {
          setPermissionRequest(null);
          resolve(allowed);
        }
      });
    });
  };

  // ==========================================
  // 3. Security & QA Agent Workflow
  // ==========================================
  const runSecurityWorkflow = async (devHistory: any[]) => {
    setAgentPhase('reviewing');
    setActiveAgent('security');
    setCurrentActivity('Security & QA Agent: Reviewing code and checking compile metrics...');
    setAgentProgress(90);

    const securityMsgId = Math.random().toString();
    addChatMessage({ id: securityMsgId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true });

    const SECURITY_SYSTEM_PROMPT = `You are a Senior Security & QA Engineer. Your role is to inspect all implemented code modifications from the developer.
Review code quality, error handling, performance issues, and search for standard backend/frontend security vulnerabilities (SQLi, XSS, exposed variables, open permissions).
You can run get_diagnostics to audit compile status.

Your response must strictly conclude with this exact visual scorecard:

# SECURITY REPORT
Critical Issues: (details or None)
Medium Issues: (details or None)
Low Issues: (details or None)

# TEST RESULTS
Passed: (details or None)
Failed: (details or None)

# CODE QUALITY SCORE
Performance: X/10
Security: Y/10
Maintainability: Z/10

FINAL STATUS: APPROVED or NEEDS FIXES`;

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: devHistory,
          systemPrompt: SECURITY_SYSTEM_PROMPT,
          customApiKey: settings.apiKey,
          model: settings.aiModel
        })
      });

      if (!response.ok) throw new Error('Security check failed');

      let accumulated = '';
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

      // Parse Scorecard metrics
      const perfMatch = accumulated.match(/Performance:\s*(\d+)\/10/);
      const secMatch = accumulated.match(/Security:\s*(\d+)\/10/);
      const maintMatch = accumulated.match(/Maintainability:\s*(\d+)\/10/);
      const statusMatch = accumulated.match(/FINAL STATUS:\s*(APPROVED|NEEDS FIXES)/);

      const performance = perfMatch ? parseInt(perfMatch[1]) : 8;
      const security = secMatch ? parseInt(secMatch[1]) : 9;
      const maintainability = maintMatch ? parseInt(maintMatch[1]) : 8;
      const status = statusMatch ? statusMatch[1] as 'APPROVED' | 'NEEDS FIXES' : 'APPROVED';

      setSecurityReport({
        performance,
        security,
        maintainability,
        status,
        content: accumulated.split('# SECURITY REPORT').pop() || accumulated
      });

      setAgentProgress(100);
      setAgentPhase(status === 'APPROVED' ? 'completed' : 'failed');
      setActiveAgent(null);
      setCurrentActivity(null);
      setAiGenerating(false);

      if (status === 'APPROVED') {
        await saveProjectMemory(`Implemented task: ${currentGoalRef.current}. Security: ${security}/10. Performance: ${performance}/10.`);
      }

      // Auto-save session
      if (chatMessages.length > 0) saveCurrentSession();

    } catch (e: any) {
      updateLastChatMessage(`⚠️ Security QA Error: ${e.message}`, false);
      setAiGenerating(false);
      setAgentPhase('failed');
    }
  };


  async function executeAction(action: any): Promise<string> {
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
  }

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
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border transition-all ${
              isAgentMode
                ? 'bg-violet-600/25 border-violet-500/40 text-violet-300 shadow-[0_0_8px_rgba(124,58,237,0.2)]'
                : 'bg-transparent border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20'
            }`}
          >
            <Zap className="w-2.5 h-2.5" />
            Agent Team
          </button>
        </div>

        <div className="flex items-center gap-1.5">
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
            onClick={() => { saveCurrentSession(); clearChat(); clearAgentTasks(); setSecurityReport(null); setGitBranchName(null); setProposedPlan(null); setAgentPhase('idle'); }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-200 border border-transparent hover:border-white/5 transition-all"
            title="New chat"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Clear */}
          <button
            onClick={() => { clearChat(); clearAgentTasks(); setSecurityReport(null); setGitBranchName(null); setProposedPlan(null); setAgentPhase('idle'); }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-rose-400 border border-transparent hover:border-white/5 transition-all"
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Multi-Agent Stepper Pipeline */}
      {agentPhase !== 'idle' && (
        <div className="px-4 py-2 bg-[#131316]/90 backdrop-blur-sm border-b border-white/[0.04] flex items-center justify-between gap-1 select-none shrink-0">
          <StepItem label="Architect" status={
            agentPhase === 'planning' ? 'active' :
            ['approval_required', 'development', 'reviewing', 'completed'].includes(agentPhase) ? 'completed' : 'pending'
          } />
          <div className="h-[1px] flex-1 bg-white/10" />
          <StepItem label="Developer" status={
            agentPhase === 'development' ? 'active' :
            ['reviewing', 'completed'].includes(agentPhase) ? 'completed' : 'pending'
          } />
          <div className="h-[1px] flex-1 bg-white/10" />
          <StepItem label="Security & QA" status={
            agentPhase === 'reviewing' ? 'active' :
            agentPhase === 'completed' ? 'completed' : 'pending'
          } />
        </div>
      )}

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

      {/* Visual Scorecard / Security Report Display */}
      {securityReport && (
        <div className="m-3 p-4 bg-[#131316] border border-white/[0.06] rounded-2xl flex flex-col gap-3 shadow-lg shrink-0 fade-in-up">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
            <span className="text-[10.5px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <GitCompare className="w-3.5 h-3.5 text-violet-400" />
              QA & Security Audit
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              securityReport.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {securityReport.status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 py-1 select-none">
            <ScoreCircle label="Security" score={securityReport.security} color="text-emerald-400" />
            <ScoreCircle label="Performance" score={securityReport.performance} color="text-blue-400" />
            <ScoreCircle label="Quality" score={securityReport.maintainability} color="text-violet-400" />
          </div>

          <div className="text-[10.5px] text-zinc-500 bg-black/20 p-2.5 rounded-xl border border-white/[0.02] max-h-24 overflow-y-auto font-mono whitespace-pre-wrap">
            {securityReport.content}
          </div>
        </div>
      )}

      {/* Permission Request Dialog Banner */}
      {permissionRequest && (
        <div className="m-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col gap-3 shadow-lg shrink-0 fade-in-up">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[11.5px] font-bold text-white">System Permission Request</h4>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed font-mono mt-1 bg-black/30 p-1.5 rounded border border-white/5">
                {permissionRequest.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => permissionRequest.resolve(false)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-[11px] transition-colors cursor-pointer"
            >
              Deny
            </button>
            <button
              onClick={() => permissionRequest.resolve(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Allow Execution
            </button>
          </div>
        </div>
      )}

      {/* Architect Plan Review Card */}
      {agentPhase === 'approval_required' && proposedPlan && (
        <div className="m-3 p-4 bg-violet-600/10 border border-violet-500/25 rounded-2xl flex flex-col gap-3 shadow-lg shrink-0 fade-in-up">
          <div>
            <h4 className="text-[12px] font-bold text-white mb-1">Architecture Plan Complete</h4>
            <p className="text-[10.5px] text-zinc-400 leading-relaxed">
              The Architect Agent has generated an implementation plan. Review the plan above before proceeding to development.
            </p>
          </div>
          {gitBranchName && (
            <div className="text-[9.5px] text-zinc-500 font-mono">
              Branch target: {gitBranchName}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={approvePlanAndDevelop}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[11.5px] font-medium shadow-[0_0_12px_rgba(124,58,237,0.3)] transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approve & Develop
            </button>
            <button
              onClick={() => {
                setAgentPhase('idle');
                setActiveAgent(null);
                setProposedPlan(null);
              }}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-[11.5px] border border-white/5 transition-colors cursor-pointer"
            >
              Request Revision
            </button>
          </div>
        </div>
      )}

      {/* Active Agent Activity Panel */}
      {currentActivity && (
        <div className="m-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl flex flex-col gap-2 shadow-sm fade-in-up shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-semibold text-zinc-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
              {activeAgent === 'architect' ? 'Architect Agent' :
               activeAgent === 'developer' ? 'Developer Agent' : 'Security & QA Agent'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">{agentProgress}%</span>
          </div>
          <span className="text-[11px] text-zinc-400 truncate font-mono bg-black/20 px-2 py-1 rounded border border-white/[0.02]">
            {currentActivity}
          </span>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]"
              initial={{ width: 0 }}
              animate={{ width: `${agentProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-3 pb-3 pt-2 border-t border-white/[0.05] bg-[#0c0c0f]/60 shrink-0">
        
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
                <FileCode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">{f.replace(workspacePath || '', '').replace(/^\//, '')}</span>
              </button>
            ))}
          </motion.div>
        )}

        {/* Unified Input Card */}
        <form onSubmit={handleSend} className="relative flex flex-col bg-[#17171b] border border-white/[0.07] focus-within:border-violet-500/40 rounded-3xl overflow-hidden p-2 shadow-lg transition-all">
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
            placeholder={isAgentMode ? 'Give the agent team a task… (e.g. "add error handling to file X")' : 'Ask anything… type @ to mention a file'}
            rows={1}
            className="w-full bg-transparent text-[12.5px] text-zinc-100 placeholder-zinc-500 outline-none resize-none leading-relaxed px-3 pt-2 pb-1 select-text"
            style={{ maxHeight: '140px', overflowY: 'auto' }}
          />

          {/* Controls Bar Row */}
          <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5 border-t border-white/[0.03]">
            <div className="flex items-center gap-2">
              {/* Attachment Context Plus Button */}
              <button
                type="button"
                onClick={() => {
                  if (settings.contextInjectionEnabled) {
                    updateSettings({ contextInjectionEnabled: false });
                    setContextFile(null);
                  } else {
                    updateSettings({ contextInjectionEnabled: true });
                    setContextFile(activeFile);
                  }
                }}
                title={settings.contextInjectionEnabled ? `Context: ${contextFile?.split('/').pop()}` : 'Add active file context'}
                className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
                  settings.contextInjectionEnabled
                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {/* Context active pill */}
              {settings.contextInjectionEnabled && contextFile && (
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 shrink-0">
                  <Paperclip className="w-2.5 h-2.5" />
                  <span className="max-w-[70px] truncate">{contextFile.split('/').pop()}</span>
                  <button
                    type="button"
                    onClick={() => { setContextFile(null); updateSettings({ contextInjectionEnabled: false }); }}
                    className="hover:text-rose-400 transition-colors"
                  >
                    <XCircle className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              {/* Model Picker Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelPicker(p => !p)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] bg-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-all font-medium"
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
                        type="button"
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

              {/* Agent mode pill badge */}
              {isAgentMode && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-600/15 border border-violet-500/30 text-violet-300 font-semibold tracking-wide shadow-[0_0_8px_rgba(124,58,237,0.15)]">
                  Agent Team
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Mic Icon (design ornament) */}
              <button
                type="button"
                className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors hover:bg-white/5 rounded-full flex items-center justify-center"
                title="Voice Input (design only)"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              {/* Send/Stop Button */}
              {isAiGenerating ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="w-7.5 h-7.5 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-full text-rose-400 cursor-pointer transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="w-7.5 h-7.5 flex items-center justify-center bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-full text-white transition-all hover:shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                >
                  <svg className="w-3.5 h-3.5 transform rotate-45 -translate-x-px translate-y-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </form>
        <p className="text-center text-[9px] text-zinc-700 mt-1.5 select-none">
          Enter to send · Shift+Enter for new line · @ to mention file
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function StepItem({ label, status }: { label: string; status: 'active' | 'completed' | 'pending' }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8.5px] font-bold transition-all ${
        status === 'completed' ? 'bg-emerald-500 text-white' :
        status === 'active' ? 'bg-violet-600 text-white animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.5)]' :
        'bg-zinc-800 text-zinc-500'
      }`}>
        {status === 'completed' ? '✓' : ''}
      </div>
      <span className={`text-[10px] font-medium transition-colors ${
        status === 'active' ? 'text-zinc-200 font-semibold' :
        status === 'completed' ? 'text-zinc-400' : 'text-zinc-600'
      }`}>{label}</span>
    </div>
  );
}

function ScoreCircle({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-2 bg-white/[0.01] border border-white/[0.03] rounded-xl flex-1">
      <span className="text-[9.5px] text-zinc-500 font-medium">{label}</span>
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
          <circle cx="20" cy="20" r="16" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
          <circle cx="20" cy="20" r="16" fill="transparent" stroke="currentColor" strokeWidth="3" 
            strokeDasharray={2 * Math.PI * 16}
            strokeDashoffset={2 * Math.PI * 16 * (1 - score / 10)}
            className={color}
          />
        </svg>
        <span className="text-[11px] font-extrabold text-white font-mono">{score}</span>
      </div>
    </div>
  );
}

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
        {isAgentMode ? 'Agent Team Workspace' : 'AI Assistant'}
      </h3>
      <p className="text-[11.5px] text-zinc-600 max-w-[220px] leading-relaxed">
        {isAgentMode
          ? 'An autonomous software engineering team (Architect, Developer, Security & QA) will analyze, code, and review your tasks.'
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
      className={`flex flex-col ${isUser ? 'items-end self-end max-w-[85%]' : 'items-start self-start w-full'}`}
    >
      {isUser ? (
        <div className="rounded-[22px] px-4.5 py-2.5 text-[12.5px] bg-[#242429] border border-white/[0.05] text-zinc-100 whitespace-pre-wrap leading-relaxed select-text shadow-sm">
          {msg.content}
        </div>
      ) : (
        <div className="text-[12.5px] w-full text-zinc-200 leading-relaxed pr-2 select-text">
          <MarkdownRenderer content={msg.content} onApplyCode={handleApply} />
          {msg.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-violet-400 rounded-sm animate-pulse ml-1 align-middle" />
          )}
        </div>
      )}
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
