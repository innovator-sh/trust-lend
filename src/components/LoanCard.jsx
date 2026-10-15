import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function LoanCard({ 
  amount = "$5,000", 
  label = "Micro-Credit Facility", 
  status = "Active", 
  reputationGain = "+12 QP", 
  dueDate = "Nov 24, 2026",
  type = "primary" // 'primary' (active) or 'ghost' (available)
}) {
  const { isDarkMode } = useTheme();

  return (
    <motion.div 
      whileHover={{ y: -5, shadow: "0 20px 40px rgba(0,0,0,0.1)" }}
      className={`
        p-8 rounded-[2.5rem] border transition-all duration-300 relative overflow-hidden group
        ${isDarkMode 
          ? 'bg-[#1A1A1A] border-[#333] hover:border-[#D4AF37]/40' 
          : 'bg-white border-[#E8E8E8] hover:border-[#D4AF37]/40 luxury-shadow'}
      `}
    >
      <div className="flex justify-between items-start mb-8">
        <div>
          <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.4em] mb-2 font-cabinet">
            {label}
          </p>
          <h3 className={`text-3xl font-black font-cabinet tracking-tighter ${isDarkMode ? 'text-white' : 'text-[#1A1A1A]'}`}>
            {amount}
          </h3>
        </div>
        <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border 
          ${status === 'Active' 
            ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20' 
            : 'bg-[#E8E8E8] text-[#8C8C8C] border-[#E8E8E8]'}`}>
          {status}
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#FAFAF8] dark:bg-[#333] flex items-center justify-center text-[#D4AF37]">
            <iconify-icon icon="lucide:star" className="text-sm"></iconify-icon>
          </div>
          <span className="text-[11px] font-black text-[#D4AF37] tracking-wider uppercase">{reputationGain} Potential Gain</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.2em] mb-1">Settlement Due</p>
          <p className={`text-sm font-black ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#1A1A1A]'}`}>{dueDate}</p>
        </div>
      </div>

      {/* Decorative gradient for the background */}
      <div className={`absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-[60px] opacity-[0.03] transition-all group-hover:opacity-[0.08] ${isDarkMode ? 'bg-[#D4AF37]' : 'bg-[#D4AF37]'}`}></div>
    </motion.div>
  );
}
