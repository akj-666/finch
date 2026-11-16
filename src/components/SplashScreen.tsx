import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete?: () => void;
  minDuration?: number; // Duration in ms before transition
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  minDuration = 1200,
}) => {
  const [progress, setProgress] = useState(25);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Immediate clean presentation for reduced motion
      const timer = setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          setShouldRender(false);
          onComplete?.();
        }, 120);
      }, 500);
      return () => clearTimeout(timer);
    }

    // Step 1: Smooth progress advancement
    const progressTimer1 = setTimeout(() => {
      setProgress(72);
    }, 280);

    const progressTimer2 = setTimeout(() => {
      setProgress(100);
    }, minDuration - 250);

    // Step 2: Trigger fade-out transition as app completes intro
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, minDuration);

    // Step 3: Unmount splash screen after fade completes
    const unmountTimer = setTimeout(() => {
      setShouldRender(false);
      onComplete?.();
    }, minDuration + 380);

    return () => {
      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, [minDuration, onComplete]);

  if (!shouldRender) return null;

  return (
    <div
      onClick={() => {
        // Tap to dismiss splash immediately
        setIsFadingOut(true);
        setTimeout(() => {
          setShouldRender(false);
          onComplete?.();
        }, 180);
      }}
      className={`fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-[#fffaf2] to-[#fff8ee] text-[#0f3b2e] select-none transition-opacity duration-350 ease-out cursor-pointer ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Finch mobile splash screen"
    >
      {/* Embedded Lightweight Keyframe Styles */}
      <style>{`
        @keyframes finchBirdEntry {
          0% {
            opacity: 0;
            transform: scale(0.93);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes finchRingDraw {
          0% {
            stroke-dashoffset: 943;
            opacity: 0;
          }
          15% {
            opacity: 0.52;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 0.52;
          }
        }

        @keyframes finchWordmarkFadeUp {
          0% {
            opacity: 0;
            transform: translateY(9px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes finchTaglineFadeUp {
          0% {
            opacity: 0;
            transform: translateY(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes finchLoadingSweep {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        @keyframes finchElementFadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        .finch-anim-bird {
          animation: finchBirdEntry 550ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: center center;
          will-change: transform, opacity;
        }

        .finch-anim-ring {
          stroke-dasharray: 943;
          stroke-dashoffset: 943;
          animation: finchRingDraw 550ms cubic-bezier(0.25, 1, 0.5, 1) 240ms forwards;
          will-change: stroke-dashoffset;
        }

        .finch-anim-wordmark {
          opacity: 0;
          animation: finchWordmarkFadeUp 420ms cubic-bezier(0.16, 1, 0.3, 1) 400ms forwards;
          will-change: transform, opacity;
        }

        .finch-anim-tagline {
          opacity: 0;
          animation: finchTaglineFadeUp 420ms cubic-bezier(0.16, 1, 0.3, 1) 540ms forwards;
          will-change: transform, opacity;
        }

        .finch-anim-indicator {
          opacity: 0;
          animation: finchElementFadeIn 380ms ease-out 480ms forwards;
        }

        .finch-loading-bar-sweep {
          background: linear-gradient(90deg, #c89b3c 0%, #dfc074 50%, #c89b3c 100%);
          background-size: 200% 100%;
          animation: finchLoadingSweep 2.2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .finch-anim-bird,
          .finch-anim-ring,
          .finch-anim-wordmark,
          .finch-anim-tagline,
          .finch-anim-indicator {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            stroke-dashoffset: 0 !important;
          }
          .finch-loading-bar-sweep {
            animation: none !important;
            background: #c89b3c !important;
          }
        }
      `}</style>

      {/* Top accent bar for status area */}
      <div className="w-full h-1.5 sm:h-2 bg-[#0f3b2e]" />

      {/* Main Center Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-4">
        {/* Soft Ambient Radial Glow */}
        <div
          className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(229, 238, 231, 0.95) 0%, rgba(229, 238, 231, 0) 70%)',
          }}
        />

        {/* 1. Finch Bird Mark with scale & settle + 2. Drawing gold accent ring */}
        <div className="relative flex items-center justify-center mb-5 sm:mb-6 finch-anim-bird">
          <svg
            viewBox="310 800 460 410"
            className="w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 drop-shadow-[0_18px_24px_rgba(15,59,46,0.14)]"
            role="img"
            aria-label="Finch bird mark"
          >
            {/* Forest green outer circle */}
            <circle cx="540" cy="1000" r="174" fill="#0f3b2e" />

            {/* Fine muted-gold ring that draws around the bird mark */}
            <circle
              cx="540"
              cy="1000"
              r="150"
              fill="none"
              stroke="#c89b3c"
              strokeWidth="2.5"
              className="finch-anim-ring"
            />

            {/* White/Ivory Bird Body */}
            <path
              d="M570 883c-77 0-137 57-137 137 0 61 33 108 86 130-14 20-33 37-61 49 47 12 96-1 130-34 75-6 129-63 129-139 0-80-63-143-147-143Z"
              fill="#fff8ee"
            />

            {/* Forest Green Wing */}
            <path
              d="M476 1032c29-40 70-61 122-59-20 14-33 33-38 58 27-13 57-16 89-8-27 36-67 58-115 62-26-12-46-30-58-53Z"
              fill="#0f3b2e"
            />

            {/* Gold Eye */}
            <circle cx="611" cy="966" r="11" fill="#c89b3c" />

            {/* Gold Beak */}
            <path d="m684 968 69 22-69 22c7-14 7-30 0-44Z" fill="#c89b3c" />

            {/* Gold Tail Accent */}
            <path d="M401 1129c-28 8-50 25-65 49 33-5 62-18 85-41l-20-8Z" fill="#c89b3c" />
          </svg>
        </div>

        {/* 3. Finch wordmark fades in & moves up + 4. Tagline follows */}
        <div className="relative text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-0.04em] text-[#0f3b2e] lowercase leading-none finch-anim-wordmark">
            finch
          </h1>
          <p className="text-xs sm:text-sm text-[#63736a] tracking-wide mt-2 font-medium finch-anim-tagline">
            A clearer view of every rupee.
          </p>
        </div>

        {/* 5. Restrained Loading Indicator with subtle gold sweep */}
        <div className="relative flex flex-col items-center mt-7 sm:mt-9 finch-anim-indicator">
          {/* Progress Track */}
          <div className="w-44 sm:w-56 h-1 sm:h-1.5 rounded-full bg-[#e7e9df] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-350 ease-out finch-loading-bar-sweep"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Subtext */}
          <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-[#88938c] mt-2.5">
            GETTING THINGS READY
          </span>
        </div>
      </div>

      {/* Bottom Footer Area */}
      <div className="w-full flex flex-col items-center pb-3">
        <span className="text-[10px] sm:text-[11px] tracking-[0.2em] uppercase font-semibold text-[#87928b] mb-3">
          KOTTAYAM · KERALA
        </span>
        {/* Bottom accent bar */}
        <div className="w-full h-1.5 sm:h-2 bg-[#0f3b2e]" />
      </div>
    </div>
  );
};
