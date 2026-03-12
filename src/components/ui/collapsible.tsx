'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Collapsible({
  title,
  defaultOpen = true,
  children,
  className,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn('rounded overflow-hidden', className)}>
      <button
        type="button"
        className="collapsible-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-white/80 transition-transform',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>
      {isOpen && <div className="collapsible-content">{children}</div>}
    </div>
  );
}
