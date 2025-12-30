import React, { useState } from 'react';
import { Home, PlusCircle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchScreen from './SearchScreen';

interface Project {
  id: string;
  title: string;
  time: string;
  gradient: string;
}

interface HomeScreenProps {
  onNavigate: (screen: string, data?: { id?: string; title?: string }) => void;
  projects: Project[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

const HomeScreen = React.forwardRef<HTMLDivElement, HomeScreenProps>(({ onNavigate, projects }, ref) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const currentProjects = projects;
  const isEmpty = currentProjects.length === 0;

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
      className="min-h-[100dvh] bg-[var(--pulp-base)] text-[var(--pulp-ink)] font-sans flex flex-col items-center relative overflow-hidden w-full"
    >
      {/* Pulp Grain Overlay */}
      <svg className="pulp-grain" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <filter id="homeNoiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#homeNoiseFilter)" />
      </svg>

      {/* Pull Down Handler */}
      <motion.div
        className="w-full flex-grow flex flex-col h-full"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
      >
        <div className="w-full flex flex-col h-screen z-10">
          {/* Pulp Header */}
          <header className="pulp-header px-8 pt-12 pb-6 flex justify-between items-end border-b-2 border-[var(--pulp-ink)]/10">
            <div>
              <h1 className="pulp-title text-4xl">SONGS</h1>
              <p className="font-mono text-xs opacity-50 mt-1">{currentProjects.length} projects</p>
            </div>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="pulp-btn !w-10 !h-10"
            >
              <Search size={16} />
            </button>
          </header>

          {/* Main Content */}
          <div className="flex-grow flex flex-col items-center justify-start pb-32 overflow-y-auto w-full px-8 pt-6">
            {isEmpty ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6 mt-16 text-center"
              >
                <div className="text-center max-w-[280px]">
                  <h3 className="pulp-title text-2xl leading-tight opacity-30">
                    READY TO WRITE YOUR FIRST SONG?
                  </h3>
                  <p className="font-mono text-sm mt-4 opacity-40">
                    Tap "New" below to begin
                  </p>
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
                    onClick={() => onNavigate('editor', { id: project.id })}
                    className="bg-[var(--pulp-base)] rounded-xl p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all shadow-[4px_4px_8px_var(--pulp-shadow),-4px_-4px_8px_var(--pulp-highlight)] hover:shadow-[2px_2px_4px_var(--pulp-shadow),-2px_-2px_4px_var(--pulp-highlight)]"
                  >
                    <div className={`h-14 w-14 rounded-lg ${project.gradient} shadow-md shrink-0`}></div>
                    <div className="flex flex-col flex-grow min-w-0">
                      <h3 className="text-sm font-semibold truncate" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        {project.title}
                      </h3>
                      <span className="font-mono text-xs opacity-50">{project.time}</span>
                    </div>
                    <div className="text-[var(--pulp-ink)] opacity-30">
                      →
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Footer Pill - Pulp Style */}
          <div className="w-full absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex justify-center pointer-events-none">
            <motion.div className="bg-[var(--pulp-base)] p-1.5 rounded-full flex items-center gap-1 shadow-[6px_6px_12px_var(--pulp-shadow),-6px_-6px_12px_var(--pulp-highlight)] pointer-events-auto">
              <button className="bg-[var(--pulp-shadow)]/30 px-6 py-2.5 rounded-full flex items-center gap-2 transition-all">
                <Home size={16} className="text-[var(--pulp-ink)]" />
                <span className="text-xs font-semibold font-mono text-[var(--pulp-ink)]">Home</span>
              </button>
              <button
                onClick={() => {
                  console.log("New Song button clicked");
                  onNavigate('editor', { title: 'Untitled Song' });
                }}
                className="px-6 py-2.5 rounded-full flex items-center gap-2 hover:bg-[var(--pulp-shadow)]/20 transition-all text-[var(--pulp-ink)] opacity-60 hover:opacity-100"
              >
                <PlusCircle size={16} />
                <span className="text-xs font-semibold font-mono">New</span>
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
