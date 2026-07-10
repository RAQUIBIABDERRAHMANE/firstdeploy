'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, Trash2, Clock, ChevronLeft, X } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { ChatSession } from '../../types';

interface ChatSessionManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatSessionManager({ isOpen, onClose }: ChatSessionManagerProps) {
  const {
    chatSessions,
    activeChatSessionId,
    loadSession,
    deleteSession,
    saveCurrentSession,
    clearChat,
    chatMessages
  } = useEditorStore();

  const handleNewChat = () => {
    // Auto-save current session if it has messages
    if (chatMessages.length > 0) {
      saveCurrentSession();
    }
    clearChat();
    onClose();
  };

  const handleLoadSession = (sessionId: string) => {
    loadSession(sessionId);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteSession(sessionId);
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 z-50 flex flex-col bg-[#111113] border-r border-white/[0.06]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-violet-400" />
              <span className="text-[13px] font-semibold text-white">Chat History</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat button */}
          <div className="px-3 py-3 shrink-0">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-600/15 hover:bg-violet-600/25 border border-violet-500/20 hover:border-violet-500/40 text-[12px] font-medium text-violet-300 hover:text-violet-200 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
            {chatSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center py-10 gap-2">
                <Clock className="w-8 h-8 text-zinc-700" />
                <p className="text-[12px] text-zinc-600">No saved sessions yet</p>
                <p className="text-[11px] text-zinc-700">Your conversations will appear here</p>
              </div>
            ) : (
              chatSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isActive={session.id === activeChatSessionId}
                  onLoad={() => handleLoadSession(session.id)}
                  onDelete={(e) => handleDelete(e, session.id)}
                  formatDate={formatDate}
                />
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SessionCardProps {
  session: ChatSession;
  isActive: boolean;
  onLoad: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatDate: (date: Date) => string;
}

function SessionCard({ session, isActive, onLoad, onDelete, formatDate }: SessionCardProps) {
  const msgCount = session.messages.filter(m => m.role === 'user').length;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      onClick={onLoad}
      className={`group relative flex flex-col gap-1 px-3 py-2.5 rounded-xl cursor-pointer border transition-all ${
        isActive
          ? 'bg-violet-600/15 border-violet-500/30 text-white'
          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04] hover:border-white/[0.06] text-zinc-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium leading-snug line-clamp-2 flex-1">
          {session.title}
        </p>
        <button
          onClick={onDelete}
          className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center gap-2 text-[10.5px] text-zinc-600">
        <Clock className="w-2.5 h-2.5" />
        <span>{formatDate(session.updatedAt)}</span>
        <span className="text-zinc-700">•</span>
        <span>{msgCount} {msgCount === 1 ? 'message' : 'messages'}</span>
      </div>
    </motion.div>
  );
}
