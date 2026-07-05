'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Terminal, 
  GitBranch, 
  Search, 
  Bell, 
  Sliders, 
  Cpu, 
  Wifi, 
  WifiOff, 
  Sparkles,
  Command
} from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { useGitStatus } from '../hooks/useWorkspace';

interface TopBarProps {
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
}

export default function TopBar({ onOpenCommandPalette, onOpenSettings }: TopBarProps) {
  const { workspacePath, settings } = useEditorStore();
  const [isOnline, setIsOnline] = useState(true);
  const [aiWorking, setAiWorking] = useState(false);
  
  const { data: gitData } = useGitStatus(workspacePath);
  const branchName = gitData?.branch || 'main';

  // Watch network state
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const workspaceName = workspacePath 
    ? workspacePath.split('/').pop() || workspacePath.split('\\').pop() || 'Workspace'
    : 'No Workspace';

  return (
    <div className="h-12 w-full bg-[#09090B] border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between px-4 select-none z-50">
      
      {/* Left: Workspace & Git status */}
      <div className="flex items-center gap-3">
        {/* Workspace title */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <span className="text-[13px] font-medium text-white tracking-wide truncate max-w-[150px]">
            {workspaceName}
          </span>
        </div>

        {/* Separator */}
        {gitData?.isRepository && (
          <>
            <span className="text-[rgba(255,255,255,0.15)] text-[10px]">/</span>
            {/* Git Branch Pill */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/8 transition-colors rounded-full px-2 py-0.5 text-[11px] text-[#A1A1AA] cursor-pointer">
              <GitBranch className="w-3 h-3 text-[#A1A1AA]" />
              <span>{branchName}</span>
            </div>
          </>
        )}
      </div>

      {/* Middle: Search & Command Palette trigger */}
      <div className="flex-1 max-w-[420px] px-4">
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between bg-[#111113] border border-[rgba(255,255,255,0.06)] hover:border-white/12 hover:bg-[#17171B] rounded-lg px-3 py-1.5 cursor-pointer text-[12px] text-[#A1A1AA] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#A1A1AA]" />
            <span>Search files or command...</span>
          </div>
          <div className="flex items-center gap-0.5 bg-white/5 border border-white/5 rounded px-1.5 py-0.5 text-[10px] font-mono">
            <Command className="w-2.5 h-2.5 mr-0.5" />
            <span>P</span>
          </div>
        </motion.div>
      </div>

      {/* Right: Actions, AI Status, Network, Profile */}
      <div className="flex items-center gap-3.5">
        
        {/* Connection status indicator */}
        <div className="flex items-center">
          {isOnline ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] bg-emerald-500/5 border border-emerald-500/10 rounded-full px-2 py-0.5">
              <Wifi className="w-3 h-3" />
              <span>Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-400 text-[11px] bg-rose-500/5 border border-rose-500/10 rounded-full px-2 py-0.5">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </div>
          )}
        </div>

        {/* AI Status pill */}
        <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] rounded-full px-2.5 py-0.5">
          <div className={`w-1.5 h-1.5 rounded-full bg-violet-400 ${aiWorking ? 'animate-ping' : ''}`} />
          <Sparkles className="w-3 h-3 text-violet-400" />
          <span>{settings.aiModel}</span>
        </div>

        {/* Settings button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-[rgba(255,255,255,0.06)] text-[#A1A1AA] hover:text-white cursor-pointer transition-colors"
        >
          <Sliders className="w-4 h-4" />
        </motion.button>

        {/* Notifications button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-[rgba(255,255,255,0.06)] text-[#A1A1AA] hover:text-white cursor-pointer relative transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#8B5CF6] rounded-full" />
        </motion.button>

        {/* User avatar */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="w-7 h-7 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 border border-[rgba(255,255,255,0.15)] flex items-center justify-center text-[11px] font-bold text-white cursor-pointer"
        >
          FD
        </motion.div>
      </div>

    </div>
  );
}
