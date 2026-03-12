'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ConfigDialog } from '@/components/calculator/export-dialog';
import { useCalculatorStore } from '@/store/calculator-store';
import { Settings, Save, FolderOpen, RotateCcw } from 'lucide-react';

export function Header() {
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [showLoadDialog, setShowLoadDialog] = React.useState(false);
  const { resetToDefaults } = useCalculatorStore();

  return (
    <>
      <header className="bg-surface-900 border-b border-surface-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-surface-100">
              Harmonic Drive DCT Calculator
            </h1>
            <span className="text-xs text-surface-500 hidden sm:inline">
              Double-Circular-Arc Common-Tangent Flexspline Tooth Profile
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSaveDialog(true)}
              title="Save Configuration"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Save</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLoadDialog(true)}
              title="Load Configuration"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Load</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              title="Reset to Defaults"
            >
              <RotateCcw className="h-4 w-4" />
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
