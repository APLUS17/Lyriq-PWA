import React from 'react';

const iconProps = {
    className: "h-6 w-6 text-gray-300 hover:text-white transition-colors",
    strokeWidth: 1.5,
};

export const MenuIcon: React.FC = () => (
    <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);

export const UndoIcon: React.FC = () => (
    <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
);

export const RedoIcon: React.FC = () => (
    <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
    </svg>
);

export const ShareIcon: React.FC = () => (
    <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
);

const editorIconProps = {
    className: "h-5 w-5",
};

export const UnderlineIcon: React.FC<{ active: boolean }> = ({ active }) => (
    <span className={`font-sans text-xl font-bold tracking-tighter cursor-pointer ${active ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>U</span>
);

export const SyllableCountIcon: React.FC<{ active: boolean }> = ({ active }) => (
     <span className={`font-sans text-xl font-bold tracking-tighter cursor-pointer ${active ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>S</span>
);

export const PlusIcon: React.FC = () => (
    <svg {...editorIconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="h-5 w-5 text-gray-500 hover:text-gray-300 cursor-pointer">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export const TrashIcon: React.FC = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

export const GeminiIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        className={className}
        fill="currentColor"
    >
        <path d="M11.12 6.52a.85.85 0 0 1 1.76 0l1.29 3.29 3.29 1.29a.85.85 0 0 1 0 1.76l-3.29 1.29-1.29 3.29a.85.85 0 0 1-1.76 0l-1.29-3.29-3.29-1.29a.85.85 0 0 1 0-1.76l3.29-1.29z"></path>
    </svg>
);

export const MicrophoneIcon: React.FC = () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 016 0v8.25a3 3 0 01-3 3z" />
    </svg>
);

export const MusicNoteIcon: React.FC = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V7.5A2.25 2.25 0 0019.5 5.25v1.838m-9 0a2.25 2.25 0 00-2.25 2.25v3.75a2.25 2.25 0 002.25 2.25h.75A2.25 2.25 0 0012 15.75v-3.75a2.25 2.25 0 00-2.25-2.25H9z" />
    </svg>
);

export const PlayIcon: React.FC<{className?: string}> = ({ className = "h-6 w-6" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
    </svg>
);

export const PauseIcon: React.FC<{className?: string}> = ({ className = "h-6 w-6" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
);

export const CloseIcon: React.FC = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const PreviousIcon: React.FC = () => (
    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 18V6h2v12H6zm3.5-6L18 6v12l-8.5-6z" />
    </svg>
);

export const NextIcon: React.FC = () => (
    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 6v12l8.5-6L8 6zm10 12V6h2v12h-2z" />
    </svg>
);