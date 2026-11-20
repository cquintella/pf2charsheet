import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onDone: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone, durationMs = 5000 }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), Math.max(0, durationMs - 400));
    const doneTimer = window.setTimeout(onDone, durationMs);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [durationMs, onDone]);

  const bannerSrc =
    typeof window !== 'undefined' && window.location.protocol === 'file:'
      ? './assets/banner.jpg'
      : '/assets/banner.jpg';

  return (
    <div
      role="status"
      aria-label="PF2ECharSheet v1.0.0"
      className={`fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-400 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative w-full max-w-4xl rounded-2xl overflow-hidden border border-accent/50 shadow-2xl bg-black">
        <img
          src={bannerSrc}
          alt="PF2ECharSheet"
          className="w-full h-auto block object-cover select-none"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-14 pb-4 px-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white tracking-wide">
              by <span className="text-accent-text">cquintella</span>
              <span className="ml-2 text-xs font-semibold text-text-secondary">v1.0.0</span>
            </p>
            <a
              href="https://github.com/cquintella/pf2charsheet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-text hover:underline font-medium break-all"
            >
              https://github.com/cquintella/pf2charsheet
            </a>
          </div>

          <button
            type="button"
            onClick={onDone}
            autoFocus
            className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-accent-contrast text-xs font-black uppercase tracking-wider shadow-lg transition-colors self-start sm:self-end"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
};
