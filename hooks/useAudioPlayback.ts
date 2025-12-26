import { useState, useEffect, useRef, useCallback } from 'react';

export interface AudioMarker {
    position: number; // Position in seconds
    note?: string;
    id: string;
}

export interface AudioPlaybackState {
    isPlaying: boolean;
    position: number; // Current position in seconds
    duration: number; // Total duration in seconds
    progress: number; // 0-1 normalized progress
    playbackSpeed: number;
    markers: AudioMarker[];
    audioElement: HTMLAudioElement | null;
}

export interface AudioPlaybackControls {
    play: () => Promise<void>;
    pause: () => void;
    togglePlayPause: () => Promise<void>;
    seek: (positionSeconds: number) => void;
    seekToProgress: (progress: number) => void;
    setSpeed: (speed: number) => void;
    addMarker: (note?: string) => void;
    removeMarker: (markerId: string) => void;
    seekToMarker: (markerId: string) => void;
}

export interface UseAudioPlaybackReturn extends AudioPlaybackState, AudioPlaybackControls {
    // Combined interface with all state and controls
}

/**
 * Custom hook for managing audio playback with enhanced features:
 * - Speed control (0.5x, 1x, 1.5x, 2x)
 * - Progress tracking and scrubbing
 * - Timestamp markers
 */
export function useAudioPlayback(audioUrl: string): UseAudioPlaybackReturn {
    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [progress, setProgress] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [markers, setMarkers] = useState<AudioMarker[]>([]);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isManualSeekRef = useRef(false);

    // Initialize audio element
    useEffect(() => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        // Set initial playback rate
        audio.playbackRate = playbackSpeed;

        const handleLoadedMetadata = () => {
            setDuration(audio.duration || 0);
        };

        const handleTimeUpdate = () => {
            if (!isManualSeekRef.current && audio.duration) {
                const currentPos = audio.currentTime;
                setPosition(currentPos);
                setProgress(currentPos / audio.duration);
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setPosition(0);
            setProgress(0);
            audio.currentTime = 0;
        };

        const handlePause = () => {
            setIsPlaying(false);
        };

        const handlePlay = () => {
            setIsPlaying(true);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('play', handlePlay);

        // If duration is already available (cached audio)
        if (audio.duration) {
            setDuration(audio.duration);
        }

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('play', handlePlay);
            audio.pause();
            audioRef.current = null;
        };
    }, [audioUrl]);

    // Update playback speed when it changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed]);

    const play = useCallback(async () => {
        if (audioRef.current) {
            try {
                await audioRef.current.play();
            } catch (error) {
                console.error('Playback error:', error);
            }
        }
    }, []);

    const pause = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
    }, []);

    const togglePlayPause = useCallback(async () => {
        if (isPlaying) {
            pause();
        } else {
            await play();
        }
    }, [isPlaying, play, pause]);

    const seek = useCallback((positionSeconds: number) => {
        if (audioRef.current && audioRef.current.duration) {
            isManualSeekRef.current = true;
            const clampedPosition = Math.max(0, Math.min(positionSeconds, audioRef.current.duration));
            audioRef.current.currentTime = clampedPosition;
            setPosition(clampedPosition);
            setProgress(clampedPosition / audioRef.current.duration);

            // Reset manual seek flag after a short delay
            setTimeout(() => {
                isManualSeekRef.current = false;
            }, 100);
        }
    }, []);

    const seekToProgress = useCallback((progressValue: number) => {
        if (audioRef.current && audioRef.current.duration) {
            const clampedProgress = Math.max(0, Math.min(1, progressValue));
            const positionSeconds = clampedProgress * audioRef.current.duration;
            seek(positionSeconds);
        }
    }, [seek]);

    const setSpeed = useCallback((speed: number) => {
        // Clamp speed between 0.25x and 2x
        const clampedSpeed = Math.max(0.25, Math.min(2, speed));
        setPlaybackSpeed(clampedSpeed);
    }, []);

    const addMarker = useCallback((note?: string) => {
        const newMarker: AudioMarker = {
            position,
            note,
            id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        setMarkers(prev => [...prev, newMarker].sort((a, b) => a.position - b.position));
    }, [position]);

    const removeMarker = useCallback((markerId: string) => {
        setMarkers(prev => prev.filter(m => m.id !== markerId));
    }, []);

    const seekToMarker = useCallback((markerId: string) => {
        const marker = markers.find(m => m.id === markerId);
        if (marker) {
            seek(marker.position);
        }
    }, [markers, seek]);

    return {
        // State
        isPlaying,
        position,
        duration,
        progress,
        playbackSpeed,
        markers,
        audioElement: audioRef.current,

        // Controls
        play,
        pause,
        togglePlayPause,
        seek,
        seekToProgress,
        setSpeed,
        addMarker,
        removeMarker,
        seekToMarker,
    };
}
