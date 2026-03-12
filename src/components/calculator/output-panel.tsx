'use client';

import * as React from 'react';
import { cn, formatNumber, formatWithUnit } from '@/lib/utils';
import { OUTPUT_CATEGORIES } from '@/lib/constants';

interface OutputValue {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  precision?: number;
}

interface OutputPanelProps {
  category: keyof typeof OUTPUT_CATEGORIES;
  values: Record<string, number | string>;
  className?: string;
}

export function OutputPanel({ category, values, className }: OutputPanelProps) {
  const categories = OUTPUT_CATEGORIES[category] || [];

  return (
    <div className={cn('space-y-4', className)}>
      {categories.map((cat) => (
        <div key={cat.label} className="space-y-1">
          <h4 className="text-xs font-medium text-surface-600 uppercase tracking-wider">
            {cat.label}
          </h4>
          <div className="bg-white rounded p-1.5 space-y-0.5 border border-surface-400">
            {cat.values.map((item) => {
              const value = values[item.key];
              const displayValue =
                value !== undefined
                  ? typeof value === 'number'
                    ? formatWithUnit(value, item.unit || '', item.precision || 4)
                    : value
                  : '--';

              return (
                <div key={item.key} className="output-row">
                  <span className="output-label">{item.label}</span>
                  <span className="output-value">{displayValue}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface StatusMessageProps {
  message: string;
  type?: 'info' | 'success' | 'error' | 'computing';
  className?: string;
}

export function StatusMessage({ message, type = 'info', className }: StatusMessageProps) {
  const typeStyles = {
    info: 'text-surface-600',
    success: 'text-green-600',
    error: 'text-red-600',
    computing: 'text-blue-600 computing-pulse',
  };

  return (
    <div className={cn('text-xs py-1', typeStyles[type], className)}>
      {type === 'computing' && (
        <span className="inline-block w-3 h-3 mr-1 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      )}
      {message}
    </div>
  );
}

interface ProgressBarProps {
  progress: number;
  className?: string;
}

export function ProgressBar({ progress, className }: ProgressBarProps) {
  return (
    <div className={cn('w-full h-1.5 bg-surface-300 rounded overflow-hidden', className)}>
      <div
        className="h-full bg-primary-500 transition-all duration-200"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
