'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal, 
  GitBranch, 
  Search,
  Bell, 
  Sliders, 
  Wifi, 
  WifiOff, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { useGitStatus } from '../hooks/useWorkspace';

interface TopBarProps {
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
}

export default function TopBar({ onOpenCommandPalette, onOpenSettings }: TopBarProps) {
  const { workspacePath, settings, isAiPanelOpen, setAiPanelOpen } = useEditorStore();
  const [isOnline, setIsOnline] = useState(true);
  const [notifCount] = useState(1);
  
  const { data: gitData } = useGitStatus(workspacePath);
  const branchName = gitData?.branch || 'main';

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const workspaceName = workspacePath
    ? (workspacePath.split('/').pop() || workspacePath.split('\\').pop() || 'Workspace')
    : 'No Workspace';

  // Shorten model name for display
  const modelShort = settings.aiModel
    ? settings.aiModel.split('-').slice(0, 2).join(' ')
    : 'Groq AI';

  return (
    <div className="h-9 w-full bg-[#09090B] border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between px-3 select-none z-50 shrink-0">

      {/* ── Left: Workspace & Git ── */}
      <div className="flex items-center gap-2 min-w-0">

        {/* App icon + workspace name */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-5 h-5 rounded-md bg-violet-600/20 border border-violet-500/25 flex items-center justify-center">
            <Terminal className="w-3 h-3 text-violet-400" />
          </div>
          <span className="text-[12.5px] font-semibold text-white truncate max-w-[130px] tracking-tight">
            {workspaceName}
          </span>
        </div>

        {/* Git branch */}
        {gitData?.isRepository && (
          <>
            <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-1 bg-white/4 border border-white/6 hover:border-white/10 hover:bg-white/6 transition-colors rounded-full px-2 py-0.5 text-[11px] text-[#A1A1AA] cursor-pointer shrink-0"
            >
              <GitBranch className="w-2.5 h-2.5" />
              <span>{branchName}</span>
              {gitData.changes?.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-0.5" />
              )}
            </motion.div>
          </>
        )}
      </div>

      {/* ── Centre: Command Palette trigger ── */}
      <div className="flex-1 flex justify-center px-4">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onOpenCommandPalette}
          className="w-full max-w-[380px] flex items-center justify-between bg-[#111113] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.13)] hover:bg-[#17171B] rounded-lg px-2.5 py-1 cursor-pointer text-[11.5px] text-[#71717A] transition-all duration-150"
        >
          <div className="flex items-center gap-1.5">
            <Search className="w-3 h-3" />
            <span>Search files, commands…</span>
          </div>
          <div className="flex items-center gap-0.5">
            <kbd className="bg-white/5 border border-white/8 rounded px-1 py-px text-[10px] font-mono text-white/40">⌘</kbd>
            <kbd className="bg-white/5 border border-white/8 rounded px-1 py-px text-[10px] font-mono text-white/40">P</kbd>
          </div>
        </motion.button>
      </div>

      {/* ── Right: Status, AI toggle, Settings, Notif, Avatar ── */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Network status */}
        <AnimatePresence mode="wait">
          {isOnline ? (
            <motion.div
              key="online"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1 text-emerald-400 text-[11px] bg-emerald-500/6 border border-emerald-500/12 rounded-full px-1.5 py-0.5"
            >
              <Wifi className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Connected</span>
            </motion.div>
          ) : (
            <motion.div
              key="offline"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1 text-rose-400 text-[11px] bg-rose-500/6 border border-rose-500/12 rounded-full px-1.5 py-0.5"
            >
              <WifiOff className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Offline</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI model pill — also toggles the AI panel */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setAiPanelOpen(!isAiPanelOpen)}
          className={`flex items-center gap-1.5 text-[11px] rounded-full px-2.5 py-0.5 border transition-all cursor-pointer ${
            isAiPanelOpen
              ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
              : 'bg-white/4 border-white/8 text-[#A1A1AA] hover:border-violet-500/20 hover:text-violet-300'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${isAiPanelOpen ? 'bg-violet-400 glow-active' : 'bg-white/20'}`} />
          <Sparkles className="w-2.5 h-2.5" />
          <span className="hidden md:inline capitalize">{modelShort}</span>
        </motion.button>

        {/* Settings button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-[rgba(255,255,255,0.06)] text-[#71717A] hover:text-white cursor-pointer transition-all"
          title="Settings (Ctrl+,)"
        >
          <Sliders className="w-3.5 h-3.5" />
        </motion.button>

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-[rgba(255,255,255,0.06)] text-[#71717A] hover:text-white cursor-pointer relative transition-all"
          title="Notifications"
        >
          <Bell className="w-3.5 h-3.5" />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#8B5CF6] rounded-full" />
          )}
        </motion.button>

        {/* User avatar */}
        <motion.div
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className="w-6 h-6 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 border border-white/15 flex items-center justify-center text-[10px] font-bold text-white cursor-pointer select-none"
          title="Account"
        >
          FD
        </motion.div>
      </div>
    </div>
  );
}
