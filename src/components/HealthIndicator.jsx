import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function HealthIndicator({ healthValue = 85, label = "Facility Health" }) {
  const { isDarkMode } = useTheme();

  // Determine health color
  const getHealthColor = (v) => {
    if (v > 75) return '#10B981'; // Green
    if (v > 40) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  };

  const healthColor = getHealthColor(healthValue);

  return (
    <div className={`p-8 rounded-[2.5rem] border transition-all duration-300 relative overflow-hidden group
      ${isDarkMode ? 'bg-[#1A1A1A] border-[#333]' : 'bg-white border-[#E8E8E8] luxury-shadow'}`}>
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.4em] mb-1 font-cabinet">
            {label}
          </p>
          <div className="flex items-center gap-3">
            <h3 className={`text-3xl font-black font-cabinet tracking-tighter ${isDarkMode ? 'text-white' : 'text-[#1A1A1A]'}`}>
              {healthValue}%
            </h3>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded bg-[#D4AF37]/5 text-[#D4AF37] border border-[#D4AF37]/10`}>
              Optimal
            </span>
          </div>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-[#FAFAF8] dark:bg-[#333] flex items-center justify-center text-[#10B981] shadow-inner">
          <iconify-icon icon="lucide:heart-pulse" className="text-2xl animate-pulse"></iconify-icon>
        </div>
      </div>

      <div className="space-y-4">
        <div className="h-2 w-full bg-[#E8E8E8] dark:bg-[#333] rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${healthValue}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ backgroundColor: healthColor }}
            className="h-full rounded-full"
          />
        </div>
        <div className="flex justify-between text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.2em]">
          <span>Critical Alert</span>
          <span>Solvent Zone</span>
        </div>
      </div>
      
      {/* Decorative gradient for the background */}
      <div className={`absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-[60px] opacity-[0.03] transition-all group-hover:opacity-[0.08] ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-[#10B981]'}`}></div>
    </div>
  );
}
