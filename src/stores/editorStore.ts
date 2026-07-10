import { create } from 'zustand';
import { FileNode, TerminalTab, ChatMessage, AiAgentTask, EditorSettings, ChatSession, DiffPreview } from '../types';

interface EditorState {
  // Workspace Path
  workspacePath: string | null;
  setWorkspacePath: (path: string | null) => void;
  
  // File System Tree
  fileTree: FileNode[];
  setFileTree: (tree: FileNode[]) => void;
  expandedPaths: Set<string>;
  toggleExpandedPath: (path: string) => void;
  setExpandedPaths: (paths: Set<string>) => void;
  
  // File Tabs
  activeFile: string | null;
  setActiveFile: (path: string | null) => void;
  openTabs: string[];
  openTab: (path: string) => void;
  closeTab: (path: string) => void;
  closeAllTabs: () => void;
  
  // Unsaved files
  unsavedFiles: Set<string>;
  setFileUnsaved: (path: string, isUnsaved: boolean) => void;
  
  // Layout Panels
  activeSidebarTab: 'explorer' | 'search' | 'git' | 'ai' | 'settings';
  setActiveSidebarTab: (tab: 'explorer' | 'search' | 'git' | 'ai' | 'settings') => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isBottomCollapsed: boolean;
  setBottomCollapsed: (collapsed: boolean) => void;
  activeBottomTab: 'terminal' | 'problems' | 'output' | 'aiLogs';
  setActiveBottomTab: (tab: 'terminal' | 'problems' | 'output' | 'aiLogs') => void;
  isAiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;
  
  // Panel dimensions (percentage/pixels)
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  bottomHeight: number;
  setBottomHeight: (height: number) => void;
  aiPanelWidth: number;
  setAiPanelWidth: (width: number) => void;
  
  // Terminal tabs
  terminalTabs: TerminalTab[];
  activeTerminalId: string | null;
  addTerminalTab: (name?: string) => void;
  removeTerminalTab: (id: string) => void;
  setActiveTerminalId: (id: string | null) => void;
  
  // Settings
  settings: EditorSettings;
  updateSettings: (settings: Partial<EditorSettings>) => void;
  
  // AI Chat & Agent
  chatMessages: ChatMessage[];
  isAiGenerating: boolean;
  setAiGenerating: (generating: boolean) => void;
  addChatMessage: (msg: ChatMessage) => void;
  updateLastChatMessage: (content: string, isStreaming?: boolean) => void;
  clearChat: () => void;
  
  // AI Agent timeline tasks
  agentTasks: AiAgentTask[];
  addAgentTask: (task: AiAgentTask) => void;
  updateAgentTaskStatus: (id: string, status: AiAgentTask['status'], output?: string) => void;
  clearAgentTasks: () => void;

  // Chat Sessions (persistent history)
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  saveCurrentSession: (title?: string) => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;

  // Diff Preview state
  diffPreview: DiffPreview | null;
  setDiffPreview: (diff: DiffPreview | null) => void;

  // Inline completion ghost text
  inlineCompletionText: string | null;
  setInlineCompletionText: (text: string | null) => void;
  
  // Git
  gitBranch: string;
  setGitBranch: (branch: string) => void;

  // Active file content cache (for context injection)
  activeFileContent: string;
  setActiveFileContent: (content: string) => void;
}

const DEFAULT_SETTINGS: EditorSettings = {
  theme: 'vs-dark',
  fontSize: 13,
  tabSize: 2,
  wordWrap: 'on',
  minimap: true,
  autosave: true,
  aiModel: 'llama-3.3-70b-versatile',
  systemPrompt: 'You are an advanced software engineering assistant integrated directly into a web IDE. Write clean, production-ready code.',
  apiKey: '',
  inlineCompletionsEnabled: true,
  contextInjectionEnabled: false,
};

const SESSIONS_KEY = 'firstdeploy_chat_sessions';

function loadSessionsFromStorage(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((s: any) => ({
      ...s,
      updatedAt: new Date(s.updatedAt),
      messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
    }));
  } catch {
    return [];
  }
}

