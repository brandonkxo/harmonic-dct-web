'use client';

import * as React from 'react';
import Image from 'next/image';
import { Button } from './button';

const TIPS = [
  'Keep the modulus bigger than your max deformation value to avoid excess interference.',
  'Use the Radial Modification tab to fine-tune tooth clearance.',
  'Export your configuration as JSON to save your work.',
  'The conjugate solver finds optimal circular spline profiles automatically, using the double conjugate mapping method.',
  'Click the reference image button to learn what each tab does.',
  'Try the overlap fix button, which removes small amounts of interference!',
];

export function TipsPopup() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentTip, setCurrentTip] = React.useState(0);

  React.useEffect(() => {
    // Show popup on first visit
    const hasSeenTips = sessionStorage.getItem('hasSeenTips');
    if (!hasSeenTips) {
      setIsOpen(true);
      setCurrentTip(Math.floor(Math.random() * TIPS.length));
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem('hasSeenTips', 'true');
  };

  const handleNextTip = () => {
    setCurrentTip((prev) => (prev + 1) % TIPS.length);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-200 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden border border-surface-400">
        {/* Header */}
        <div className="bg-primary-500 px-4 py-2 text-white font-medium text-sm">
          Helpful Tip
        </div>

        {/* Content */}
        <div className="p-4 flex gap-4 items-start" style={{ backgroundColor: '#ffffff' }}>
          {/* Character Image */}
          <div className="flex-shrink-0">
            <Image
              src="/HelpfulCharacter.png"
              alt="Helpful Character"
              width={80}
              height={80}
              className="object-contain"
            />
          </div>

          {/* Tip Text */}
          <div className="flex-1">
            <p className="text-surface-800 text-sm leading-relaxed">
              {TIPS[currentTip]}
            </p>
            <p className="text-surface-500 text-xs mt-2">
              Tip {currentTip + 1} of {TIPS.length}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-surface-300 flex justify-between items-center border-t border-surface-400">
          <Button variant="secondary" size="sm" onClick={handleNextTip}>
            Next Tip
          </Button>
          <Button variant="primary" size="sm" onClick={handleClose}>
            Got it!
          </Button>
        </div>
      </div>
    </div>
  );
}
