'use client';

import React from 'react';
import {
  GitBranch, Terminal, CheckCircle2, AlertCircle, AlertTriangle,
  Sparkles, RefreshCw, Zap, Cpu
} from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { useGitStatus } from '../hooks/useWorkspace';

const EXT_LANGUAGE: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript JSX', js: 'JavaScript', jsx: 'JavaScript JSX',
  json: 'JSON', html: 'HTML', css: 'CSS', scss: 'SCSS', md: 'Markdown', mdx: 'MDX',
  py: 'Python', go: 'Go', rs: 'Rust', java: 'Java', c: 'C', cpp: 'C++', cs: 'C#',
  php: 'PHP', rb: 'Ruby', sh: 'Shell', bash: 'Bash', dockerfile: 'Dockerfile',
  yml: 'YAML', yaml: 'YAML', toml: 'TOML', xml: 'XML', sql: 'SQL',
  graphql: 'GraphQL', prisma: 'Prisma', env: 'Env', tf: 'Terraform', svelte: 'Svelte', vue: 'Vue',
};

const MODEL_SHORT: Record<string, string> = {
  'llama-3.3-70b-versatile':       'Llama 3.3 70B',
  'llama-3.1-8b-instant':          'Llama 3.1 8B',
  'deepseek-r1-distill-llama-70b': 'DeepSeek R1',
  'gemma2-9b-it':                  'Gemma 2 9B',
  'mixtral-8x7b-32768':            'Mixtral 8x7B',
};

export default function StatusBar() {
  const { workspacePath, activeFile, settings, isAiGenerating, updateSettings } = useEditorStore();
  const { data: gitData } = useGitStatus(workspacePath);

  const language = activeFile
    ? (EXT_LANGUAGE[activeFile.split('.').pop()?.toLowerCase() ?? ''] ?? 'Plain Text')
    : 'Plain Text';

  const pendingChanges = gitData?.changes?.length ?? 0;
  const modelLabel = MODEL_SHORT[settings.aiModel] || settings.aiModel?.split('-').slice(0, 3).join(' ') || 'AI';

  return (
    <div className="h-[22px] w-full bg-[#07070a] border-t border-white/[0.05] flex items-center justify-between px-3 text-[10.5px] text-zinc-600 select-none z-50 shrink-0">

      {/* ── Left ── */}
      <div className="flex items-center gap-3">
        {gitData?.isRepository ? (
          <button className="flex items-center gap-1 hover:text-zinc-400 cursor-pointer transition-colors">
            <GitBranch className="w-2.5 h-2.5" />
            <span>{gitData.branch}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/70" />
            <span>No repo</span>
          </div>
        )}

        {gitData?.isRepository && pendingChanges > 0 && (
          <div className="flex items-center gap-1 text-amber-500/70">
            <RefreshCw className="w-2 h-2" style={{ animationDuration: '3s' }} />
            <span>{pendingChanges} change{pendingChanges !== 1 ? 's' : ''}</span>
          </div>
        )}

        <span className="opacity-20">│</span>

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

      {/* ── Right ── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Terminal className="w-2.5 h-2.5 text-violet-500/60" />
          <span>{workspacePath ? 'Ready' : 'No workspace'}</span>
        </div>

        {activeFile && (
          <button className="hover:text-zinc-400 cursor-pointer transition-colors">Ln 1, Col 1</button>
        )}

        <button className="hover:text-zinc-400 cursor-pointer transition-colors">
          Spaces: {settings.tabSize ?? 2}
        </button>

        <button className="hover:text-zinc-400 cursor-pointer transition-colors">UTF-8</button>
        <button className="hover:text-zinc-400 cursor-pointer transition-colors">LF</button>

        <button className="hover:text-white cursor-pointer transition-colors text-zinc-400 font-medium bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-px">
          {language}
        </button>

        <span className="opacity-20">│</span>

        {/* Inline completions toggle */}
        <button
          onClick={() => updateSettings({ inlineCompletionsEnabled: !settings.inlineCompletionsEnabled })}
          title={settings.inlineCompletionsEnabled ? 'Inline AI: ON (click to disable)' : 'Inline AI: OFF (click to enable)'}
          className={`flex items-center gap-1 cursor-pointer transition-colors ${
            settings.inlineCompletionsEnabled ? 'text-violet-400 hover:text-violet-300' : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          <Cpu className="w-2.5 h-2.5" />
          <span>{settings.inlineCompletionsEnabled ? 'Copilot ON' : 'Copilot OFF'}</span>
        </button>

        {/* AI model badge */}
        <div className={`flex items-center gap-1 border-l border-white/[0.06] pl-2.5 transition-colors ${isAiGenerating ? 'text-violet-400' : 'text-zinc-600'}`}>
          {isAiGenerating
            ? <Zap className="w-2.5 h-2.5 animate-pulse" />
            : <Sparkles className="w-2.5 h-2.5" />}
          <span>{isAiGenerating ? 'AI working…' : modelLabel}</span>
        </div>
      </div>
    </div>
  );
}
