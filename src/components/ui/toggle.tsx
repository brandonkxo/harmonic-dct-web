'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SegmentedToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  leftLabel: string;
  rightLabel: string;
  leftColor?: string;
  rightColor?: string;
  disabled?: boolean;
  className?: string;
}

export function SegmentedToggle({
  value,
  onChange,
  leftLabel,
  rightLabel,
  leftColor = 'bg-green-600',
  rightColor = 'bg-red-500',
  disabled = false,
  className,
}: SegmentedToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex rounded-md border border-surface-300 bg-surface-100 p-0.5',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <button
        type="button"
        onClick={() => !disabled && onChange(false)}
        disabled={disabled}
        className={cn(
          'px-2 py-1 text-xs font-medium rounded transition-all duration-200',
          !value
            ? `${leftColor} text-white shadow-sm`
            : 'text-surface-600 hover:text-surface-800 hover:bg-surface-400'
        )}
      >
        {leftLabel}
      </button>
      <button
        type="button"
        onClick={() => !disabled && onChange(true)}
        disabled={disabled}
        className={cn(
          'px-2 py-1 text-xs font-medium rounded transition-all duration-200',
          value
            ? `${rightColor} text-white shadow-sm`
            : 'text-surface-600 hover:text-surface-800 hover:bg-surface-400'
        )}
      >
        {rightLabel}
      </button>
    </div>
  );
}
