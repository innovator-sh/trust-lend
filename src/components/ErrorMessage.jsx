/**
 * ErrorMessage.jsx
 * Inline error display with retry button. Coral red styling, Aether-consistent.
 */
import React from 'react';

export default function ErrorMessage({ message = 'Something went wrong', onRetry, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-4 p-4 rounded-xl
      bg-[#EF4444]/8 border border-[#EF4444]/20 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="text-[#EF4444] text-lg">⚠</span>
        <p className="text-[11px] font-black text-[#EF4444] uppercase tracking-widest">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex-shrink-0 px-4 py-2 rounded-lg border border-[#EF4444]/30
            text-[#EF4444] text-[9px] font-black uppercase tracking-widest
            hover:bg-[#EF4444] hover:text-white transition-all active:scale-[0.96]"
        >
          Retry
        </button>
      )}
    </div>
  );
}
