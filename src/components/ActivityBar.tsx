'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Files, 
  Search, 
  GitBranch, 
  Sparkles, 
  Settings
} from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';

interface ActivityItem {
  id: 'explorer' | 'search' | 'git';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
}

const TOP_ITEMS: ActivityItem[] = [
  { id: 'explorer', icon: Files,     label: 'File Explorer',  shortcut: '⌘⇧E' },
  { id: 'search',   icon: Search,    label: 'Search',         shortcut: '⌘⇧F' },
  { id: 'git',      icon: GitBranch, label: 'Source Control', shortcut: '⌘⇧G' },
];

export default function ActivityBar() {
  const {
    activeSidebarTab,
    isSidebarCollapsed,
    isAiPanelOpen,
    setActiveSidebarTab,
    setAiPanelOpen,
    setIsSettingsOpen,
  } = useEditorStore();

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleSidebarClick = (id: ActivityItem['id']) => {
    if (activeSidebarTab === id && !isSidebarCollapsed) {
      // clicking the same open tab collapses the sidebar
      useEditorStore.getState().setSidebarCollapsed(true);
    } else {
      setActiveSidebarTab(id); // also expands sidebar inside setActiveSidebarTab
    }
  };

  return (
    <div className="w-[48px] h-full bg-[#09090B] border-r border-[rgba(255,255,255,0.06)] flex flex-col items-center justify-between py-3 select-none z-40 shrink-0">

      {/* ── Top icons: Explorer / Search / Git ── */}
      <div className="flex flex-col items-center gap-1 w-full">
        {TOP_ITEMS.map((item) => {
          const isActive = activeSidebarTab === item.id && !isSidebarCollapsed;
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              className="relative w-full flex justify-center py-0.5 group"
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => handleSidebarClick(item.id)}
            >
              <button
                className={`w-9 h-9 rounded-lg flex items-center justify-center relative cursor-pointer transition-all duration-200 ${
                  isActive
                    ? 'text-white bg-[rgba(124,58,237,0.14)] border border-[#8B5CF6]/25 shadow-[0_0_10px_rgba(139,92,246,0.12)]'
                    : 'text-[#71717A] hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                aria-label={item.label}
                title={item.label}
              >
                {/* Active left bar indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeBarIndicator"
                    className="absolute left-0 w-[2.5px] h-5 bg-[#8B5CF6] rounded-r-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className={`w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-[#A78BFA]' : ''}`} />
              </button>

              {/* Tooltip */}
              <AnimatePresence>
                {hoveredItem === item.id && (
                  <motion.div
                    initial={{ opacity: 0, x: -6, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -6, scale: 0.95 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-[52px] top-1/2 -translate-y-1/2 z-50 pointer-events-none glass-elevated rounded-md px-2.5 py-1.5 flex items-center gap-2 whitespace-nowrap"
                  >
                    <span className="text-[11.5px] text-white font-medium">{item.label}</span>
                    <span className="text-[10px] text-white/30 font-mono">{item.shortcut}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* ── Bottom icons: AI + Settings ── */}
      <div className="flex flex-col items-center gap-1 w-full">

        {/* AI Panel toggle */}
        <div
          className="relative w-full flex justify-center py-0.5 group"
          onMouseEnter={() => setHoveredItem('ai')}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => setAiPanelOpen(!isAiPanelOpen)}
        >
          <button
            className={`w-9 h-9 rounded-lg flex items-center justify-center relative cursor-pointer transition-all duration-200 ${
              isAiPanelOpen
                ? 'text-white bg-[rgba(124,58,237,0.14)] border border-[#8B5CF6]/25 shadow-[0_0_10px_rgba(139,92,246,0.12)]'
                : 'text-[#71717A] hover:text-violet-400 hover:bg-violet-500/6 border border-transparent'
            }`}
            aria-label="AI Assistant"
          >
            {isAiPanelOpen && (
              <motion.div
                className="absolute left-0 w-[2.5px] h-5 bg-[#8B5CF6] rounded-r-full"
                layoutId="activeBarIndicator"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <Sparkles className={`w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-105 ${isAiPanelOpen ? 'text-[#A78BFA]' : ''}`} />
            {isAiPanelOpen && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 glow-active" />
            )}
          </button>
          <AnimatePresence>
            {hoveredItem === 'ai' && (
              <motion.div
                initial={{ opacity: 0, x: -6, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -6, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className="absolute left-[52px] top-1/2 -translate-y-1/2 z-50 pointer-events-none glass-elevated rounded-md px-2.5 py-1.5 flex items-center gap-2 whitespace-nowrap"
              >
                <span className="text-[11.5px] text-white font-medium">AI Assistant</span>
                <span className="text-[10px] text-white/30 font-mono">⌘⇧A</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Settings */}
        <div
          className="relative w-full flex justify-center py-0.5 group"
          onMouseEnter={() => setHoveredItem('settings')}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => {
            if (typeof setIsSettingsOpen === 'function') setIsSettingsOpen(true);
          }}
        >
          <button
            className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer text-[#71717A] hover:text-white hover:bg-white/5 border border-transparent transition-all duration-200"
            aria-label="Settings"
          >
            <Settings className="w-[18px] h-[18px] transition-transform duration-200 group-hover:rotate-45 group-hover:scale-105" />
          </button>
          <AnimatePresence>
            {hoveredItem === 'settings' && (
              <motion.div
                initial={{ opacity: 0, x: -6, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -6, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className="absolute left-[52px] top-1/2 -translate-y-1/2 z-50 pointer-events-none glass-elevated rounded-md px-2.5 py-1.5 flex items-center gap-2 whitespace-nowrap"
              >
                <span className="text-[11.5px] text-white font-medium">Settings</span>
                <span className="text-[10px] text-white/30 font-mono">⌘,</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
