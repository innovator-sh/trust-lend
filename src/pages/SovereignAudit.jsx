import React from 'react';
import AppShell from '../components/AppShell';
import { useWallet } from '../context/WalletContext';
import { useReputationNFT } from '../hooks/useReputationNFT';
import { useLendingPool } from '../hooks/useLendingPool';
import Skeleton, { SkeletonRow } from '../components/Skeleton';
import { ADDRESSES } from '../contracts/addresses';

export default function SovereignAudit() {
  const { address } = useWallet();
  const { reputationData, trustScore, hasNFT, isLoading: isNFTLoading, mintNFT } = useReputationNFT();
  const { borrowLimit, isLoading: isPoolLoading } = useLendingPool();

  const isLoading = isNFTLoading || isPoolLoading;

  if (isLoading) {
    return (
        <AppShell pageTitle="Sovereign Audit" pageSubtitle="Loading Credit Identity...">
            <div className="max-w-7xl mx-auto space-y-12 pb-24">
                <Skeleton h="150px" />
                <Skeleton h="300px" />
            </div>
        </AppShell>
    );
  }

  if (!hasNFT) {
     return (
        <AppShell pageTitle="Sovereign Audit" pageSubtitle="Credit Identity Verification">
            <div className="max-w-7xl mx-auto py-24 text-center">
                <p className="text-4xl mb-4">🛡️</p>
                <p className="font-cabinet text-2xl font-black text-[#FAFAF8]">Identity Missing</p>
                <p className="text-[#8C8C8C] mt-2 mb-8 text-sm">You need a TrustLend Soulbound NFT to participate in the borrowing mechanics.</p>
                <button onClick={mintNFT} className="px-8 py-4 bg-[#F5A623] text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:scale-105 transition-transform">
                    Mint Reputation Identity
                </button>
            </div>
        </AppShell>
     );
  }

  return (
    <AppShell pageTitle="Sovereign Audit" pageSubtitle="Credit Identity Verification">
      <div className="max-w-7xl mx-auto space-y-12 pb-24">
        
        {/* Profile Identity Header */}
        <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] flex flex-col md:flex-row justify-between items-center gap-8">
           <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-[#FAFAF8] dark:bg-[#0A0F1E] border-2 border-[#F5A623] flex items-center justify-center font-black text-2xl text-[#1A1A1A] dark:text-[#FAFAF8]">
                  {address ? address.slice(2, 3).toUpperCase() : "T"}
              </div>
              <div>
                 <h2 className="text-2xl font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8]">TL-Entity-{address?.slice(-4).toUpperCase()}</h2>
                 <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mt-1 font-mono">ID: {address}</p>
                 <p className="text-[10px] font-black text-[#1D9E75] uppercase tracking-widest mt-1">Tier: {reputationData?.tier}</p>
                 <a 
                    href={`https://amoy.polygonscan.com/token/${ADDRESSES.REPUTATION_NFT}?a=${tokenId}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] font-black text-[#F5A623] uppercase tracking-widest mt-2 block hover:underline"
                 >
                     View NFT on Polygonscan ↗
                 </a>
              </div>
           </div>
           <div className="flex gap-12">
              <div className="text-center">
                 <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">Current Limit</p>
                 <p className="text-2xl font-black text-[#1A1A1A] dark:text-[#FAFAF8]">${Number(borrowLimit).toLocaleString()}</p>
              </div>
              <div className="text-center">
                 <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">Global Percentile</p>
                 <p className="text-2xl font-black text-[#F5A623]">Top {100 - Number(trustScore)}%</p>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Trust Score DNA (Radar Concept) */}
          <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] flex flex-col items-center">
             <h4 className="text-[10px] font-black text-[#F5A623] uppercase tracking-[0.3em] mb-12 self-start">Reputation Matrix Synthesis</h4>
             
             <div className="relative w-64 h-64 border border-[#E8E8E8] dark:border-[#1E2A3A] rounded-full flex items-center justify-center">
                <div className="absolute inset-0 border border-[#E8E8E8] dark:border-[#1E2A3A] rounded-full scale-75 opacity-50"></div>
                <div className="absolute inset-0 border border-[#E8E8E8] dark:border-[#1E2A3A] rounded-full scale-50 opacity-20"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 text-[8px] font-black text-[#8C8C8C] uppercase">Identity</div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-6 text-[8px] font-black text-[#8C8C8C] uppercase">Capital</div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-10 text-[8px] font-black text-[#8C8C8C] uppercase">Social</div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-10 text-[8px] font-black text-[#8C8C8C] uppercase">History</div>
                
                <div className="w-32 h-32 bg-[#F5A623]/20 border border-[#F5A623] clip-path-polygon absolute rotate-45 transform" style={{scale: `${Number(trustScore)/100}`}}></div>
                <p className="text-5xl font-black text-[#1A1A1A] dark:text-[#FAFAF8] font-cabinet z-10">{Number(trustScore)}</p>
             </div>
             
             <div className="mt-12 grid grid-cols-2 gap-6 w-full">
                {[
                  { label: 'Blockchain ID Proof', val: 'Verified' },
                  { label: 'Social Vouching', val: `${trustScore > 40 ? 'Synced' : 'Pending'}` },
                  { label: 'Repayment Volume', val: `$${reputationData?.totalRepaid || 0}` },
                  { label: 'Settlement Streak', val: `${reputationData?.repaymentStreak || 0} Tx Limit` }
                ].map((s, i) => (
                  <div key={i} className="flex justify-between items-center p-4 rounded bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                     <span className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest">{s.label}</span>
                     <span className={`text-xs font-black ${s.val === 'Pending' ? 'text-[#F5A623]' : 'text-[#1A1A1A] dark:text-[#FAFAF8]'}`}>{s.val}</span>
                  </div>
                ))}
             </div>
          </div>

          {/* Verification Checklist */}
          <div className="space-y-8">
             <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                <h4 className="text-[10px] font-black text-[#F5A623] uppercase tracking-[0.3em] mb-8">Verification Matrix</h4>
                <div className="space-y-6">
                   {[
                     { label: 'Web3 Wallet Signature', status: 'Completed', icon: 'lucide:badge-check', active: true },
                     { label: 'Soulbound NFT Mint', status: hasNFT ? 'Completed' : 'Missing', icon: 'lucide:fingerprint', active: hasNFT },
                     { label: 'Decentralized Social Nodes', status: '80% Synced', icon: 'lucide:link', active: true },
                     { label: 'On-chain Governance History', status: 'Insufficient', icon: 'lucide:clock', active: false }
                   ].map((v, i) => (
                     <div key={i} className={`flex items-center justify-between p-6 rounded-xl border transition-all ${v.active ? 'bg-[#1D9E75]/5 border-[#1D9E75]/20' : 'bg-[#FAFAF8] dark:bg-[#0A0F1E] border-[#E8E8E8] dark:border-[#1E2A3A]'}`}>
                        <div className="flex items-center gap-4">
                           <iconify-icon icon={v.icon} className={`text-xl ${v.active ? 'text-[#1D9E75]' : 'text-[#8C8C8C]'}`}></iconify-icon>
                           <p className="text-[10px] font-black text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest">{v.label}</p>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${v.active ? 'text-[#1D9E75]' : 'text-[#8C8C8C]'}`}>{v.status}</span>
                     </div>
                   ))}
                </div>
             </div>

             <div className="p-8 rounded-[12px] bg-[#F59E0B]/5 border border-[#F59E0B]/10">
                <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest mb-2">Insight</p>
                <p className="text-[10px] text-[#1A1A1A] dark:text-[#FAFAF8] leading-relaxed">Completing the **"On-chain Governance"** module will likely augment your on-chain credibility by **+12 pts** and unlock up to a **$1,000.00** limit.</p>
             </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
