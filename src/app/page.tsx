'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderClosed, 
  AlertCircle, 
  Terminal as TermIcon, 
  Sparkles,
  RefreshCw,
  Search as SearchIcon,
  GitBranch,
  Settings as SettingsIcon,
  Code
} from 'lucide-react';

import { useEditorStore } from '../stores/editorStore';
import { useDirectoryFiles } from '../hooks/useWorkspace';

// Lazy loading panels for fast startup
import dynamic from 'next/dynamic';

const TopBar = dynamic(() => import('../components/TopBar'), { ssr: false });
const ActivityBar = dynamic(() => import('../components/ActivityBar'), { ssr: false });
const ResizablePanel = dynamic(() => import('../components/ResizablePanel'), { ssr: false });
const StatusBar = dynamic(() => import('../components/StatusBar'), { ssr: false });
const CommandPalette = dynamic(() => import('../components/CommandPalette'), { ssr: false });
const SettingsPanel = dynamic(() => import('../features/settings/SettingsPanel'), { ssr: false });

const FileExplorer = dynamic(() => import('../features/explorer/FileExplorer'), { ssr: false });
const SearchPanel = dynamic(() => import('../features/search/SearchPanel'), { ssr: false });
const GitPanel = dynamic(() => import('../features/git/GitPanel'), { ssr: false });
const CodeEditor = dynamic(() => import('../features/editor/CodeEditor'), { ssr: false });
const TerminalPanel = dynamic(() => import('../features/terminal/TerminalPanel'), { ssr: false });
const AiPanel = dynamic(() => import('../features/ai/AiPanel'), { ssr: false });

