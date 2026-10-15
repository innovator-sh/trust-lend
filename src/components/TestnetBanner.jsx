import React from 'react';
import { Link } from 'react-router-dom';

/**
 * A small fixed notice on every page. TrustLend is a prototype on a test network.
 */
export default function TestnetBanner() {
  return (
    <div
      role="note"
      className="fixed bottom-3 left-3 z-[60] max-w-[280px] rounded-xl border border-[#F5A623]/30
                 bg-[#0A0F1E]/95 px-3 py-2 text-[10px] font-bold leading-snug text-[#FAFAF8]
                 shadow-lg backdrop-blur"
    >
      <span className="text-[#F5A623] font-black uppercase tracking-widest">Testnet prototype</span>
      <span className="text-[#8C8C8C]"> · Test tokens only. No real money. Not a licensed lender. </span>
      <Link to="/terms" className="underline text-[#F5A623] hover:text-white">Terms &amp; privacy</Link>
    </div>
  );
}
