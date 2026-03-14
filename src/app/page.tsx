'use client';

import * as React from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCalculatorStore } from '@/store/calculator-store';
import {
  TabFlexsplineTooth,
  TabConjugateTooth,
  TabFlexsplineFull,
  TabCircularSpline,
  TabRadialModification,
  TabLongitudinalModification,
} from '@/components/tabs';
import type { TabId } from '@/types';

const TAB_CONFIG: { id: TabId; label: string; shortLabel: string }[] = [
  { id: 'flexspline-full', label: 'Flexspline', shortLabel: 'FS' },
  { id: 'circular-spline', label: 'Circular Spline', shortLabel: 'CS' },
  { id: 'radial-modification', label: 'Radial Modification', shortLabel: 'Radial' },
  { id: 'longitudinal-modification', label: 'Longitudinal Mod', shortLabel: 'Longitud' },
];

export default function Home() {
  const activeTab = useCalculatorStore((state) => state.activeTab);
  const setActiveTab = useCalculatorStore((state) => state.setActiveTab);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useCalculatorStore.getState().undo();
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        useCalculatorStore.getState().redo();
      }
      // Tab switching: Ctrl+1-4
      if (e.ctrlKey && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < TAB_CONFIG.length) {
          setActiveTab(TAB_CONFIG[tabIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  return (
    <div className="min-h-screen flex flex-col bg-surface-300">
      <Header />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabId)}
          className="flex-1 flex flex-col"
        >
          <TabsList>
            {TAB_CONFIG.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-hidden p-2">
            <TabsContent value="flexspline-full">
              <TabFlexsplineFull />
            </TabsContent>
            <TabsContent value="circular-spline">
              <TabCircularSpline />
            </TabsContent>
            <TabsContent value="radial-modification">
              <TabRadialModification />
            </TabsContent>
            <TabsContent value="longitudinal-modification">
              <TabLongitudinalModification />
            </TabsContent>
          </div>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
