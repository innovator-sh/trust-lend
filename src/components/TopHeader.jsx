import { useState, useRef, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useTrustToken } from '../hooks/useTrustToken';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

export default function TopHeader({ pageTitle, pageSubtitle, toggleMobile }) {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { walletAddress, isConnected, chainId, isSupported, disconnectWallet, connectWallet, switchNetwork } = useWallet();
  const { trustBalance, maticBalance, claimTestTokens, canClaim, isLoading } = useTrustToken();

  const title = pageTitle || t('common.dashboard');
  const subtitle = pageSubtitle || t('dashboard.overview');

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : '';
  const showClaimBtn = isConnected && parseFloat(trustBalance) < 100;

  return (
    <header className={`sticky top-0 z-30 transition-all duration-500 h-24 md:h-28 flex items-center justify-between px-8 md:px-16 border-b 
      ${isDarkMode ? 'bg-[#1A1A1A]/60 backdrop-blur-xl border-[#333]' : 'bg-white/60 backdrop-blur-xl border-[#F5F3F0]'}`}>
      
      <div className="flex items-center gap-6">
        <button onClick={toggleMobile} className="lg:hidden w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-[#E8E8E8] text-[#1A1A1A] shadow-lg active:scale-90 transition-transform dark:bg-[#D4AF37] dark:text-black">
          <iconify-icon icon="lucide:menu" className="text-xl"></iconify-icon>
        </button>
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          <h1 className={`text-xl md:text-3xl font-black font-cabinet tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-[#1A1A1A]'}`}>
            {title}
          </h1>
          <div className="hidden md:flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse"></span>
            <span className="text-[10px] md:text-xs text-[#8C8C8C] font-black uppercase tracking-[0.3em] leading-none whitespace-nowrap">
              {subtitle}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3 md:gap-5">
        <LanguageSwitcher />
        <ThemeToggle />

        {showClaimBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            onClick={claimTestTokens} disabled={isLoading || !canClaim}
            className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${canClaim && !isLoading ? 'border-[#F5A623]/40 text-[#F5A623] hover:bg-[#F5A623]/10 active:scale-95' : 'border-[#1E2A3A] text-[#8C8C8C] cursor-not-allowed opacity-50'}`}
          >
            {isLoading ? <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="45 20" strokeLinecap="round" /></svg> : <span>🪙</span>}
            <span className="hidden lg:inline">Claim TRUST</span>
          </motion.button>
        )}

        {isConnected ? (
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(v => !v)} className={`flex items-center gap-2.5 px-3 py-2 md:px-4 md:py-2.5 rounded-2xl border transition-all duration-300 ${isDarkMode ? 'bg-[#111827] border-[#1E2A3A] hover:border-[#F5A623]/40' : 'bg-white border-[#E8E8E8] hover:border-[#D4AF37]/60'} active:scale-95`}>
              
              {/* Network Badge */}
              {chainId === 31337 && (
                <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#F5A623]/15 border border-[#F5A623]/30 text-[#F5A623] text-[8px] font-black uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-pulse inline-block" /> Local Dev
                </span>
              )}
              {chainId === 80002 && (
                <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2DD4BF]/15 border border-[#2DD4BF]/30 text-[#2DD4BF] text-[8px] font-black uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] animate-pulse inline-block" /> Amoy Testnet
                </span>
              )}
              {!isSupported && (
                <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[8px] font-black uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse inline-block" /> Wrong Network
                </span>
              )}

              <div className="hidden md:flex items-center gap-3 text-[10px] font-black">
                <span className="text-[#8C8C8C]">{trustBalance} <span className="text-[#F5A623]">TRUST</span></span>
                <span className="w-px h-3 bg-[#1E2A3A]" />
                <span className="text-[#8C8C8C]">{maticBalance} <span className="text-[#1D9E75]">MATIC</span></span>
              </div>
              <span className="font-mono text-[11px] font-bold text-[#FAFAF8]">{shortAddr}</span>
              <iconify-icon icon="lucide:chevron-down" className={`text-xs text-[#8C8C8C] transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}></iconify-icon>
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute right-0 top-[calc(100%+8px)] w-72 bg-[#111827] border border-[#1E2A3A] rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="p-4 border-b border-[#1E2A3A]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#8C8C8C] mb-1">Connected Wallet</p>
                    <p className="font-mono text-[11px] text-[#FAFAF8] font-bold break-all">{walletAddress}</p>
                  </div>
                  <div className="p-4 border-b border-[#1E2A3A] space-y-2 text-[11px]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#8C8C8C]">Network</p>
                    {isSupported ? (
                        <div className="flex items-center gap-2 text-[#FAFAF8] font-bold">
                            <span className={`w-2 h-2 rounded-full ${chainId === 31337 ? 'bg-[#F5A623]' : 'bg-[#2DD4BF]'}`} />
                            {chainId === 31337 ? 'TrustLend Local' : 'Polygon Amoy'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                           <button onClick={() => switchNetwork(31337)} className="w-full text-left p-2 rounded-lg bg-[#F5A623]/10 text-[#F5A623] hover:bg-[#F5A623]/20 transition-all font-bold">Switch to Local</button>
                           <button onClick={() => switchNetwork(80002)} className="w-full text-left p-2 rounded-lg bg-[#2DD4BF]/10 text-[#2DD4BF] hover:bg-[#2DD4BF]/20 transition-all font-bold">Switch to Amoy</button>
                        </div>
                    )}
                  </div>
                  <div className="p-3">
                    <button onClick={() => { disconnectWallet(); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#EF4444] text-[11px] font-black uppercase tracking-widest hover:bg-[#EF4444]/10 transition-all text-left">
                      <iconify-icon icon="lucide:log-out" className="text-base"></iconify-icon>
                      Disconnect
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <button onClick={connectWallet} className="flex items-center gap-3 px-5 py-2.5 md:px-8 md:py-3 rounded-full border-2 border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all duration-300 font-black text-[10px] md:text-sm tracking-wide uppercase active:scale-95 group">
            <iconify-icon icon="lucide:wallet" className="text-xl group-hover:scale-110 transition-transform"></iconify-icon>
            <span className="hidden sm:inline group-hover:translate-x-1 transition-transform">Connect Wallet</span>
          </button>
        )}
      </div>
    </header>
  );
}
