import React from 'react';
import type { AutoTuneMode } from '../types';
import type { UseSettingsReturn } from '../hooks/useSettings';
import { MUSICAL_KEYS, MUSICAL_SCALES, KEY_DISPLAY_NAMES } from '../constants/musicConstants';

interface SettingsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UseSettingsReturn;
}

const SettingsDropdown: React.FC<SettingsDropdownProps> = ({ isOpen, onClose, settings }) => {
  if (!isOpen) return null;

  const {
    settings: currentSettings,
    updateAutoTuneMode,
    updateAutoTuneKey,
    updateAutoTuneScale
  } = settings;

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateAutoTuneMode(e.target.value as AutoTuneMode);
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateAutoTuneKey(e.target.value);
  };

  const handleScaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateAutoTuneScale(e.target.value);
  };

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose}></div>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute top-14 right-6 w-64 bg-zinc-900/90 backdrop-blur-xl border border-white/10 text-gray-200 rounded-xl shadow-2xl z-20 p-4 animate-fade-in-fast"
      >
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Audio Effects</h3>

        {/* Auto-Tune Mode */}
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1.5">Mode</label>
          <select
            value={currentSettings.autoTuneMode}
            onChange={handleModeChange}
            className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-transparent transition-all"
          >
            <option value="auto">🚀 Auto</option>
            <option value="manual">⚡ Manual</option>
            <option value="disabled">❌ Disabled</option>
          </select>
        </div>

        {/* Only show Key/Scale if not disabled */}
        {currentSettings.autoTuneMode !== 'disabled' && (
          <>
            {/* Key Selection */}
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1.5">Key</label>
              <select
                value={currentSettings.autoTuneKey}
                onChange={handleKeyChange}
                className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                {MUSICAL_KEYS.map(key => (
                  <option key={key} value={key}>
                    {KEY_DISPLAY_NAMES[key]}
                  </option>
                ))}
              </select>
            </div>

            {/* Scale Selection */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Scale</label>
              <select
                value={currentSettings.autoTuneScale}
                onChange={handleScaleChange}
                className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                {MUSICAL_SCALES.map(scale => (
                  <option key={scale} value={scale}>
                    {scale}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Info based on mode */}
        <div className="mt-3 pt-3 border-t border-white/10">
          {currentSettings.autoTuneMode === 'auto' && (
            <p className="text-xs text-blue-300/80">⚡ Preloads on beat upload</p>
          )}
          {currentSettings.autoTuneMode === 'manual' && (
            <p className="text-xs text-yellow-300/80">💾 Loads on-demand</p>
          )}
          {currentSettings.autoTuneMode === 'disabled' && (
            <p className="text-xs text-gray-400">🚫 Effects hidden</p>
          )}
        </div>
      </div>
    </>
  );
};

export default SettingsDropdown;
