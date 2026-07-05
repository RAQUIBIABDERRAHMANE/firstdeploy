'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Command, 
  Search, 
  Terminal, 
  Files, 
  GitBranch, 
  Sparkles, 
  Sliders, 
  HelpCircle,
  FolderClosed
} from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';

interface CommandItem {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export default function CommandPalette({ isOpen, onClose, onOpenSettings }: CommandPaletteProps) {
  const { 
    setActiveSidebarTab, 
    setBottomCollapsed, 
    isBottomCollapsed,
    setAiPanelOpen,
    isAiPanelOpen
  } = useEditorStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const COMMANDS: CommandItem[] = [
    {
      id: 'sidebar-explorer',
      name: 'Show File Explorer',
      category: 'Navigation',
      icon: Files,
      action: () => { setActiveSidebarTab('explorer'); onClose(); }
    },
    {
      id: 'sidebar-search',
      name: 'Search Files Workspace',
      category: 'Navigation',
      icon: Search,
      action: () => { setActiveSidebarTab('search'); onClose(); }
    },
    {
      id: 'sidebar-git',
      name: 'Show Git Version Control',
      category: 'Source Control',
      icon: GitBranch,
      action: () => { setActiveSidebarTab('git'); onClose(); }
    },
    {
      id: 'sidebar-ai',
      name: 'Show AI Copilot Panel',
      category: 'AI Assistant',
      icon: Sparkles,
      action: () => { setActiveSidebarTab('ai'); onClose(); }
    },
    {
      id: 'toggle-terminal',
      name: 'Toggle Terminal Bottom Panel',
      category: 'Layout',
      icon: Terminal,
      action: () => { setBottomCollapsed(!isBottomCollapsed); onClose(); }
    },
    {
      id: 'toggle-ai-panel',
      name: 'Toggle AI Panel Side Drawer',
      category: 'Layout',
      icon: Sparkles,
      action: () => { setAiPanelOpen(!isAiPanelOpen); onClose(); }
    },
    {
      id: 'open-settings',
      name: 'Open Editor Configuration Preferences',
      category: 'Preferences',
      icon: Sliders,
      action: () => { onOpenSettings(); onClose(); }
    }
  ];

  // Filter commands by search term
  const filtered = COMMANDS.filter((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  // Focus input on mount
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
      setQuery('');
    }
  }, [isOpen]);

  // Key navigation logic
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filtered, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-[15vh] select-none">
      
      {/* Click outside to close */}
      <div className="absolute inset-0 z-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.96 }}
        transition={{ duration: 0.12 }}
        className="w-full max-w-lg bg-[#17171B]/95 border border-[rgba(255,255,255,0.08)] backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 select-none"
      >
        
        {/* Search Input bar */}
        <div className="relative flex items-center border-b border-[rgba(255,255,255,0.06)] px-4 py-3 bg-[#111113]/30">
          <Search className="w-4 h-4 text-[#A1A1AA]/60 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type command description to execute..."
            className="w-full bg-transparent text-[13px] text-white outline-none pl-3 placeholder-zinc-500 select-text"
          />
          <kbd className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono text-zinc-400">ESC</kbd>
        </div>

        {/* Dynamic list matching results */}
        <div className="max-h-[280px] overflow-y-auto p-1.5">
          {filtered.length > 0 ? (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = cmd.icon;

              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-xl transition-all duration-100 ${
                    isSelected
                      ? 'bg-violet-600/15 border border-violet-500/20 text-white shadow-inner'
                      : 'border border-transparent text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-violet-400' : 'text-[#A1A1AA]'}`} />
                    <div className="flex flex-col">
                      <span className="text-[12.5px] font-medium">{cmd.name}</span>
                      <span className="text-[10px] text-zinc-500">{cmd.category}</span>
                    </div>
                  </div>
                  
                  {isSelected && (
                    <kbd className="text-[10px] bg-violet-500/10 text-violet-400 rounded px-1.5 py-0.5 font-sans font-semibold">
                      Enter
                    </kbd>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-[12px] text-zinc-500">
              No matching commands found.
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="h-7 border-t border-[rgba(255,255,255,0.06)] bg-[#09090B]/60 flex items-center justify-between px-4 text-[10px] text-zinc-500">
          <div className="flex items-center gap-2">
            <span>Use keys:</span>
            <kbd className="border border-white/5 bg-white/5 rounded px-1">↑↓</kbd>
            <span>Navigate</span>
            <kbd className="border border-white/5 bg-white/5 rounded px-1">Enter</kbd>
            <span>Select</span>
          </div>
          <span>Command Copilot Active</span>
        </div>

      </motion.div>
    </div>
  );
}
