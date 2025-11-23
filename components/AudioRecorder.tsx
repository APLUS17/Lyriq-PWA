import React, { useState, useEffect } from 'react';
import { TrashIcon } from './Icons';

interface AudioRecorderProps {
    startTime: number;
    onSave: () => void;
    onCancel: () => void;
}

const CheckIcon: React.FC = () => (
    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);


const AudioRecorder: React.FC<AudioRecorderProps> = ({ startTime, onSave, onCancel }) => {
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedTime(Date.now() - startTime);
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    return (
        <div className="fixed bottom-8 left-0 right-0 z-50 flex justify-center">
            <div className="bg-zinc-900 border border-red-500/30 shadow-[0_0_40px_-10px_rgba(239,68,68,0.3)] rounded-full flex items-center gap-6 px-6 py-3 animate-fade-in-fast backdrop-blur-md">
                <div className="flex items-center gap-3 border-r border-white/10 pr-6">
                    <div className="relative">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                        <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-500 blur-sm animate-pulse"></div>
                    </div>
                    <span className="font-mono text-white text-lg tracking-widest tabular-nums">{formatTime(elapsedTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        type="button" 
                        onClick={onCancel} 
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all" 
                        aria-label="Cancel recording"
                    >
                        <TrashIcon />
                    </button>
                    <button 
                        type="button" 
                        onClick={onSave} 
                        className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all shadow-lg shadow-red-500/20" 
                        aria-label="Save take"
                    >
                        <CheckIcon />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AudioRecorder;