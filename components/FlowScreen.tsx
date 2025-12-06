import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic, Music, ChevronDown, Rewind, FastForward, Volume2 } from 'lucide-react';
import { motion, PanInfo } from 'framer-motion';
import { TimedWord, TimedLine } from '../types';
import { findLineIndexAtTime, HIGHLIGHT_LOOKAHEAD } from '../services/lyriqTranscriptionService';

export type FlowScreenState = 'hidden' | 'peeking' | 'expanded';

interface FlowScreenProps {
    viewState: FlowScreenState;
    onViewStateChange: (state: FlowScreenState) => void;
    songTitle: string;
    lyrics: string[];
    beatUrl?: string;
    onBeatUpload: (file: File) => void;
    onBack?: () => void;
    // Optional synced lyrics for auto-scroll
    syncedWords?: TimedWord[];
    syncedLines?: TimedLine[];
}

const FlowScreen: React.FC<FlowScreenProps> = ({ viewState, onViewStateChange, songTitle, lyrics, beatUrl, onBeatUpload, onBack, syncedWords, syncedLines }) => {
    // Audio State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Synced Lyrics State
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

    // Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const beatPlayerRef = useRef<HTMLAudioElement | null>(null);
    const beatSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lineElementsRef = useRef<(HTMLParagraphElement | null)[]>([]);
    const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
    const scrollTimeoutRef = useRef<number | null>(null);

    // Initialize Audio Context
    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return audioContextRef.current;
    }, []);

    // Time update loop
    useEffect(() => {
        if (isPlaying && beatPlayerRef.current) {
            const animate = () => {
                if (beatPlayerRef.current) {
                    setCurrentTime(beatPlayerRef.current.currentTime);
                }
                animationFrameRef.current = requestAnimationFrame(animate);
            };
            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isPlaying]);

    // Update duration when beat loads
    useEffect(() => {
        const audio = beatPlayerRef.current;
        const handleLoadedMetadata = () => {
            setDuration(audio?.duration || 0);
        };

        if (audio) {
            audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        }

        return () => {
            if (audio) {
                audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            }
        };
    }, [beatUrl]);

    // Auto-scroll and highlighting effect
    useEffect(() => {
        if (!syncedLines || syncedLines.length === 0 || !isPlaying) return;

        const lookaheadTime = currentTime + HIGHLIGHT_LOOKAHEAD;
        const newLineIndex = findLineIndexAtTime(lookaheadTime, syncedLines);

        if (newLineIndex !== currentLineIndex && newLineIndex >= 0) {
            setCurrentLineIndex(newLineIndex);

            // Auto-scroll to active line
            if (autoScrollEnabled && lineElementsRef.current[newLineIndex]) {
                lineElementsRef.current[newLineIndex]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    }, [currentTime, syncedLines, isPlaying, currentLineIndex, autoScrollEnabled]);

    // Disable auto-scroll when user manually scrolls
    const handleUserScroll = useCallback(() => {
        if (isPlaying) {
            setAutoScrollEnabled(false);
            // Clear existing timeout if any
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            // Re-enable after 3 seconds of no interaction
            scrollTimeoutRef.current = window.setTimeout(() => {
                setAutoScrollEnabled(true);
                scrollTimeoutRef.current = null;
            }, 3000);
        }
    }, [isPlaying]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    // Toggle Playback
    const togglePlayback = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const ctx = initAudioContext();
        if (!ctx) return;

        if (isPlaying) {
            beatPlayerRef.current?.pause();
            setIsPlaying(false);
        } else {
            // Only try to connect the source if a beat is loaded
            if (beatPlayerRef.current && beatUrl) {
                if (!beatSourceNodeRef.current) {
                    try {
                        beatSourceNodeRef.current = ctx.createMediaElementSource(beatPlayerRef.current);
                        beatSourceNodeRef.current.connect(ctx.destination);
                    } catch (e) { /* console.warn("Beat source already connected", e); */ }
                }
                await beatPlayerRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const handleRewind = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (beatPlayerRef.current) beatPlayerRef.current.currentTime = Math.max(0, beatPlayerRef.current.currentTime - 15);
        setCurrentTime(beatPlayerRef.current?.currentTime || 0);
    };

    const handleForward = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (beatPlayerRef.current) beatPlayerRef.current.currentTime = Math.min(beatPlayerRef.current.duration, beatPlayerRef.current.currentTime + 15);
        setCurrentTime(beatPlayerRef.current?.currentTime || 0);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onBeatUpload(file);
    };

    // Helper to format time
    const formatTime = (time: number) => {
        if (isNaN(time) || time === Infinity || time < 0) return "00:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Gestures
    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 100;
        if (viewState === 'peeking') {
            if (info.offset.y < -threshold) {
                onViewStateChange('expanded');
            } else if (info.offset.y > threshold) {
                onViewStateChange('hidden');
            }
        } else if (viewState === 'expanded') {
            if (info.offset.y > threshold) {
                onViewStateChange('peeking');
            }
        }
    };

    // Variants
    const variants = {
        hidden: { y: '100%' },
        peeking: { y: 'calc(100% - 80px)' }, // 80px peek height
        expanded: { y: 0 }
    };

    if (viewState === 'hidden') return null;

    const hasBeatOrRecording = beatUrl || isRecording || isPlaying;
    const progressPercent = (currentTime / (duration || 1)) * 100;

    // Extract plain text from lyrics (which may be Lyric objects)
    const lyricsText = lyrics.map(line => {
        if (typeof line === 'string') return line;
        if (typeof line === 'object' && line !== null && 'html' in line) {
            // Strip HTML tags to get plain text
            const temp = document.createElement('div');
            temp.innerHTML = (line as any).html;
            return temp.textContent || temp.innerText || '';
        }
        return '';
    }).filter(line => line.trim() !== '');

    return (
        <div className="w-full h-full fixed inset-0 z-50 bg-zinc-950 flex flex-col font-sans">
            {/* Page Header */}
            <div className="absolute top-0 left-0 right-0 p-6 z-40 flex items-center justify-between">
                <button onClick={onBack} className="p-2 text-gray-400 hover:text-white transition-colors">
                    <ChevronDown className="rotate-90" size={28} />
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="text-white font-extrabold text-2xl flex items-center gap-2">
                        {songTitle}
                        <span className="p-1 bg-zinc-800 rounded-full text-pink-500"><div className="w-3 h-3 border-2 border-current rounded-sm" /></span>
                    </h1>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Lyrics Area (Main Page Content) */}
            <div
                ref={lyricsContainerRef}
                className="flex-grow overflow-y-auto px-8 pt-28 pb-40 flex flex-col items-center justify-center space-y-8 text-center lyriq-player-view"
                style={{ scrollSnapType: 'y mandatory' }}
                onScroll={handleUserScroll}
            >
                {syncedLines && syncedLines.length > 0 ? (
                    /* Synced Lyrics Mode - with word-level highlighting */
                    syncedLines.map((line, i) => (
                        <p
                            key={i}
                            ref={el => { lineElementsRef.current[i] = el; }}
                            className={`lyriq-line text-3xl font-extrabold transition-all duration-500 cursor-default p-2 rounded-lg 
                                ${i === currentLineIndex ? 'text-white scale-105 bg-pink-500/10 highlighted-line' : 'text-zinc-600'}`}
                            style={{ scrollSnapAlign: 'center', minHeight: '50px' }}
                            data-start={line.start}
                            data-end={line.end}
                        >
                            {/* Render words with individual data attributes for karaoke effect */}
                            {syncedWords ? (() => {
                                // Filter syncedWords to only words within this line's time range
                                const lineWords = syncedWords.filter(w =>
                                    w.start >= line.start && w.end <= line.end
                                );
                                return lineWords.map((timedWord, wordIdx) => {
                                    const isHighlighted = currentTime >= timedWord.start;
                                    return (
                                        <span
                                            key={wordIdx}
                                            className={`lyriq-word ${isHighlighted ? 'highlighted-word' : ''}`}
                                            data-start={timedWord.start}
                                            data-end={timedWord.end}
                                        >
                                            {timedWord.word}{' '}
                                        </span>
                                    );
                                });
                            })() : (
                                line.text
                            )}
                        </p>
                    ))
                ) : lyricsText.length > 0 ? (
                    /* Regular Lyrics Mode - no sync */
                    lyricsText.map((line, i) => (
                        <p
                            key={i}
                            ref={el => { lineElementsRef.current[i] = el; }}
                            className={`lyriq-line text-3xl font-extrabold transition-all duration-500 cursor-default p-2 rounded-lg 
                                ${i === currentLineIndex ? 'text-white scale-105 bg-pink-500/10 highlighted-line' : 'text-zinc-600'}`}
                            style={{ scrollSnapAlign: 'center', minHeight: '50px' }}
                        >
                            {line}
                        </p>
                    ))
                ) : (
                    <p className="text-zinc-600 text-3xl font-bold mt-20">Type your lyrics and flow begins here.</p>
                )}
            </div>

            {/* Slide-Up Player Modal */}
            <motion.div
                initial="peeking"
                animate={viewState}
                variants={variants}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                className="absolute bottom-0 left-0 right-0 z-50 flex flex-col bg-zinc-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] overflow-y-auto border-t border-white/10"
                style={{ height: viewState === 'expanded' ? '30vh' : 'auto', maxHeight: viewState === 'expanded' ? '35vh' : 'auto' }}
            >
                {/* Handle Bar */}
                <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing" onClick={() => viewState === 'peeking' && onViewStateChange('expanded')}>
                    <div className="w-12 h-1.5 bg-zinc-700 rounded-full" />
                </div>

                {/* Player Content (Peek/Collapsed State) */}
                {viewState !== 'expanded' && (
                    <div className="px-6 py-4 pb-6">
                        {!hasBeatOrRecording ? (
                            /* Initial State: Add Beat / Record Buttons */
                            <div className="flex items-center justify-around gap-4 pt-2">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 text-white font-medium px-6 py-3 rounded-full bg-pink-600 hover:bg-pink-700 transition-all shadow-md shadow-pink-900"
                                >
                                    <Music size={20} />
                                    Add Beat
                                </button>
                                <div className="w-px h-8 bg-zinc-700" />
                                <button
                                    onClick={() => setIsRecording(true)}
                                    className="flex items-center gap-2 text-white font-medium px-6 py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors shadow-md shadow-zinc-800"
                                >
                                    <Mic size={20} />
                                    Record Flow
                                </button>
                            </div>
                        ) : (
                            /* Playing/Peek State (Transport Controls) */
                            <div className="flex flex-col gap-2">
                                {/* Progress Bar */}
                                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mb-2 relative">
                                    <motion.div
                                        className="h-full bg-pink-500 shadow-lg shadow-pink-500/50"
                                        style={{ width: `${progressPercent}%` }}
                                        transition={{ duration: 0.1 }}
                                    />
                                    <div className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white ring-2 ring-pink-500" style={{ left: `${progressPercent}%`, marginLeft: '-8px' }} />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <h2 className="text-white font-bold text-base">{songTitle}</h2>
                                        <span className="text-zinc-500 text-xs font-mono">
                                            {formatTime(currentTime)} / {formatTime(duration)}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <button onClick={handleRewind} className="text-white/70 hover:text-white transition-colors p-1">
                                            <Rewind size={24} fill="currentColor" />
                                        </button>
                                        <button onClick={togglePlayback} className="text-white bg-pink-600 p-2 rounded-full hover:bg-pink-500 transition-colors shadow-xl shadow-pink-900">
                                            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                                        </button>
                                        <button onClick={handleForward} className="text-white/70 hover:text-white transition-colors p-1">
                                            <FastForward size={24} fill="currentColor" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* Expanded Content (Minimalist Player) */}
                {viewState === 'expanded' && (
                    <motion.div
                        className="flex-grow flex flex-col px-6 pt-0 items-center justify-start"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Time Display (Centered) */}
                        <div className="text-zinc-400 font-mono text-lg mb-4 mt-6">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </div>

                        {/* Waveform & Track Selectors Container */}
                        <div className="relative w-full">

                            {/* Track Icons - Absolute position left of the waveform */}
                            <div className="absolute top-1/2 -translate-y-1/2 left-0 -ml-1 flex flex-col items-center justify-around h-20 text-zinc-500">
                                <Music size={20} className={beatUrl ? "text-pink-500" : "text-zinc-500"} title="Beat Track" />
                                <div className="h-4"></div> {/* Small spacer */}
                                <Mic size={20} className={isRecording ? "text-red-500" : "text-zinc-500"} title="Vocal Track" />
                            </div>

                            {/* Waveform Container */}
                            <div className="ml-10 h-24 bg-zinc-800/50 rounded-lg relative overflow-hidden flex items-center justify-center p-2">
                                {/* Placeholder Waveform */}
                                <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-50">
                                    {Array.from({ length: 100 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="w-0.5 bg-pink-500/80 rounded-full transition-all duration-100"
                                            style={{ height: `${Math.max(5, Math.random() * 90)}%`, opacity: Math.random() * 0.5 + 0.5 }}
                                        />
                                    ))}
                                </div>
                                {/* Indicator line for current position (Playhead) */}
                                <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 shadow-xl shadow-red-500/50" style={{ left: `${progressPercent}%` }} />
                            </div>
                        </div>

                        {/* Floating Action Buttons (Centered below waveform) */}
                        <div className="flex items-center justify-center gap-8 mt-12">

                            {/* Volume Button */}
                            <button
                                className="p-2.5 text-zinc-400 hover:text-white transition-colors rounded-full w-11 h-11 flex items-center justify-center"
                                title="Toggle Volume Mixer"
                            >
                                <Volume2 size={24} />
                            </button>

                            {/* Record Button */}
                            <button
                                className={`py-2.5 px-4 rounded-full transition-all duration-300 ${isRecording ? 'bg-red-600 text-white animate-pulse shadow-2xl shadow-red-900' : 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900'}`}
                                onClick={() => setIsRecording(!isRecording)}
                                title={isRecording ? "Stop Recording" : "Start Recording"}
                            >
                                <div className={`w-8 h-8 rounded-full ${isRecording ? 'bg-white' : 'bg-red-500/0'}`} />
                            </button>

                            {/* Play/Pause Button */}
                            <button
                                onClick={togglePlayback}
                                className="p-2.5 text-white bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors w-11 h-11 flex items-center justify-center"
                                title={isPlaying ? "Pause Playback" : "Start Playback"}
                            >
                                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                            </button>
                        </div>

                        {/* Vertical Spacer */}
                        <div className="flex-grow w-full h-8" />
                    </motion.div>
                )}
            </motion.div>

            {/* Hidden Audio Elements */}
            <audio ref={beatPlayerRef} src={beatUrl} crossOrigin="anonymous" onLoadedMetadata={() => setDuration(beatPlayerRef.current?.duration || 0)} />
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*"
                className="hidden"
            />
        </div>
    );
};

export default FlowScreen;
