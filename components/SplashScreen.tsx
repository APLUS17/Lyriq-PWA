import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number; // milliseconds
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, duration = 2000 }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Start fade out before completion
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, duration - 500);

    // Complete after full duration
    const completeTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-gradient-to-br from-zinc-900 via-purple-900/20 to-zinc-900 flex items-center justify-center transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="text-center space-y-6 animate-fade-in-fast">
        {/* Logo / Brand */}
        <div className="relative">
          <h1 className="text-7xl font-brand font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-200 to-pink-300 tracking-tight animate-pulse-slow">
            Lyriq
          </h1>
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full animate-shimmer"></div>
        </div>

        {/* Tagline */}
        <p className="text-gray-400 text-lg font-light tracking-wide">
          Create. Record. Perfect.
        </p>

        {/* Loading indicator */}
        <div className="flex justify-center gap-2 mt-8">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
