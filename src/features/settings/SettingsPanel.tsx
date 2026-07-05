'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  Settings, 
  Terminal, 
  Sparkles, 
  Eye, 
  Keyboard, 
  Key, 
  Sliders 
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useEditorStore();
  const [activeTab, setActiveTab] = React.useState<'editor' | 'ai' | 'keys'>('editor');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-2xl h-[450px] bg-[#17171B]/95 border border-[rgba(255,255,255,0.08)] backdrop-blur-md rounded-2xl shadow-2xl flex overflow-hidden"
      >
        
        {/* Left Side: Settings menu categories */}
        <div className="w-[180px] bg-[#111113]/70 border-r border-[rgba(255,255,255,0.06)] p-4 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1.5 mb-3 text-white text-[13px] font-bold">
            <Sliders className="w-4 h-4 text-violet-400" />
            <span>Preferences</span>
          </div>

          <button
            onClick={() => setActiveTab('editor')}
            className={`w-full text-left px-2.5 py-2 text-[12px] rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-violet-600/15 text-white border border-violet-500/20 font-medium'
                : 'text-[#A1A1AA] hover:text-white hover:bg-white/5'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Editor Options
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`w-full text-left px-2.5 py-2 text-[12px] rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-violet-600/15 text-white border border-violet-500/20 font-medium'
                : 'text-[#A1A1AA] hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Configuration
          </button>

          <button
            onClick={() => setActiveTab('keys')}
            className={`w-full text-left px-2.5 py-2 text-[12px] rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'keys'
                ? 'bg-violet-600/15 text-white border border-violet-500/20 font-medium'
                : 'text-[#A1A1AA] hover:text-white hover:bg-white/5'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            Keybindings
          </button>
        </div>

        {/* Right Side: Options layout */}
        <div className="flex-1 flex flex-col h-full bg-[#111113]/30">
          {/* Header */}
          <div className="h-12 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between px-6 bg-[#09090B]/30">
            <span className="text-[13px] font-bold text-white uppercase tracking-wide">
              {activeTab === 'editor' && 'Editor Settings'}
              {activeTab === 'ai' && 'AI Configuration'}
              {activeTab === 'keys' && 'Keyboard Shortcuts'}
            </span>
            
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/5 rounded text-[#A1A1AA] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Options view container */}
          <div className="flex-1 overflow-y-auto p-6 select-text">
            {activeTab === 'editor' && (
              <div className="flex flex-col gap-5">
                {/* Font size option */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-semibold text-white">Font Size</span>
                    <span className="text-[11px] text-[#A1A1AA]">Modify text size of editor workspace.</span>
                  </div>
                  <input
                    type="number"
                    value={settings.fontSize}
                    onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) || 12 })}
                    className="w-16 bg-[#17171B] border border-white/5 focus:border-[#8B5CF6]/50 rounded px-2 py-1 text-[12px] text-white outline-none text-center"
                    min="10"
                    max="24"
                  />
                </div>

                {/* Tab size option */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-semibold text-white">Tab Spacing</span>
                    <span className="text-[11px] text-[#A1A1AA]">Whitespace characters inserted on tab press.</span>
                  </div>
                  <select
                    value={settings.tabSize}
                    onChange={(e) => updateSettings({ tabSize: parseInt(e.target.value) })}
                    className="bg-[#17171B] border border-white/5 focus:border-[#8B5CF6]/50 rounded px-2 py-1 text-[12px] text-white outline-none"
                  >
                    <option value={2}>2 spaces</option>
                    <option value={4}>4 spaces</option>
                    <option value={8}>8 spaces</option>
                  </select>
                </div>

                {/* Minimap toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-semibold text-white">Minimap Slider</span>
                    <span className="text-[11px] text-[#A1A1AA]">Displays map overview bar on the right side of the screen.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.minimap}
                    onChange={(e) => updateSettings({ minimap: e.target.checked })}
                    className="accent-[#8B5CF6] w-4 h-4 cursor-pointer"
                  />
                </div>

                {/* Word wrap toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-semibold text-white">Word Wrap</span>
                    <span className="text-[11px] text-[#A1A1AA]">Wrap lines of text to fit browser viewport sizes.</span>
                  </div>
                  <select
                    value={settings.wordWrap}
                    onChange={(e) => updateSettings({ wordWrap: e.target.value as 'on' | 'off' })}
                    className="bg-[#17171B] border border-white/5 focus:border-[#8B5CF6]/50 rounded px-2 py-1 text-[12px] text-white outline-none"
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="flex flex-col gap-5">
                {/* Groq Model Selector */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-semibold text-white">Groq LLM Model</span>
                    <span className="text-[11px] text-[#A1A1AA]">Select active generative AI model parameter.</span>
                  </div>
                  <select
                    value={settings.aiModel}
                    onChange={(e) => updateSettings({ aiModel: e.target.value })}
                    className="bg-[#17171B] border border-white/5 focus:border-[#8B5CF6]/50 rounded px-2 py-1 text-[12px] text-white outline-none"
                  >
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B</option>
                    <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                  </select>
                </div>

                {/* Custom API Key */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-semibold text-white">Groq API Key</span>
                    <span className="text-[11px] text-[#A1A1AA]">Provides access key to call Groq API directly.</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="password"
                      value={settings.apiKey}
                      onChange={(e) => updateSettings({ apiKey: e.target.value })}
                      placeholder="Insert API key..."
                      className="w-full bg-[#17171B] border border-white/5 focus:border-[#8B5CF6]/50 rounded-lg px-3 py-2 pl-9 text-[12px] text-white outline-none placeholder-zinc-600"
                    />
                    <Key className="absolute left-3 w-3.5 h-3.5 text-[#A1A1AA]/50" />
                  </div>
                </div>

                {/* System Prompt */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-semibold text-white">System Prompt Instructions</span>
                  <textarea
                    value={settings.systemPrompt}
                    onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                    className="w-full h-24 bg-[#17171B] border border-white/5 focus:border-[#8B5CF6]/50 rounded-lg p-2.5 text-[12px] text-white outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}

            {activeTab === 'keys' && (
              <div className="flex flex-col gap-4 text-[12px]">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-300">Command Palette overlay</span>
                  <kbd className="bg-white/5 border border-white/10 rounded px-2 py-0.5 font-mono text-[10px]">Ctrl+Shift+P</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-300">Open Settings</span>
                  <kbd className="bg-white/5 border border-white/10 rounded px-2 py-0.5 font-mono text-[10px]">Ctrl+,</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-300">Save Active File</span>
                  <kbd className="bg-white/5 border border-white/10 rounded px-2 py-0.5 font-mono text-[10px]">Ctrl+S</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-300">Toggle AI Panel visibility</span>
                  <kbd className="bg-white/5 border border-white/10 rounded px-2 py-0.5 font-mono text-[10px]">Ctrl+I</kbd>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-300">Close Active File Tab</span>
                  <kbd className="bg-white/5 border border-white/10 rounded px-2 py-0.5 font-mono text-[10px]">Ctrl+W</kbd>
                </div>
              </div>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
