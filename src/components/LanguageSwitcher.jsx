import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const languages = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="relative z-[100]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#F5A623]/20 bg-[#111827]/40 text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] hover:border-[#F5A623]/50 hover:text-[#FAFAF8] transition-all duration-300"
      >
        <iconify-icon icon="lucide:languages" className="text-sm text-[#F5A623]"></iconify-icon>
        <span className="hidden md:inline">{currentLanguage.native}</span>
        <iconify-icon icon="lucide:chevron-down" className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></iconify-icon>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[-1]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2 w-40 rounded-xl bg-[#111827] border border-[#1E2A3A] shadow-2xl p-1 overflow-hidden"
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full flex flex-col items-start px-4 py-2.5 rounded-lg transition-all duration-200 group
                    ${i18n.language === lang.code 
                      ? 'bg-[#F5A623]/10 text-[#F5A623]' 
                      : 'text-[#8C8C8C] hover:bg-white/5 hover:text-[#FAFAF8]'}`}
                >
                  <span className="text-[11px] font-black uppercase tracking-widest">{lang.native}</span>
                  <span className="text-[8px] opacity-50 font-medium">{lang.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
