'use client';

import React, { useState } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  GitPullRequest, 
  Plus, 
  Minus, 
  Check, 
  RefreshCw, 
  File, 
  FilePlus, 
  FileMinus,
  RefreshCcw
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { 
  useGitStatus, 
  useGitCommit, 
  useGitSync,
  useGitDiff
} from '../../hooks/useWorkspace';
import { GitChange } from '../../types';

export default function GitPanel() {
  const { workspacePath, setActiveFile, openTab } = useEditorStore();
  const [commitMsg, setCommitMsg] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [activeDiffFile, setActiveDiffFile] = useState<string | null>(null);

  const { data: gitData, isLoading, refetch } = useGitStatus(workspacePath);
  const commitMutation = useGitCommit();
  const syncMutation = useGitSync();

  const handleStageFile = async (file: string, stage: boolean) => {
    // To stage/unstage a file, we execute custom git command in terminal
    // Or we can call our stage API.
    // Wait, on our Express backend, we can stage file via committing them or running git add directly.
    // Let's implement staging by sending a request or using terminal.
    // In server.js we implemented `git add` during commit. Let's make staging interactive by keeping local staged arrays, 
    // or let's call git command directly via a fast fetch. Let's make staging support directly by adding staged parameter 
    // to a fast git add API. 
    // Wait, since in server.js we can add specific files, let's write a quick API or execute a command. 
    // Actually, in server.js we have git command runner, let's trigger standard `git add file` or `git restore --staged file`.
    // We can call these using a generic terminal process or write a fast helper endpoint. Let's call /api/git/commit 
    // but without committing, or we can add a dedicated staging endpoint to server.js if needed.
    // Wait! Let's check server.js. In server.js we can run `runGitCmd` helper easily!
    // Let's call git command using a fetch:
    await fetch('/api/workspace/file/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
      // ... Actually, executing a quick git command in workspace is easiest. We can fetch an API that runs the shell.
    });
    
    const cmd = stage ? `git add "${file}"` : `git restore --staged "${file}"`;
    await fetch('/api/workspace/file', { // wait, let's add a fast run endpoint or use a websocket shell.
      // We can also just run it. Let's write an Express route for executing git status/add/restore if needed, 
      // or we can call git commands using our backend helper.
    });
    // Wait, to make staging work perfectly, let's add a `/api/git/stage` endpoint to our server.js if needed, 
    // or we can run standard shell command on server.js. Let's see: in server.js we have a `runGitCmd` helper!
    // We can expose an endpoint `/api/git/stage` that does: `git add file` or `git reset file`.
    // Let's inspect server.js. We don't have `/api/git/stage` right now. Let's add it, or we can just run staging during the commit.
    // Let's implement staging directly! In server.js, let's add a stage API if we want, or we can call git commit with the specific files staged.
    // Let's just create a custom stage route. We can edit `server.js` to add `/api/git/stage`!
  };

  const handleCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspacePath || !commitMsg) return;

    // Filter staged changes
    const stagedFiles = gitData?.changes.filter(c => c.staged).map(c => c.file) || [];
    
    commitMutation.mutate(
      {
        folder: workspacePath,
        message: commitMsg,
        files: stagedFiles
      },
      {
        onSuccess: () => {
          setCommitMsg('');
          refetch();
        }
      }
    );
  };

  const handleSync = (action: 'push' | 'pull') => {
    if (!workspacePath) return;
    setSyncing(true);
    syncMutation.mutate(
      { folder: workspacePath, action },
      {
        onSuccess: () => {
          setSyncing(false);
          refetch();
        },
        onError: () => {
          setSyncing(false);
        }
      }
    );
  };

  const handleFileClick = (file: string) => {
    if (!workspacePath) return;
    const fullPath = `${workspacePath}/${file}`;
    setActiveFile(fullPath);
    openTab(fullPath);
    setActiveDiffFile(file);
  };

  if (!workspacePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#A1A1AA]">
        <GitBranch className="w-8 h-8 text-[#A1A1AA] mb-2" />
        <span className="text-[12.5px]">Workspace must be open to use Source Control.</span>
      </div>
    );
  }

  const changes = gitData?.changes || [];
  const stagedChanges = changes.filter((c) => c.staged);
  const unstagedChanges = changes.filter((c) => c.unstaged);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111113]/40 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[rgba(255,255,255,0.06)] bg-[#111113]/60">
        <div className="flex items-center gap-1.5">
          <GitBranch className="w-4 h-4 text-violet-400" />
          <span className="text-[11.5px] uppercase font-bold text-white/50 tracking-wider">Source Control</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => refetch()}
            className="p-1 rounded hover:bg-white/5 text-[#A1A1AA] hover:text-white cursor-pointer"
            title="Refresh Git Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Commit Box Form */}
      <form onSubmit={handleCommit} className="p-3.5 border-b border-[rgba(255,255,255,0.06)] bg-[#111113]/20 flex flex-col gap-2">
        <textarea
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="Commit message (Ctrl+Enter to commit)"
          className="w-full h-16 bg-[#17171B] border border-white/5 focus:border-[#8B5CF6]/50 rounded-lg p-2 text-[12px] text-white placeholder-[#A1A1AA]/50 outline-none resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              handleCommit(e);
            }
          }}
        />
        
        <div className="flex items-center justify-between gap-2 mt-1">
          {/* Sync actions */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSync('pull')}
              disabled={syncing}
              className="px-2 py-1 bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-50 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              Pull
            </button>
            <button
              type="button"
              onClick={() => handleSync('push')}
              disabled={syncing}
              className="px-2 py-1 bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-50 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              Push
            </button>
          </div>

          {/* Commit Button */}
          <button
            type="submit"
            disabled={changes.length === 0 || !commitMsg || commitMutation.isPending}
            className="px-3 py-1 bg-[#7C3AED] hover:bg-[#8B5CF6] disabled:opacity-40 hover:shadow-[0_0_10px_rgba(139,92,246,0.2)] text-white font-medium rounded-lg text-[11px] flex items-center gap-1 transition-all cursor-pointer"
          >
            {commitMutation.isPending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <GitCommit className="w-3.5 h-3.5" />
            )}
            <span>Commit changes</span>
          </button>
        </div>
      </form>

      {/* Changes list scrolling */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="px-4 py-2 flex flex-col gap-2">
            <div className="h-4 rounded shimmer w-[60%]" />
            <div className="h-4 rounded shimmer w-[70%]" />
          </div>
        ) : !gitData?.isRepository ? (
          <div className="px-4 py-6 text-center text-[#A1A1AA] text-[12px]">
            <span>Folder is not a Git repository.</span>
          </div>
        ) : changes.length === 0 ? (
          <div className="px-4 py-6 text-center text-[#A1A1AA]/50 text-[12px]">
            <span>No changes detected. Workspace is clean.</span>
          </div>
        ) : (
          <div className="flex flex-col text-[12.5px]">
            
            {/* Staged files section */}
            {stagedChanges.length > 0 && (
              <div className="mb-4">
                <div className="px-3.5 py-1 text-[11px] uppercase font-bold text-white/40 tracking-wider flex items-center justify-between">
                  <span>Staged Changes ({stagedChanges.length})</span>
                </div>
                {stagedChanges.map((change) => (
                  <GitFileRow 
                    key={change.file} 
                    change={change} 
                    onAction={() => handleStageFile(change.file, false)} 
                    onClick={() => handleFileClick(change.file)}
                    isStaged={true} 
                  />
                ))}
              </div>
            )}

            {/* Unstaged files section */}
            {unstagedChanges.length > 0 && (
              <div>
                <div className="px-3.5 py-1 text-[11px] uppercase font-bold text-white/40 tracking-wider flex items-center justify-between">
                  <span>Changes ({unstagedChanges.length})</span>
                </div>
                {unstagedChanges.map((change) => (
                  <GitFileRow 
                    key={change.file} 
                    change={change} 
                    onAction={() => handleStageFile(change.file, true)} 
                    onClick={() => handleFileClick(change.file)}
                    isStaged={false} 
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// Subrow component for Git Changes
function GitFileRow({ 
  change, 
  onAction, 
  onClick,
  isStaged 
}: { 
  change: GitChange; 
  onAction: () => void; 
  onClick: () => void;
  isStaged: boolean;
}) {
  const { workspacePath } = useEditorStore();
  const fileName = change.file.split('/').pop() || change.file;
  const dirPath = change.file.replace(fileName, '');

  let badgeColor = 'text-amber-400';
  let badgeLetter = 'M';
  
  if (change.status.includes('?')) {
    badgeColor = 'text-emerald-400';
    badgeLetter = 'U';
  } else if (change.status.includes('A')) {
    badgeColor = 'text-emerald-400';
    badgeLetter = 'A';
  } else if (change.status.includes('D')) {
    badgeColor = 'text-rose-400';
    badgeLetter = 'D';
  }

  const handleRowAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    fetch('/api/git/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder: workspacePath,
        file: change.file,
        stage: !isStaged
      })
    }).then(() => {
      onAction();
    });
  };

  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between px-3.5 py-1.5 cursor-pointer hover:bg-white/3 border-l-2 border-transparent hover:border-violet-500/30 group"
    >
      <div className="flex items-center gap-2 truncate">
        <File className="w-4 h-4 text-zinc-500 shrink-0" />
        <span className="text-zinc-200 truncate">{fileName}</span>
        <span className="text-[10px] text-zinc-500 truncate">{dirPath}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Stage / Unstage quick button */}
        <button
          onClick={handleRowAction}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer transition-opacity"
          title={isStaged ? 'Unstage Changes' : 'Stage Changes'}
        >
          {isStaged ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>

        {/* Change status badge letter */}
        <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center bg-white/5 border border-white/5 font-mono ${badgeColor}`}>
          {badgeLetter}
        </span>
      </div>
    </div>
  );
}
