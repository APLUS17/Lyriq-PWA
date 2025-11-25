import React, { useState } from 'react';
import { MusicNoteIcon, MicrophoneIcon, GeminiIcon } from './Icons';

interface OnboardingScreen {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}

const screens: OnboardingScreen[] = [
  {
    id: 1,
    title: 'Write Your Lyrics',
    description: 'Create structured or freeform lyrics with syllable counting, rhyme suggestions, and AI-powered tools to perfect your verses.',
    icon: <div className="text-6xl">✍️</div>,
    gradient: 'from-purple-500/20 to-pink-500/20'
  },
  {
    id: 2,
    title: 'Upload Your Beat',
    description: 'Add any instrumental track. Auto-tune effects prepare in the background so you\'re ready to record instantly.',
    icon: <MusicNoteIcon />,
    gradient: 'from-blue-500/20 to-purple-500/20'
  },
  {
    id: 3,
    title: 'Record & Perfect',
    description: 'Record unlimited takes per section. Apply auto-tune, compare versions, and create your perfect vocal performance.',
    icon: <MicrophoneIcon />,
    gradient: 'from-pink-500/20 to-red-500/20'
  }
];

interface OnboardingScreensProps {
  onComplete: () => void;
}

const OnboardingScreens: React.FC<OnboardingScreensProps> = ({ onComplete }) => {
  const [currentScreen, setCurrentScreen] = useState(0);

  const handleNext = () => {
    if (currentScreen < screens.length - 1) {
      setCurrentScreen(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentScreen > 0) {
      setCurrentScreen(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const screen = screens[currentScreen];
  const isLastScreen = currentScreen === screens.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-900 flex items-center justify-center p-6">
      {/* Skip button */}
      {!isLastScreen && (
        <button
          onClick={handleSkip}
          className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors text-sm font-medium"
        >
          Skip
        </button>
      )}

      {/* Main content */}
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        {/* Icon */}
        <div className={`w-32 h-32 mx-auto rounded-3xl bg-gradient-to-br ${screen.gradient} backdrop-blur-sm border border-white/10 flex items-center justify-center shadow-2xl transform transition-all duration-500`}>
          <div className="text-white scale-150">
            {screen.icon}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-300">
          {screen.title}
        </h2>

        {/* Description */}
        <p className="text-gray-400 text-center text-lg leading-relaxed px-4">
          {screen.description}
        </p>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-4">
          {screens.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentScreen(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentScreen
                  ? 'w-8 bg-gradient-to-r from-purple-500 to-pink-500'
                  : 'w-2 bg-gray-600 hover:bg-gray-500'
              }`}
              aria-label={`Go to screen ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center pt-8">
          {/* Previous button */}
          <button
            onClick={handlePrevious}
            disabled={currentScreen === 0}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              currentScreen === 0
                ? 'invisible'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Previous
          </button>

          {/* Next/Get Started button */}
          <button
            onClick={handleNext}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transform hover:scale-105"
          >
            {isLastScreen ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreens;
