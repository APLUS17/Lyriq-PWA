import React from 'react';

interface SectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSection: (title: string) => void;
}

const SECTIONS = [
  'Intro', 'Verse', 'Pre-Chorus', 'Bridge', 'Chorus', 'Outro'
];

const SectionModal: React.FC<SectionModalProps> = ({ isOpen, onClose, onAddSection }) => {
  if (!isOpen) return null;

  const handleAdd = (title: string) => {
    onAddSection(title);
    onClose();
  };
  
  return (
    <>
        <div className="fixed inset-0 z-10" onClick={onClose}></div>
        <div 
            onMouseDown={(e) => e.stopPropagation()} 
            className="absolute top-14 right-6 w-48 bg-zinc-900/90 backdrop-blur-xl border border-white/10 text-gray-200 rounded-xl shadow-2xl z-20 p-1.5 animate-fade-in-fast"
        >
            <ul className="space-y-0.5">
                {SECTIONS.map(title => (
                <li key={title}>
                    <button 
                        type="button" 
                        onClick={() => handleAdd(title)} 
                        className="w-full text-left flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all"
                    >
                    <span className="text-gray-500 text-xs font-light">+</span>
                    <span>{title}</span>
                    </button>
                </li>
                ))}
            </ul>
        </div>
    </>
  );
};

export default SectionModal;