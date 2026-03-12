'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y: number;

      switch (side) {
        case 'top':
          y = rect.top - 8;
          break;
        case 'bottom':
          y = rect.bottom + 8;
          break;
        case 'left':
          x = rect.left - 8;
          y = rect.top + rect.height / 2;
          break;
        case 'right':
          x = rect.right + 8;
          y = rect.top + rect.height / 2;
          break;
        default:
          y = rect.top - 8;
      }

      setPosition({ x, y });
    }
    setIsVisible(true);
  };

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div
          className={cn(
            'fixed z-50 px-2 py-1 text-xs',
            'bg-surface-700 text-surface-100',
            'rounded shadow-lg',
            'pointer-events-none',
            'transform -translate-x-1/2',
            side === 'top' && '-translate-y-full',
            side === 'bottom' && 'translate-y-0',
            className
          )}
          style={{ left: position.x, top: position.y }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
