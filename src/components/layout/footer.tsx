'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';

export function Footer() {
  const { isComputing, computeProgress, lastError } = useCalculatorStore();

  return (
    <footer className="bg-surface-400 border-t border-surface-500 px-3 py-1.5">
      <div className="flex items-center justify-between text-xs text-surface-700">
        <div className="flex items-center gap-4">
          {isComputing ? (
            <span className="text-orange-600 flex items-center gap-2">
              <span className="inline-block w-2 h-2 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
              Computing... {computeProgress}%
            </span>
          ) : lastError ? (
            <span className="text-red-600">{lastError}</span>
          ) : (
            <span className="text-green-600">Ready</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/liu-et-al-2025.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline hover:text-surface-900 underline"
          >
            Based on Liu et al., Machines 2025
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-surface-900 uppercase tracking-wide"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
