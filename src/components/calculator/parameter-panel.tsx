'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
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

// Individual parameter input with local editing state
function ParameterInput({
  paramKey,
  value,
  isInteger,
  tooltip,
  onChange,
  onEnter,
}: {
  paramKey: string;
  value: number;
  isInteger: boolean;
  tooltip?: string;
  onChange: (value: number) => void;
  onEnter?: () => void;
}) {
  const formatValue = (v: number) => isInteger ? String(v) : v.toFixed(3);
  const [localValue, setLocalValue] = useState(formatValue(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync local value when store value changes (but not while editing)
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(formatValue(value));
    }
  }, [value, isFocused, isInteger]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Update store immediately if valid (for real-time preview)
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      onChange(numValue);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numValue = parseFloat(localValue);
    if (!isNaN(numValue)) {
      onChange(numValue);
      setLocalValue(formatValue(numValue));
    } else {
      // Revert to current store value if invalid
      setLocalValue(formatValue(value));
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      onEnter?.();
    }
  };

  return (
    <Input
      type="number"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      step={isInteger ? 1 : 0.001}
      className="w-24"
      tooltip={tooltip}
    />
  );
}

// Fillet input with local editing state
function FilletInput({
  value,
  onChange,
  onEnter,
}: {
  value: number;
  onChange: (value: number) => void;
  onEnter?: () => void;
}) {
  const formatValue = (v: number) => v.toFixed(3);
  const [localValue, setLocalValue] = useState(formatValue(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(formatValue(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      onChange(numValue);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numValue = parseFloat(localValue);
    if (!isNaN(numValue) && numValue >= 0) {
      onChange(numValue);
      setLocalValue(formatValue(numValue));
    } else {
      setLocalValue(formatValue(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      onEnter?.();
    }
  };

  return (
    <Input
      type="number"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={() => setIsFocused(true)}
      onKeyDown={handleKeyDown}
      step={0.001}
      min={0}
      className="w-24"
    />
  );
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
  } = useCalculatorStore();

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
              return (
                <div key={key} className="flex items-center gap-2">
                  <label className="flex-1 text-xs text-surface-600 uppercase tracking-wide truncate" title={PARAM_TOOLTIPS[key]}>
                    {PARAM_LABELS[key]}
                  </label>
                  <ParameterInput
                    paramKey={key}
                    value={params[key]}
                    isInteger={isInteger}
                    tooltip={PARAM_TOOLTIPS[key]}
                    onChange={(value) => setParam(key, value)}
                    onEnter={handleUpdate}
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
              <FilletInput value={filletAdd} onChange={setFilletAdd} onEnter={handleUpdate} />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex-1 text-xs text-surface-600 uppercase tracking-wide">Dedendum Fillet</label>
              <FilletInput value={filletDed} onChange={setFilletDed} onEnter={handleUpdate} />
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
      </div>
    </div>
  );
}
