import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Section } from '../types';
import { drawStaticWaveform } from '../services/canvasWaveformService';
import { PlayIcon, PauseIcon, TrashIcon, NextIcon, PreviousIcon } from './Icons';

interface BottomTakesPlayerProps {
    section: Section;
    onClose: () => void;
    onDeleteTake: (takeId: string, sectionId: string) => void;
    className?: string;
}

const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60).toString();
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

// This is a browser-only service
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

// A function to decode base64 audio data into an AudioBuffer
async function decodeAudioData(base64: string): Promise<AudioBuffer> {
    try {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;
        return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error("Failed to decode audio data:", error);
        throw error;
    }
}


const BottomTakesPlayer: React.FC<BottomTakesPlayerProps> = ({ section, onClose, onDeleteTake, className }) => {
    const [playerState, setPlayerState] = useState<'peeking' | 'expanded'>('peeking');
    const [isVisible, setIsVisible] = useState(false);

    const [currentTakeIndex, setCurrentTakeIndex] = useState(section.takes.length > 0 ? section.takes.length - 1 : 0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [isLoadingWaveform, setIsLoadingWaveform] = useState(true);
    const [swipeState, setSwipeState] = useState<{ startY: number, currentY: number } | null>(null);

    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const waveformContainerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isScrubbingRef = useRef(false);

    const currentTake = section.takes[currentTakeIndex];

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const handleClose = useCallback(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    }, [onClose]);

    // Effect for loading and decoding audio data
    useEffect(() => {
        if (!currentTake) {
            if (section.takes.length === 0) handleClose();
            return;
        }

        setIsLoadingWaveform(true);
        setAudioBuffer(null);

        decodeAudioData(currentTake.data)
            .then(decodedBuffer => {
                setAudioBuffer(decodedBuffer);
            })
            .catch(err => {
                console.error("Could not generate waveform:", err);
            })
            .finally(() => {
                setIsLoadingWaveform(false);
            });

        const audio = new Audio(currentTake.url);
        audioPlayerRef.current = audio;
        setProgress(0);

        const handleTimeUpdate = () => {
            if (!isScrubbingRef.current && audio.duration) {
                setProgress(audio.currentTime / audio.duration);
            }
        };

        const handleEnded = () => {
            if (currentTakeIndex < section.takes.length - 1) {
                setCurrentTakeIndex(prev => prev + 1);
            } else {
                setIsPlaying(false);
                setProgress(0);
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        if (isPlaying) {
            audio.play().catch(e => console.error("Error playing audio:", e));
        }

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
            audio.pause();
        };
    }, [currentTake, section.takes.length, handleClose]);

    // Effect for drawing the static waveform
    useEffect(() => {
        if (!isLoadingWaveform && audioBuffer && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                drawStaticWaveform(ctx, audioBuffer, progress);
            }
        }
    }, [progress, audioBuffer, isLoadingWaveform]);

    useEffect(() => {
        if (section.takes.length > 0) {
            setCurrentTakeIndex(prev => Math.min(prev, section.takes.length - 1));
        } else {
            handleClose();
        }
    }, [section.takes.length, handleClose]);

    const handlePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        if (isPlaying) {
            audioPlayerRef.current?.pause();
        } else {
            audioPlayerRef.current?.play().catch(err => console.error("Playback error:", err));
        }
        setIsPlaying(!isPlaying);
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentTakeIndex > 0) setCurrentTakeIndex(prev => prev - 1);
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentTakeIndex < section.takes.length - 1) setCurrentTakeIndex(prev => prev + 1);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentTake) {
            onDeleteTake(currentTake.id, section.id);
        }
    };

    const handleScrub = (e: React.MouseEvent | React.TouchEvent) => {
        if (!waveformContainerRef.current || !audioPlayerRef.current || !audioPlayerRef.current.duration) return;

        const rect = waveformContainerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const newProgress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

        setProgress(newProgress);
        audioPlayerRef.current.currentTime = newProgress * audioPlayerRef.current.duration;
    };

    const handleScrubStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        isScrubbingRef.current = true;
        handleScrub(e);
    };

    const handleScrubMove = (e: MouseEvent | TouchEvent) => {
        if (isScrubbingRef.current) handleScrub(e as any);
    };

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
    }, []);

    // Swipe to dismiss logic
    const handleSwipeStart = (e: React.MouseEvent | React.TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || (waveformContainerRef.current && waveformContainerRef.current.contains(target))) {
            return; // Don't swipe if interacting with buttons or waveform
        }
        const startY = 'touches' in e ? e.touches[0].clientX : e.clientY;
        setSwipeState({ startY, currentY: startY });
    };

    const handleSwipeMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!swipeState) return;
        const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        if (currentY >= swipeState.startY) { // Only allow swiping down
            setSwipeState(prev => prev ? { ...prev, currentY } : null);
        }
    }, [swipeState]);

    const handleSwipeEnd = useCallback(() => {
        if (!swipeState) return;
        const deltaY = swipeState.currentY - swipeState.startY;
        const SWIPE_DOWN_THRESHOLD = 80;

        if (deltaY > SWIPE_DOWN_THRESHOLD) {
            handleClose();
        }
        setSwipeState(null);
    }, [swipeState, handleClose]);

    useEffect(() => {
        if (swipeState) {
            window.addEventListener('mousemove', handleSwipeMove);
            window.addEventListener('touchmove', handleSwipeMove);
            window.addEventListener('mouseup', handleSwipeEnd);
            window.addEventListener('touchend', handleSwipeEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleSwipeMove);
            window.removeEventListener('touchmove', handleSwipeMove);
            window.removeEventListener('mouseup', handleSwipeEnd);
            window.removeEventListener('touchend', handleSwipeEnd);
        };
    }, [swipeState, handleSwipeMove, handleSwipeEnd]);


    if (!currentTake) return null;

    const currentTime = audioPlayerRef.current ? progress * audioPlayerRef.current.duration : 0;
    const totalDuration = audioPlayerRef.current?.duration || currentTake.duration;

    const swipeDeltaY = swipeState ? swipeState.currentY - swipeState.startY : 0;
    const isSwipingDown = swipeDeltaY > 0;
    const playerStyle: React.CSSProperties = {};
    if (swipeState && isSwipingDown) {
        playerStyle.transform = `translateY(${swipeDeltaY}px)`;
        playerStyle.transition = 'none';
    }

    const playerClassName = `fixed bottom-0 left-0 right-0 z-50 bg-[#1c1c1e] border-t border-white/10 rounded-t-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out will-change-transform ${isVisible ? (playerState === 'peeking' ? 'translate-y-[calc(100%-80px)]' : 'translate-y-0') : 'translate-y-full'} ${className || ''}`;

    return (
        <div
            className={playerClassName}
            style={playerStyle}
            onMouseDown={handleSwipeStart}
            onTouchStart={handleSwipeStart}
        >
            <div className="w-full flex justify-center pt-3 pb-1 cursor-pointer" onClick={() => setPlayerState(prev => prev === 'peeking' ? 'expanded' : 'peeking')}>
                <div className="w-12 h-1.5 bg-zinc-700 rounded-full"></div>
            </div>

            <div className="px-6 pb-4 flex items-center justify-between h-[50px]">
                <div className="flex flex-col justify-center">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{section.title} <span className="opacity-50 mx-1">|</span> Take {currentTakeIndex + 1}</h2>
                    <span className="font-mono text-sm text-gray-300 tabular-nums">{formatDuration(currentTime)} / {formatDuration(totalDuration)}</span>
                </div>
                <div className="flex items-center gap-4">
                    <button type="button" onClick={handlePrev} disabled={currentTakeIndex === 0} className="disabled:opacity-20 text-gray-400 hover:text-white transition-colors"><PreviousIcon /></button>
                    <button type="button" onClick={handlePlayPause} className="bg-gray-100 hover:bg-white text-black rounded-full p-2 transition-colors shadow-lg shadow-white/10">
                        {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                    </button>
                    <button type="button" onClick={handleNext} disabled={currentTakeIndex >= section.takes.length - 1} className="disabled:opacity-20 text-gray-400 hover:text-white transition-colors"><NextIcon /></button>
                </div>
            </div>

            <div className="px-6 pb-8 pt-2">
                <div className="flex justify-between items-end mb-4 px-1">
                    <div className="text-sm">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Currently Playing</p>
                        <p className="text-gray-200 font-semibold text-lg">Take {currentTakeIndex + 1}</p>
                        <p className="text-gray-500 text-xs">{section.title}</p>
                    </div>
                    <button type="button" onClick={handleDelete} className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors text-gray-400"><TrashIcon /></button>
                </div>

                <div
                    ref={waveformContainerRef}
                    className="relative h-20 w-full flex items-center cursor-pointer my-2 bg-black/20 rounded-lg overflow-hidden border border-white/5"
                    onMouseDown={handleScrubStart}
                    onTouchStart={handleScrubStart}
                >
                    {isLoadingWaveform ? (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-mono">Loading waveform...</div>
                    ) : (
                        <canvas ref={canvasRef} className="w-full h-full opacity-80" />
                    )}
                </div>
                <div className="flex justify-between items-center mt-4">
                    <p className="font-mono text-xs text-gray-500 tabular-nums">{formatDuration(currentTime)}</p>
                    <div className="flex items-center gap-6">
                        <button type="button" onClick={handlePrev} disabled={currentTakeIndex === 0} className="disabled:opacity-20 text-gray-400 hover:text-white transition-colors"><PreviousIcon /></button>
                        <button type="button" onClick={handlePlayPause} className="bg-gray-100 hover:bg-white text-black rounded-full p-4 transition-colors shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] scale-100 hover:scale-105 active:scale-95">
                            {isPlaying ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
                        </button>
                        <button type="button" onClick={handleNext} disabled={currentTakeIndex >= section.takes.length - 1} className="disabled:opacity-20 text-gray-400 hover:text-white transition-colors"><NextIcon /></button>
                    </div>
                    <p className="font-mono text-xs text-gray-500 tabular-nums">{formatDuration(totalDuration)}</p>
                </div>
            </div>
        </div>
    );
};

export default BottomTakesPlayer;