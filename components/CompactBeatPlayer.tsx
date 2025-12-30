import React, { useState, useEffect, useRef } from 'react';
import { PlayIcon, PauseIcon, TrashIcon } from './Icons';

interface CompactBeatPlayerProps {
    beat: { url: string; file: File };
    onRemoveBeat: () => void;
}

const formatDuration = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60).toString();
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

const CompactBeatPlayer: React.FC<CompactBeatPlayerProps> = ({ beat, onRemoveBeat }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [analyserData, setAnalyserData] = useState<number[]>(new Array(16).fill(0));

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const animationRef = useRef<number | null>(null);
    const progressBarRef = useRef<HTMLDivElement | null>(null);
    const isScrubbingRef = useRef(false);

    useEffect(() => {
        const audio = new Audio(beat.url);
        audioRef.current = audio;

        const handleTimeUpdate = () => {
            if (audio.duration && !isScrubbingRef.current) {
                setProgress(audio.currentTime / audio.duration);
            }
        };
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
            audio.pause();
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [beat]);

    const setupAnalyser = () => {
        if (!audioRef.current || sourceRef.current) return;

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const source = ctx.createMediaElementSource(audioRef.current);
        sourceRef.current = source;
        source.connect(analyser);
        analyser.connect(ctx.destination);
    };

    const updateWaveform = () => {
        if (!analyserRef.current || !isPlaying) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        const samples = Array.from({ length: 16 }, (_, i) => {
            const idx = Math.floor(i * (dataArray.length / 16));
            return dataArray[idx] / 255;
        });

        setAnalyserData(samples);
        animationRef.current = requestAnimationFrame(updateWaveform);
    };

    const handlePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!audioRef.current) return;

        if (!sourceRef.current) {
            setupAnalyser();
        }

        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }

        if (isPlaying) {
            audioRef.current.pause();
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        } else {
            audioRef.current.play().catch(console.error);
            updateWaveform();
        }
        setIsPlaying(!isPlaying);
    };

    const handleScrub = (e: React.MouseEvent | React.TouchEvent) => {
        if (!progressBarRef.current || !audioRef.current || !audioRef.current.duration) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const newProgress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        setProgress(newProgress);
        audioRef.current.currentTime = newProgress * audioRef.current.duration;
    };

    const handleScrubStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        isScrubbingRef.current = true;
        handleScrub(e);
    };

    useEffect(() => {
        const handleScrubMove = (e: MouseEvent | TouchEvent) => {
            if (isScrubbingRef.current) handleScrub(e as any);
        };
        const handleScrubEnd = () => { isScrubbingRef.current = false; };

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

    const currentTime = audioRef.current ? progress * (audioRef.current.duration || 0) : 0;
    const totalDuration = audioRef.current?.duration || 0;
    const fileName = beat.file.name.replace(/\.[^/.]+$/, '');

    // Collapsed state - compact inline player
    if (!isExpanded) {
        return (
            <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setIsExpanded(true)}
            >
                <button
                    type="button"
                    onClick={handlePlayPause}
                    className="pulp-btn !w-8 !h-8 !shadow-[3px_3px_6px_var(--pulp-shadow),-3px_-3px_6px_var(--pulp-highlight)]"
                >
                    {isPlaying ? <PauseIcon className="w-3 h-3" /> : <PlayIcon className="w-3 h-3" />}
                </button>

                <div className="flex items-end gap-[2px] h-5">
                    {analyserData.map((value, i) => (
                        <div
                            key={i}
                            className="w-[3px] bg-[var(--pulp-ink)] rounded-full transition-all duration-75"
                            style={{
                                height: `${Math.max(4, value * 20)}px`,
                                opacity: isPlaying ? 0.4 + value * 0.6 : 0.3
                            }}
                        />
                    ))}
                </div>

                <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-[var(--pulp-ink)] opacity-80 tabular-nums">
                        {formatDuration(currentTime)}
                    </span>
                    <span className="text-[9px] font-mono text-[var(--pulp-ink)] opacity-50 truncate max-w-[80px]">
                        {fileName}
                    </span>
                </div>
            </div>
        );
    }

    // Expanded state - card with scrubbing controls
    return (
        <div
            className="absolute bottom-10 left-0 bg-[var(--pulp-base)] rounded-xl p-4 shadow-[8px_8px_16px_var(--pulp-shadow),-8px_-8px_16px_var(--pulp-highlight)] min-w-[280px] z-50"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header with close */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-[var(--pulp-ink)] opacity-60 uppercase tracking-wider">
                    Beat
                </span>
                <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="text-[var(--pulp-ink)] opacity-40 hover:opacity-100 text-lg"
                >
                    ×
                </button>
            </div>

            {/* Track name */}
            <p className="text-sm font-mono text-[var(--pulp-ink)] font-medium truncate mb-3">
                {fileName}
            </p>

            {/* Progress bar / scrubber */}
            <div
                ref={progressBarRef}
                className="relative h-2 bg-[var(--pulp-shadow)] rounded-full cursor-pointer mb-3"
                onMouseDown={handleScrubStart}
                onTouchStart={handleScrubStart}
            >
                <div
                    className="absolute top-0 left-0 h-full bg-[var(--pulp-accent)] rounded-full transition-all duration-75"
                    style={{ width: `${progress * 100}%` }}
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--pulp-base)] border-2 border-[var(--pulp-accent)] rounded-full shadow-md transition-all duration-75"
                    style={{ left: `calc(${progress * 100}% - 6px)` }}
                />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[var(--pulp-ink)] opacity-60 tabular-nums">
                    {formatDuration(currentTime)}
                </span>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handlePlayPause}
                        className="pulp-btn !w-10 !h-10"
                    >
                        {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRemoveBeat(); }}
                        className="pulp-btn !w-8 !h-8 text-red-500"
                    >
                        <TrashIcon />
                    </button>
                </div>

                <span className="text-[10px] font-mono text-[var(--pulp-ink)] opacity-60 tabular-nums">
                    {formatDuration(totalDuration)}
                </span>
            </div>
        </div>
    );
};

export default CompactBeatPlayer;
