'use client';

import React from 'react';
import { 
  GitBranch, 
  Terminal,
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Zap
} from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { useGitStatus } from '../hooks/useWorkspace';

const EXT_LANGUAGE: Record<string, string> = {
  ts:         'TypeScript',
  tsx:        'TypeScript JSX',
  js:         'JavaScript',
  jsx:        'JavaScript JSX',
  json:       'JSON',
  html:       'HTML',
  css:        'CSS',
  scss:       'SCSS',
  md:         'Markdown',
  mdx:        'MDX',
  py:         'Python',
  go:         'Go',
  rs:         'Rust',
  java:       'Java',
  c:          'C',
  cpp:        'C++',
  cs:         'C#',
  php:        'PHP',
  rb:         'Ruby',
  sh:         'Shell',
  bash:       'Bash',
  dockerfile: 'Dockerfile',
  yml:        'YAML',
  yaml:       'YAML',
  toml:       'TOML',
  xml:        'XML',
  sql:        'SQL',
  graphql:    'GraphQL',
  prisma:     'Prisma',
  env:        'Env',
};

export default function StatusBar() {
  const { workspacePath, activeFile, settings, isAiGenerating } = useEditorStore();
  const { data: gitData } = useGitStatus(workspacePath);

  const language = activeFile
    ? (EXT_LANGUAGE[activeFile.split('.').pop()?.toLowerCase() ?? ''] ?? 'Plain Text')
    : 'Plain Text';

  const pendingChanges = gitData?.changes?.length ?? 0;

  return (
    <div className="h-[22px] w-full bg-[#07070A] border-t border-[rgba(255,255,255,0.05)] flex items-center justify-between px-3 text-[10.5px] text-[#52525B] select-none z-50 shrink-0">

      {/* ── Left side ── */}
      <div className="flex items-center gap-3">

        {/* Git branch */}
        {gitData?.isRepository ? (
          <button className="flex items-center gap-1 hover:text-[#A1A1AA] cursor-pointer transition-colors">
            <GitBranch className="w-2.5 h-2.5" />
            <span>{gitData.branch}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/70" />
            <span>No repo</span>
          </div>
        )}

        {/* Pending changes badge */}
        {gitData?.isRepository && pendingChanges > 0 && (
          <div className="flex items-center gap-1 text-amber-500/70">
            <RefreshCw className="w-2 h-2" style={{ animationDuration: '3s' }} />
            <span>{pendingChanges} change{pendingChanges !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Divider */}
        <span className="text-white/8">│</span>

        {/* Diagnostics */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-0.5 hover:text-rose-400/80 transition-colors cursor-pointer">
            <AlertCircle className="w-2.5 h-2.5 text-rose-500/60" />
            <span>0</span>
          </button>
          <button className="flex items-center gap-0.5 hover:text-amber-400/80 transition-colors cursor-pointer">
            <AlertTriangle className="w-2.5 h-2.5 text-amber-500/60" />
            <span>0</span>
          </button>
        </div>
      </div>

      {/* ── Right side ── */}
      <div className="flex items-center gap-3">

        {/* Workspace status */}
        <div className="flex items-center gap-1">
          <Terminal className="w-2.5 h-2.5 text-violet-500/60" />
          <span>{workspacePath ? 'Ready' : 'No workspace'}</span>
        </div>

        {/* Cursor position */}
        {activeFile && (
          <button className="hover:text-[#A1A1AA] cursor-pointer transition-colors">
            Ln 1, Col 1
          </button>
        )}

        {/* Tab size */}
        <button className="hover:text-[#A1A1AA] cursor-pointer transition-colors">
          Spaces: {settings.tabSize ?? 2}
        </button>

        {/* Encoding */}
        <button className="hover:text-[#A1A1AA] cursor-pointer transition-colors">
          UTF-8
        </button>

        {/* EOL */}
        <button className="hover:text-[#A1A1AA] cursor-pointer transition-colors">
          LF
        </button>

        {/* Language */}
        <button className="hover:text-white cursor-pointer transition-colors text-[#A1A1AA] font-medium bg-white/4 border border-white/5 rounded px-1.5 py-px">
          {language}
        </button>

        {/* AI status */}
        <div className={`flex items-center gap-1 border-l border-white/6 pl-2.5 ${isAiGenerating ? 'text-violet-400' : 'text-[#52525B]'} transition-colors`}>
          {isAiGenerating ? (
            <Zap className="w-2.5 h-2.5 animate-pulse" />
          ) : (
            <Sparkles className="w-2.5 h-2.5" />
          )}
          <span>{isAiGenerating ? 'AI working…' : 'AI Ready'}</span>
        </div>
      </div>
    </div>
  );
}
