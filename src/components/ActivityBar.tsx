'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Files, 
  Search, 
  GitBranch, 
  Play, 
  Blocks, 
  Sparkles, 
  Settings,
  HelpCircle 
} from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';

interface ActivityBarItem {
  id: 'explorer' | 'search' | 'git' | 'ai' | 'settings';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const ITEMS: ActivityBarItem[] = [
  { id: 'explorer', icon: Files, label: 'File Explorer' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'git', icon: GitBranch, label: 'Source Control' },
  { id: 'ai', icon: Sparkles, label: 'AI Assistant' },
  { id: 'settings', icon: Settings, label: 'Settings' }
];

export default function ActivityBar() {
  const { activeSidebarTab, isSidebarCollapsed, setActiveSidebarTab } = useEditorStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <div className="w-[52px] h-full bg-[#09090B] border-r border-[rgba(255,255,255,0.06)] flex flex-col items-center justify-between py-4 select-none z-40">
      {/* Top half items */}
      <div className="flex flex-col items-center gap-2 w-full">
        {ITEMS.slice(0, 4).map((item) => {
          const isActive = activeSidebarTab === item.id && !isSidebarCollapsed;
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              className="relative w-full flex justify-center py-1 group"
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => setActiveSidebarTab(item.id)}
            >
              <button
                className={`w-10 h-10 rounded-lg flex items-center justify-center relative cursor-pointer transition-all duration-300 ${
                  isActive 
                    ? 'text-white bg-[rgba(124,58,237,0.12)] border border-[#8B5CF6]/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]' 
                    : 'text-[#A1A1AA] hover:text-white hover:bg-white/5'
                }`}
              >
                {/* Active sidebar background pill */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 w-[3px] h-6 bg-[#8B5CF6] rounded-r-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                
                <Icon className={`w-[20px] h-[20px] transition-transform duration-300 group-hover:scale-105 ${isActive ? 'text-[#8B5CF6]' : ''}`} />
              </button>

              {/* Tooltip */}
              <AnimatePresence>
                {hoveredItem === item.id && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#17171B] border border-[rgba(255,255,255,0.08)] text-white text-[11px] rounded shadow-xl whitespace-nowrap z-50 pointer-events-none backdrop-blur-md"
                  >
                    {item.label}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Bottom half settings & other things */}
      <div className="flex flex-col items-center gap-2 w-full">
        {ITEMS.slice(4).map((item) => {
          const isActive = activeSidebarTab === item.id && !isSidebarCollapsed;
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              className="relative w-full flex justify-center py-1 group"
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => setActiveSidebarTab(item.id)}
            >
              <button
                className={`w-10 h-10 rounded-lg flex items-center justify-center relative cursor-pointer transition-all duration-300 ${
                  isActive 
                    ? 'text-white bg-[rgba(124,58,237,0.12)] border border-[#8B5CF6]/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]' 
                    : 'text-[#A1A1AA] hover:text-white hover:bg-white/5'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 w-[3px] h-6 bg-[#8B5CF6] rounded-r-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                
                <Icon className={`w-[20px] h-[20px] transition-transform duration-300 group-hover:scale-105 ${isActive ? 'text-[#8B5CF6]' : ''}`} />
              </button>

              <AnimatePresence>
                {hoveredItem === item.id && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#17171B] border border-[rgba(255,255,255,0.08)] text-white text-[11px] rounded shadow-xl whitespace-nowrap z-50 pointer-events-none backdrop-blur-md"
                  >
                    {item.label}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