function EditorMain() {
  const searchParams = useSearchParams();
  const folderParam = searchParams.get('folder');
  
  const { 
    workspacePath, 
    setWorkspacePath,
    activeSidebarTab,
    isSidebarCollapsed,
    isBottomCollapsed,
    activeBottomTab,
    isAiPanelOpen,
    sidebarWidth,
    setSidebarWidth,
    bottomHeight,
    setBottomHeight,
    aiPanelWidth,
    setAiPanelWidth,
    setActiveBottomTab,
    setBottomCollapsed,
    setSidebarCollapsed
  } = useEditorStore();

  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Validate the workspace folder parameter
  useEffect(() => {
    const validateWorkspace = async () => {
      if (!folderParam) {
        setValidationError('No workspace folder path specified. Please configure a ?folder= query parameter in the URL.');
        setIsValidating(false);
        return;
      }

      try {
        setIsValidating(true);
        // Call directory checker
        const res = await fetch(`/api/workspace/files?path=${encodeURIComponent(folderParam)}`);
        
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Folder not found or inaccessible.');
        }

        // Auto-configure workspace path
        setWorkspacePath(folderParam.replace(/\\/g, '/'));
        setValidationError(null);
      } catch (err: any) {
        setValidationError(err.message || 'Error loading directory tree.');
      } finally {
        setIsValidating(false);
      }
    };

    validateWorkspace();
  }, [folderParam, setWorkspacePath]);

  // Global keybind hooks
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Ctrl+Shift+P for Command Palette
      if (e.key === 'P' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsCommandOpen(true);
      }
      
      // Ctrl+, for settings
      if (e.key === ',' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  // Show beautiful loading splash screen
  if (isValidating) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#09090B] gap-4 select-none">
        <div className="relative flex items-center justify-center">
          {/* Animated rings glow */}
          <div className="w-16 h-16 rounded-full border border-violet-500/20 border-t-violet-500 animate-spin" />
          <Code className="absolute w-6 h-6 text-violet-400 animate-pulse" />
        </div>
        <div className="flex flex-col items-center text-center gap-1">
          <span className="text-[13px] font-bold text-white tracking-wide">FirstDeploy AI IDE</span>
          <span className="text-[11px] text-zinc-500">Initializing project workspace containers...</span>
        </div>
      </div>
    );
  }

  // Show animated folder errors panel
  if (validationError) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#09090B] p-6 text-center select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md bg-[#111113] border border-rose-500/20 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[14px] font-bold text-white">Workspace Loading Failed</span>
            <p className="text-[12px] text-[#A1A1AA] leading-relaxed select-text">{validationError}</p>
          </div>
          <div className="text-[11px] text-zinc-500 border-t border-white/5 pt-4 mt-2 w-full">
            Ensure the folder exists on the server. Try accessing:<br/>
            <code className="text-violet-400 mt-1 select-all break-all">http://IP:PORT/?folder=D:/APPS/host</code>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-[#09090B] text-white select-none overflow-hidden relative">
      
      {/* Top Bar Navigation */}
      <TopBar 
        onOpenCommandPalette={() => setIsCommandOpen(true)} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
      />

      {/* Middle Layout section */}
      <div className="flex-1 w-full flex overflow-hidden">
        
        {/* Activity Bar icons */}
        <ActivityBar />

        {/* Sidebar menu selection panel drawer */}
        <ResizablePanel
          direction="horizontal"
          size={sidebarWidth}
          onResize={setSidebarWidth}
          isCollapsed={isSidebarCollapsed}
          side="right"
          className="shrink-0 z-30"
          minSize={200}
          maxSize={400}
        >
          <div className="w-full h-full flex flex-col">
            {activeSidebarTab === 'explorer' && <FileExplorer />}
            {activeSidebarTab === 'search' && <SearchPanel />}
            {activeSidebarTab === 'git' && <GitPanel />}
          </div>
        </ResizablePanel>

        {/* Central Workspace grid */}
        <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden bg-[#111113]/30">
          
          {/* Top Monaco Editor frame */}
          <div className="flex-1 min-h-0 relative">
            <CodeEditor />
          </div>

          {/* Bottom panel (terminal/output) drawer */}
          <ResizablePanel
            direction="vertical"
            size={bottomHeight}
            onResize={setBottomHeight}
            isCollapsed={isBottomCollapsed}
            side="top"
            className="z-20 shrink-0"
            minSize={180}
            maxSize={500}
          >
            <div className="w-full h-full flex flex-col">
              
              {/* Bottom tabs list header */}
              <div className="h-8 border-b border-[rgba(255,255,255,0.06)] bg-[#09090B]/40 flex items-center justify-between px-4 text-[11px] font-medium text-[#A1A1AA] select-none shrink-0">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      setActiveBottomTab('terminal');
                      setBottomCollapsed(false);
                    }}
                    className={`py-1 relative cursor-pointer hover:text-white transition-colors ${
                      activeBottomTab === 'terminal' && !isBottomCollapsed ? 'text-white font-semibold' : ''
                    }`}
                  >
                    <span>Terminal</span>
                    {activeBottomTab === 'terminal' && !isBottomCollapsed && (
                      <motion.div layoutId="bottomTabLine" className="absolute bottom-0 left-0 w-full h-[2px] bg-[#8B5CF6]" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setActiveBottomTab('problems');
                      setBottomCollapsed(false);
                    }}
                    className={`py-1 relative cursor-pointer hover:text-white transition-colors ${
                      activeBottomTab === 'problems' && !isBottomCollapsed ? 'text-white font-semibold' : ''
                    }`}
                  >
                    <span>Problems</span>
                    {activeBottomTab === 'problems' && !isBottomCollapsed && (
                      <motion.div layoutId="bottomTabLine" className="absolute bottom-0 left-0 w-full h-[2px] bg-[#8B5CF6]" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setActiveBottomTab('output');
                      setBottomCollapsed(false);
                    }}
                    className={`py-1 relative cursor-pointer hover:text-white transition-colors ${
                      activeBottomTab === 'output' && !isBottomCollapsed ? 'text-white font-semibold' : ''
                    }`}
                  >
                    <span>Output</span>
                    {activeBottomTab === 'output' && !isBottomCollapsed && (
                      <motion.div layoutId="bottomTabLine" className="absolute bottom-0 left-0 w-full h-[2px] bg-[#8B5CF6]" />
                    )}
                  </button>
                </div>

                {/* Close Bottom Panel shortcut button */}
                <button
                  onClick={() => setBottomCollapsed(true)}
                  className="p-0.5 rounded hover:bg-white/5 text-[#A1A1AA] hover:text-white cursor-pointer"
                  title="Collapse panel"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bottom panels viewport */}
              <div className="flex-1 w-full bg-[#111113] overflow-hidden">
                {activeBottomTab === 'terminal' && <TerminalPanel />}
                
                {activeBottomTab === 'problems' && (
                  <div className="p-4 text-[12px] text-zinc-500 flex items-center justify-center h-full">
                    No problems found in workspace.
                  </div>
                )}
                
                {activeBottomTab === 'output' && (
                  <div className="p-4 text-[11.5px] font-mono text-zinc-500 overflow-y-auto h-full select-text leading-relaxed">
                    [System] Initializing workspace build outputs...<br/>
                    [System] Hot Reloading compilation processes: Active.<br/>
                    [System] Container port routing established on port 3100.
                  </div>
                )}
              </div>

            </div>
          </ResizablePanel>

        </div>

        {/* Right side AI Copilot Drawer */}
        <ResizablePanel
          direction="horizontal"
          size={aiPanelWidth}
          onResize={setAiPanelWidth}
          isCollapsed={!isAiPanelOpen}
          side="left"
          className="shrink-0 z-30"
          minSize={250}
          maxSize={500}
        >
          <AiPanel />
        </ResizablePanel>

      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Dialog overlays */}
      <AnimatePresence>
        {isCommandOpen && (
          <CommandPalette 
            isOpen={isCommandOpen} 
            onClose={() => setIsCommandOpen(false)} 
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsPanel 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
          />
        )}
      </AnimatePresence>

    </div>
  );
}

// X Close Icon helper
function XIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#09090B] gap-4 select-none">
        <RefreshCw className="w-6 h-6 text-violet-500 animate-spin" />
        <span className="text-[12.5px] text-[#A1A1AA]">Bootstrapping environment...</span>
      </div>
    }>
      <EditorMain />
    </Suspense>
  );
}
