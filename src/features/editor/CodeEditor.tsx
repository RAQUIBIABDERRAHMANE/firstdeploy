'use client';

import React, { useState, useEffect, useRef } from 'react';
import MonacoEditor, { loader } from '@monaco-editor/react';
import { 
  X, 
  File, 
  ChevronRight, 
  Save, 
  Sparkles, 
  Terminal,
  AlertCircle
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useFileContent, useSaveFile } from '../../hooks/useWorkspace';
import InlineAiToolbar from './InlineAiToolbar';

export default function CodeEditor() {
  const { 
    activeFile, 
    openTabs, 
    closeTab, 
    setActiveFile, 
    unsavedFiles, 
    setFileUnsaved,
    settings 
  } = useEditorStore();

  const [editorValue, setEditorValue] = useState('');
  const [selectionText, setSelectionText] = useState('');
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  
  const editorRef = useRef<any>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // Queries
  const { data: fileData, isLoading, error, refetch } = useFileContent(activeFile);
  const saveMutation = useSaveFile();

  // Load file content when activeFile changes
  useEffect(() => {
    if (fileData) {
      setEditorValue(fileData.content);
      // Remove unsaved flag when loading a new file
      if (activeFile) {
        setFileUnsaved(activeFile, false);
      }
    }
  }, [fileData, activeFile, setFileUnsaved]);

  // Handle Ctrl+S keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        triggerManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, editorValue]);

  const triggerManualSave = () => {
    if (!activeFile) return;
    saveMutation.mutate({ path: activeFile, content: editorValue }, {
      onSuccess: () => {
        setFileUnsaved(activeFile, false);
      }
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    const nextVal = value || '';
    setEditorValue(nextVal);

    if (!activeFile) return;
    setFileUnsaved(activeFile, true);

    // Autosave functionality (1 second debounce)
    if (settings.autosave) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveMutation.mutate({ path: activeFile, content: nextVal }, {
          onSuccess: () => {
            setFileUnsaved(activeFile, false);
          }
        });
      }, 1000);
    }
  };

  // Setup custom theme during editor instantiation
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    monaco.editor.defineTheme('ide-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: 'A1A1AA', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C084FC', fontStyle: 'bold' }, // Purple
        { token: 'string', foreground: '34D399' }, // Emerald
        { token: 'number', foreground: 'FBBF24' } // Yellow
      ],
      colors: {
        'editor.background': '#111113',
        'editor.foreground': '#FFFFFF',
        'editorLineNumber.foreground': '#A1A1AA40',
        'editorLineNumber.activeForeground': '#8B5CF6',
        'editor.lineHighlightBackground': '#FFFFFF05',
        'editor.selectionBackground': '#8B5CF625',
        'editorCursor.foreground': '#8B5CF6',
        'editorBracketMatch.background': '#8B5CF625',
        'editorBracketMatch.border': '#8B5CF640'
      }
    });

    monaco.editor.setTheme('ide-dark');

    // Attach selection listener
    editor.onDidChangeCursorSelection((e: any) => {
      const selection = editor.getSelection();
      const text = editor.getModel().getValueInRange(selection);
      
      if (text.trim().length > 0) {
        setSelectionText(text);
        
        // Find screen coordinates for floating bubble positioning
        const endPos = selection.getEndPosition();
        const coords = editor.getScrolledVisiblePosition(endPos);
        
        if (coords) {
          const editorElement = editor.getDomNode();
          const rect = editorElement.getBoundingClientRect();
          
          setToolbarPos({
            x: rect.left + coords.left + 20,
            y: rect.top + coords.top - 60
          });
        }
      } else {
        setToolbarPos(null);
      }
    });
  };

  // Determine monaco language mode by extension
  const getEditorLanguage = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mapping: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      html: 'html',
      css: 'css',
      md: 'markdown',
      py: 'python',
      go: 'go',
      rs: 'rust',
      yaml: 'yaml',
      yml: 'yaml',
      dockerfile: 'dockerfile',
      sh: 'shell'
    };
    return mapping[ext || ''] || 'plaintext';
  };

  // Generate breadcrumb layout paths
  const getBreadcrumbs = () => {
    if (!activeFile) return [];
    // Convert D:\... or /home/... to clean splits
    const clean = activeFile.replace(/\\/g, '/');
    return clean.split('/');
  };

  const activeFileName = activeFile 
    ? activeFile.split('/').pop() || activeFile.split('\\').pop() || 'Untitled' 
    : '';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111113] overflow-hidden select-none">
      
      {/* Editor Tabs list */}
      <div className="h-9 w-full bg-[#09090B] border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between overflow-x-auto select-none shrink-0 pr-4">
        <div className="flex items-center h-full">
          {openTabs.map((tabPath) => {
            const isActive = activeFile === tabPath;
            const tabName = tabPath.split('/').pop() || tabPath.split('\\').pop() || 'Untitled';
            const isUnsaved = unsavedFiles.has(tabPath);

            return (
              <div
                key={tabPath}
                onClick={() => setActiveFile(tabPath)}
                className={`group h-full flex items-center gap-2 px-4 cursor-pointer text-[12px] border-r border-[rgba(255,255,255,0.04)] transition-all ${
                  isActive 
                    ? 'bg-[#111113] text-white border-t-2 border-t-[#8B5CF6]' 
                    : 'bg-[#09090B] text-[#A1A1AA] hover:text-white hover:bg-[#111113]/30'
                }`}
              >
                <File className="w-3.5 h-3.5 text-zinc-500" />
                <span>{tabName}</span>
                
                {/* Unsaved indicator dot / close button */}
                <div className="w-4 h-4 flex items-center justify-center relative">
                  {isUnsaved ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6] group-hover:hidden shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                  ) : null}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tabPath);
                    }}
                    className={`p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-white ${
                      isUnsaved ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sync manual save indicator */}
        {activeFile && unsavedFiles.has(activeFile) && (
          <button 
            onClick={triggerManualSave}
            className="flex items-center gap-1 text-[11px] text-[#8B5CF6] hover:text-white border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 rounded px-2 py-0.5 cursor-pointer"
          >
            <Save className="w-3 h-3" />
            <span>Save pending</span>
          </button>
        )}
      </div>

      {/* Breadcrumbs pathway bar */}
      {activeFile && (
        <div className="h-7 w-full border-b border-[rgba(255,255,255,0.03)] bg-[#111113]/40 flex items-center gap-1.5 px-4 text-[11px] text-[#A1A1AA] shrink-0 font-medium select-none">
          {getBreadcrumbs().map((crumb, idx, arr) => (
            <React.Fragment key={idx}>
              <span className={idx === arr.length - 1 ? 'text-white' : 'hover:text-white cursor-pointer'}>
                {crumb}
              </span>
              {idx < arr.length - 1 && <ChevronRight className="w-3 h-3 text-[#A1A1AA]/40" />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Main Monaco Workspace */}
      <div className="flex-1 w-full bg-[#111113] relative select-text">
        {!activeFile ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#A1A1AA]">
            <Sparkles className="w-12 h-12 text-violet-500/30 mb-3 animate-pulse" />
            <h2 className="text-[14px] font-bold text-white mb-1">FirstDeploy AI Code Editor</h2>
            <p className="text-[12px] text-zinc-500 max-w-[320px]">
              Select a file from the Explorer or search queries in the workspace to begin coding.
            </p>
          </div>
        ) : isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 text-violet-500 animate-spin" />
            <span className="text-[12.5px] text-[#A1A1AA]">Loading {activeFileName}...</span>
          </div>
        ) : error ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-rose-400 text-center gap-2">
            <AlertCircle className="w-8 h-8" />
            <span className="text-[13px] font-semibold">Failed to read file contents.</span>
            <button onClick={() => refetch()} className="px-3 py-1 bg-white/5 border border-white/5 hover:bg-white/10 rounded-lg text-white text-[12px] transition-colors mt-2">
              Retry
            </button>
          </div>
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
              fontFamily: 'JetBrains Mono, Fira Code, ui-monospace, monospace',
              lineHeight: 20,
              padding: { top: 10, bottom: 10 },
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              automaticLayout: true,
              glyphMargin: false,
              folding: true,
              renderLineHighlight: 'all',
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
                verticalHasArrows: false,
                horizontalHasArrows: false
              }
            }}
            loading={
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 text-violet-500 animate-spin" />
                <span className="text-[12px] text-[#A1A1AA]">Loading editor core...</span>
              </div>
            }
          />
        )}

        {/* Floating selection Copilot toolbar */}
        {toolbarPos && (
          <InlineAiToolbar
            selectionText={selectionText}
            position={toolbarPos}
            onClose={() => setToolbarPos(null)}
          />
        )}
      </div>

    </div>
  );
}

// Inline loading spinner helper
function RefreshCw(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
