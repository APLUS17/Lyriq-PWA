import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic, Music, ChevronDown, Rewind, FastForward, Volume2, Edit2, Check, Sliders } from 'lucide-react';
import { createVocalEffectChain, setEffectLevel, EffectChain } from '../services/audioEffectsService';
import { motion, PanInfo } from 'framer-motion';
import { TimedWord, TimedLine } from '../types';
import { transcribeAndGroupAudio, findLineIndexAtTime } from '../services/lyriqTranscriptionService';
import { drawCenteredWaveform, decodeAudioFromUrl, drawLiveWaveform } from '../services/canvasWaveformService';

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

    // Audio FX State
    const [effectChain, setEffectChain] = useState<EffectChain | null>(null);
    const [fxSpace, setFxSpace] = useState(0); // Reverb (0-100)
    const [fxWidth, setFxWidth] = useState(0); // Chorus (0-100)
    const [fxDelay, setFxDelay] = useState(0); // Delay (0-100)
    const [showFxPanel, setShowFxPanel] = useState(false);

    // Recording state
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Synced Lyrics State
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

    // Local Transcription State
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [localSyncedWords, setLocalSyncedWords] = useState<TimedWord[] | null>(null);
    const [localSyncedLines, setLocalSyncedLines] = useState<TimedLine[] | null>(null);

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
    const lastScrollY = useRef(0);
    const lastScrollTime = useRef(0);
    const modalCollapseTimeoutRef = useRef<number | null>(null);
    const beatWaveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const vocalWaveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const waveformAnimationRef = useRef<number | null>(null);
    const analyserNodeRef = useRef<AnalyserNode | null>(null);
    const visualizerAnimationRef = useRef<number | null>(null);

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
        let startTime = Date.now() - (currentTime * 1000);

        const animate = () => {
            if (isPlaying) {
                if (beatPlayerRef.current && !beatPlayerRef.current.paused) {
                    setCurrentTime(beatPlayerRef.current.currentTime);
                } else if (vocalPlayerRef.current && !vocalPlayerRef.current.paused) {
                    setCurrentTime(vocalPlayerRef.current.currentTime);
                }
            } else if (isRecording) {
                // If recording without beat playback, update time manually
                if (!isPlaying) {
                    const now = Date.now();
                    setCurrentTime((now - startTime) / 1000);
                }
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        if (isPlaying || isRecording) {
            // Reset start time reference if starting fresh
            if (!isPlaying && isRecording) {
                startTime = Date.now() - (currentTime * 1000);
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isPlaying, isRecording]);

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

    // Update FX Levels in Real-time
    useEffect(() => {
        if (!effectChain) return;
        setEffectLevel(effectChain.reverbGain, fxSpace);
    }, [fxSpace, effectChain]);

    useEffect(() => {
        if (!effectChain) return;
        setEffectLevel(effectChain.widthGain, fxWidth);
    }, [fxWidth, effectChain]);

    useEffect(() => {
        if (!effectChain) return;
        setEffectLevel(effectChain.delayGain, fxDelay);
    }, [fxDelay, effectChain]);

    // Auto-scroll and highlighting effect
    // Line-by-Line Sync Logic (Apple Music Style)
    const HIGHLIGHT_OFFSET = 0.15; // 0.15s lookahead

    // Auto-scroll and highlighting effect
    useEffect(() => {
        const activeLines = localSyncedLines || syncedLines;

        if (!activeLines || activeLines.length === 0 || !isPlaying) return;

        const lookaheadTime = currentTime + HIGHLIGHT_OFFSET;
        const newLineIndex = findLineIndexAtTime(lookaheadTime, activeLines);

        if (newLineIndex !== currentLineIndex) {
            setCurrentLineIndex(newLineIndex);

            // Auto-scroll to active line
            if (autoScrollEnabled && lineElementsRef.current[newLineIndex]) {
                lineElementsRef.current[newLineIndex]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }, [currentTime, syncedLines, localSyncedLines, isPlaying, currentLineIndex, autoScrollEnabled]);

    // Disable auto-scroll when user manually scrolls + smart modal behavior
    const handleUserScroll = useCallback(() => {
        const now = Date.now();
        // Throttle to max once per 100ms
        if (now - lastScrollTime.current < 100) return;
        lastScrollTime.current = now;

        const currentScrollY = lyricsContainerRef.current?.scrollTop || 0;
        const scrollDelta = currentScrollY - lastScrollY.current;
        lastScrollY.current = currentScrollY;

        // Detect scroll direction and update modal state
        if (Math.abs(scrollDelta) > 5) { // Ignore tiny movements
            // Clear existing modal timeout
            if (modalCollapseTimeoutRef.current) {
                clearTimeout(modalCollapseTimeoutRef.current);
            }

            // Debounce modal state change (200ms)
            modalCollapseTimeoutRef.current = window.setTimeout(() => {
                if (scrollDelta > 0 && viewState === 'expanded') {
                    // Scrolling down → collapse to peek
                    onViewStateChange('peeking');
                } else if (scrollDelta < 0 && viewState === 'peeking') {
                    // Scrolling up → expand
                    onViewStateChange('expanded');
                }
                modalCollapseTimeoutRef.current = null;
            }, 200);
        }

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
    }, [isPlaying, viewState, onViewStateChange]);

    // Click-to-seek: Jump playback to clicked line
    const handleLineClick = useCallback((lineIndex: number) => {
        const lines = localSyncedLines || syncedLines;
        const line = lines?.[lineIndex];
        if (!line) return;

        // Seek to line start
        seekBothTracks(
            line.start,
            beatPlayerRef.current!,
            vocalPlayerRef.current
        );

        // Update current line immediately
        setCurrentLineIndex(lineIndex);
        setCurrentTime(line.start);

        // Re-enable auto-scroll
        setAutoScrollEnabled(true);
    }, [localSyncedLines, syncedLines, duration]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            if (modalCollapseTimeoutRef.current) {
                clearTimeout(modalCollapseTimeoutRef.current);
            }
        };
    }, []);

    // Waveform rendering loop for beat track
    useEffect(() => {
        const canvas = beatWaveformCanvasRef.current;
        if (!canvas || !beatAudioBuffer) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size based on its actual rendered size (controlled by CSS)
        const resizeCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            // Use canvas rect, not container, because container holds both canvases now
            const rect = canvas.getBoundingClientRect();

            // Avoid zero-size issues if hidden
            if (rect.width === 0 || rect.height === 0) return;

            const newWidth = rect.width * dpr;
            const newHeight = rect.height * dpr;

            if (canvas.width !== newWidth || canvas.height !== newHeight) {
                canvas.width = newWidth;
                canvas.height = newHeight;
                ctx.scale(dpr, dpr);
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
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();

            if (rect.width === 0 || rect.height === 0) return;

            const newWidth = rect.width * dpr;
            const newHeight = rect.height * dpr;

            if (canvas.width !== newWidth || canvas.height !== newHeight) {
                canvas.width = newWidth;
                canvas.height = newHeight;
                ctx.scale(dpr, dpr);
            }
        };

        resizeCanvas();

        // Render vocal waveform (static for now, will update with progress)
        const progress = duration > 0 ? currentTime / duration : 0;
        drawCenteredWaveform(ctx, vocalAudioBuffer, progress);

        return () => {
            // Cleanup
        };
    }, [vocalAudioBuffer, currentTime, duration]);

    // Toggle Playback
    const togglePlayback = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const ctx = initAudioContext();
        if (!ctx) return;

        if (isPlaying) {
            pauseBothTracks(beatPlayerRef.current!, vocalPlayerRef.current);
            setIsPlaying(false);
        } else {
            // Check if we have EITHER a beat OR a vocal track to play
            if ((beatPlayerRef.current && beatUrl) || (vocalPlayerRef.current && vocalUrl)) {

                // Connect beat track to audio context if exists
                if (beatPlayerRef.current && beatUrl && !beatSourceNodeRef.current) {
                    try {
                        beatSourceNodeRef.current = ctx.createMediaElementSource(beatPlayerRef.current);
                        beatSourceNodeRef.current.connect(ctx.destination);
                    } catch (e) { /* console.warn("Beat source already connected", e); */ }
                }

                // Connect                // 2. Connect Vocal Track WITH EFFECTS CHAIN
                if (vocalPlayerRef.current && vocalUrl && !vocalSourceNodeRef.current) {
                    try {
                        vocalSourceNodeRef.current = ctx.createMediaElementSource(vocalPlayerRef.current);

                        // Create Effect Chain if not exists
                        let chain = effectChain;
                        if (!chain) {
                            chain = createVocalEffectChain(ctx);
                            setEffectChain(chain);
                        }

                        // Source -> Effect Input
                        vocalSourceNodeRef.current.disconnect(); // Disconnect from prev destination
                        vocalSourceNodeRef.current.connect(chain!.inputNode);

                        // Effect Output -> Speakers
                        chain!.outputNode.connect(ctx.destination);

                        // Apply current levels
                        setEffectLevel(chain!.reverbGain, fxSpace);
                        setEffectLevel(chain!.widthGain, fxWidth);
                        setEffectLevel(chain!.delayGain, fxDelay);

                    } catch (e) {
                        console.error("FX Setup Error", e);
                        // Fallback to direct connection if FX fails
                        if (vocalSourceNodeRef.current) {
                            try { vocalSourceNodeRef.current.connect(ctx.destination); } catch (err) { }
                        }
                    }
                }

                // Auto-rewind if at end
                if (currentTime >= duration && duration > 0) {
                    seekBothTracks(0, beatPlayerRef.current, vocalPlayerRef.current);
                    setCurrentTime(0);
                }

                // Play available tracks
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
            // Stop Visualizer
            if (visualizerAnimationRef.current) {
                cancelAnimationFrame(visualizerAnimationRef.current);
                visualizerAnimationRef.current = null;
            }
            // Analyser node cleanup is handled by GC as simple JS object, 
            // but we might want to check if we need to disconnect source. 
            // Since source was local, it will be GC'd when stream tracks stop.
            analyserNodeRef.current = null;
        } else {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        channelCount: 1,
                        sampleRate: 24000
                    }
                });

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

                    // Decode for waveform
                    const ctx = initAudioContext();
                    try {
                        const buffer = await decodeAudioFromUrl(url, ctx);
                        setVocalAudioBuffer(buffer);

                        // Update duration if we don't have one (acapella) or if vocal is longer
                        if (duration === 0 || buffer.duration > duration) {
                            setDuration(buffer.duration);
                        }
                    } catch (err) {
                        console.error('Failed to decode vocal recording:', err);
                    }

                    // Stop all tracks in the stream
                    stream.getTracks().forEach(track => track.stop());
                    setIsRecording(false);

                    // Start Transcription
                    setIsTranscribing(true);
                    try {
                        const { words, lines } = await transcribeAndGroupAudio(audioBlob);
                        setLocalSyncedWords(words);
                        setLocalSyncedLines(lines);
                        console.log('Transcription complete:', words, lines);
                    } catch (error: any) {
                        console.error('Transcription failed:', error);
                        const errorMessage = error?.message || 'Unknown error';
                        const stack = error?.stack || 'No stack trace';
                        alert(`Transcription failed.\n\nError: ${errorMessage}\n\nStack: ${stack.substring(0, 200)}...`);
                    } finally {
                        setIsTranscribing(false);
                    }
                };

                mediaRecorderRef.current.start();
                setIsRecording(true);

                // Setup Live Visualizer
                const audioCtx = initAudioContext();
                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 2048;

                // --- Live FX Monitoring Setup ---
                let chain = effectChain;
                if (!chain) {
                    chain = createVocalEffectChain(audioCtx);
                    setEffectChain(chain);
                }

                // Mic -> Analyser (for waveform)
                source.connect(analyser);
                analyserNodeRef.current = analyser;

                // Mic -> FX Chain -> Speakers (Monitoring)
                source.connect(chain.inputNode);
                chain.outputNode.connect(audioCtx.destination);

                // Sync current UI levels to the new chain
                setEffectLevel(chain.reverbGain, fxSpace);
                setEffectLevel(chain.widthGain, fxWidth);
                setEffectLevel(chain.delayGain, fxDelay);

                const drawVisualizer = () => {
                    if (!vocalWaveformCanvasRef.current || !analyserNodeRef.current) return;
                    const canvas = vocalWaveformCanvasRef.current;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;

                    // Ensure canvas size matches display size
                    const dpr = window.devicePixelRatio || 1;
                    const rect = canvas.getBoundingClientRect();
                    const width = rect.width * dpr;
                    const height = rect.height * dpr;

                    if (canvas.width !== width || canvas.height !== height) {
                        canvas.width = width;
                        canvas.height = height;
                        ctx.scale(dpr, dpr);
                    }

                    const bufferLength = analyserNodeRef.current.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);
                    analyserNodeRef.current.getByteTimeDomainData(dataArray);

                    // Use context wrapper to handle scaling if needed, or pass raw canvas dimensions
                    // drawLiveWaveform handles clearRect using passed width/height
                    drawLiveWaveform(ctx, dataArray, bufferLength);

                    visualizerAnimationRef.current = requestAnimationFrame(drawVisualizer);
                };
                drawVisualizer();

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

    // Editing Handlers
    const handleEditToggle = () => {
        // Edit feature removed for Apple Music style
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
                    <h1 className={`text-white font-extrabold flex items-center gap-2 transition-all duration-700 ease-out 
                        ${((localSyncedLines && localSyncedLines.length > 0) || (syncedLines && syncedLines.length > 0)) ? 'text-2xl mt-0' : 'text-4xl mt-0'}`}>
                        {songTitle}
                    </h1>
                </div>
                <div className="w-10" />
            </div>

            {/* Lyrics Area (Main Page Content) */}
            <div
                ref={lyricsContainerRef}
                className="flex-grow overflow-y-auto px-4 md:px-8 pt-24 md:pt-[50vh] pb-48 md:pb-[50vh] flex flex-col items-center space-y-6 text-center lyriq-player-view"
                onScroll={handleUserScroll}
            >
                {isTranscribing ? (
                    <div className="flex flex-col items-center justify-center space-y-4 animate-pulse">
                        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                        <p className="text-zinc-400 font-medium">Transcribing your flow...</p>
                    </div>
                ) : (localSyncedLines && localSyncedLines.length > 0) || (syncedLines && syncedLines.length > 0) ? (
                    /* Synced Lyrics Mode - Apple Music Style */
                    (localSyncedLines || syncedLines)!.map((line, i) => (
                        <p
                            key={i}
                            ref={el => { lineElementsRef.current[i] = el; }}
                            onClick={() => handleLineClick(i)}
                            className={`lyriq-line text-xl md:text-3xl transition-all duration-500 p-3 md:p-4 rounded-xl cursor-pointer
                                ${i === currentLineIndex
                                    ? 'text-white scale-105 opacity-100 blur-0 font-extrabold'
                                    : 'text-zinc-500 scale-100 opacity-50 blur-[0.5px] font-semibold hover:opacity-80'}`}
                            style={{ minHeight: '60px' }}
                            data-start={line.start}
                            data-end={line.end}
                        >
                            {/* Render words with individual data attributes for karaoke effect */}
                            {/* Apple Music Style - Line Highlighting Only */}
                            {line.text}

                        </p>
                    ))
                ) : (
                    <p className="text-zinc-600 text-3xl font-bold mt-20">Find Your Flow</p>
                )}
            </div>

            {/* Slide-Up Player Modal (CSS Transition) */}
            <div
                className={`lyriq-controls-modal ${viewState === 'expanded' ? 'visible' : viewState === 'peeking' ? 'peeking' : 'hidden'} ${beatUrl ? 'has-beat' : ''}`}
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
                            {/* Track Icons - Absolute position left of the waveform */}
                            <div className="absolute top-1/2 -translate-y-1/2 left-0 -ml-1 flex flex-col items-center justify-around h-20 text-zinc-500 z-10">
                                <div
                                    className="cursor-pointer hover:text-white transition-colors p-1"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        fileInputRef.current?.click();
                                    }}
                                >
                                    <Music size={20} className={beatUrl ? "text-pink-500" : "text-zinc-500"} title="Upload Beat" />
                                </div>
                                <div className="h-2"></div> {/* Small spacer */}
                                <Mic size={20} className={isRecording ? "text-red-500" : "text-zinc-500"} title="Vocal Track" />
                            </div>

                            {/* Waveform Container - Dual Track Stack */}
                            <div
                                ref={waveformContainerRef}
                                className="lyriq-waveforms cursor-pointer"
                                onMouseDown={handleScrubStart}
                                onTouchStart={handleScrubStart}
                            >
                                <canvas
                                    ref={beatWaveformCanvasRef}
                                    id="beatWaveformCanvas"
                                    width={3344}
                                />
                                <canvas
                                    ref={vocalWaveformCanvasRef}
                                    id="vocalWaveformCanvas"
                                    width={3344}
                                />
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

                            {/* FX Panel Overlay (Room, Width, Delay) */}
                            {showFxPanel && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-0 left-0 right-0 ml-10 h-32 bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-cyan-500/20 p-4 flex flex-col justify-center gap-2 z-20"
                                >
                                    {/* Room Reverb Slider */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] uppercase font-bold text-cyan-500 w-12 tracking-wider">Room</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={fxSpace}
                                            onChange={(e) => setFxSpace(Number(e.target.value))}
                                            className="flex-grow h-1.5 bg-zinc-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                                        />
                                        <span className="text-xs text-zinc-400 w-8 text-right">{fxSpace}%</span>
                                    </div>

                                    {/* Width Slider */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] uppercase font-bold text-violet-500 w-12 tracking-wider">Width</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={fxWidth}
                                            onChange={(e) => setFxWidth(Number(e.target.value))}
                                            className="flex-grow h-1.5 bg-zinc-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400"
                                        />
                                        <span className="text-xs text-zinc-400 w-8 text-right">{fxWidth}%</span>
                                    </div>

                                    {/* Delay Slider */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] uppercase font-bold text-blue-500 w-12 tracking-wider">Delay</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={fxDelay}
                                            onChange={(e) => setFxDelay(Number(e.target.value))}
                                            className="flex-grow h-1.5 bg-zinc-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400"
                                        />
                                        <span className="text-xs text-zinc-400 w-8 text-right">{fxDelay}%</span>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Floating Action Buttons (Centered below waveform) */}
                        <div className="flex items-center justify-center gap-8 mt-6">

                            {/* FX Toggle Button */}
                            <button
                                onClick={() => setShowFxPanel(!showFxPanel)}
                                className={`p-2.5 transition-colors rounded-full w-11 h-11 flex items-center justify-center ${showFxPanel ? 'text-cyan-400 bg-cyan-400/10' : 'text-zinc-400 hover:text-white'}`}
                                title="Toggle Effects"
                            >
                                <Sliders size={20} />
                            </button>

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
                                className={`py-2.5 px-4 rounded-full transition-all duration-300 ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-red-600 hover:bg-red-700'}`}
                                onClick={toggleRecording}
                                title={isRecording ? "Stop Recording" : "Start Recording"}
                            >
                                <div className={`w-8 h-8 transition-all duration-300 bg-white ${isRecording ? 'rounded-md scale-50' : 'rounded-full scale-50'}`} />
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
            <audio ref={vocalPlayerRef} src={vocalUrl || undefined} crossOrigin="anonymous" />
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
