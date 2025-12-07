import React from 'react';
import { motion } from 'framer-motion';

interface EditorControlPillProps {
  isUnstructured: boolean;
  showSyllableCount: boolean;
  onToggleUnstructured: () => void;
  onToggleSyllableCount: () => void;
  onAddSection: () => void;
}

const EditorControlPill: React.FC<EditorControlPillProps> = ({
  isUnstructured,
  showSyllableCount,
  onToggleUnstructured,
  onToggleSyllableCount,
  onAddSection,
}) => {
  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="fixed bottom-4 left-6 z-20 flex justify-start pointer-events-none"
    >
      <motion.div
        className="bg-[#1c1c1e]/90 p-1.5 rounded-full flex items-center gap-1 shadow-2xl border border-white/10 pointer-events-auto backdrop-blur-md"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* U - Unstructured Toggle */}
        <motion.button
          onClick={onToggleUnstructured}
          className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-base transition-all ${
            isUnstructured
              ? 'text-white bg-[#3a3a3c]'
              : 'text-gray-500 hover:text-white hover:bg-white/10'
          }`}
          aria-label="Toggle unstructured view"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          U
        </motion.button>

        {/* S - Syllable Count Toggle */}
        <motion.button
          onClick={onToggleSyllableCount}
          className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-base transition-all ${
            showSyllableCount
              ? 'text-white bg-[#3a3a3c]'
              : 'text-gray-500 hover:text-white hover:bg-white/10'
          }`}
          aria-label="Toggle syllable count"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          S
        </motion.button>

        {/* + - Add Section */}
        <motion.button
          onClick={onAddSection}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all text-gray-500 hover:text-white hover:bg-white/10"
          aria-label="Add section"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-xl leading-none">+</span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default EditorControlPill;
