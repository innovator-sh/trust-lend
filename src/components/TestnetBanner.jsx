import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const KEY = 'tl_testnet_notice_closed';

const wasClosed = () => {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
};

/**
 * A small fixed notice. TrustLend is a prototype on a test network.
 * A user can close it for the rest of the browser session. The Terms page keeps the full text.
 */
export default function TestnetBanner() {
  const [closed, setClosed] = useState(wasClosed);
  if (closed) return null;

  const close = () => {
    try { sessionStorage.setItem(KEY, '1'); } catch { /* the notice just comes back on reload */ }
    setClosed(true);
  };

  return (
    <div
      role="note"
      className="fixed bottom-3 left-3 z-[60] max-w-[280px] rounded-xl border border-[#F5A623]/30
                 bg-[#0A0F1E]/95 py-2 pl-3 pr-7 text-[10px] font-bold leading-snug text-[#FAFAF8]
                 shadow-lg backdrop-blur"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close the testnet notice"
        className="absolute right-2 top-1.5 text-sm leading-none text-[#8C8C8C] hover:text-white"
      >
        ×
      </button>
      <span className="text-[#F5A623] font-black uppercase tracking-widest">Testnet prototype</span>
      <span className="text-[#8C8C8C]"> · Test tokens only. No real money. Not a licensed lender. </span>
      <Link to="/terms" className="underline text-[#F5A623] hover:text-white">Terms &amp; privacy</Link>
    </div>
  );
}
