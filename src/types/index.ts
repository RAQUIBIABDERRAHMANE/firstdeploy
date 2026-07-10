export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  updatedAt?: string;
  children?: FileNode[];
  isLoaded?: boolean;
}

export interface TerminalTab {
  id: string;
  name: string;
  path: string;
}

export interface GitChange {
  file: string;
  status: string;
  staged: boolean;
  unstaged: boolean;
}

export interface GitStatus {
  isRepository: boolean;
  branch: string;
  changes: GitChange[];
}

export interface SearchResult {
  path: string;
  relative: string;
  line: number;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  agent?: 'architect' | 'developer' | 'security' | null;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: Date;
}

export interface DiffPreview {
  file: string;
  original: string;
  modified: string;
  onAccept: () => void;
  onReject: () => void;
}

export interface AiAgentTask {
  id: string;
  type: 'read' | 'write' | 'delete' | 'search' | 'command' | 'plan' | 'diff' | 'diagnostics';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
}

export interface EditorSettings {
  theme: string;
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off';
  minimap: boolean;
  autosave: boolean;
  aiModel: string;
  systemPrompt: string;
  apiKey: string;
  inlineCompletionsEnabled: boolean;
  contextInjectionEnabled: boolean;
}
