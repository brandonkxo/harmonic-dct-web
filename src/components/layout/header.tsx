'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ConfigDialog } from '@/components/calculator/export-dialog';
import { useCalculatorStore } from '@/store/calculator-store';
import { Save, FolderOpen, RotateCcw } from 'lucide-react';

export function Header() {
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [showLoadDialog, setShowLoadDialog] = React.useState(false);
  const { resetToDefaults } = useCalculatorStore();

  return (
    <>
      <header className="bg-primary-500 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-white uppercase tracking-wide">
              Harmonic Drive Calculator
            </h1>
            <span className="text-xs text-primary-100 hidden sm:inline">
              Double-Circular-Arc Method
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSaveDialog(true)}
              title="Save Configuration"
            >
              <Save className="h-3 w-3" />
              <span className="hidden sm:inline ml-1">Save</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLoadDialog(true)}
              title="Load Configuration"
            >
              <FolderOpen className="h-3 w-3" />
              <span className="hidden sm:inline ml-1">Load</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              title="Reset to Defaults"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline ml-1">Reset</span>
            </Button>
          </div>
        </div>
      </header>

      <ConfigDialog
        mode="save"
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
      />
      <ConfigDialog
        mode="load"
        isOpen={showLoadDialog}
        onClose={() => setShowLoadDialog(false)}
      />
    </>
  );
}