function saveSessionsToStorage(sessions: ChatSession[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {}
}

export const useEditorStore = create<EditorState>((set, get) => ({
  workspacePath: null,
  setWorkspacePath: (path) => set({ workspacePath: path }),
  
  fileTree: [],
  setFileTree: (tree) => set({ fileTree: tree }),
  expandedPaths: new Set<string>(),
  toggleExpandedPath: (path) => set((state) => {
    const next = new Set(state.expandedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    return { expandedPaths: next };
  }),
  setExpandedPaths: (paths) => set({ expandedPaths: paths }),
  
  activeFile: null,
  setActiveFile: (path) => set((state) => {
    if (!path) return { activeFile: null };
    const nextTabs = state.openTabs.includes(path) 
      ? state.openTabs 
      : [...state.openTabs, path];
    return { activeFile: path, openTabs: nextTabs };
  }),
  openTabs: [],
  openTab: (path) => set((state) => {
    const exists = state.openTabs.includes(path);
    const nextTabs = exists ? state.openTabs : [...state.openTabs, path];
    return { openTabs: nextTabs, activeFile: path };
  }),
  closeTab: (path) => set((state) => {
    const nextTabs = state.openTabs.filter((t) => t !== path);
    let nextActive = state.activeFile;
    if (state.activeFile === path) {
      nextActive = nextTabs.length > 0 ? nextTabs[nextTabs.length - 1] : null;
    }
    return { openTabs: nextTabs, activeFile: nextActive };
  }),
  closeAllTabs: () => set({ openTabs: [], activeFile: null }),
  
  unsavedFiles: new Set<string>(),
  setFileUnsaved: (path, isUnsaved) => set((state) => {
    const next = new Set(state.unsavedFiles);
    if (isUnsaved) {
      next.add(path);
    } else {
      next.delete(path);
    }
    return { unsavedFiles: next };
  }),
  
  activeSidebarTab: 'explorer',
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab, isSidebarCollapsed: false }),
  isSettingsOpen: false,
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  isSidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  isBottomCollapsed: false,
  setBottomCollapsed: (collapsed) => set({ isBottomCollapsed: collapsed }),
  activeBottomTab: 'terminal',
  setActiveBottomTab: (tab) => set((state) => ({
    activeBottomTab: tab,
    isBottomCollapsed: state.activeBottomTab === tab && !state.isBottomCollapsed ? true : false
  })),
  isAiPanelOpen: true,
  setAiPanelOpen: (open) => set({ isAiPanelOpen: open }),
  
  sidebarWidth: 260,
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(width, 500)) }),
  bottomHeight: 280,
  setBottomHeight: (height) => set({ bottomHeight: Math.max(150, Math.min(height, 600)) }),
  aiPanelWidth: 340,
  setAiPanelWidth: (width) => set({ aiPanelWidth: Math.max(280, Math.min(width, 680)) }),
  
  terminalTabs: [],
  activeTerminalId: null,
  addTerminalTab: (name) => set((state) => {
    const id = Math.random().toString(36).substring(7);
    const newTab: TerminalTab = {
      id,
      name: name || `terminal-${state.terminalTabs.length + 1}`,
      path: state.workspacePath || ''
    };
    return {
      terminalTabs: [...state.terminalTabs, newTab],
      activeTerminalId: id,
      isBottomCollapsed: false,
      activeBottomTab: 'terminal'
    };
  }),
  removeTerminalTab: (id) => set((state) => {
    const nextTabs = state.terminalTabs.filter((t) => t.id !== id);
    let nextActive = state.activeTerminalId;
    if (state.activeTerminalId === id) {
      nextActive = nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null;
    }
    return { terminalTabs: nextTabs, activeTerminalId: nextActive };
  }),
  setActiveTerminalId: (id) => set({ activeTerminalId: id }),
  
  settings: DEFAULT_SETTINGS,
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),
  
  chatMessages: [],
  isAiGenerating: false,
  setAiGenerating: (generating) => set({ isAiGenerating: generating }),
  addChatMessage: (msg) => set((state) => ({
    chatMessages: [...state.chatMessages, msg]
  })),
  updateLastChatMessage: (content, isStreaming = false) => set((state) => {
    if (state.chatMessages.length === 0) return {};
    const nextMsg = [...state.chatMessages];
    const last = nextMsg[nextMsg.length - 1];
    nextMsg[nextMsg.length - 1] = {
      ...last,
      content: isStreaming ? (last.content + content) : (content || last.content),
      isStreaming
    };
    return { chatMessages: nextMsg };
  }),
  clearChat: () => set({ chatMessages: [], agentTasks: [] }),
  
  agentTasks: [],
  addAgentTask: (task) => set((state) => ({
    agentTasks: [...state.agentTasks, task]
  })),
  updateAgentTaskStatus: (id, status, output) => set((state) => ({
    agentTasks: state.agentTasks.map((t) =>
      t.id === id ? { ...t, status, output: output !== undefined ? output : t.output } : t
    )
  })),
  clearAgentTasks: () => set({ agentTasks: [] }),

  // Chat Sessions
  chatSessions: [],
  activeChatSessionId: null,
  saveCurrentSession: (title) => set((state) => {
    if (state.chatMessages.length === 0) return {};
    const existing = state.chatSessions.find(s => s.id === state.activeChatSessionId);
    const sessionTitle = title || (state.chatMessages[0]?.content?.slice(0, 40) + '…') || 'Chat';
    if (existing) {
      const updated = state.chatSessions.map(s => s.id === existing.id 
        ? { ...s, messages: state.chatMessages, updatedAt: new Date(), title: title || s.title }
        : s
      );
      saveSessionsToStorage(updated);
      return { chatSessions: updated };
    }
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: sessionTitle,
      messages: state.chatMessages,
      updatedAt: new Date()
    };
    const next = [newSession, ...state.chatSessions].slice(0, 30);
    saveSessionsToStorage(next);
    return { chatSessions: next, activeChatSessionId: newSession.id };
  }),
  loadSession: (sessionId) => set((state) => {
    const session = state.chatSessions.find(s => s.id === sessionId);
    if (!session) return {};
    return { chatMessages: session.messages, activeChatSessionId: sessionId, agentTasks: [] };
  }),
  deleteSession: (sessionId) => set((state) => {
    const next = state.chatSessions.filter(s => s.id !== sessionId);
    saveSessionsToStorage(next);
    return { 
      chatSessions: next,
      activeChatSessionId: state.activeChatSessionId === sessionId ? null : state.activeChatSessionId
    };
  }),

  // Diff Preview
  diffPreview: null,
  setDiffPreview: (diff) => set({ diffPreview: diff }),

  // Inline completion
  inlineCompletionText: null,
  setInlineCompletionText: (text) => set({ inlineCompletionText: text }),
  
  gitBranch: 'main',
  setGitBranch: (branch) => set({ gitBranch: branch }),

  activeFileContent: '',
  setActiveFileContent: (content) => set({ activeFileContent: content }),
}));
