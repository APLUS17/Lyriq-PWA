import React from 'react';

interface RhymePopupProps {
  position: { top: number; left: number };
  word: string;
  rhymes: string[];
  isLoading: boolean;
}

const LoadingDots: React.FC = () => (
    <div className="flex space-x-1 justify-center items-center h-12">
        <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce"></div>
    </div>
);

const RhymePopup: React.FC<RhymePopupProps> = ({ position, word, rhymes, isLoading }) => {
  return (
    <div
      style={{ top: position.top + 12, left: position.left }}
      className="fixed bg-zinc-900/95 backdrop-blur-xl border border-white/10 text-gray-200 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-50 p-3 text-sm font-medium animate-fade-in-fast w-48"
    >
      <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 border-b border-white/5 pb-2 px-1">
        Rhymes for "{word}"
      </h4>
      {isLoading ? (
        <LoadingDots />
      ) : (
        <ul className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
          {rhymes.length > 0 && !rhymes.includes('Error.') && !rhymes.includes('No rhymes found.') ? (
            rhymes.map((rhyme) => (
              <li key={rhyme} className="px-2 py-1.5 rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-gray-300">
                {rhyme}
              </li>
            ))
          ) : (
            <li className="text-gray-500 italic px-2 py-1 text-xs">{rhymes[0] || 'No suggestions.'}</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default RhymePopup;