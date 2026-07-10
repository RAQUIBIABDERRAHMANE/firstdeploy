'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';

export function useInlineCompletion(editorRef: React.MutableRefObject<any>, monacoRef: React.MutableRefObject<any>) {
  const { settings, workspacePath, activeFile } = useEditorStore();
  const disposeRef = useRef<(() => void) | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !settings.inlineCompletionsEnabled) return;

    const monaco = monacoRef.current;
    const editor = editorRef.current;

    const provider = monaco.languages.registerInlineCompletionsProvider('*', {
      provideInlineCompletions: async (model: any, position: any, _context: any, token: any) => {
        if (token.isCancellationRequested) return { items: [] };

        // Get prefix and suffix
        const offset = model.getOffsetAt(position);
        const fullText = model.getValue();
        const prefix = fullText.slice(0, offset);
        const suffix = fullText.slice(offset);
        const language = model.getLanguageId();

        // Skip very short or whitespace-only prefixes
        const lastLine = prefix.split('\n').pop() || '';
        if (lastLine.trim().length < 2) return { items: [] };

        try {
          const res = await fetch('/api/ai/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prefix: prefix.slice(-2000),
              suffix: suffix.slice(0, 500),
              language,
              filePath: activeFile || '',
              customApiKey: settings.apiKey,
              model: 'llama-3.1-8b-instant'
            })
          });

          if (!res.ok || token.isCancellationRequested) return { items: [] };
          const data = await res.json();
          if (!data.completion || !data.completion.trim()) return { items: [] };

          return {
            items: [{
              insertText: data.completion,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column
              }
            }],
            enableForwardStability: true
          };
        } catch {
          return { items: [] };
        }
      },
      freeInlineCompletions: () => {}
    });

    disposeRef.current = () => provider.dispose();
    return () => disposeRef.current?.();
  }, [editorRef.current, monacoRef.current, settings.inlineCompletionsEnabled, activeFile]);

  // Cleanup on unmount
  useEffect(() => () => disposeRef.current?.(), []);
}
