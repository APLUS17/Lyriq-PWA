import React, { useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface Project {
  id: number;
  title: string;
  time: string;
  gradient: string;
}

interface SearchScreenProps {
  onClose: () => void;
  projects: Project[];
}

const SearchScreen: React.FC<SearchScreenProps> = ({ onClose, projects }) => {
  const categories = ['Songs', 'Verses', 'Takes'];
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-3 pt-12">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10"
        >
          <ChevronLeft size={24} className="text-white" />
        </button>
        <div className="flex-grow relative">
          <input
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search your library"
            className="w-full bg-[#1c1c1e] text-white pl-4 pr-4 py-3 rounded-2xl outline-none placeholder-gray-500 text-base"
          />
        </div>
      </div>

      {/* Category Chips */}
      <div className="px-6 flex gap-2 mb-8 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            className="bg-[#1c1c1e] hover:bg-[#2c2c2e] px-5 py-2 rounded-full text-sm font-medium text-gray-300 transition-colors border border-white/5"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Empty State or Results */}
      <div className="flex-grow flex flex-col items-center justify-center text-gray-500 pb-32">
        <Search size={48} className="mb-4 opacity-50" />
        <h3 className="text-xl font-bold text-white mb-1">Search your library</h3>
        <p className="text-sm">Search anything in your library.</p>
      </div>
    </motion.div>
  );
};

export default SearchScreen;
