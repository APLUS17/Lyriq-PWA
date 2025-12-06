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
        <div className="w-full h-full relative bg-black flex flex-col">
            {/* Page Header */}
            <div className="absolute top-0 left-0 right-0 p-6 z-40 flex items-center justify-between">
                <button onClick={onBack} className="p-2 text-gray-400 hover:text-white">
                    <ChevronDown className="rotate-90" size={28} />
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="text-white font-bold text-xl flex items-center gap-2">
                        {songTitle}
                        <span className="p-1 bg-zinc-800 rounded-full text-zinc-400"><div className="w-3 h-3 border-2 border-current rounded-sm" /></span>
                    </h1>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Lyrics Area (Main Page Content) */}
            <div className="flex-grow overflow-y-auto px-6 pt-24 pb-40 flex flex-col items-center justify-center space-y-8 text-center">
                {lyrics.length > 0 ? (
                    lyrics.map((line, i) => (
                        <p key={i} className={`text-2xl font-bold transition-colors duration-300 cursor-default ${i === 0 ? 'text-white' : 'text-zinc-600'}`}>
                            {line}
                        </p>
                    ))
                ) : (
                    <p className="text-zinc-600 text-2xl font-bold">Testing, testing, one, two, <span className="text-pink-500 italic">five</span>.</p>
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
                className="absolute bottom-0 left-0 right-0 z-50 flex flex-col bg-zinc-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden border-t border-white/10"
                style={{ height: viewState === 'expanded' ? '92vh' : 'auto' }}
            >
                {/* Handle Bar */}
                <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing" onClick={() => viewState === 'peeking' && onViewStateChange('expanded')}>
                    <div className="w-12 h-1.5 bg-zinc-700 rounded-full" />
                </div>

                {/* Player Content */}
                <div className="px-6 py-4 pb-8">
                    {!beatUrl && !isRecording && !isPlaying ? (
                        /* Initial State: Add Beat / Record Buttons */
                        <div className="flex items-center justify-around gap-4 pt-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 text-white font-medium px-6 py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                            >
                                <Music size={20} />
                                Add beat
                            </button>
                            <div className="w-px h-8 bg-zinc-700" />
                            <button
                                onClick={() => setIsRecording(true)}
                                className="flex items-center gap-2 text-white font-medium px-6 py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                            >
                                <Mic size={20} />
                                Record
                            </button>
                        </div>
                    ) : (
                        /* Playing/Peek State */
                        <div className="flex flex-col gap-2">
                            {/* Progress Bar */}
                            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mb-2">
                                <div className="h-full bg-pink-500" style={{ width: `${(currentTime / (beatPlayerRef.current?.duration || 1)) * 100}%` }} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <h2 className="text-white font-bold text-sm">{songTitle}</h2>
                                    <span className="text-zinc-500 text-xs font-mono">
                                        {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date((beatPlayerRef.current?.duration || 0) * 1000).toISOString().substr(14, 5)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-6">
                                    <button onClick={handleRewind} className="text-white hover:text-pink-500 transition-colors">
                                        <Rewind size={24} fill="currentColor" />
                                    </button>
                                    <button onClick={togglePlayback} className="text-white hover:text-pink-500 transition-colors">
                                        {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                                    </button>
                                    <button onClick={handleForward} className="text-white hover:text-pink-500 transition-colors">
                                        <FastForward size={24} fill="currentColor" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Expanded Content (Waveform) - Only visible if expanded */}
                {viewState === 'expanded' && (
                    <motion.div
                        className="flex-grow flex flex-col p-6 pt-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <div className="h-48 bg-zinc-950/50 w-full rounded-xl border border-white/5 relative overflow-hidden mt-4">
                            {/* Placeholder Waveform */}
                            <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-50">
                                {Array.from({ length: 50 }).map((_, i) => (
                                    <div key={i} className="w-1 bg-zinc-600 rounded-full" style={{ height: `${Math.random() * 100}%` }} />
                                ))}
                            </div>
                        </div>

                        {/* Expanded Controls */}
                        <div className="flex items-center justify-center gap-8 mt-8">
                            <button
                                className={`p-4 rounded-full transition-colors ${isRecording ? 'bg-red-500 text-white' : 'bg-zinc-800 text-red-500 hover:bg-zinc-700'}`}
                                onClick={() => setIsRecording(!isRecording)}
                            >
                                <Mic size={32} />
                            </button>
                        </div>
                    </motion.div>
                )}
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
        </div>
    );
};

export default FlowScreen;
