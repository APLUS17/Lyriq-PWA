import React, { useRef } from 'react';
import { MusicNoteIcon } from './Icons';

const AddBeatIcon: React.FC = () => (
    <span className="relative inline-flex items-center justify-center w-5 h-5">
        <MusicNoteIcon />
        <svg className="absolute -top-0.5 -right-0.5 h-3 w-3 text-white bg-yellow-500 rounded-full p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
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
        <>
            <button
                type="button"
                onClick={handleAddBeatClick}
                className="fixed bottom-8 right-6 z-40 flex items-center gap-2 rounded-full bg-zinc-900/80 px-5 py-3 text-sm font-medium text-white shadow-lg backdrop-blur-md border border-white/10 hover:bg-zinc-800 transition-all active:scale-95"
                aria-label="Add beat from file"
            >
                <MusicNoteIcon />
                <span>Add Beat</span>
            </button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/wav,audio/mpeg,audio/mp3,audio/ogg,audio/flac,audio/aac,audio/*,.wav"
                className="hidden"
                aria-hidden="true"
            />
        </>
    );

};

export default InitialControls;