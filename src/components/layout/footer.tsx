'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { Button } from '@/components/ui/button';

// Map tab IDs to their reference images
const TAB_REF_IMAGES: Record<string, { src: string; alt: string } | null> = {
  'flexspline-full': { src: '/ref-images/flexspline-ref-radii.png', alt: 'Flexspline Reference Radii' },
  'radial-modification': { src: '/ref-images/rad-mod.png', alt: 'Radial Modification Reference' },
  'longitudinal-modification': { src: '/ref-images/long-mod-ref.png', alt: 'Longitudinal Modification Reference' },
};

export function Footer() {
  const { isComputing, computeProgress, lastError, activeTab } = useCalculatorStore();
  const [showRefImage, setShowRefImage] = React.useState(false);

  const refImage = TAB_REF_IMAGES[activeTab];

  return (
    <>
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
            ) : null}
            {refImage && (
              <Button variant="secondary" size="sm" onClick={() => setShowRefImage(true)}>
                Reference Image
              </Button>
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

      {/* Reference Image Dialog */}
      {showRefImage && refImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowRefImage(false)}>
          <div className="bg-surface-100 border border-surface-400 rounded max-w-4xl max-h-[90vh] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-surface-700">Reference Image</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowRefImage(false)}>
                Close
              </Button>
            </div>
            <img
              src={refImage.src}
              alt={refImage.alt}
              className="max-w-full max-h-[calc(90vh-80px)] object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
