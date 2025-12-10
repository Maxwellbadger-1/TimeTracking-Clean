import { useEffect, useState } from 'react';
import maxflowLogo from '../assets/maxflow-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // Start fade out animation
          setTimeout(() => setFadeOut(true), 300);
          // Complete after fade out
          setTimeout(() => onComplete(), 800);
          return 100;
        }
        return prev + 2;
      });
    }, 20);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated Background Shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-64 h-64 bg-blue-200/20 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-200/20 dark:bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-300/10 dark:bg-blue-400/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Logo Container with Animation */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo with Scale Animation */}
        <div className="animate-scale-in">
          <img
            src={maxflowLogo}
            alt="Maxflow Software"
            className="w-48 h-48 object-contain drop-shadow-2xl"
          />
        </div>

        {/* App Title */}
        <div className="text-center space-y-2 animate-fade-in-up delay-200">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            TimeTracking System
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Stiftung der DPolG
          </p>
        </div>

        {/* Loading Progress Bar */}
        <div className="w-64 animate-fade-in-up delay-400">
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
            {progress < 100 ? 'Lädt...' : 'Bereit!'}
          </p>
        </div>

        {/* Powered by Badge */}
        <div className="animate-fade-in-up delay-600 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Powered by
          </p>
          <p className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Maxflow Software
          </p>
        </div>
      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes scale-in {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes fade-in-up {
          0% {
            transform: translateY(20px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.6s ease-out;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }

        .delay-200 {
          animation-delay: 200ms;
        }

        .delay-400 {
          animation-delay: 400ms;
        }

        .delay-500 {
          animation-delay: 500ms;
        }

        .delay-600 {
          animation-delay: 600ms;
        }

        .delay-1000 {
          animation-delay: 1000ms;
        }

        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
