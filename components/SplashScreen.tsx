import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
    onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onComplete, 500); // Wait for fade out animation
        }, 2000);

        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div
            className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090b] transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            <div className="flex flex-col items-center animate-pulse-slow relative">
                {/* Logo Icon */}
                <div className="w-24 h-24 bg-gradient-to-br from-zinc-800 to-black rounded-3xl shadow-2xl flex items-center justify-center mb-8 border border-white/10 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
                    <svg className="w-12 h-12 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                </div>
            </div>

            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-200 to-gray-500 tracking-tight mb-2">
                Lyriq
            </h1>
            <p className="text-gray-500 text-sm tracking-widest uppercase font-medium">
                Professional Lyric Studio
            </p>
        </div>
    );
};

export default SplashScreen;
