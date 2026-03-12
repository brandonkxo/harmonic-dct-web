'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  downloadAsSLDCRV,
  downloadAsDXF,
  downloadConfigJSON,
  readJSONFile,
} from '@/lib/utils';
import { useCalculatorStore } from '@/store/calculator-store';
import type { PointTuple } from '@/types';
import { cn } from '@/lib/utils';

interface ExportDialogProps {
  points?: PointTuple[];
  defaultFilename?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDialog({
  points,
  defaultFilename = 'harmonic_curve',
  isOpen,
  onClose,
}: ExportDialogProps) {
  const [filename, setFilename] = React.useState(defaultFilename);
  const [format, setFormat] = React.useState<'sldcrv' | 'dxf'>('sldcrv');
  const [closed, setClosed] = React.useState(true);

  if (!isOpen) return null;

  const handleExport = () => {
    if (!points || points.length === 0) return;

    const fullFilename = `${filename}.${format}`;
    if (format === 'sldcrv') {
      downloadAsSLDCRV(points, fullFilename);
    } else {
      downloadAsDXF(points, fullFilename, closed);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-surface-100 border border-surface-400 rounded w-full max-w-sm p-4 shadow-xl">
        <h2 className="text-sm font-medium uppercase tracking-wide text-surface-700 mb-3">Export Curve</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-surface-600 uppercase tracking-wide mb-1">Filename</label>
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Enter filename"
            />
          </div>

          <div>
            <label className="block text-xs text-surface-600 uppercase tracking-wide mb-1">Format</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="format"
                  checked={format === 'sldcrv'}
                  onChange={() => setFormat('sldcrv')}
                  className="text-primary-500"
                />
                <span>SLDCRV (SolidWorks)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="format"
                  checked={format === 'dxf'}
                  onChange={() => setFormat('dxf')}
                  className="text-primary-500"
                />
                <span>DXF (AutoCAD)</span>
              </label>
            </div>
          </div>

          {format === 'dxf' && (
            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={closed}
                onChange={(e) => setClosed(e.target.checked)}
                className="text-primary-500"
              />
              <span>Closed polyline</span>
            </label>
          )}

          <div className="text-xs text-surface-500">
            {points ? `${points.length} points will be exported` : 'No points to export'}
          </div>
        </div>

        <div className="flex justify-end gap-1.5 mt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleExport} disabled={!points || points.length === 0}>
            Export
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ConfigDialogProps {
  mode: 'save' | 'load';
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigDialog({ mode, isOpen, onClose }: ConfigDialogProps) {
  const [configName, setConfigName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { getConfig, loadConfig } = useCalculatorStore();

  if (!isOpen) return null;

  const handleSave = () => {
    if (!configName.trim()) {
      setError('Please enter a name');
      return;
    }
    const config = getConfig();
    downloadConfigJSON({ name: configName, ...config }, `${configName}.json`);
    onClose();
  };

  const handleLoadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const config = await readJSONFile(file);
      loadConfig(config);
      setError(null);
      onClose();
    } catch (err) {
      setError('Failed to load configuration file');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-surface-100 border border-surface-400 rounded w-full max-w-sm p-4 shadow-xl">
        <h2 className="text-sm font-medium uppercase tracking-wide text-surface-700 mb-3">
          {mode === 'save' ? 'Save Configuration' : 'Load Configuration'}
        </h2>

        <div className="space-y-3">
          {mode === 'save' ? (
            <div>
              <label className="block text-xs text-surface-600 uppercase tracking-wide mb-1">Configuration Name</label>
              <Input
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="Enter configuration name"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-surface-600 uppercase tracking-wide mb-1">Select JSON file</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleLoadFile}
                className="block w-full text-xs text-surface-600
                  file:mr-2 file:py-1 file:px-2
                  file:rounded file:border-0
                  file:text-xs file:font-medium
                  file:bg-surface-300 file:text-surface-700
                  hover:file:bg-surface-400"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-1.5 mt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {mode === 'save' && (
            <Button variant="primary" onClick={handleSave}>
              Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
