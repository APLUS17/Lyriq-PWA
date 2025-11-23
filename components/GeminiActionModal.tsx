import React, { useEffect, useRef, useState } from 'react';
import { GeminiIcon } from './Icons';

interface GeminiActionModalProps {
  anchorEl: HTMLElement;
  onClose: () => void;
  onAction: (action: 'suggest' | 'rhyme' | 'rewrite') => void;
}

const GeminiActionModal: React.FC<GeminiActionModalProps> = ({ anchorEl, onClose, onAction }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const anchorRect = anchorEl.getBoundingClientRect();
    const modalWidth = 192; // w-48
    const left = Math.min(
      anchorRect.left + window.scrollX,
      window.innerWidth - modalWidth - 16 // 1rem padding from edge
    );
    setPosition({
      top: anchorRect.bottom + window.scrollY + 8, // 8px gap
      left: left,
    });

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node) &&
        !anchorEl.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [anchorEl, onClose]);

  const handleActionClick = (action: 'suggest' | 'rhyme' | 'rewrite') => {
    onAction(action);
    onClose();
  };

  return (
    <div
      ref={modalRef}
      style={{ top: position.top, left: position.left }}
      className="fixed bg-zinc-900/90 backdrop-blur-xl border border-white/10 text-gray-200 rounded-xl shadow-2xl z-50 p-1.5 text-sm font-medium animate-fade-in-fast w-48"
    >
      <div className="px-3 py-2 mb-1 border-b border-white/5 flex items-center gap-2">
         <GeminiIcon className="w-3 h-3 text-blue-400"/>
         <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Gemini AI</span>
      </div>
      <ul className="space-y-0.5">
        <li>
          <button type="button" onClick={() => handleActionClick('suggest')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-gray-300">
            Suggest next line
          </button>
        </li>
        <li>
          <button type="button" onClick={() => handleActionClick('rhyme')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-gray-300">
            Suggest rhymes
          </button>
        </li>
        <li>
          <button type="button" onClick={() => handleActionClick('rewrite')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-gray-300">
            Rewrite
          </button>
        </li>
      </ul>
    </div>
  );
};

export default GeminiActionModal;