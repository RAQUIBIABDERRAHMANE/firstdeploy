'use client';

import React from 'react';
import { 
  GitBranch, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { useGitStatus } from '../hooks/useWorkspace';

export default function StatusBar() {
  const { workspacePath, activeFile, settings } = useEditorStore();
  const { data: gitData } = useGitStatus(workspacePath);
  
  // Extract active file extension for language guessing
  let language = 'Plain Text';
  if (activeFile) {
    const ext = activeFile.split('.').pop()?.toLowerCase();
    const mapping: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript JSX',
      js: 'JavaScript',
      jsx: 'JavaScript JSX',
      json: 'JSON',
      html: 'HTML',
      css: 'CSS',
      md: 'Markdown',
      py: 'Python',
      go: 'Go',
      rs: 'Rust',
      dockerfile: 'Dockerfile',
      yml: 'YAML',
      yaml: 'YAML'
    };
    language = mapping[ext || ''] || 'Plain Text';
  }

  // Count fake errors/warnings for visual richness
  const errorCount = 0;
  const warningCount = 0;

  return (
    <div className="h-6 w-full bg-[#09090B] border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between px-3 text-[11px] text-[#A1A1AA] select-none z-50">
      
      {/* Left side: Git branch & Errors */}
      <div className="flex items-center gap-3">
        {/* Branch */}
        {gitData?.isRepository ? (
          <div className="flex items-center gap-1 hover:text-white cursor-pointer transition-colors">
            <GitBranch className="w-3 h-3 text-[#A1A1AA]" />
            <span>{gitData.branch}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>No repository</span>
          </div>
        )}

        {/* Sync changes status indicator */}
        {gitData?.isRepository && gitData.changes.length > 0 && (
          <div className="flex items-center gap-1 text-[#8B5CF6]">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '3s' }} />
            <span>{gitData.changes.length} pending changes</span>
          </div>
        )}

        {/* Diagnostics warnings & errors */}
        <div className="flex items-center gap-2 border-l border-white/5 pl-3">
          <button className="flex items-center gap-0.5 hover:text-rose-400 transition-colors cursor-pointer">
            <AlertCircle className="w-3 h-3 text-rose-500" />
            <span>{errorCount}</span>
          </button>
          <button className="flex items-center gap-0.5 hover:text-amber-400 transition-colors cursor-pointer">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>{warningCount}</span>
          </button>
        </div>
      </div>

      {/* Right side: Editor configuration parameters */}
      <div className="flex items-center gap-4">
        {/* Workspace status */}
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-violet-400" />
          <span className="truncate max-w-[200px] text-white/50">
            {workspacePath ? 'Ready' : 'No workspace'}
          </span>
        </div>

        {/* Line & column indicators */}
        {activeFile && (
          <div className="hover:text-white cursor-pointer transition-colors">
            Ln 1, Col 1
          </div>
        )}

        {/* Tab Size */}
        <div className="hover:text-white cursor-pointer transition-colors">
          Spaces: {settings.tabSize}
        </div>

        {/* Encoding */}
        <div className="hover:text-white cursor-pointer transition-colors">
          UTF-8
        </div>

        {/* Line Ending */}
        <div className="hover:text-white cursor-pointer transition-colors">
          LF
        </div>

        {/* Language */}
        <div className="hover:text-white cursor-pointer transition-colors text-white font-medium bg-white/5 border border-white/5 rounded px-1.5 py-0.5">
          {language}
        </div>

        {/* AI engine */}
        <div className="flex items-center gap-1.5 text-violet-400 border-l border-white/5 pl-3 cursor-pointer hover:text-white transition-colors">
          <Sparkles className="w-3 h-3" />
          <span>AI Active</span>
        </div>
      </div>

    </div>
  );
}
