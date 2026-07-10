'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, XCircle, GitCompare, ChevronDown, ChevronUp } from 'lucide-react';

interface DiffModalProps {
  file: string;
  original: string;
  modified: string;
  onAccept: () => void;
  onReject: () => void;
}

export default function DiffModal({ file, original, modified, onAccept, onReject }: DiffModalProps) {
  const [expanded, setExpanded] = useState(true);
  const diff = computeLineDiff(original, modified);
  const addedLines = diff.filter(l => l.type === 'added').length;
  const removedLines = diff.filter(l => l.type === 'removed').length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      >
        <div className="w-full max-w-4xl max-h-[80vh] flex flex-col bg-[#111113] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-[#0c0c0e] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                <GitCompare className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">AI Proposed Changes</p>
                <p className="text-[11px] text-zinc-500 font-mono">{file.split('/').pop()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  +{addedLines} added
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                  -{removedLines} removed
                </span>
              </div>
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Diff view */}
          {expanded && (
            <div className="flex-1 overflow-auto">
              <pre className="text-[12px] font-mono leading-[1.7] p-4">
                {diff.map((line, i) => (
                  <div
                    key={i}
                    className={`px-2 rounded-sm ${
                      line.type === 'added'
                        ? 'bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-500/60'
                        : line.type === 'removed'
                        ? 'bg-rose-500/10 text-rose-300 border-l-2 border-rose-500/60'
                        : 'text-zinc-400'
                    }`}
                  >
                    <span className="select-none text-[10px] opacity-40 mr-3 w-6 inline-block text-right">
                      {i + 1}
                    </span>
                    <span className="select-none mr-2 opacity-60">
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    {line.content}
                  </div>
                ))}
              </pre>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.06] bg-[#0c0c0e] shrink-0">
            <p className="text-[11px] text-zinc-600">
              Review changes before applying to <span className="text-zinc-400 font-mono">{file.split('/').pop()}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onReject}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                Discard
              </button>
              <button
                onClick={onAccept}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium text-white bg-violet-600 hover:bg-violet-500 shadow-[0_0_16px_rgba(124,58,237,0.3)] hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                Accept Changes
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

function computeLineDiff(original: string, modified: string): DiffLine[] {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const lcs = computeLCS(origLines, modLines);
  
  let oi = 0;
  let mi = 0;
  let li = 0;

  while (oi < origLines.length || mi < modLines.length) {
    if (li < lcs.length && oi < origLines.length && origLines[oi] === lcs[li] && mi < modLines.length && modLines[mi] === lcs[li]) {
      result.push({ type: 'unchanged', content: origLines[oi] });
      oi++; mi++; li++;
    } else if (mi < modLines.length && (li >= lcs.length || modLines[mi] !== lcs[li])) {
      result.push({ type: 'added', content: modLines[mi] });
      mi++;
    } else if (oi < origLines.length) {
      result.push({ type: 'removed', content: origLines[oi] });
      oi++;
    }
  }

  return result;
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = Math.min(a.length, 200);
  const n = Math.min(b.length, 200);
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return lcs;
}
