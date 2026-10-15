import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import NetworkGuard from './NetworkGuard';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function AppShell({ children, pageTitle = "Dashboard", pageSubtitle = "Overview" }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDarkMode } = useTheme();

  return (
    <div className={`flex min-h-screen font-satoshi overflow-hidden transition-colors duration-500
      ${isDarkMode ? 'bg-[#0A0A0A] text-white' : 'bg-[#F5F3F0] text-[#1A1A1A]'}`}>
      <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      
      <main className="flex-1 relative pb-20 max-w-full overflow-x-hidden flex flex-col h-screen">
        <TopHeader 
          pageTitle={pageTitle} 
          pageSubtitle={pageSubtitle} 
          toggleMobile={() => setMobileMenuOpen(true)} 
        />
        
        {/* NetworkGuard blocks pages when on wrong network */}
        <NetworkGuard>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 overflow-y-auto px-4 md:px-10 lg:px-16 py-8 md:py-12"
          >
            {children}
          </motion.div>
        </NetworkGuard>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
