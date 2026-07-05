'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Eye, 
  Wrench, 
  Zap, 
  MessageSquareCode, 
  Play, 
  ArrowRight 
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';

interface InlineAiToolbarProps {
  selectionText: string;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export default function InlineAiToolbar({ selectionText, position, onClose }: InlineAiToolbarProps) {
  const { addChatMessage, setAiGenerating, updateLastChatMessage, setAiPanelOpen, settings } = useEditorStore();
  const [customPrompt, setCustomPrompt] = useState('');

  if (!position) return null;

  const triggerAction = async (promptLabel: string, systemPromptText: string) => {
    onClose();
    setAiPanelOpen(true);
    
    const promptMessage = `Action: **${promptLabel}**\n\nTarget Code:\n\`\`\`typescript\n${selectionText}\n\`\`\``;
    
    // Add user message
    addChatMessage({
      id: Math.random().toString(),
      role: 'user',
      content: promptMessage,
      timestamp: new Date()
    });

    // Prepare response placeholder
    const msgId = Math.random().toString();
    addChatMessage({
      id: msgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    });
    setAiGenerating(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: promptMessage }],
          systemPrompt: systemPromptText,
          model: settings.aiModel,
          customApiKey: settings.apiKey
        })
      });

      if (!response.ok) throw new Error("Failed to process request");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('data:')) {
              const dataText = cleanLine.slice(5).trim();
              if (dataText === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataText);
                if (parsed.text) {
                  updateLastChatMessage(parsed.text, true);
                }
              } catch (e) {}
            }
          }
        }
      }
      updateLastChatMessage('', false);
    } catch (err: any) {
      updateLastChatMessage(`Error processing code selection: ${err.message}`, false);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    triggerAction(customPrompt, `Apply the following instructions to the provided code snippet: ${customPrompt}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      style={{ top: position.y, left: position.x }}
      className="absolute z-50 min-w-[280px] bg-[#17171B] border border-[#8B5CF6]/40 backdrop-blur-md rounded-xl shadow-2xl p-2 select-none pointer-events-auto"
    >
      <div className="flex flex-col gap-1">
        
        {/* Quick action buttons list */}
        <div className="grid grid-cols-2 gap-1 text-[11px] font-medium mb-1.5">
          <button
            onClick={() => triggerAction('Explain Code', 'Explain how this code block works in detail.')}
            className="flex items-center gap-1.5 px-2 py-1.5 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg text-left cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-zinc-400" />
            Explain
          </button>
          <button
            onClick={() => triggerAction('Fix Code', 'Detect any bug or compiler issue in this code and write a corrected version.')}
            className="flex items-center gap-1.5 px-2 py-1.5 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg text-left cursor-pointer"
          >
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            Fix Bugs
          </button>
          <button
            onClick={() => triggerAction('Refactor Code', 'Refactor this code to follow standard clean architecture patterns.')}
            className="flex items-center gap-1.5 px-2 py-1.5 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg text-left cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-violet-400" />
            Refactor
          </button>
          <button
            onClick={() => triggerAction('Comment Code', 'Add descriptive documentation and comments to the following code snippet.')}
            className="flex items-center gap-1.5 px-2 py-1.5 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg text-left cursor-pointer"
          >
            <MessageSquareCode className="w-3.5 h-3.5 text-zinc-400" />
            Comments
          </button>
        </div>

        {/* Separator */}
        <div className="h-px bg-white/5 my-1" />

        {/* Custom prompt input field */}
        <form onSubmit={handleCustomSubmit} className="relative flex items-center bg-[#111113] border border-white/5 focus-within:border-[#8B5CF6]/50 rounded-lg overflow-hidden p-1 select-text">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ask AI to edit selection..."
            className="w-full bg-transparent text-[11px] text-white placeholder-zinc-500 outline-none px-2 select-text"
          />
          <button
            type="submit"
            disabled={!customPrompt.trim()}
            className="p-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded text-white cursor-pointer"
          >
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
