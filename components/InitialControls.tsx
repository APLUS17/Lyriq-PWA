import React, { useRef } from 'react';
import { MusicNoteIcon } from './Icons';

const AddBeatIcon: React.FC = () => (
    <span className="relative inline-flex items-center justify-center">
        <MusicNoteIcon />
        <svg className="absolute -top-1 -right-1 h-2.5 w-2.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
        </svg>
    </span>
);

interface InitialControlsProps {
    onAddBeat: (file: File) => void;
}

const InitialControls: React.FC<InitialControlsProps> = ({ onAddBeat }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddBeatClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onAddBeat(file);
        }
    };

    return (
        <div className="fixed bottom-8 left-6 z-40">
            <button
                type="button"
                onClick={handleAddBeatClick}
                className="flex items-center gap-2 px-4 py-3 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-full text-gray-300 hover:text-white hover:bg-zinc-800 transition-all shadow-lg hover:shadow-xl hover:border-white/20 group"
                aria-label="Add beat from file"
            >
                <div className="text-yellow-500 group-hover:text-yellow-400 transition-colors">
                    <AddBeatIcon />
                </div>
                <span className="font-medium text-sm">Add Beat</span>
            </button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/wav,audio/mpeg,audio/mp3,audio/ogg,audio/flac,audio/aac,audio/*,.wav"
                className="hidden"
                aria-hidden="true"
            />
        </div>
    );
};

export default InitialControls;