import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic, Music, ChevronDown, Rewind, FastForward, Volume2 } from 'lucide-react';
import { motion, PanInfo } from 'framer-motion';
import { TimedWord, TimedLine } from '../types';
import { findLineIndexAtTime, HIGHLIGHT_LOOKAHEAD } from '../services/lyriqTranscriptionService';
import { drawCenteredWaveform, decodeAudioFromUrl } from '../services/canvasWaveformService';
import { playBothTracks, pauseBothTracks, seekBothTracks } from '../services/audioSyncService';
import { getTimeFromEvent } from '../services/scrubbingService';

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

    // Recording state
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Synced Lyrics State
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

    // Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const beatPlayerRef = useRef<HTMLAudioElement | null>(null);
    const vocalPlayerRef = useRef<HTMLAudioElement | null>(null);
    const beatSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const vocalSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lineElementsRef = useRef<(HTMLParagraphElement | null)[]>([]);
    const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
    const scrollTimeoutRef = useRef<number | null>(null);
    const beatWaveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const vocalWaveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const waveformAnimationRef = useRef<number | null>(null);

    // Waveform state
    const [beatAudioBuffer, setBeatAudioBuffer] = useState<AudioBuffer | null>(null);
    const [vocalAudioBuffer, setVocalAudioBuffer] = useState<AudioBuffer | null>(null);

    // Vocal track state
    const [vocalUrl, setVocalUrl] = useState<string | null>(null);

    // Scrubbing state
    const [isScrubbing, setIsScrubbing] = useState(false);
    const waveformContainerRef = useRef<HTMLDivElement | null>(null);

    // Volume mixer state
    const [showVolumeMixer, setShowVolumeMixer] = useState(false);
    const [beatVolume, setBeatVolume] = useState(1.0);
    const [vocalVolume, setVocalVolume] = useState(1.0);

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

    // Update duration when beat loads and decode audio for waveform
    useEffect(() => {
        const audio = beatPlayerRef.current;
        const handleLoadedMetadata = () => {
            setDuration(audio?.duration || 0);
        };

        if (audio) {
            audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        }

        // Decode audio for waveform rendering
        if (beatUrl) {
            const ctx = initAudioContext();
            decodeAudioFromUrl(beatUrl, ctx)
                .then(buffer => {
                    setBeatAudioBuffer(buffer);
                })
                .catch(err => {
                    console.error('Failed to decode audio for waveform:', err);
                });
        } else {
            setBeatAudioBuffer(null);
        }

        return () => {
            if (audio) {
                audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            }
        };
    }, [beatUrl, initAudioContext]);

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

    // Waveform rendering loop for beat track
    useEffect(() => {
        const canvas = beatWaveformCanvasRef.current;
        if (!canvas || !beatAudioBuffer) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size based on container
        const resizeCanvas = () => {
            const container = canvas.parentElement;
            if (container) {
                const dpr = window.devicePixelRatio || 1;
                const rect = container.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.scale(dpr, dpr);
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Animation loop
        const renderWaveform = () => {
            const progress = duration > 0 ? currentTime / duration : 0;
            drawCenteredWaveform(ctx, beatAudioBuffer, progress);
            waveformAnimationRef.current = requestAnimationFrame(renderWaveform);
        };

        renderWaveform();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (waveformAnimationRef.current) {
                cancelAnimationFrame(waveformAnimationRef.current);
            }
        };
    }, [beatAudioBuffer, currentTime, duration]);

    // Waveform rendering loop for vocal track
    useEffect(() => {
        const canvas = vocalWaveformCanvasRef.current;
        if (!canvas || !vocalAudioBuffer) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const resizeCanvas = () => {
            const container = canvas.parentElement;
            if (container) {
                const dpr = window.devicePixelRatio || 1;
                const rect = container.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.scale(dpr, dpr);
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Animation loop for vocal waveform
        let vocalAnimationRef: number | null = null;
        const renderVocalWaveform = () => {
            const progress = duration > 0 ? currentTime / duration : 0;
            drawCenteredWaveform(ctx, vocalAudioBuffer, progress);
            vocalAnimationRef = requestAnimationFrame(renderVocalWaveform);
        };

        renderVocalWaveform();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (vocalAnimationRef) {
                cancelAnimationFrame(vocalAnimationRef);
            }
        };
    }, [vocalAudioBuffer, currentTime, duration]);

    // Toggle Playback
    const togglePlayback = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const ctx = initAudioContext();
        if (!ctx) return;

        if (isPlaying) {
            pauseBothTracks(beatPlayerRef.current, vocalPlayerRef.current);
            setIsPlaying(false);
        } else {
            // Only try to connect the source if a beat is loaded
            if (beatPlayerRef.current && beatUrl) {
                // Connect beat track to audio context
                if (!beatSourceNodeRef.current) {
                    try {
                        beatSourceNodeRef.current = ctx.createMediaElementSource(beatPlayerRef.current);
                        beatSourceNodeRef.current.connect(ctx.destination);
                    } catch (e) { /* console.warn("Beat source already connected", e); */ }
                }

                // Connect vocal track to audio context if exists
                if (vocalPlayerRef.current && vocalUrl && !vocalSourceNodeRef.current) {
                    try {
                        vocalSourceNodeRef.current = ctx.createMediaElementSource(vocalPlayerRef.current);
                        vocalSourceNodeRef.current.connect(ctx.destination);
                    } catch (e) { /* console.warn("Vocal source already connected", e); */ }
                }

                // Play both tracks in sync
                await playBothTracks(beatPlayerRef.current, vocalPlayerRef.current);
                setIsPlaying(true);
            }
        }
    };

    const handleRewind = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (beatPlayerRef.current) {
            const newTime = Math.max(0, beatPlayerRef.current.currentTime - 15);
            seekBothTracks(newTime, beatPlayerRef.current, vocalPlayerRef.current);
            setCurrentTime(newTime);
        }
    };

    const handleForward = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (beatPlayerRef.current) {
            const newTime = Math.min(beatPlayerRef.current.duration, beatPlayerRef.current.currentTime + 15);
            seekBothTracks(newTime, beatPlayerRef.current, vocalPlayerRef.current);
            setCurrentTime(newTime);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onBeatUpload(file);
    };

    // Scrubbing handlers
    const handleScrubStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!waveformContainerRef.current) return;
        setIsScrubbing(true);

        // Pause playback while scrubbing
        if (isPlaying) {
            pauseBothTracks(beatPlayerRef.current, vocalPlayerRef.current);
        }
    }, [isPlaying]);

    const handleScrubMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isScrubbing || !waveformContainerRef.current) return;

        const newTime = getTimeFromEvent(e, waveformContainerRef.current, duration);
        setCurrentTime(newTime);
        seekBothTracks(newTime, beatPlayerRef.current, vocalPlayerRef.current);
    }, [isScrubbing, duration]);

    const handleScrubEnd = useCallback(async () => {
        if (!isScrubbing) return;
        setIsScrubbing(false);

        // Resume playback if it was playing before
        if (isPlaying && beatPlayerRef.current) {
            await playBothTracks(beatPlayerRef.current, vocalPlayerRef.current);
        }
    }, [isScrubbing, isPlaying]);

    // Attach scrubbing event listeners
    useEffect(() => {
        if (isScrubbing) {
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
        }
    }, [isScrubbing, handleScrubMove, handleScrubEnd]);

    // Sync volumes to audio elements
    useEffect(() => {
        if (beatPlayerRef.current) {
            beatPlayerRef.current.volume = beatVolume;
        }
    }, [beatVolume]);

    useEffect(() => {
        if (vocalPlayerRef.current) {
            vocalPlayerRef.current.volume = vocalVolume;
        }
    }, [vocalVolume]);

    // Toggle Recording
    const toggleRecording = async () => {
        if (isRecording) {
            // Stop recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        } else {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                // Determine best mime type
                const mimeTypes = [
                    'audio/webm;codecs=opus',
                    'audio/mp4',
                    'audio/webm'
                ];

                let selectedMimeType = '';
                for (const type of mimeTypes) {
                    if (MediaRecorder.isTypeSupported(type)) {
                        selectedMimeType = type;
                        break;
                    }
                }

                const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
                mediaRecorderRef.current = new MediaRecorder(stream, options);
                audioChunksRef.current = [];

                mediaRecorderRef.current.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorderRef.current.onstop = async () => {
                    // Create blob from recorded chunks
                    const audioBlob = new Blob(audioChunksRef.current, {
                        type: mediaRecorderRef.current?.mimeType || 'audio/webm'
                    });

                    // Create URL for playback
                    const url = URL.createObjectURL(audioBlob);
                    setVocalUrl(url);

                    // Wait a bit for the audio element to update before decoding
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Decode for waveform
                    const ctx = initAudioContext();
                    try {
                        const buffer = await decodeAudioFromUrl(url, ctx);
                        setVocalAudioBuffer(buffer);
                        console.log('Vocal recording decoded successfully', buffer);
                    } catch (err) {
                        console.error('Failed to decode vocal recording:', err);
                    }

                    // Connect vocal player to AudioContext if not already connected
                    if (vocalPlayerRef.current && !vocalSourceNodeRef.current) {
                        try {
                            // Wait for audio element to load
                            await new Promise((resolve) => {
                                if (vocalPlayerRef.current) {
                                    vocalPlayerRef.current.onloadedmetadata = resolve;
                                }
                            });

                            vocalSourceNodeRef.current = ctx.createMediaElementSource(vocalPlayerRef.current);
                            vocalSourceNodeRef.current.connect(ctx.destination);
                            console.log('Vocal player connected to AudioContext');
                        } catch (e) {
                            console.warn("Could not connect vocal source:", e);
                        }
                    }

                    // Stop all tracks in the stream
                    stream.getTracks().forEach(track => track.stop());
                    setIsRecording(false);
                };

                mediaRecorderRef.current.start();
                setIsRecording(true);

                // If beat is playing, keep it playing during recording
                // Otherwise, start playing the beat for recording
                if (!isPlaying && beatPlayerRef.current && beatUrl) {
                    await togglePlayback();
                }
            } catch (error) {
                console.error('Error accessing microphone:', error);
                alert('Could not access microphone. Please ensure permissions are granted.');
            }
        }
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

            {/* Slide-Up Player Modal (CSS Transition) */}
            <div
                className={`lyriq-controls-modal ${viewState === 'expanded' ? 'visible' : viewState === 'peeking' ? 'peeking' : 'hidden'}`}
                onClick={() => {
                    if (viewState === 'peeking') onViewStateChange('expanded');
                }}
            >
                {/* Handle Bar */}
                <div
                    className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (viewState === 'expanded') onViewStateChange('peeking');
                        else if (viewState === 'peeking') onViewStateChange('expanded');
                    }}
                >
                    <div className="w-12 h-1.5 bg-zinc-700 rounded-full" />
                </div>

                {/* Player Content (Peek/Collapsed State) */}
                {/* Player Content (Peek/Collapsed State) */}
                {viewState !== 'expanded' && (
                    (beatUrl || vocalUrl || isRecording) ? (
                        <div className="lyriq-mini-player">
                            <div className="flex flex-col items-start justify-center h-full gap-1">
                                <span className="text-white font-bold text-sm tracking-tight">{songTitle || "Untitled Project"}</span>
                                <span className="text-zinc-500 font-mono text-xs tracking-wider">{formatTime(currentTime)} / {formatTime(duration)}</span>
                            </div>
                            <div className="flex items-center gap-6">
                                <button
                                    onClick={handleRewind}
                                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    <Rewind size={24} fill="currentColor" className="opacity-80" />
                                </button>
                                <button
                                    onClick={togglePlayback}
                                    className="text-zinc-400 hover:text-white transition-colors"
                                >
                                    {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                                </button>
                                <button
                                    onClick={handleForward}
                                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    <FastForward size={24} fill="currentColor" className="opacity-80" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="lyriq-initial-controls">
                            <button
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                className="lyriq-initial-btn"
                            >
                                <Music size={20} />
                                Add Beat
                            </button>
                            <div className="lyriq-initial-separator" />
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleRecording(); }}
                                className="lyriq-initial-btn"
                            >
                                <Mic size={20} />
                                Record
                            </button>
                        </div>
                    )
                )}


                {/* Expanded Content (Minimalist Player) */}
                {viewState === 'expanded' && (
                    <motion.div
                        className="flex-grow flex flex-col px-6 pt-0 items-center justify-start h-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.2 }} // Delay to let slide finish
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
                                <Mic size={20} className={isRecording ? "text-red-500 animate-pulse" : vocalUrl ? "text-green-500" : "text-zinc-500"} title={isRecording ? "Recording..." : vocalUrl ? "Vocal Track Loaded" : "No Vocal Track"} />
                            </div>

                            {/* Waveform Container - Dual Track Stack */}
                            <div
                                ref={waveformContainerRef}
                                className="ml-10 h-24 bg-zinc-800/50 rounded-lg relative overflow-hidden cursor-pointer"
                                onMouseDown={handleScrubStart}
                                onTouchStart={handleScrubStart}
                            >
                                {/* Beat Track Waveform (Bottom Layer) */}
                                <div className="absolute inset-0 flex items-end p-2 pointer-events-none">
                                    {beatAudioBuffer ? (
                                        <canvas
                                            ref={beatWaveformCanvasRef}
                                            className="w-full h-1/2"
                                        />
                                    ) : (
                                        <div className="w-full h-1/2 flex items-center justify-center gap-0.5 opacity-30">
                                            {Array.from({ length: 100 }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="w-0.5 bg-zinc-600 rounded-full"
                                                    style={{ height: `${Math.max(5, Math.random() * 60)}%` }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Vocal Track Waveform (Top Layer) */}
                                {vocalAudioBuffer && (
                                    <div className="absolute inset-0 flex items-start p-2">
                                        <canvas
                                            ref={vocalWaveformCanvasRef}
                                            className="w-full h-1/2"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Volume Mixer Overlay */}
                            {showVolumeMixer && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-0 left-0 right-0 ml-10 h-24 bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-pink-500/20 p-4 flex flex-col justify-center gap-3 z-10"
                                >
                                    {/* Beat Volume Slider */}
                                    <div className="flex items-center gap-3">
                                        <Music size={16} className="text-pink-500 flex-shrink-0" />
                                        <div className="flex-grow relative h-2 bg-zinc-700 rounded-full overflow-hidden">
                                            <div
                                                className="absolute inset-y-0 left-0 bg-pink-500 rounded-full"
                                                style={{ width: `${beatVolume * 100}%` }}
                                            />
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={beatVolume * 100}
                                                onChange={(e) => setBeatVolume(Number(e.target.value) / 100)}
                                                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                                            />
                                        </div>
                                        <span className="text-xs text-zinc-400 w-10 text-right tabular-nums">
                                            {Math.round(beatVolume * 100)}%
                                        </span>
                                    </div>

                                    {/* Vocal Volume Slider */}
                                    {vocalUrl && (
                                        <div className="flex items-center gap-3">
                                            <Mic size={16} className="text-red-500 flex-shrink-0" />
                                            <div className="flex-grow relative h-2 bg-zinc-700 rounded-full overflow-hidden">
                                                <div
                                                    className="absolute inset-y-0 left-0 bg-red-500 rounded-full"
                                                    style={{ width: `${vocalVolume * 100}%` }}
                                                />
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={vocalVolume * 100}
                                                    onChange={(e) => setVocalVolume(Number(e.target.value) / 100)}
                                                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                                                />
                                            </div>
                                            <span className="text-xs text-zinc-400 w-10 text-right tabular-nums">
                                                {Math.round(vocalVolume * 100)}%
                                            </span>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>

                        {/* Floating Action Buttons (Centered below waveform) */}
                        <div className="flex items-center justify-center gap-8 mt-6">

                            {/* Volume Button */}
                            <button
                                onClick={() => setShowVolumeMixer(!showVolumeMixer)}
                                className={`p-2.5 transition-colors rounded-full w-11 h-11 flex items-center justify-center ${showVolumeMixer ? 'text-pink-500 bg-pink-500/10' : 'text-zinc-400 hover:text-white'}`}
                                title="Toggle Volume Mixer"
                            >
                                <Volume2 size={24} />
                            </button>

                            {/* Record Button */}
                            <button
                                className={`py-2.5 px-4 rounded-full transition-all duration-300 ${isRecording ? 'bg-red-600 text-white animate-pulse shadow-2xl shadow-red-900' : 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900'}`}
                                onClick={toggleRecording}
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
                        <div className="flex-grow w-full h-4" />
                    </motion.div>
                )}
            </div>

            {/* Hidden Audio Elements */}
            <audio ref={beatPlayerRef} src={beatUrl} crossOrigin="anonymous" onLoadedMetadata={() => setDuration(beatPlayerRef.current?.duration || 0)} />
            <audio ref={vocalPlayerRef} src={vocalUrl || undefined} />
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
