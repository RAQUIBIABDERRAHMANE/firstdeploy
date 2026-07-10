'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Eye, Wrench, Zap, MessageSquareCode, ArrowRight, FlaskConical, Code2 } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';

interface InlineAiToolbarProps {
  selectionText: string;
  position: { x: number; y: number } | null;
  onClose: () => void;
  editorRef?: React.MutableRefObject<any>;
}

export default function InlineAiToolbar({ selectionText, position, onClose, editorRef }: InlineAiToolbarProps) {
  const { addChatMessage, setAiGenerating, updateLastChatMessage, setAiPanelOpen, settings } = useEditorStore();
  const [customPrompt, setCustomPrompt] = useState('');

  if (!position) return null;

  const sendToChat = async (label: string, systemPrompt: string) => {
    onClose();
    setAiPanelOpen(true);
    const content = `**${label}**\n\n\`\`\`\n${selectionText}\n\`\`\``;
    addChatMessage({ id: Math.random().toString(), role: 'user', content, timestamp: new Date() });
    addChatMessage({ id: Math.random().toString(), role: 'assistant', content: '', timestamp: new Date(), isStreaming: true });
    setAiGenerating(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content }],
          systemPrompt,
          model: settings.aiModel,
          customApiKey: settings.apiKey
        })
      });
      if (!res.ok) throw new Error('Failed');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n'); buf = lines.pop() || '';
          for (const line of lines) {
            const clean = line.trim();
            if (clean.startsWith('data:')) {
              const data = clean.slice(5).trim();
              if (data === '[DONE]') continue;
              try { const p = JSON.parse(data); if (p.text) updateLastChatMessage(p.text, true); } catch {}
            }
          }
        }
      }
      updateLastChatMessage('', false);
    } catch (e: any) {
      updateLastChatMessage(`Error: ${e.message}`, false);
    } finally {
      setAiGenerating(false);
    }
  };

  const insertAtCursor = async (systemPrompt: string) => {
    if (!editorRef?.current) return sendToChat('Insert Code', systemPrompt);
    onClose();
    const editor = editorRef.current;
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: selectionText }],
          systemPrompt,
          model: settings.aiModel,
          customApiKey: settings.apiKey
        })
      });
      if (!res.ok) return;
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buf = '', fullResponse = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n'); buf = lines.pop() || '';
          for (const line of lines) {
            const clean = line.trim();
            if (clean.startsWith('data:')) {
              const data = clean.slice(5).trim();
              if (data === '[DONE]') continue;
              try { const p = JSON.parse(data); if (p.text) fullResponse += p.text; } catch {}
            }
          }
        }
      }
      const codeMatch = fullResponse.match(/```[a-zA-Z]*\n?([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1].trim() : fullResponse.trim();
      const selection = editor.getSelection();
      editor.executeEdits('inline-toolbar', [{ range: selection, text: code, forceMoveMarkers: true }]);
    } catch {}
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    sendToChat(customPrompt, `Apply the following instruction to the provided code: ${customPrompt}`);
    setCustomPrompt('');
  };

  const ACTIONS = [
    {
      label: 'Explain',
      icon: <Eye className="w-3 h-3 text-blue-400" />,
      action: () => sendToChat('Explain Code', 'Explain how this code works in clear, detailed steps.'),
    },
    {
      label: 'Fix Bugs',
      icon: <Wrench className="w-3 h-3 text-emerald-400" />,
      action: () => sendToChat('Fix Bugs', 'Identify and fix any bugs, type errors, or runtime issues in this code. Return the corrected code.'),
    },
    {
      label: 'Refactor',
      icon: <Zap className="w-3 h-3 text-violet-400" />,
      action: () => sendToChat('Refactor', 'Refactor this code following clean architecture best practices. Improve readability and performance.'),
    },
    {
      label: 'Comment',
      icon: <MessageSquareCode className="w-3 h-3 text-zinc-400" />,
      action: () => sendToChat('Add Comments', 'Add clear JSDoc/inline comments to document this code.'),
    },
    {
      label: 'Gen Tests',
      icon: <FlaskConical className="w-3 h-3 text-amber-400" />,
      action: () => sendToChat('Generate Tests', 'Write comprehensive unit tests for this code using Jest and TypeScript. Include edge cases.'),
    },
    {
      label: 'Insert',
      icon: <Code2 className="w-3 h-3 text-cyan-400" />,
      action: () => insertAtCursor('Improve this code and return only the updated version without explanation.'),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      style={{ top: position.y, left: position.x }}
      className="absolute z-50 bg-[#17171b] border border-violet-500/30 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-2 select-none pointer-events-auto min-w-[260px]"
    >
      <div className="flex items-center gap-1.5 px-1 pb-2 mb-1 border-b border-white/[0.05]">
        <Sparkles className="w-3 h-3 text-violet-400" />
        <span className="text-[10.5px] font-semibold text-zinc-400">AI Actions</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2">
        {ACTIONS.map(({ label, icon, action }) => (
          <button
            key={label}
            onClick={action}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl transition-all text-left"
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      <div className="h-px bg-white/[0.04] my-1" />
      <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 bg-[#0f0f12] border border-white/[0.07] focus-within:border-violet-500/40 rounded-xl overflow-hidden p-1.5 mt-1">
        <input
          type="text"
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          placeholder="Custom instruction…"
          className="flex-1 bg-transparent text-[11px] text-white placeholder-zinc-600 outline-none px-1.5"
        />
        <button
          type="submit"
          disabled={!customPrompt.trim()}
          className="p-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-lg text-white transition-colors shrink-0"
        >
          <ArrowRight className="w-3 h-3" />
        </button>
      </form>
    </motion.div>
  );
}
