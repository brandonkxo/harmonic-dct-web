'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';

export function Footer() {
  const { isComputing, computeProgress, lastError } = useCalculatorStore();

  return (
    <footer className="bg-surface-900 border-t border-surface-700 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-surface-500">
        <div className="flex items-center gap-4">
          {isComputing ? (
            <span className="text-blue-400 flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Computing... {computeProgress}%
            </span>
          ) : lastError ? (
            <span className="text-red-400">{lastError}</span>
          ) : (
            <span className="text-green-400">Ready</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>
            Based on Liu et al., "A Novel Rapid Design Framework..." Machines 2025
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-surface-300"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
