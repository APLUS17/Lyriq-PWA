import React from 'react';
import type { AutoTuneMode } from '../types';
import type { UseSettingsReturn } from '../hooks/useSettings';
import { MUSICAL_KEYS, MUSICAL_SCALES, KEY_DISPLAY_NAMES, SCALE_DESCRIPTIONS } from '../constants/musicConstants';
import { CloseIcon } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UseSettingsReturn;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings }) => {
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
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose}></div>

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 animate-fade-in-fast"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* Audio Effects Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Audio Effects</h3>

            {/* Auto-Tune Mode */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Auto-Tune Mode
              </label>
              <select
                value={currentSettings.autoTuneMode}
                onChange={handleModeChange}
                className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                <option value="auto">🚀 Auto (Recommended)</option>
                <option value="manual">⚡ Manual</option>
                <option value="disabled">❌ Disabled</option>
              </select>

              {/* Info box based on selected mode */}
              {currentSettings.autoTuneMode === 'auto' && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-300">
                  <p className="font-medium mb-1">ℹ️ Auto Mode</p>
                  <p className="text-blue-200/80">Effects preload when you upload a beat. First-time download: ~6MB (cached after).</p>
                </div>
              )}
              {currentSettings.autoTuneMode === 'manual' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-300">
                  <p className="font-medium mb-1">⚡ Manual Mode</p>
                  <p className="text-yellow-200/80">Effects load only when you click "Apply Auto-Tune". Good for saving bandwidth.</p>
                </div>
              )}
              {currentSettings.autoTuneMode === 'disabled' && (
                <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg px-3 py-2 text-xs text-gray-300">
                  <p className="font-medium mb-1">❌ Disabled</p>
                  <p className="text-gray-200/80">Auto-tune features are hidden. Enable to use vocal effects.</p>
                </div>
              )}
            </div>
          </div>

          {/* Auto-Tune Settings (only show if not disabled) */}
          {currentSettings.autoTuneMode !== 'disabled' && (
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Auto-Tune Settings</h3>

              {/* Key Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Key
                </label>
                <select
                  value={currentSettings.autoTuneKey}
                  onChange={handleKeyChange}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                >
                  {MUSICAL_KEYS.map(key => (
                    <option key={key} value={key}>
                      {KEY_DISPLAY_NAMES[key]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scale Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Scale
                </label>
                <select
                  value={currentSettings.autoTuneScale}
                  onChange={handleScaleChange}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-white/10 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                >
                  {MUSICAL_SCALES.map(scale => (
                    <option key={scale} value={scale}>
                      {scale} - {SCALE_DESCRIPTIONS[scale]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-purple-500/20"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
};

export default SettingsModal;
