'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { PARAM_GROUPS, PARAM_LABELS, PARAM_TOOLTIPS, INTEGER_PARAMS } from '@/lib/constants';
import { Collapsible } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { GearParams } from '@/types';

interface ParameterPanelProps {
  includeFillets?: boolean;
  onUpdate?: () => void;
}

export function ParameterPanel({
  includeFillets = false,
  onUpdate,
}: ParameterPanelProps) {
  const {
    params,
    filletAdd,
    filletDed,
    setParam,
    setFilletAdd,
    setFilletDed,
    resetToDefaults,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCalculatorStore();

  const handleParamChange = (key: keyof GearParams, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setParam(key, numValue);
    }
  };

  const handleUpdate = () => {
    onUpdate?.();
  };

  const handleReset = () => {
    resetToDefaults();
    onUpdate?.();
  };

  return (
    <div className="space-y-2">
      {/* Parameter Groups */}
      {Object.entries(PARAM_GROUPS).map(([groupName, paramKeys]) => (
        <Collapsible key={groupName} title={groupName} defaultOpen={groupName === 'Basic Geometry'}>
          <div className="space-y-1">
            {paramKeys.map((key) => {
              const isInteger = INTEGER_PARAMS.has(key);
              const displayValue = isInteger ? params[key] : parseFloat(params[key].toFixed(3));
              return (
                <div key={key} className="flex items-center gap-2">
                  <label className="flex-1 text-xs text-surface-600 uppercase tracking-wide truncate" title={PARAM_TOOLTIPS[key]}>
                    {PARAM_LABELS[key]}
                  </label>
                  <Input
                    type="number"
                    value={displayValue}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                    step={isInteger ? 1 : 0.001}
                    className="w-24"
                    tooltip={PARAM_TOOLTIPS[key]}
                  />
                </div>
              );
            })}
          </div>
        </Collapsible>
      ))}

      {/* Fillets */}
      {includeFillets && (
        <Collapsible title="Fillet Radii" defaultOpen={false}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label className="flex-1 text-xs text-surface-600 uppercase tracking-wide">Addendum Fillet</label>
              <Input
                type="number"
                value={parseFloat(filletAdd.toFixed(3))}
                onChange={(e) => setFilletAdd(parseFloat(e.target.value) || 0)}
                step={0.001}
                min={0}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex-1 text-xs text-surface-600 uppercase tracking-wide">Dedendum Fillet</label>
              <Input
                type="number"
                value={parseFloat(filletDed.toFixed(3))}
                onChange={(e) => setFilletDed(parseFloat(e.target.value) || 0)}
                step={0.001}
                min={0}
                className="w-24"
              />
            </div>
          </div>
        </Collapsible>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button onClick={handleUpdate} variant="primary" size="sm">
          Update
        </Button>
        <Button onClick={handleReset} variant="secondary" size="sm">
          Reset
        </Button>
        <div className="flex-1" />
        <Button
          onClick={undo}
          variant="ghost"
          size="sm"
          disabled={!canUndo()}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </Button>
        <Button
          onClick={redo}
          variant="ghost"
          size="sm"
          disabled={!canRedo()}
          title="Redo (Ctrl+Y)"
        >
          Redo
        </Button>
      </div>
    </div>
  );
}
