import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAudioPlayback, AudioMarker } from '../hooks/useAudioPlayback';
import { drawStaticWaveform } from '../services/canvasWaveformService';
import { PlayIcon, PauseIcon, TrashIcon } from './Icons';

interface WaveformPlayerProps {
    audioUrl: string;
    audioFile: File;
    onRemove?: () => void;
    className?: string;
    title?: string;
}

const formatDuration = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60).toString();
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

async function decodeAudioFile(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
    audioUrl,
    audioFile,
    onRemove,
    className = '',
    title = 'Audio'
}) => {
    const {
        isPlaying,
        position,
        duration,
        progress,
        playbackSpeed,
        markers,
        togglePlayPause,
        seekToProgress,
        setSpeed,
        addMarker,
        removeMarker,
        seekToMarker,
    } = useAudioPlayback(audioUrl);

    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [isLoadingWaveform, setIsLoadingWaveform] = useState(true);
    const [showMarkerNote, setShowMarkerNote] = useState<string | null>(null);

    const waveformContainerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isScrubbingRef = useRef(false);

    // Load audio buffer for waveform
    useEffect(() => {
        setIsLoadingWaveform(true);
        setAudioBuffer(null);

        decodeAudioFile(audioFile)
            .then(decodedBuffer => setAudioBuffer(decodedBuffer))
            .catch(err => console.error("Could not generate waveform:", err))
            .finally(() => setIsLoadingWaveform(false));
    }, [audioFile]);

    // Draw waveform
    useEffect(() => {
        if (!isLoadingWaveform && audioBuffer && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) drawStaticWaveform(ctx, audioBuffer, progress);
        }
    }, [progress, audioBuffer, isLoadingWaveform]);

    const handleScrub = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!waveformContainerRef.current || duration === 0) return;
        const rect = waveformContainerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const newProgress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        seekToProgress(newProgress);
    }, [duration, seekToProgress]);

    const handleScrubStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        isScrubbingRef.current = true;
        handleScrub(e);
    };

    const handleScrubMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (isScrubbingRef.current) handleScrub(e as any);
    }, [handleScrub]);

    const handleScrubEnd = () => {
        isScrubbingRef.current = false;
    };

    useEffect(() => {
        window.addEventListener('mousemove', handleScrubMove);
        window.addEventListener('touchmove', handleScrubMove);
        window.addEventListener('mouseup', handleScrubEnd);
        window.addEventListener('touchend', handleScrubEnd);
        return () => {
            window.removeEventListener('mousemove', handleScrubMove);
            window.removeEventListener('touchmove', handleScrubMove);
            window.removeEventListener('mouseup', handleScrubEnd);
            window.removeEventListener('touchend', handleScrubEnd);
        };
    }, [handleScrubMove]);

    const handlePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioContext.state === 'suspended') audioContext.resume();
        togglePlayPause();
    };

    const handleSpeedChange = (speed: number) => {
        setSpeed(speed);
    };

    const handleAddMarker = () => {
        addMarker(`Note at ${formatDuration(position)}`);
    };

    const handleMarkerClick = (marker: AudioMarker, e: React.MouseEvent) => {
        e.stopPropagation();
        seekToMarker(marker.id);
        setShowMarkerNote(marker.id);
        setTimeout(() => setShowMarkerNote(null), 2000);
    };

    const calculateMarkerPosition = (markerPosition: number): number => {
        return duration > 0 ? (markerPosition / duration) * 100 : 0;
    };

    return (
        <div className={`bg-[#1c1c1e] rounded-2xl p-6 border border-white/10 ${className}`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">{title}</p>
                    <p className="text-gray-200 font-semibold text-lg truncate">{audioFile.name}</p>
                </div>
                {onRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors text-gray-400"
                    >
                        <TrashIcon />
                    </button>
                )}
            </div>

            {/* Waveform */}
            <div
                ref={waveformContainerRef}
                className="relative h-24 w-full flex items-center cursor-pointer my-4 bg-black/20 rounded-lg overflow-hidden border border-white/5"
                onMouseDown={handleScrubStart}
                onTouchStart={handleScrubStart}
            >
                {isLoadingWaveform ? (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-mono">
                        Loading waveform...
                    </div>
                ) : (
                    <canvas ref={canvasRef} className="w-full h-full opacity-80" />
                )}

                {/* Markers */}
                {markers.map(marker => {
                    const markerPos = calculateMarkerPosition(marker.position);
                    return (
                        <div
                            key={marker.id}
                            className="absolute top-0 bottom-0 w-0.5 bg-[#52FF00] cursor-pointer group"
                            style={{ left: `${markerPos}%` }}
                            onClick={(e) => handleMarkerClick(marker, e)}
                        >
                            <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-[#52FF00] rounded-full shadow-lg shadow-[#52FF00]/50" />
                            {showMarkerNote === marker.id && marker.note && (
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                    {marker.note}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Time Display */}
            <div className="flex justify-between items-center mb-4">
                <p className="font-mono text-sm text-gray-400 tabular-nums">{formatDuration(position)}</p>
                <p className="font-mono text-sm text-gray-400 tabular-nums">{formatDuration(duration)}</p>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-4">
                {/* Play/Pause Button */}
                <button
                    type="button"
                    onClick={handlePlayPause}
                    className="bg-gray-100 hover:bg-white text-black rounded-full p-4 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] scale-100 hover:scale-105 active:scale-95"
                >
                    {isPlaying ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
                </button>

                {/* Speed Control */}
                <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1 border border-white/5">
                    {SPEED_OPTIONS.map(speed => (
                        <button
                            key={speed}
                            type="button"
                            onClick={() => handleSpeedChange(speed)}
                            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${playbackSpeed === speed
                                    ? 'bg-[#52FF00] text-black font-bold'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {speed}x
                        </button>
                    ))}
                </div>

                {/* Add Marker Button */}
                <button
                    type="button"
                    onClick={handleAddMarker}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 hover:text-white transition-colors border border-white/10"
                    title="Add marker at current position"
                >
                    <span className="text-lg">🏷️</span>
                    <span className="font-mono">Marker</span>
                </button>
            </div>

            {/* Markers List (if any) */}
            {markers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-mono">
                        Markers ({markers.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {markers.map(marker => (
                            <button
                                key={marker.id}
                                type="button"
                                onClick={(e) => handleMarkerClick(marker, e)}
                                className="group relative flex items-center gap-2 px-3 py-1.5 bg-black/30 hover:bg-black/50 rounded-lg text-xs border border-white/10 hover:border-[#52FF00]/50 transition-all"
                            >
                                <span className="font-mono text-gray-400">{formatDuration(marker.position)}</span>
                                {marker.note && (
                                    <span className="text-gray-500 max-w-[100px] truncate">{marker.note}</span>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeMarker(marker.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 ml-1"
                                >
                                    ×
                                </button>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WaveformPlayer;
