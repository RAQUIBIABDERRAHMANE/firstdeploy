'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, X, Loader2 } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';

interface InlinePromptBarProps {
  editorRef: React.MutableRefObject<any>;
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number } | null;
}

export default function InlinePromptBar({ editorRef, isOpen, onClose, position }: InlinePromptBarProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings, activeFile } = useEditorStore();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setPrompt('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !editorRef.current || !activeFile) return;
    setIsLoading(true);

    try {
      const editor = editorRef.current;
      const model = editor.getModel();
      const selection = editor.getSelection();
      const selectedText = model.getValueInRange(selection);
      const fullContent = model.getValue();
      const language = model.getLanguageId();

      const context = selectedText
        ? `Selected code:\n\`\`\`${language}\n${selectedText}\n\`\`\`\n\nInstruction: ${prompt}`
        : `File content:\n\`\`\`${language}\n${fullContent.slice(0, 3000)}\n\`\`\`\n\nInstruction: ${prompt}`;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: context }],
          systemPrompt: `You are an expert code editor. The user will give you an instruction about their code. 
Return ONLY the updated code as a raw code block (no explanation). 
If the instruction applies to a selection, return only the replacement for that selection.
If it applies to the whole file, return the entire updated file content.`,
          model: settings.aiModel,
          customApiKey: settings.apiKey
        })
      });

      if (!res.ok) throw new Error('Failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const clean = line.trim();
            if (clean.startsWith('data:')) {
              const data = clean.slice(5).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) fullResponse += parsed.text;
              } catch {}
            }
          }
        }
      }

      // Extract code from response
      const codeMatch = fullResponse.match(/```[a-zA-Z]*\n?([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1].trim() : fullResponse.trim();

      // Apply to editor
      if (selectedText && selection) {
        editor.executeEdits('inline-prompt', [{
          range: selection,
          text: code,
          forceMoveMarkers: true
        }]);
      } else {
        model.setValue(code);
        // Auto-save
        await fetch('/api/workspace/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: activeFile, content: code })
        });
      }

      onClose();
    } catch (err) {
      console.error('Inline prompt error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && position && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -6 }}
          transition={{ duration: 0.15 }}
          style={{ top: position.top, left: position.left }}
          className="absolute z-[100] w-[380px] bg-[#17171b] border border-violet-500/30 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.05]">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="text-[11px] text-zinc-500 font-medium">Edit with AI (Ctrl+K)</span>
          </div>
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2.5">
            <input
              ref={inputRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe what to change…"
              className="flex-1 bg-transparent text-[12.5px] text-white placeholder-zinc-600 outline-none"
              onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                type="submit"
                disabled={!prompt.trim() || isLoading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[11.5px] font-medium transition-all shadow-[0_0_12px_rgba(124,58,237,0.3)]"
              >
                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                <span>{isLoading ? 'Editing…' : 'Apply'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
