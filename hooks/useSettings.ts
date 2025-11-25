import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, AutoTuneMode } from '../types';

const STORAGE_KEY = 'lyriq-app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  autoTuneMode: 'auto', // Default to auto for best UX
  autoTuneKey: 'C',
  autoTuneScale: 'Major',
};

/**
 * Custom hook for managing app settings with localStorage persistence
 *
 * @example
 * const { settings, updateSettings, updateAutoTuneMode } = useSettings();
 *
 * // Update auto-tune mode
 * updateAutoTuneMode('manual');
 *
 * // Update multiple settings at once
 * updateSettings({ autoTuneKey: 'D', autoTuneScale: 'Minor' });
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Load from localStorage on init
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new settings
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  });

  // Persist to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }, [settings]);

  /**
   * Update multiple settings at once
   */
  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Update auto-tune mode specifically
   */
  const updateAutoTuneMode = useCallback((mode: AutoTuneMode) => {
    setSettings(prev => ({ ...prev, autoTuneMode: mode }));
  }, []);

  /**
   * Update auto-tune key
   */
  const updateAutoTuneKey = useCallback((key: string) => {
    setSettings(prev => ({ ...prev, autoTuneKey: key }));
  }, []);

  /**
   * Update auto-tune scale
   */
  const updateAutoTuneScale = useCallback((scale: string) => {
    setSettings(prev => ({ ...prev, autoTuneScale: scale }));
  }, []);

  /**
   * Reset to default settings
   */
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateSettings,
    updateAutoTuneMode,
    updateAutoTuneKey,
    updateAutoTuneScale,
    resetSettings,
  };
}

export type UseSettingsReturn = ReturnType<typeof useSettings>;
