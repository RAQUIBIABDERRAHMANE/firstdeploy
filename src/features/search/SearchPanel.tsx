'use client';

import React, { useState } from 'react';
import { 
  Search, 
  Replace, 
  ChevronRight, 
  ChevronDown, 
  File, 
  CaseSensitive, 
  Regex,
  Filter,
  RefreshCw,
  X
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useSearchWorkspace } from '../../hooks/useWorkspace';
import { SearchResult } from '../../types';

export default function SearchPanel() {
  const { workspacePath, setActiveFile, openTab } = useEditorStore();
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [includeFiles, setIncludeFiles] = useState('');
  const [excludeFiles, setExcludeFiles] = useState('');
  
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearched, setIsSearched] = useState(false);

  const searchMutation = useSearchWorkspace();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!workspacePath || !query) return;

    searchMutation.mutate(
      {
        folder: workspacePath,
        query,
        isRegex,
        matchCase,
        include: includeFiles || undefined,
        exclude: excludeFiles || undefined
      },
      {
        onSuccess: (data) => {
          setResults(data);
          setIsSearched(true);
        }
      }
    );
  };

  const handleResultClick = (filePath: string) => {
    setActiveFile(filePath);
    openTab(filePath);
    // Future work: we could pass the line number to Monaco to scroll to line
  };

  // Group results by file
  const groupedResults: Record<string, SearchResult[]> = {};
  results.forEach(res => {
    if (!groupedResults[res.path]) {
      groupedResults[res.path] = [];
    }
    groupedResults[res.path].push(res);
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111113]/40 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[rgba(255,255,255,0.06)] bg-[#111113]/60">
        <span className="text-[11.5px] uppercase font-bold text-white/50 tracking-wider">Search Workspace</span>
        <button 
          onClick={() => {
            setResults([]);
            setQuery('');
            setIsSearched(false);
          }}
          className="p-1 rounded hover:bg-white/5 text-[#A1A1AA] hover:text-white cursor-pointer"
          title="Clear Results"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Inputs Form */}
      <form onSubmit={handleSearch} className="p-3.5 flex flex-col gap-2.5 border-b border-[rgba(255,255,255,0.06)] bg-[#111113]/20">
        
        {/* Search row */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[#17171B] border border-white/5 focus:border-[#8B5CF6]/50 rounded px-2.5 py-1.5 pl-8 text-[12.5px] text-white placeholder-[#A1A1AA]/60 outline-none"
            placeholder="Search text..."
          />
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#A1A1AA]/60" />
          
          {/* Options toggle buttons */}
          <div className="absolute right-2.5 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMatchCase(!matchCase)}
              className={`p-0.5 rounded cursor-pointer transition-colors ${
                matchCase ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30' : 'text-[#A1A1AA] hover:text-white'
              }`}
              title="Match Case"
            >
              <CaseSensitive className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsRegex(!isRegex)}
              className={`p-0.5 rounded cursor-pointer transition-colors ${
                isRegex ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30' : 'text-[#A1A1AA] hover:text-white'
              }`}
              title="Use Regular Expression"
            >
              <Regex className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Replace Row */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            className="w-full bg-[#17171B] border border-white/5 focus:border-[#8B5CF6]/50 rounded px-2.5 py-1.5 pl-8 text-[12.5px] text-white placeholder-[#A1A1AA]/60 outline-none"
            placeholder="Replace text (visual reference)..."
          />
          <Replace className="absolute left-2.5 w-3.5 h-3.5 text-[#A1A1AA]/60" />
        </div>

        {/* Filters Toggle */}
        <div className="flex items-center justify-between text-[11px]">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 text-[#A1A1AA] hover:text-white cursor-pointer"
          >
            <Filter className="w-3 h-3" />
            <span>Files to include/exclude</span>
          </button>
          
          <button
            type="submit"
            className="px-2.5 py-1 bg-[#7C3AED] hover:bg-[#8B5CF6] hover:shadow-[0_0_10px_rgba(139,92,246,0.25)] rounded text-white font-medium flex items-center gap-1 transition-all cursor-pointer"
          >
            {searchMutation.isPending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Search className="w-3 h-3" />
            )}
            <span>Search</span>
          </button>
        </div>

        {/* Files Filters inputs */}
        {showFilters && (
          <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2 mt-1">
            <input
              type="text"
              value={includeFiles}
              onChange={(e) => setIncludeFiles(e.target.value)}
              className="w-full bg-[#17171B] border border-white/5 rounded px-2 py-1 text-[11.5px] text-white placeholder-[#A1A1AA]/50 outline-none"
              placeholder="e.g. *.ts, src/"
            />
            <input
              type="text"
              value={excludeFiles}
              onChange={(e) => setExcludeFiles(e.target.value)}
              className="w-full bg-[#17171B] border border-white/5 rounded px-2 py-1 text-[11.5px] text-white placeholder-[#A1A1AA]/50 outline-none"
              placeholder="exclude (e.g. node_modules)"
            />
          </div>
        )}
      </form>

      {/* Results Scrolling List */}
      <div className="flex-1 overflow-y-auto py-2">
        {searchMutation.isPending ? (
          <div className="px-4 py-2 flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 rounded shimmer w-[80%]" />
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="flex flex-col">
            <div className="px-3.5 py-1 text-[11px] text-[#A1A1AA]/80 font-medium">
              Found {results.length} matches in {Object.keys(groupedResults).length} files
            </div>
            
            {Object.entries(groupedResults).map(([filePath, fileMatches]) => {
              const fileName = filePath.split('/').pop() || filePath;
              const dirPath = filePath.replace(fileName, '');

              return (
                <div key={filePath} className="mb-2">
                  {/* File group header */}
                  <div 
                    onClick={() => handleResultClick(filePath)}
                    className="flex items-center gap-1.5 px-3 py-1 cursor-pointer hover:bg-white/3 text-[#A1A1AA] hover:text-white"
                  >
                    <File className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span className="text-[12px] font-medium truncate">{fileName}</span>
                    <span className="text-[10px] text-zinc-500 truncate">{dirPath}</span>
                  </div>

                  {/* Line matches list */}
                  <div className="flex flex-col">
                    {fileMatches.map((match, i) => (
                      <div
                        key={i}
                        onClick={() => handleResultClick(match.path)}
                        className="flex items-start gap-2 pl-7 pr-3.5 py-0.5 cursor-pointer hover:bg-white/5 text-[11.5px]"
                      >
                        <span className="text-[#8B5CF6] font-mono select-none w-5 shrink-0 text-right">
                          {match.line}
                        </span>
                        <code className="text-zinc-300 font-mono break-all truncate">
                          {match.content}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : isSearched ? (
          <div className="px-4 py-3 text-[#A1A1AA] text-[12px]">
            No results found.
          </div>
        ) : (
          <div className="px-4 py-3 text-[#A1A1AA]/50 text-[12px] text-center mt-10">
            Enter a query and click search to scan files.
          </div>
        )}
      </div>

    </div>
  );
}
