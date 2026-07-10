'use client';

import React, { useState, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { X, File, ChevronRight, Save, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useFileContent, useSaveFile } from '../../hooks/useWorkspace';
import InlineAiToolbar from './InlineAiToolbar';
import InlinePromptBar from './InlinePromptBar';
import { useInlineCompletion } from '../../hooks/useInlineCompletion';

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  json: 'json', html: 'html', css: 'css', scss: 'css', sass: 'css',
  md: 'markdown', mdx: 'markdown', py: 'python', go: 'go', rs: 'rust',
  yaml: 'yaml', yml: 'yaml', dockerfile: 'dockerfile', sh: 'shell', bash: 'shell',
  sql: 'sql', toml: 'ini', prisma: 'prisma', graphql: 'graphql',
  svelte: 'html', vue: 'html', php: 'php', rb: 'ruby', tf: 'hcl',
  env: 'ini', lock: 'ini', xml: 'xml', c: 'c', cpp: 'cpp', cs: 'csharp',
  java: 'java', kt: 'kotlin', swift: 'swift',
};

export default function CodeEditor() {
  const {
    activeFile, openTabs, closeTab, setActiveFile, unsavedFiles, setFileUnsaved,
    settings, setActiveFileContent
  } = useEditorStore();

  const [editorValue, setEditorValue] = useState('');
  const [selectionText, setSelectionText] = useState('');
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [inlinePromptOpen, setInlinePromptOpen] = useState(false);
  const [inlinePromptPos, setInlinePromptPos] = useState<{ top: number; left: number } | null>(null);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: fileData, isLoading, error, refetch } = useFileContent(activeFile);
  const saveMutation = useSaveFile();

  // Wire up inline completions
  useInlineCompletion(editorRef, monacoRef);

  useEffect(() => {
    if (fileData) {
      setEditorValue(fileData.content);
      setActiveFileContent(fileData.content);
      if (activeFile) setFileUnsaved(activeFile, false);
    }
  }, [fileData, activeFile]);

  // Ctrl+S save, Ctrl+K inline prompt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        triggerManualSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openInlinePrompt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, editorValue]);

  const triggerManualSave = () => {
    if (!activeFile) return;
    saveMutation.mutate({ path: activeFile, content: editorValue }, {
      onSuccess: () => setFileUnsaved(activeFile, false)
    });
  };

  const openInlinePrompt = () => {
    if (!editorRef.current || !containerRef.current) return;
    const editor = editorRef.current;
    const position = editor.getPosition();
    if (!position) return;
    const coords = editor.getScrolledVisiblePosition(position);
    if (!coords) return;
    const editorEl = editor.getDomNode();
    const editorRect = editorEl.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    setInlinePromptPos({
      top: editorRect.top - containerRect.top + coords.top + 24,
      left: Math.min(editorRect.left - containerRect.left + coords.left, containerRect.width - 400)
    });
    setInlinePromptOpen(true);
  };

  const handleEditorChange = (value: string | undefined) => {
    const nextVal = value || '';
    setEditorValue(nextVal);
    setActiveFileContent(nextVal);
    if (!activeFile) return;
    setFileUnsaved(activeFile, true);
    if (settings.autosave) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveMutation.mutate({ path: activeFile, content: nextVal }, {
          onSuccess: () => setFileUnsaved(activeFile, false)
        });
      }, 1200);
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme('ide-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc', fontStyle: 'bold' },
        { token: 'string', foreground: '34d399' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'type', foreground: '60a5fa' },
        { token: 'function', foreground: 'a78bfa' },
        { token: 'variable', foreground: 'e2e8f0' },
      ],
      colors: {
        'editor.background': '#111113',
        'editor.foreground': '#e4e4e7',
        'editorLineNumber.foreground': '#3f3f46',
        'editorLineNumber.activeForeground': '#8b5cf6',
        'editor.lineHighlightBackground': '#ffffff04',
        'editor.selectionBackground': '#8b5cf620',
        'editorCursor.foreground': '#8b5cf6',
        'editorBracketMatch.background': '#8b5cf620',
        'editorBracketMatch.border': '#8b5cf650',
        'editorInlayHint.background': '#8b5cf610',
        'editorInlayHint.foreground': '#8b5cf680',
        'editor.findMatchBackground': '#f59e0b30',
        'editor.findMatchHighlightBackground': '#f59e0b20',
        'editorWidget.background': '#17171b',
        'editorWidget.border': '#ffffff10',
        'editorSuggestWidget.background': '#17171b',
        'editorSuggestWidget.border': '#ffffff10',
        'editorSuggestWidget.selectedBackground': '#8b5cf620',
        'input.background': '#0f0f12',
        'input.border': '#ffffff10',
        'scrollbarSlider.background': '#ffffff10',
        'scrollbarSlider.hoverBackground': '#8b5cf630',
        'scrollbarSlider.activeBackground': '#8b5cf650',
      }
    });

    monaco.editor.setTheme('ide-dark');

    // Selection listener for floating AI toolbar
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      const text = editor.getModel()?.getValueInRange(selection) || '';
      if (text.trim().length > 0) {
        setSelectionText(text);
        const endPos = selection.getEndPosition();
        const coords = editor.getScrolledVisiblePosition(endPos);
        if (coords) {
          const rect = editor.getDomNode().getBoundingClientRect();
          setToolbarPos({ x: rect.left + coords.left + 20, y: rect.top + coords.top - 60 });
        }
      } else {
        setToolbarPos(null);
      }
    });

    // Inline completion config
    editor.updateOptions({
      inlineSuggest: { enabled: settings.inlineCompletionsEnabled },
      suggest: { showInlineDetails: true },
    });
  };

  const getEditorLanguage = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const base = filePath.split('/').pop()?.toLowerCase() || '';
    if (base === 'dockerfile') return 'dockerfile';
    if (base === '.env' || base.startsWith('.env')) return 'ini';
    return LANGUAGE_MAP[ext] || 'plaintext';
  };

  const getBreadcrumbs = () => {
    if (!activeFile) return [];
    return activeFile.replace(/\\/g, '/').split('/').filter(Boolean);
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full bg-[#111113] overflow-hidden relative">

      {/* Tab bar */}
      <div className="h-9 w-full bg-[#09090b] border-b border-white/[0.05] flex items-center justify-between overflow-x-auto shrink-0 pr-4">
        <div className="flex items-center h-full">
          {openTabs.map((tabPath) => {
            const isActive = activeFile === tabPath;
            const tabName = tabPath.split('/').pop() || tabPath.split('\\').pop() || 'Untitled';
            const isUnsaved = unsavedFiles.has(tabPath);
            const lang = getEditorLanguage(tabPath);

            return (
              <div
                key={tabPath}
                onClick={() => setActiveFile(tabPath)}
                className={`group h-full flex items-center gap-2 px-4 cursor-pointer text-[12px] border-r border-white/[0.03] transition-all shrink-0 ${
                  isActive
                    ? 'bg-[#111113] text-white border-t-[1.5px] border-t-violet-500'
                    : 'bg-[#09090b] text-zinc-500 hover:text-zinc-200 hover:bg-[#111113]/40'
                }`}
              >
                <File className="w-3 h-3 text-zinc-600 shrink-0" />
                <span className="max-w-[120px] truncate">{tabName}</span>
                <div className="w-4 h-4 flex items-center justify-center relative shrink-0">
                  {isUnsaved && (
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 group-hover:hidden shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tabPath); }}
                    className={`p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors ${
                      isUnsaved ? 'hidden group-hover:flex' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {activeFile && unsavedFiles.has(activeFile) && (
          <button
            onClick={triggerManualSave}
            className="shrink-0 flex items-center gap-1 text-[11px] text-violet-400 hover:text-white border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 rounded px-2 py-0.5 cursor-pointer transition-all"
          >
            <Save className="w-3 h-3" />
            Save
          </button>
        )}
      </div>

      {/* Breadcrumbs */}
      {activeFile && (
        <div className="h-7 border-b border-white/[0.03] bg-[#0f0f12]/60 flex items-center gap-1 px-4 text-[11px] text-zinc-600 shrink-0 overflow-x-auto">
          {getBreadcrumbs().map((crumb, idx, arr) => (
            <React.Fragment key={idx}>
              <span className={idx === arr.length - 1 ? 'text-zinc-300 font-medium' : 'hover:text-zinc-300 cursor-pointer transition-colors'}>
                {crumb}
              </span>
              {idx < arr.length - 1 && <ChevronRight className="w-3 h-3 text-zinc-700 shrink-0" />}
            </React.Fragment>
          ))}
          <span className="ml-auto text-[10px] text-zinc-700 font-mono shrink-0">Ctrl+K to edit with AI</span>
        </div>
      )}

      {/* Monaco editor area */}
      <div className="flex-1 w-full bg-[#111113] relative select-text">
        {!activeFile ? (
          <WelcomeScreen />
        ) : isLoading ? (
          <LoadingScreen name={activeFile.split('/').pop() || ''} />
        ) : error ? (
          <ErrorScreen onRetry={refetch} />
        ) : (
          <MonacoEditor
            height="100%"
            width="100%"
            language={getEditorLanguage(activeFile)}
            value={editorValue}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              fontSize: settings.fontSize,
              tabSize: settings.tabSize,
              wordWrap: settings.wordWrap,
              minimap: { enabled: settings.minimap },
              bracketPairColorization: { enabled: true },
              stickyScroll: { enabled: true },
              fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
              fontLigatures: true,
              lineHeight: 22,
              padding: { top: 14, bottom: 14 },
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              automaticLayout: true,
              glyphMargin: true,
              folding: true,
              renderLineHighlight: 'all',
              lineNumbersMinChars: 4,
              inlineSuggest: { enabled: settings.inlineCompletionsEnabled },
              scrollbar: {
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
                verticalHasArrows: false,
                horizontalHasArrows: false,
              },
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              renderLineHighlightOnlyWhenFocus: false,
            }}
            loading={<LoadingScreen name="editor core" />}
          />
        )}

        {/* Floating selection toolbar */}
        {toolbarPos && (
          <InlineAiToolbar
            selectionText={selectionText}
            position={toolbarPos}
            onClose={() => setToolbarPos(null)}
            editorRef={editorRef}
          />
        )}

        {/* Ctrl+K Inline prompt bar */}
        <InlinePromptBar
          editorRef={editorRef}
          isOpen={inlinePromptOpen}
          onClose={() => setInlinePromptOpen(false)}
          position={inlinePromptPos}
        />
      </div>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center select-none">
      <div className="w-16 h-16 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-5">
        <Sparkles className="w-8 h-8 text-violet-400/60" />
      </div>
      <h2 className="text-[15px] font-bold text-white mb-2">FirstDeploy AI Editor</h2>
      <p className="text-[12.5px] text-zinc-600 max-w-[280px] leading-relaxed">
        Open a file from the explorer to start editing. Press <kbd className="px-1 py-0.5 rounded bg-white/5 text-zinc-400 text-[11px]">Ctrl+K</kbd> to edit with AI.
      </p>
    </div>
  );
}

function LoadingScreen({ name }: { name: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
      <span className="text-[12px] text-zinc-600">Loading {name}…</span>
    </div>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-rose-400 text-center gap-3">
      <AlertCircle className="w-8 h-8" />
      <span className="text-[13px] font-semibold">Failed to read file</span>
      <button
        onClick={onRetry}
        className="px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-white text-[12px] transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
