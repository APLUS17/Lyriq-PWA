import React, { useState, useRef } from 'react';
import { Home, PlusCircle, Search, Edit2, Trash2, Image } from 'lucide-react';
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

interface ContextMenuState {
  projectId: number;
  x: number;
  y: number;
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pullOffset, setPullOffset] = useState(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const songListRef = useRef<HTMLDivElement>(null);
  const isPullingRef = useRef(false);
  const startYRef = useRef(0);

  // Dummy Data if none provided
  const currentProjects = projects;
  const isEmpty = currentProjects.length === 0;

  // Pull to search logic - only triggered when pulling down from top of songs list
  const handleListTouchStart = (e: React.TouchEvent) => {
    if (songListRef.current && songListRef.current.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  };

  const handleListTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || !songListRef.current) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    // Only allow pull down when at the top of the list
    if (diff > 0 && songListRef.current.scrollTop === 0) {
      e.preventDefault(); // Prevent default scrolling behavior
      setPullOffset(Math.min(diff * 0.5, 100));
    } else if (diff < 0) {
      // User is trying to scroll up, cancel the pull gesture
      isPullingRef.current = false;
      setPullOffset(0);
    }
  };

  const handleListTouchEnd = () => {
    if (pullOffset > 60) {
      setIsSearchOpen(true);
    }
    setPullOffset(0);
    isPullingRef.current = false;
  };

  // Long press handlers for context menu
  const handleSongTouchStart = (e: React.TouchEvent, project: Project) => {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      setContextMenu({
        projectId: project.id,
        x: touch.clientX,
        y: touch.clientY
      });
    }, 500);
  };

  const handleSongTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleSongTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Context menu actions
  const handleRename = (projectId: number) => {
    console.log('Rename project:', projectId);
    // TODO: Implement rename functionality
    setContextMenu(null);
  };

  const handleDelete = (projectId: number) => {
    console.log('Delete project:', projectId);
    // TODO: Implement delete functionality
    setContextMenu(null);
  };

  const handleChangeCoverArt = (projectId: number) => {
    console.log('Change cover art:', projectId);
    // TODO: Implement cover art change
    setContextMenu(null);
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
      className="fixed inset-0 bg-black text-white font-sans overflow-hidden w-full"
      onClick={() => setContextMenu(null)}
    >
      <GlassBackground />

      {/* Header - Fixed at top */}
      <div
        className="fixed top-0 left-0 right-0 px-6 pt-12 pb-6 flex justify-between items-center z-10 bg-black"
        style={{ transform: `translateY(${pullOffset}px)`, transition: pullOffset === 0 ? 'transform 0.3s ease-out' : 'none' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black uppercase tracking-tighter">SONGS</h1>
        </div>
        <div className="h-9 w-9 rounded-full bg-pink-400 flex items-center justify-center text-xs font-bold text-white border-2 border-black">
          M
        </div>
      </div>

      {/* Main Content - Scrollable with top/bottom padding for header/footer */}
      <div
        ref={songListRef}
        className="absolute inset-0 overflow-y-auto pt-[120px] pb-32"
        onTouchStart={handleListTouchStart}
        onTouchMove={handleListTouchMove}
        onTouchEnd={handleListTouchEnd}
      >
        <div className="px-6">
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
              className="w-full space-y-4"
            >
                {currentProjects.map((project) => (
                  <motion.div
                    key={project.id}
                    variants={itemVariants}
                    onClick={(e) => {
                      if (!contextMenu) {
                        onNavigate('editor', project.title);
                      }
                    }}
                    onTouchStart={(e) => handleSongTouchStart(e, project)}
                    onTouchEnd={handleSongTouchEnd}
                    onTouchMove={handleSongTouchMove}
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
      </div>

      {/* Footer Pill - Fixed at bottom */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex justify-center pointer-events-none">
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

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="fixed bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
            style={{
              left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`,
              top: `${Math.min(contextMenu.y, window.innerHeight - 200)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col py-2 min-w-[180px]">
              <button
                onClick={() => handleRename(contextMenu.projectId)}
                className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors text-left"
              >
                <Edit2 size={18} className="text-blue-400" />
                <span className="text-sm font-medium">Rename</span>
              </button>
              <button
                onClick={() => handleChangeCoverArt(contextMenu.projectId)}
                className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors text-left"
              >
                <Image size={18} className="text-purple-400" />
                <span className="text-sm font-medium">Cover Art</span>
              </button>
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={() => handleDelete(contextMenu.projectId)}
                className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 transition-colors text-left"
              >
                <Trash2 size={18} />
                <span className="text-sm font-medium">Delete</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {isSearchOpen && <SearchScreen onClose={() => setIsSearchOpen(false)} projects={currentProjects} />}
      </AnimatePresence>
    </motion.div>
  );
});

HomeScreen.displayName = 'HomeScreen';

export default HomeScreen;
