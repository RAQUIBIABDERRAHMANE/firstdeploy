'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  Plus, 
  X, 
  Terminal as TermIcon, 
  Trash2, 
  Maximize2, 
  Minimize2,
  Columns
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';

import '@xterm/xterm/css/xterm.css';

export default function TerminalPanel() {
  const { 
    workspacePath, 
    terminalTabs, 
    activeTerminalId, 
    addTerminalTab, 
    removeTerminalTab, 
    setActiveTerminalId 
  } = useEditorStore();

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize a terminal tab if empty
  useEffect(() => {
    if (terminalTabs.length === 0 && workspacePath) {
      addTerminalTab();
    }
  }, [terminalTabs.length, workspacePath, addTerminalTab]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111113]/90 relative">
      
      {/* Terminal tabs header */}
      <div className="h-9 w-full border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between px-3 bg-[#09090B]/60 select-none">
        
        {/* Terminal tabs */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-[80%]">
          {terminalTabs.map((tab) => {
            const isActive = activeTerminalId === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTerminalId(tab.id)}
                className={`group flex items-center gap-1.5 px-3 py-1 text-[11.5px] rounded-t-md cursor-pointer transition-colors border-t-2 ${
                  isActive
                    ? 'bg-[#111113] border-[#8B5CF6] text-white'
                    : 'bg-transparent border-transparent text-[#A1A1AA] hover:bg-white/3 hover:text-white'
                }`}
              >
                <TermIcon className="w-3 h-3 text-[#A1A1AA]" />
                <span className="truncate max-w-[80px]">{tab.name}</span>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTerminalTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          
          {/* New tab button */}
          <button
            onClick={() => addTerminalTab()}
            className="p-1 rounded hover:bg-white/5 text-[#A1A1AA] hover:text-white cursor-pointer ml-1"
            title="New Terminal"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Layout actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 rounded hover:bg-white/5 text-[#A1A1AA] hover:text-white cursor-pointer"
            title={isFullscreen ? 'Exit Maximize' : 'Maximize Panel'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminals container */}
      <div className="flex-1 w-full bg-[#111113] overflow-hidden relative">
        {terminalTabs.map((tab) => (
          <SingleTerminalInstance
            key={tab.id}
            visible={activeTerminalId === tab.id}
            tab={tab}
          />
        ))}
      </div>

    </div>
  );
}

// Single terminal instance component
function SingleTerminalInstance({ visible, tab }: { visible: boolean; tab: any }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<any>(null);
  const fitAddonInstance = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    let terminal: any;
    let fitAddon: any;
    let ws: WebSocket;

    const setupTerminal = async () => {
      // Dynamic imports for browser APIs compatibility
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      // Initialize xterm
      terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 12,
        fontFamily: 'Fira Code, SFMono-Regular, Consolas, Courier New, monospace',
        theme: {
          background: '#111113',
          foreground: '#FFFFFF',
          cursor: '#8B5CF6',
          selectionBackground: 'rgba(139, 92, 246, 0.3)',
          black: '#000000',
          red: '#EF4444',
          green: '#10B981',
          yellow: '#F59E0B',
          blue: '#3B82F6',
          magenta: '#8B5CF6',
          cyan: '#06B6D4',
          white: '#E4E4E7',
          brightBlack: '#71717A',
          brightRed: '#F87171',
          brightGreen: '#34D399',
          brightYellow: '#FBBF24',
          brightBlue: '#60A5FA',
          brightMagenta: '#A78BFA',
          brightCyan: '#22D3EE',
          brightWhite: '#FFFFFF'
        },
        allowProposedApi: true
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // Open terminal in element container
      terminal.open(terminalRef.current);
      
      // Keep references
      xtermInstance.current = terminal;
      fitAddonInstance.current = fitAddon;

      // Connect socket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/terminal?cols=${terminal.cols}&rows=${terminal.rows}&path=${encodeURIComponent(tab.path)}`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Fit layout
        setTimeout(() => fitAddon.fit(), 100);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'output') {
            terminal.write(msg.data);
          }
        } catch (e) {
          // fallback write
          terminal.write(event.data);
        }
      };

      ws.onclose = () => {
        terminal.write('\r\nSession disconnected.\r\n');
      };

      // Handle typing inputs
      terminal.onData((data: string) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      // Handle terminal sizing modifications
      terminal.onResize((size: { cols: number; rows: number }) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }));
        }
      });
      
      // Auto-fit terminal dimensions when window changes
      const handleResize = () => {
        if (fitAddon) {
          try {
            fitAddon.fit();
          } catch (e) {}
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      // Store cleaner callback
      (terminal as any)._cleanup = () => {
        window.removeEventListener('resize', handleResize);
      };
    };

    setupTerminal();

    return () => {
      if (terminal) {
        if (terminal._cleanup) terminal._cleanup();
        terminal.dispose();
      }
      if (ws) {
        ws.close();
      }
    };
  }, [tab.path]);

  // Handle panel visibility toggles to re-fit sizes
  useEffect(() => {
    if (visible && fitAddonInstance.current && xtermInstance.current) {
      setTimeout(() => {
        try {
          fitAddonInstance.current.fit();
          xtermInstance.current.focus();
        } catch (e) {}
      }, 150);
    }
  }, [visible]);

  return (
    <div
      ref={terminalRef}
      className={`w-full h-full ${visible ? 'block' : 'hidden'}`}
      style={{ minHeight: '100%', minWidth: '100%' }}
    />
  );
}
