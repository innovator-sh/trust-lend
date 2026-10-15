import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useDemo } from '../context/DemoContext';
import { useWallet } from '../context/WalletContext';

export default function DemoMode() {
  const { isDemoMode, setIsDemoMode, initializeDemoWallets } = useDemo();
  const { chainId, isSupported } = useWallet();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsDemoMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      toast("Demo Mode Active", { icon: "🎥", style: { background: '#F5A623', color: '#000' } });
    }
  }, [isDemoMode]);

  if (!isDemoMode) return null;

  return (
    <>
      {/* Top-right floating DEMO badge */}
      <div className="fixed top-4 right-4 z-[9999] bg-[#F5A623] text-black text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-[0_0_20px_rgba(245,166,35,0.4)] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
          Live Demo
      </div>

      {/* Floating control to reset state */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-3">
          <button 
            onClick={initializeDemoWallets}
            className="px-5 py-2.5 bg-[#111827] border border-[#F5A623]/30 text-[#F5A623] text-[10px] font-black uppercase tracking-widest rounded-lg shadow-xl hover:bg-[#F5A623]/10 transition-all"
          >
            Reset Demo State (68 Score, 8k Liquidity)
          </button>
      </div>
    </>
  );
}
