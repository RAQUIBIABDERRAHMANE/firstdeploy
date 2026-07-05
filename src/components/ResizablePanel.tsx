'use client';

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResizablePanelProps {
  children: React.ReactNode;
  direction: 'horizontal' | 'vertical';
  size: number;
  onResize: (size: number) => void;
  minSize?: number;
  maxSize?: number;
  isCollapsed: boolean;
  side: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
}

export default function ResizablePanel({
  children,
  direction,
  size,
  onResize,
  minSize = 100,
  maxSize = 800,
  isCollapsed,
  side,
  className = ''
}: ResizablePanelProps) {
  const isResizing = useRef(false);
  const startSize = useRef(size);
  const startPos = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startSize.current = size;
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isResizing.current) return;

      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      
      let newSize = startSize.current;
      
      // Calculate based on which side the handle is on relative to the panel content
      if (side === 'right') {
        newSize = startSize.current + delta;
      } else if (side === 'left') {
        newSize = startSize.current - delta;
      } else if (side === 'bottom') {
        newSize = startSize.current + delta;
      } else if (side === 'top') {
        newSize = startSize.current - delta;
      }

      newSize = Math.max(minSize, Math.min(newSize, maxSize));
      onResize(newSize);
    };

    const handlePointerUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [direction, side, minSize, maxSize, onResize]);

  // Set up animation variants
  const animateVariants = {
    open: {
      width: direction === 'horizontal' ? size : '100%',
      height: direction === 'vertical' ? size : '100%',
      opacity: 1,
      transition: { type: 'spring' as const, damping: 25, stiffness: 200 }
    },
    collapsed: {
      width: direction === 'horizontal' ? 0 : '100%',
      height: direction === 'vertical' ? 0 : '100%',
      opacity: 0,
      transition: { type: 'spring' as const, damping: 25, stiffness: 200 }
    }
  };

  // Determine handle placement classes
  const handleClasses = {
    right: 'absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-violet-600/40 active:bg-violet-600 transition-colors z-50',
    left: 'absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-violet-600/40 active:bg-violet-600 transition-colors z-50',
    bottom: 'absolute bottom-0 left-0 h-1 w-full cursor-row-resize hover:bg-violet-600/40 active:bg-violet-600 transition-colors z-50',
    top: 'absolute top-0 left-0 h-1 w-full cursor-row-resize hover:bg-violet-600/40 active:bg-violet-600 transition-colors z-50'
  }[side];

  return (
    <motion.div
      variants={animateVariants}
      initial={isCollapsed ? 'collapsed' : 'open'}
      animate={isCollapsed ? 'collapsed' : 'open'}
      className={`relative overflow-hidden flex flex-col bg-[#111113]/85 backdrop-blur-md border-[rgba(255,255,255,0.06)] shadow-xl ${
        side === 'left' ? 'border-l' : ''
      } ${side === 'right' ? 'border-r' : ''} ${side === 'top' ? 'border-t' : ''} ${
        side === 'bottom' ? 'border-b' : ''
      } ${className}`}
    >
      <div className="flex-1 w-full h-full overflow-hidden flex flex-col">
        {!isCollapsed && children}
      </div>
      
      {!isCollapsed && (
        <div
          className={handleClasses}
          onPointerDown={handlePointerDown}
        />
      )}
    </motion.div>
  );
}
