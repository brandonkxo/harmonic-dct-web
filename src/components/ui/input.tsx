'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  tooltip?: string;
  error?: string;
  suffix?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, tooltip, error, suffix, ...props }, ref) => {
    const [showTooltip, setShowTooltip] = React.useState(false);

    return (
      <div className="relative">
        {label && (
          <div className="flex items-center gap-1 mb-0.5">
            <label
              className="text-xs text-surface-600 uppercase tracking-wide"
              onMouseEnter={() => tooltip && setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              {label}
              {tooltip && (
                <span className="ml-1 text-surface-500 cursor-help">?</span>
              )}
            </label>
            {showTooltip && tooltip && (
              <div className="tooltip absolute left-0 top-6 w-64 whitespace-normal z-50">
                {tooltip}
              </div>
            )}
          </div>
        )}
        <div className="relative">
          <input
            type={type}
            className={cn(
              'param-input w-full',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              className
            )}
            ref={ref}
            {...props}
          />
          {suffix && (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-surface-500">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
