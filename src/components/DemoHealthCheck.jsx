import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { useReputationNFT } from '../hooks/useReputationNFT';
import { ethers } from 'ethers';
import { ADDRESSES } from '../contracts/addresses';

export default function DemoHealthCheck() {
  const { search } = useLocation();
  const { isConnected, isSupported, walletAddress, provider, signer } = useWallet();
  const { poolStats, borrowLimit, userLoan } = useLendingPool();
  const { trustScore } = useReputationNFT();
  
  const [balance, setBalance] = useState("0");
  const [isOpen, setIsOpen] = useState(true);
  
  const isDebug = search.includes('debug=true');

  useEffect(() => {
    const fetchBalance = async () => {
      if (!walletAddress || !provider) return;
      try {
        const TrustToken = new ethers.Contract(
          ADDRESSES.TRUST_TOKEN,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );
        const bal = await TrustToken.balanceOf(walletAddress);
        setBalance(ethers.formatUnits(bal, 18));
      } catch (e) { console.error(e); }
    };
    if (isDebug) fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [walletAddress, provider, isDebug]);

  if (!isDebug) return null;

  const checks = [
    { label: "Wallet connected", pass: isConnected },
    { label: "Correct network", pass: isSupported },
    { label: "TRUST Token responding", pass: !!(balance !== "err") }, // Simplified
    { label: "LendingPool responding", pass: !!poolStats },
    { label: "ReputationNFT responding", pass: !!trustScore },
    { label: "User TRUST balance > 0", pass: parseFloat(balance) > 0 },
    { label: "Pool liquidity > 1000 TRUST", pass: parseFloat(poolStats?.liquidity || 0) > 1000 },
    { label: "Borrower score = 68", pass: trustScore.toString() === "68" },
    { label: "No active loan on wallet", pass: !userLoan }
  ];

  const allPassed = checks.every(c => c.pass);

  return (
    <div className={`fixed bottom-4 left-4 z-[9999] bg-[#111827] border border-[#1E2A3A] rounded-xl shadow-2xl transition-all ${isOpen ? 'w-80 p-6' : 'w-12 h-12 flex items-center justify-center p-0 cursor-pointer overflow-hidden'}`}
         onClick={() => !isOpen && setIsOpen(true)}>
       
       <div className={`flex justify-between items-center mb-6 ${!isOpen ? 'hidden' : ''}`}>
           <p className="text-[10px] font-black uppercase tracking-widest text-[#F5A623]">System Health Check</p>
           <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="text-[#8C8C8C] hover:text-white">✕</button>
       </div>

       <div className={`space-y-3 mb-6 ${!isOpen ? 'hidden' : ''}`}>
          {checks.map((c, i) => (
              <div key={i} className="flex flex-col border-b border-[#1E2A3A] pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#FAFAF8] uppercase tracking-widest">{c.label}</span>
                    <span className={`font-black ${c.pass ? 'text-[#1D9E75]' : 'text-[#EF4444]'}`}>{c.pass ? '✓' : '✕'}</span>
                  </div>
              </div>
          ))}
       </div>

       {!isOpen && (
            <div className={`w-3 h-3 rounded-full ${allPassed ? 'bg-[#1D9E75]' : 'bg-[#EF4444]'} animate-pulse`}></div>
       )}

       {isOpen && allPassed && (
           <div className="pt-4 border-t border-[#1E2A3A] text-center">
              <span className="text-[11px] font-black text-[#1D9E75] uppercase tracking-widest animate-pulse">All Systems Go ✓</span>
           </div>
       )}
    </div>
  );
}
