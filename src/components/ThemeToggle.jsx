import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';

export default function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button 
      onClick={toggleTheme}
      className={`
        relative w-14 h-8 rounded-full p-1 transition-colors duration-500
        ${isDarkMode ? 'bg-[#D4AF37]' : 'bg-[#E8E8E8]'}
        border border-transparent hover:border-[#D4AF37]/50
      `}
    >
      <motion.div 
        animate={{ x: isDarkMode ? 24 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden"
      >
        <iconify-icon 
          icon={isDarkMode ? "lucide:moon" : "lucide:sun"} 
          className={`text-sm ${isDarkMode ? 'text-[#D4AF37]' : 'text-orange-400'}`}
        ></iconify-icon>
      </motion.div>
    </button>
  );
}
