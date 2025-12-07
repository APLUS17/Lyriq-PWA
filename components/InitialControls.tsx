import React, { useRef } from 'react';
import { MusicNoteIcon } from './Icons';

const AddBeatIcon: React.FC = () => (
    <span className="relative inline-flex items-center justify-center w-5 h-5">
        <MusicNoteIcon />
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
                className="fixed bottom-8 right-6 z-40 flex items-center justify-center rounded-full bg-zinc-800/40 backdrop-blur-md border border-white/10 p-4 text-white shadow-lg hover:bg-white/10 transition-all active:scale-95"
                aria-label="Add beat from file"
            >
                <AddBeatIcon />
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