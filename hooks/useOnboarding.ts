import { useState, useEffect, useCallback } from 'react';

const ONBOARDING_KEY = 'lyriq-onboarding-completed';
const SPLASH_KEY = 'lyriq-splash-seen';

/**
 * Hook to manage onboarding and splash screen state
 *
 * @example
 * const {
 *   shouldShowSplash,
 *   shouldShowOnboarding,
 *   completeSplash,
 *   completeOnboarding,
 *   resetOnboarding
 * } = useOnboarding();
 */
export function useOnboarding() {
  const [shouldShowSplash, setShouldShowSplash] = useState(() => {
    try {
      return localStorage.getItem(SPLASH_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  /**
   * Mark splash screen as seen
   */
  const completeSplash = useCallback(() => {
    try {
      localStorage.setItem(SPLASH_KEY, 'true');
      setShouldShowSplash(false);
    } catch (error) {
      console.error('Failed to save splash state:', error);
    }
  }, []);

  /**
   * Mark onboarding as completed
   */
  const completeOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      setShouldShowOnboarding(false);
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  }, []);

  /**
   * Reset onboarding state (useful for testing or "show tutorial again" feature)
   */
  const resetOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_KEY);
      localStorage.removeItem(SPLASH_KEY);
      setShouldShowSplash(true);
      setShouldShowOnboarding(true);
    } catch (error) {
      console.error('Failed to reset onboarding state:', error);
    }
  }, []);

  /**
   * Check if this is the first time user is opening the app
   */
  const isFirstTime = shouldShowSplash && shouldShowOnboarding;

  return {
    shouldShowSplash,
    shouldShowOnboarding,
    isFirstTime,
    completeSplash,
    completeOnboarding,
    resetOnboarding,
  };
}

export type UseOnboardingReturn = ReturnType<typeof useOnboarding>;
