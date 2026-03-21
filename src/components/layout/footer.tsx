'use client';

import * as React from 'react';
import { useCalculatorStore } from '@/store/calculator-store';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Map tab IDs to their reference images
const TAB_REF_IMAGES: Record<string, { src: string; alt: string } | null> = {
  'flexspline-full': { src: '/ref-images/flexspline-ref-radii.png', alt: 'Flexspline Reference Radii' },
  'radial-modification': { src: '/ref-images/rad-mod.png', alt: 'Radial Modification Reference' },
  'longitudinal-modification': { src: '/ref-images/long-mod-ref.png', alt: 'Longitudinal Modification Reference' },
};

// Example 3D models
const EXAMPLE_MODELS = [
  { src: '/models/0001-000-1200-006_flexspline_158t.glb', name: 'Flexspline (158T)' },
  { src: '/models/0001-000-1210-001_circular_spline_160t.glb', name: 'Circular Spline (160T)' },
];

export function Footer() {
  const { isComputing, computeProgress, lastError, activeTab } = useCalculatorStore();
  const [showRefImage, setShowRefImage] = React.useState(false);
  const [showExamples, setShowExamples] = React.useState(false);
  const [currentModelIndex, setCurrentModelIndex] = React.useState(0);

  const refImage = TAB_REF_IMAGES[activeTab];

  const nextModel = () => {
    setCurrentModelIndex((prev) => (prev + 1) % EXAMPLE_MODELS.length);
  };

  const prevModel = () => {
    setCurrentModelIndex((prev) => (prev - 1 + EXAMPLE_MODELS.length) % EXAMPLE_MODELS.length);
  };

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
            <Button
              size="sm"
              onClick={() => setShowExamples(true)}
              className="bg-orange-200 text-orange-800 border border-orange-300 hover:bg-orange-300"
            >
              Examples
            </Button>
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

      {/* Examples Dialog */}
      {showExamples && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowExamples(false)}>
          <div
            className="bg-surface-100 border border-surface-400 rounded w-[600px] h-[500px] p-4 shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-surface-700">
                Example Models
              </h2>
              <Button variant="secondary" size="sm" onClick={() => setShowExamples(false)}>
                Close
              </Button>
            </div>

            <div className="flex-1 relative overflow-hidden rounded border border-surface-300 bg-surface-200">
              {/* @ts-expect-error model-viewer is a custom element */}
              <model-viewer
                key={currentModelIndex}
                src={EXAMPLE_MODELS[currentModelIndex].src}
                camera-controls
                touch-action="pan-y"
                disable-zoom={false}
                style={{ width: '100%', height: '100%' }}
                shadow-intensity="1"
                tone-mapping="neutral"
                exposure="0.5"
              />

              {/* Navigation arrows */}
              <button
                onClick={prevModel}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-surface-100/90 hover:bg-surface-200 border border-surface-400 rounded-full p-2 shadow-md transition-colors"
                aria-label="Previous model"
              >
                <ChevronLeft className="w-5 h-5 text-surface-700" />
              </button>
              <button
                onClick={nextModel}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface-100/90 hover:bg-surface-200 border border-surface-400 rounded-full p-2 shadow-md transition-colors"
                aria-label="Next model"
              >
                <ChevronRight className="w-5 h-5 text-surface-700" />
              </button>
            </div>

            {/* Model name and indicator */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-surface-700">
                {EXAMPLE_MODELS[currentModelIndex].name}
              </span>
              <div className="flex gap-1.5">
                {EXAMPLE_MODELS.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentModelIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentModelIndex
                        ? 'bg-orange-500'
                        : 'bg-surface-400 hover:bg-surface-500'
                    }`}
                    aria-label={`Go to model ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
