'use client';

import React, { useState } from 'react';
import { Copy, Check, FileEdit } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';

interface MarkdownRendererProps {
  content: string;
  onApplyCode?: (code: string, language: string) => void;
}

export default function MarkdownRenderer({ content, onApplyCode }: MarkdownRendererProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { activeFile, workspacePath } = useEditorStore();

  if (!content) return null;

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApply = async (code: string, language: string) => {
    if (onApplyCode) {
      onApplyCode(code, language);
      return;
    }
    if (!activeFile) return;
    try {
      await fetch('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFile, content: code })
      });
    } catch {}
  };

  // Split into code blocks and prose
  const segments = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="flex flex-col gap-1.5 w-full text-[12.5px] leading-relaxed">
      {segments.map((seg, idx) => {
        if (seg.startsWith('```')) {
          const lines = seg.split('\n');
          const langLine = lines[0].replace('```', '').trim();
          const code = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n');
          const blockId = `cb-${idx}`;

          return (
            <div key={idx} className="my-2 rounded-xl overflow-hidden border border-white/[0.06] shadow-lg">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#0c0c0e] border-b border-white/[0.05]">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  {langLine || 'code'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopy(code, blockId)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {copiedId === blockId
                      ? <Check className="w-3 h-3 text-emerald-400" />
                      : <Copy className="w-3 h-3" />}
                    <span>{copiedId === blockId ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => handleApply(code, langLine)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] text-violet-400 hover:text-violet-200 hover:bg-violet-500/10 transition-colors"
                  >
                    <FileEdit className="w-3 h-3" />
                    <span>Apply</span>
                  </button>
                </div>
              </div>
              <pre className="p-4 bg-[#13131a] overflow-x-auto text-[12px] font-mono text-zinc-100 leading-[1.65]">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Prose renderer
        return <ProseBlock key={idx} text={seg} />;
      })}
    </div>
  );
}

function ProseBlock({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;

        // Headings
        const h3 = line.match(/^###\s+(.*)/);
        if (h3) return (
          <h3 key={i} className="text-[13px] font-bold text-white mt-2 mb-0.5 tracking-tight">
            {renderInline(h3[1])}
          </h3>
        );
        const h2 = line.match(/^##\s+(.*)/);
        if (h2) return (
          <h2 key={i} className="text-[14px] font-bold text-white mt-2.5 mb-1 tracking-tight">
            {renderInline(h2[1])}
          </h2>
        );
        const h1 = line.match(/^#\s+(.*)/);
        if (h1) return (
          <h1 key={i} className="text-[15px] font-extrabold text-white mt-3 mb-1.5 tracking-tight">
            {renderInline(h1[1])}
          </h1>
        );

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(line.trim())) return (
          <hr key={i} className="border-white/10 my-2" />
        );

        // Unordered list
        const li = line.match(/^[-*•]\s+(.*)/);
        if (li) return (
          <div key={i} className="flex gap-2 items-start ml-2">
            <span className="text-violet-400 mt-0.5 shrink-0">•</span>
            <span className="text-zinc-300">{renderInline(li[1])}</span>
          </div>
        );

        // Ordered list
        const oli = line.match(/^(\d+)\.\s+(.*)/);
        if (oli) return (
          <div key={i} className="flex gap-2 items-start ml-2">
            <span className="text-zinc-500 font-mono text-[11px] shrink-0 mt-0.5">{oli[1]}.</span>
            <span className="text-zinc-300">{renderInline(oli[2])}</span>
          </div>
        );

        // Blockquote
        const bq = line.match(/^>\s+(.*)/);
        if (bq) return (
          <div key={i} className="border-l-2 border-violet-500/50 pl-3 italic text-zinc-400 my-0.5">
            {renderInline(bq[1])}
          </div>
        );

        // Regular paragraph
        return (
          <p key={i} className="text-zinc-300">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  // Handle **bold**, *italic*, `code` inline
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={i} className="text-zinc-200 italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-white/8 text-violet-300 font-mono text-[11px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
