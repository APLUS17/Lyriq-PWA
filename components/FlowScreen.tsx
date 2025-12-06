import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Play, Pause, Mic, Volume2, Music, ChevronDown, Rewind, FastForward, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence, PanInfo, useAnimation } from 'framer-motion';

export type FlowScreenState = 'hidden' | 'peeking' | 'expanded';

interface FlowScreenProps {
    viewState: FlowScreenState;
    onViewStateChange: (state: FlowScreenState) => void;
    songTitle: string;
    lyrics: string[];
    beatUrl?: string;
    onBeatUpload: (file: File) => void;
    onBack?: () => void;
}

const FlowScreen: React.FC<FlowScreenProps> = ({ viewState, onViewStateChange, songTitle, lyrics, beatUrl, onBeatUpload, onBack }) => {
    // Audio State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const beatPlayerRef = useRef<HTMLAudioElement | null>(null);
    const vocalPlayerRef = useRef<HTMLAudioElement | null>(null);
    const beatSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const controlsAnimation = useAnimation();

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

    // Toggle Playback
    const togglePlayback = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const ctx = initAudioContext();
        if (!ctx) return;

        if (isPlaying) {
            beatPlayerRef.current?.pause();
            vocalPlayerRef.current?.pause();
            setIsPlaying(false);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        } else {
            if (beatPlayerRef.current && !beatSourceNodeRef.current) {
                try {
                    beatSourceNodeRef.current = ctx.createMediaElementSource(beatPlayerRef.current);
                    beatSourceNodeRef.current.connect(ctx.destination);
                } catch (e) { console.warn("Beat source already connected", e); }
            }
            if (beatPlayerRef.current) await beatPlayerRef.current.play();
            setIsPlaying(true);

            const animate = () => {
                if (beatPlayerRef.current) {
                    setCurrentTime(beatPlayerRef.current.currentTime);
                }
                animationFrameRef.current = requestAnimationFrame(animate);
            };
            animate();
        }
    };

    const handleRewind = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (beatPlayerRef.current) beatPlayerRef.current.currentTime = Math.max(0, beatPlayerRef.current.currentTime - 15);
    };

    const handleForward = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (beatPlayerRef.current) beatPlayerRef.current.currentTime = Math.min(beatPlayerRef.current.duration, beatPlayerRef.current.currentTime + 15);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onBeatUpload(file);
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

    return (
        <div className="w-full h-full relative bg-black">
            {/* Page Header / Back Button */}
            <div className="absolute top-0 left-0 right-0 p-4 z-40 flex items-center">
                <button onClick={onBack} className="p-2 text-gray-400 hover:text-white">
                    <ChevronDown className="rotate-90" size={28} />
                </button>
            </div>

            {/* Slide-Up Modal */}
            <motion.div
                initial="peeking"
                animate={viewState}
                variants={variants}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                className="absolute bottom-0 left-0 right-0 z-50 flex flex-col bg-zinc-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden border-t border-white/10 h-[92vh]" // Fixed height for modal
            >
                {/* Handle Bar */}
                <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing" onClick={() => viewState === 'peeking' && onViewStateChange('expanded')}>
                    <div className="w-12 h-1.5 bg-zinc-700 rounded-full" />
                </div>

                {/* Header / Peek View */}
                <div className="px-6 py-2 flex items-center justify-between shrink-0 h-16" onClick={() => viewState === 'peeking' && onViewStateChange('expanded')}>
                    <div className="flex flex-col">
                        <h2 className="text-white font-bold text-base">{songTitle}</h2>
                        <span className="text-zinc-500 text-xs font-mono">
                            {new Date(currentTime * 1000).toISOString().substr(14, 5)}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button onClick={handleRewind} className="text-white hover:text-pink-500 transition-colors">
                            <Rewind size={20} fill="currentColor" />
                        </button>
                        <button onClick={togglePlayback} className="text-white hover:text-pink-500 transition-colors">
                            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                        </button>
                        <button onClick={handleForward} className="text-white hover:text-pink-500 transition-colors">
                            <FastForward size={20} fill="currentColor" />
                        </button>
                    </div>
                </div>

                {/* Expanded Content */}
                <motion.div
                    className="flex-grow flex flex-col overflow-hidden"
                    animate={{ opacity: viewState === 'expanded' ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Lyrics Area */}
                    <div className="flex-grow overflow-y-auto p-6 flex flex-col items-center justify-start space-y-6 mt-4">
                        <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold mb-4">[Verse]</p>
                        {lyrics.length > 0 ? (
                            lyrics.map((line, i) => (
                                <p key={i} className="text-xl font-medium text-center text-zinc-600 transition-colors duration-300 hover:text-white cursor-default">
                                    {line}
                                </p>
                            ))
                        ) : (
                            <p className="text-zinc-700 text-xl font-medium">No lyrics yet...</p>
                        )}
                    </div>

                    {/* Waveform Area */}
                    <div className="h-48 bg-zinc-950/50 w-full relative shrink-0 border-t border-white/5">
                        {/* Placeholder Waveform */}
                        <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-50">
                            {Array.from({ length: 50 }).map((_, i) => (
                                <div key={i} className="w-1 bg-zinc-600 rounded-full" style={{ height: `${Math.random() * 100}%` }} />
                            ))}
                        </div>
                        {/* Playhead */}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-pink-500 z-10 left-1/2 shadow-[0_0_10px_rgba(236,72,153,0.5)]" />

                        {/* Time Overlay */}
                        <div className="absolute top-4 left-0 right-0 text-center font-mono text-xs text-zinc-400">
                            {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date((beatPlayerRef.current?.duration || 180) * 1000).toISOString().substr(14, 5)}
                        </div>

                        {/* Controls Overlay */}
                        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-12">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className={`p-3 rounded-full transition-colors ${beatUrl ? 'text-pink-500' : 'text-zinc-600 hover:text-white'}`}
                            >
                                <Music size={24} />
                            </button>

                            <button
                                onClick={togglePlayback}
                                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10"
                            >
                                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                            </button>

                            <button
                                className={`p-3 rounded-full transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-zinc-600 hover:text-white'}`}
                                onClick={() => setIsRecording(!isRecording)}
                            >
                                <Mic size={24} />
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Hidden Audio Elements */}
                <audio ref={beatPlayerRef} src={beatUrl} crossOrigin="anonymous" />
                <audio ref={vocalPlayerRef} crossOrigin="anonymous" />
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="audio/*"
                    className="hidden"
                />
            </motion.div>
        </div>
    );
};

export default FlowScreen;
