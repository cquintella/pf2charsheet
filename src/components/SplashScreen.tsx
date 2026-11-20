import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onDone: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone, durationMs = 3000 }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), Math.max(0, durationMs - 400));
    const doneTimer = window.setTimeout(onDone, durationMs);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        onDone();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [durationMs, onDone]);

  const bannerSrc =
    typeof window !== 'undefined' && window.location.protocol === 'file:'
      ? './assets/banner.jpg'
      : '/assets/banner.jpg';

  return (
    <div
      onClick={onDone}
      role="status"
      aria-label="PF2ECharSheet v1.0.0"
      className={`fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer transition-opacity duration-400 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl rounded-2xl overflow-hidden border border-accent/50 shadow-2xl bg-black"
      >
        <img
          src={bannerSrc}
          alt="PF2ECharSheet"
          className="w-full h-auto block object-cover select-none"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-14 pb-4 px-6 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-white tracking-wide">
              by <span className="text-accent-text">cquintella</span>
              <span className="ml-2 text-xs font-semibold text-text-secondary">v1.0.0</span>
            </p>
            <a
              href="https://github.com/cquintella/pf2charsheet"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-accent-text hover:underline font-medium break-all"
            >
              https://github.com/cquintella/pf2charsheet
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
