'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, 
  FolderOpen, 
  File, 
  Plus, 
  FolderPlus, 
  ChevronRight, 
  ChevronDown, 
  Edit3, 
  Trash2, 
  Copy, 
  Clipboard, 
  Download, 
  Upload, 
  X,
  FileCode,
  AlertCircle
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { 
  useDirectoryFiles, 
  useCreateFileOrFolder, 
  useDeleteFileOrFolder, 
  useRenameFileOrFolder, 
  useCopyPasteFileOrFolder,
  useGitStatus
} from '../../hooks/useWorkspace';
import { FileNode } from '../../types';

export default function FileExplorer() {
  const { 
    workspacePath, 
    activeFile, 
    setActiveFile, 
    openTab,
    expandedPaths,
    toggleExpandedPath
  } = useEditorStore();

  const [localTree, setLocalTree] = useState<FileNode[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null);
  const [creatingInPath, setCreatingInPath] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [renamingNode, setRenamingNode] = useState<FileNode | null>(null);
  const [renameName, setRenameName] = useState('');
  const [clipboardNode, setClipboardNode] = useState<FileNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Queries & Mutations
  const { data: rootFiles, isLoading, error, refetch } = useDirectoryFiles(workspacePath);
  const { data: gitData } = useGitStatus(workspacePath);
  
  const createFileMutation = useCreateFileOrFolder();
  const deleteMutation = useDeleteFileOrFolder();
  const renameMutation = useRenameFileOrFolder();
  const copyPasteMutation = useCopyPasteFileOrFolder();

  // Watch root directory query and update tree
  useEffect(() => {
    if (rootFiles) {
      setLocalTree(rootFiles);
    }
  }, [rootFiles]);

  // WebSocket for watch events to auto-refresh
  useEffect(() => {
    if (!workspacePath) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/watch?path=${encodeURIComponent(workspacePath)}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = () => {
      refetch();
    };

    return () => {
      ws.close();
    };
  }, [workspacePath, refetch]);

  // Click handler to close context menu
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Git coloring map helper
  const getGitStatusColor = (filePath: string) => {
    if (!gitData?.isRepository) return '';
    
    const relativePath = workspacePath ? filePath.replace(workspacePath.replace(/\\/g, '/'), '').replace(/^\//, '') : '';
    const match = gitData.changes.find(c => c.file === relativePath);
    if (!match) return '';

    if (match.status.includes('?')) return 'text-emerald-400 font-medium'; // untracked
    if (match.status.includes('A')) return 'text-emerald-400 font-medium'; // added
    if (match.status.includes('M')) return 'text-amber-400 font-medium';   // modified
    if (match.status.includes('D')) return 'text-rose-400 line-through';   // deleted
    return 'text-[#8B5CF6]';
  };

  // Directory listing recursion component
  const DirectoryNode = ({ node, depth }: { node: FileNode; depth: number }) => {
    const isExpanded = expandedPaths.has(node.path);
    const { data: subFiles, refetch: refetchSub } = useDirectoryFiles(isExpanded && node.isDirectory ? node.path : null);
    
    const isSelected = activeFile === node.path;
    const gitColorClass = getGitStatusColor(node.path);

    const handleNodeClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setContextMenu(null);
      if (node.isDirectory) {
        toggleExpandedPath(node.path);
        if (!isExpanded) refetchSub();
      } else {
        setActiveFile(node.path);
        openTab(node.path);
      }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        node
      });
    };

    // Sub-children listing logic
    const childrenToRender = node.isDirectory && isExpanded && subFiles ? subFiles : [];

    return (
      <div className="w-full">
        {/* Node label */}
        <div
          onClick={handleNodeClick}
          onContextMenu={handleContextMenu}
          className={`flex items-center justify-between px-2.5 py-1 text-[12px] cursor-pointer border-l-2 select-none group transition-colors duration-150 ${
            isSelected 
              ? 'bg-[#8B5CF6]/8 border-[#8B5CF6] text-white' 
              : 'border-transparent text-[#A1A1AA] hover:bg-white/3 hover:text-white'
          }`}
          style={{ paddingLeft: `${depth * 10 + 10}px` }}
        >
          <div className="flex items-center gap-1.5 truncate">
            {node.isDirectory ? (
              <>
                <span className="text-[#A1A1AA] group-hover:text-white transition-colors">
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </span>
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-violet-400 shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-violet-400 shrink-0" />
                )}
              </>
            ) : (
              <File className={`w-4 h-4 shrink-0 ${gitColorClass ? 'text-inherit' : 'text-zinc-500'}`} />
            )}
            <span className={`truncate text-[12.5px] ${gitColorClass || ''}`}>{node.name}</span>
          </div>
          
          {/* Quick item actions */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
            {node.isDirectory && (
              <>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatingInPath({ parentPath: node.path, type: 'file' });
                    setNewItemName('');
                  }}
                  className="p-0.5 rounded hover:bg-white/10 text-[#A1A1AA] hover:text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatingInPath({ parentPath: node.path, type: 'folder' });
                    setNewItemName('');
                  }}
                  className="p-0.5 rounded hover:bg-white/10 text-[#A1A1AA] hover:text-white"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Inline Create Input */}
        {creatingInPath?.parentPath === node.path && (
          <div 
            className="flex items-center gap-1.5 py-1 px-2.5 bg-white/3" 
            style={{ paddingLeft: `${(depth + 1) * 10 + 10}px` }}
          >
            {creatingInPath.type === 'folder' ? (
              <Folder className="w-4 h-4 text-violet-400" />
            ) : (
              <File className="w-4 h-4 text-zinc-500" />
            )}
            <input
              ref={createInputRef}
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateItem(node.path);
                if (e.key === 'Escape') setCreatingInPath(null);
              }}
              className="bg-[#17171B] border border-[#8B5CF6]/50 rounded px-1.5 py-0.5 text-[12px] text-white outline-none w-full"
              placeholder={creatingInPath.type === 'folder' ? 'folder-name' : 'file.js'}
              autoFocus
            />
          </div>
        )}

        {/* Render child files recursively */}
        {childrenToRender.length > 0 && (
          <div className="flex flex-col">
            {childrenToRender.map((subNode) => (
              <DirectoryNode key={subNode.path} node={subNode} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleCreateItem = (parentPath: string) => {
    if (!newItemName || !creatingInPath) return;
    const targetPath = `${parentPath}/${newItemName}`;
    createFileMutation.mutate(
      { path: targetPath, type: creatingInPath.type },
      {
        onSuccess: () => {
          setCreatingInPath(null);
          refetch();
        }
      }
    );
  };

  const handleRename = () => {
    if (!renamingNode || !renameName) return;
    const parts = renamingNode.path.split('/');
    parts.pop();
    const newPath = [...parts, renameName].join('/');
    
    renameMutation.mutate(
      { oldPath: renamingNode.path, newPath },
      {
        onSuccess: () => {
          setRenamingNode(null);
          refetch();
        }
      }
    );
  };

  const handleDeleteNode = (node: FileNode) => {
    if (confirm(`Are you sure you want to delete ${node.name}?`)) {
      deleteMutation.mutate(
        { path: node.path },
        {
          onSuccess: () => {
            refetch();
          }
        }
      );
    }
  };

  const handlePaste = (destParent: string) => {
    if (!clipboardNode) return;
    const targetPath = `${destParent}/${clipboardNode.name}`;
    copyPasteMutation.mutate(
      { srcPath: clipboardNode.path, destPath: targetPath },
      {
        onSuccess: () => {
          refetch();
        }
      }
    );
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !workspacePath) return;
    
    // Convert files to base64 or upload via fetch. Since we are in the editor directory,
    // let's execute standard filesystem write calls. We will process file reading in browser:
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const targetPath = `${workspacePath}/${file.name}`;
        
        await fetch('/api/workspace/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: targetPath, content: text || '' })
        });
        refetch();
      };
      reader.readAsText(file);
    });
  };

  const downloadFile = (node: FileNode) => {
    // Open standard file download dialog by calling file GET content
    window.open(`/api/workspace/file?path=${encodeURIComponent(node.path)}`);
  };

  if (!workspacePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#A1A1AA]">
        <AlertCircle className="w-8 h-8 text-[#A1A1AA] mb-2" />
        <span className="text-[12.5px]">Open a folder workspace via URL query to load project files.</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111113]/40 select-none">
      
      {/* Header bar actions */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[rgba(255,255,255,0.06)] bg-[#111113]/60">
        <span className="text-[11.5px] uppercase font-bold text-white/50 tracking-wider">Workspace Files</span>
        
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => {
              setCreatingInPath({ parentPath: workspacePath, type: 'file' });
              setNewItemName('');
            }}
            className="p-1 rounded hover:bg-white/5 text-[#A1A1AA] hover:text-white cursor-pointer"
            title="New File"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => {
              setCreatingInPath({ parentPath: workspacePath, type: 'folder' });
              setNewItemName('');
            }}
            className="p-1 rounded hover:bg-white/5 text-[#A1A1AA] hover:text-white cursor-pointer"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded hover:bg-white/5 text-[#A1A1AA] hover:text-white cursor-pointer"
            title="Upload Files"
          >
            <Upload className="w-3.5 h-3.5" />
            <input 
              ref={fileInputRef} 
              type="file" 
              multiple 
              className="hidden" 
              onChange={handleUpload} 
            />
          </button>
        </div>
      </div>

      {/* Main scrolling file list */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="px-4 py-2 flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 rounded shimmer" style={{ width: `${60 + Math.random() * 30}%` }} />
            ))}
          </div>
        ) : error ? (
          <div className="px-4 py-3 text-rose-400 text-[12px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>Failed to read workspace.</span>
          </div>
        ) : localTree.length === 0 ? (
          <div className="px-4 py-3 text-[#A1A1AA] text-[12px]">
            Workspace folder is empty.
          </div>
        ) : (
          <div className="flex flex-col">
            {localTree.map((node) => (
              <DirectoryNode key={node.path} node={node} depth={0} />
            ))}
          </div>
        )}
      </div>

      {/* Context Menu Overlay */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.08 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 min-w-[140px] bg-[#17171B]/95 border border-[rgba(255,255,255,0.08)] backdrop-blur-md rounded-lg shadow-2xl p-1 select-none"
          >
            {contextMenu.node.isDirectory && (
              <>
                <button
                  onClick={() => {
                    setCreatingInPath({ parentPath: contextMenu.node.path, type: 'file' });
                    setNewItemName('');
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-[12px] text-zinc-300 hover:text-white hover:bg-white/5 rounded flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New File
                </button>
                <button
                  onClick={() => {
                    setCreatingInPath({ parentPath: contextMenu.node.path, type: 'folder' });
                    setNewItemName('');
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-[12px] text-zinc-300 hover:text-white hover:bg-white/5 rounded flex items-center gap-2"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  New Folder
                </button>
                <div className="h-px bg-white/5 my-1" />
              </>
            )}

            <button
              onClick={() => {
                setRenamingNode(contextMenu.node);
                setRenameName(contextMenu.node.name);
              }}
              className="w-full text-left px-2.5 py-1.5 text-[12px] text-zinc-300 hover:text-white hover:bg-white/5 rounded flex items-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Rename
            </button>
            <button
              onClick={() => setClipboardNode(contextMenu.node)}
              className="w-full text-left px-2.5 py-1.5 text-[12px] text-zinc-300 hover:text-white hover:bg-white/5 rounded flex items-center gap-2"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
            {contextMenu.node.isDirectory && clipboardNode && (
              <button
                onClick={() => handlePaste(contextMenu.node.path)}
                className="w-full text-left px-2.5 py-1.5 text-[12px] text-zinc-300 hover:text-white hover:bg-white/5 rounded flex items-center gap-2"
              >
                <Clipboard className="w-3.5 h-3.5" />
                Paste
              </button>
            )}
            {!contextMenu.node.isDirectory && (
              <button
                onClick={() => downloadFile(contextMenu.node)}
                className="w-full text-left px-2.5 py-1.5 text-[12px] text-zinc-300 hover:text-white hover:bg-white/5 rounded flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            )}
            <div className="h-px bg-white/5 my-1" />
            {!contextMenu.node.isDirectory && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(contextMenu.node.path)}`);
                    if (!res.ok) return;
                    const data = await res.json();
                    const fileName = contextMenu.node.name;
                    const ext = fileName.split('.').pop() || '';
                    setContextMenu(null);
                    // Open AI panel and inject file as a message
                    useEditorStore.getState().setAiPanelOpen(true);
                    useEditorStore.getState().addChatMessage({
                      id: Math.random().toString(),
                      role: 'user',
                      content: `Here is the content of **${fileName}** for context:\n\`\`\`${ext}\n${data.content.slice(0, 8000)}\n\`\`\``,
                      timestamp: new Date()
                    });
                  } catch {}
                }}
                className="w-full text-left px-2.5 py-1.5 text-[12px] text-violet-300 hover:text-violet-200 hover:bg-violet-500/10 rounded flex items-center gap-2"
              >
                <FileCode className="w-3.5 h-3.5" />
                Send to AI
              </button>
            )}
            <div className="h-px bg-white/5 my-1" />
            <button
              onClick={() => handleDeleteNode(contextMenu.node)}
              className="w-full text-left px-2.5 py-1.5 text-[12px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Rename Dialog Modal */}
      {renamingNode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-[#17171B] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-semibold text-white">Rename Node</span>
              <button onClick={() => setRenamingNode(null)} className="p-1 hover:bg-white/5 rounded text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={renameInputRef}
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
              }}
              className="w-full bg-[#111113] border border-white/5 focus:border-[#8B5CF6]/50 rounded-lg px-3 py-2 text-[13px] text-white outline-none mb-4"
              placeholder="New name"
            />
            <div className="flex justify-end gap-2 text-[12px]">
              <button
                onClick={() => setRenamingNode(null)}
                className="px-3 py-1.5 bg-white/5 border border-white/5 hover:bg-white/10 rounded-lg text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-3 py-1.5 bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg text-white font-medium transition-colors"
              >
                Rename
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
