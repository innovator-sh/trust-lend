import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function TrustScoreMeter({ score = 750, maxScore = 1000 }) {
  const { isDarkMode } = useTheme();
  const percentage = (score / maxScore) * 100;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-64 h-64 mx-auto">
      {/* Background Track */}
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="128"
          cy="128"
          r={radius}
          stroke={isDarkMode ? "#333" : "#E8E8E8"}
          strokeWidth="12"
          fill="transparent"
          className="transition-colors duration-500"
        />
        {/* Progress Arc */}
        <motion.circle
          cx="128"
          cy="128"
          r={radius}
          stroke="#D4AF37"
          strokeWidth="12"
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>

      {/* Internal Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <motion.span 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className={`text-5xl font-black font-cabinet tracking-tighter ${isDarkMode ? 'text-white' : 'text-[#1A1A1A]'}`}
        >
          {score}
        </motion.span>
        <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.4em] mt-2">
          Trust Quotient
        </span>
      </div>

      {/* Glow Effect */}
      <div className="absolute inset-0 bg-[#D4AF37]/5 blur-[60px] rounded-full -z-10"></div>
    </div>
  );
}
