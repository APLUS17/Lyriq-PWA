import React, { useState } from 'react';
import { Home, PlusCircle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchScreen from './SearchScreen';

interface Project {
  id: number;
  title: string;
  time: string;
  gradient: string;
}

interface HomeScreenProps {
  onNavigate: (screen: string, title: string) => void;
  projects: Project[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

const GlassBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-black">
    {/* Clean black background */}
  </div>
);

const HomeScreen = React.forwardRef<HTMLDivElement, HomeScreenProps>(({ onNavigate, projects }, ref) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Dummy Data if none provided
  const currentProjects = projects;
  const isEmpty = currentProjects.length === 0;

  // Pull to search logic
  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.y > 100) {
      setIsSearchOpen(true);
    }
  };

  return (
    <motion.div
      ref={ref}
      key="home"
      custom={0}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-[100dvh] bg-black text-white font-sans flex flex-col items-center relative overflow-hidden w-full"
    >
      <GlassBackground />

      {/* Pull Down Handler */}
      <motion.div
        className="w-full flex-grow flex flex-col h-full"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
      >
        <div className="w-full flex flex-col h-screen z-10">
          {/* Header */}
          <div className="px-6 pt-12 pb-6 flex justify-between items-center w-full mx-auto">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black uppercase tracking-tighter">SONGS</h1>
            </div>
            <div className="h-9 w-9 rounded-full bg-pink-400 flex items-center justify-center text-xs font-bold text-white border-2 border-black">
              M
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-grow flex flex-col items-center justify-start pb-32 overflow-y-auto w-full mx-auto px-6">
            {isEmpty ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.4, scale: 1 }}
                className="flex flex-col items-center gap-6 mt-16"
              >
                {/* Empty State */}
                <div className="text-center max-w-[300px]">
                  <h3 className="text-3xl font-black uppercase text-zinc-800 leading-tight tracking-tighter">
                    READY TO WRITE YOUR FIRST SONG?
                  </h3>
                </div>
              </motion.div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="w-full space-y-4 self-start"
              >
                {currentProjects.map((project) => (
                  <motion.div
                    key={project.id}
                    variants={itemVariants}
                    onClick={() => onNavigate('editor', project.title)}
                    className="flex items-center gap-4 group cursor-pointer active:scale-[0.98] transition-all p-3 -mx-3 rounded-3xl hover:bg-white/5"
                  >
                    <div className={`h-20 w-20 rounded-2xl ${project.gradient} shadow-lg shrink-0`}></div>
                    <div className="flex flex-col">
                      <h3 className="text-base font-semibold text-gray-100">{project.title}</h3>
                      <span className="text-gray-500 text-xs font-medium">{project.time}</span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Footer Pill */}
          <div className="w-full absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex justify-center pointer-events-none">
            <motion.div className="bg-[#1c1c1e]/80 p-1.5 rounded-full flex items-center gap-1 shadow-2xl border border-white/10 pointer-events-auto backdrop-blur-sm">
              <button className="bg-[#3a3a3c]/90 px-6 py-2.5 rounded-full flex items-center gap-2 transition-all">
                <Home size={18} className="text-white" />
                <span className="text-xs font-semibold text-white">Home</span>
              </button>
              <button
                onClick={() => onNavigate('editor', 'Untitled Song')}
                className="px-6 py-2.5 rounded-full flex items-center gap-2 hover:bg-white/10 transition-all text-gray-400"
              >
                <PlusCircle size={18} />
                <span className="text-xs font-semibold">New</span>
              </button>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Search Modal */}
      <AnimatePresence>
        {isSearchOpen && <SearchScreen onClose={() => setIsSearchOpen(false)} projects={currentProjects} />}
      </AnimatePresence>
    </motion.div>
  );
});

HomeScreen.displayName = 'HomeScreen';

export default HomeScreen;
