import React from 'react';
import { useParams, Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';

export default function LoanRequestDetail() {
  const { isDarkMode } = useTheme();
  const { id } = useParams();

  return (
    <AppShell pageTitle="Audit Terminal" pageSubtitle="Asset Underwriting System">
      <div className="max-w-7xl mx-auto space-y-12 pb-24">
        
        {/* REQUESTER IDENTITY BANNER */}
        <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#F5A623]"></div>
          <div className="flex items-center gap-6">
             <div className="w-20 h-20 rounded-2xl bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#F5A623]/20 flex items-center justify-center font-black text-3xl text-[#1A1A1A] dark:text-[#FAFAF8]">S</div>
             <div>
                <div className="flex items-center gap-3 mb-2">
                   <h2 className="text-3xl font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8]">Siddharth M.</h2>
                   <span className="px-3 py-1 rounded bg-[#F59E0B]/10 text-[#F59E0B] text-[8px] font-black uppercase tracking-widest border border-[#F59E0B]/20">Silver Tier</span>
                </div>
                <p className="text-xs text-[#8C8C8C] leading-relaxed max-w-md">Professional Node Operator seeking micro-capital for infrastructure maintenance. 100% repayment rate over 14 cycles.</p>
             </div>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">Requested Amount</p>
             <p className="text-4xl font-black text-[#1A1A1A] dark:text-[#FAFAF8] font-cabinet">$75.00</p>
             <p className="text-[10px] font-black text-[#1D9E75] uppercase tracking-widest mt-2">Target Yield: 4.2%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* SOCIAL VOUCH PROGRESS */}
          <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
             <h4 className="text-[10px] font-black text-[#F5A623] uppercase tracking-[0.3em] mb-10">Social Vouch Progress</h4>
             <div className="space-y-10">
                <div className="flex justify-between items-center px-4">
                  {[
                    { name: 'Arnab G.', status: 'Vouched', score: 84, color: 'bg-[#1D9E75]' },
                    { name: 'Pending', status: 'Waiting', score: 0, color: 'bg-[#1E2A3A]' },
                    { name: 'Pending', status: 'Waiting', score: 0, color: 'bg-[#1E2A3A]' }
                  ].map((v, i) => (
                    <div key={i} className="flex flex-col items-center gap-4">
                       <div className={`w-14 h-14 rounded-full ${v.color} border-4 border-[#111827] flex items-center justify-center text-[#1A1A1A] dark:text-[#FAFAF8] font-black shadow-lg`}>
                          {v.name[0]}
                       </div>
                       <div className="text-center">
                          <p className="text-[9px] font-black text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest">{v.name}</p>
                          <p className="text-[8px] font-bold text-[#8C8C8C] uppercase">{v.status}</p>
                       </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 rounded-xl bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A] text-center">
                   <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-[0.2em] mb-2">Vouch Confidence</p>
                   <p className="text-2xl font-black text-[#F59E0B] font-cabinet">33%</p>
                   <p className="text-[8px] font-bold text-[#8C8C8C] mt-2 uppercase">2 more vouches required to unlock capital</p>
                </div>
             </div>
          </div>

          {/* REPUTATION BREAKDOWN */}
          <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] lg:col-span-2">
             <h4 className="text-[10px] font-black text-[#F5A623] uppercase tracking-[0.3em] mb-10">Reputation Synthesis</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { label: 'Identity Proof', score: 92, desc: 'Verified KYC & Socials' },
                  { label: 'Asset Wealth', score: 45, desc: 'On-chain TVL balance' },
                  { label: 'Social Density', score: 68, desc: 'Network node centrality' }
                ].map((s, i) => (
                  <div key={i} className="p-6 rounded-xl bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                     <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mb-4">{s.label}</p>
                     <p className="text-3xl font-black text-[#1A1A1A] dark:text-[#FAFAF8] font-mono">{s.score}<span className="text-sm text-[#8C8C8C]">/100</span></p>
                     <p className="text-[8px] font-bold text-[#8C8C8C] mt-4 uppercase leading-relaxed">{s.desc}</p>
                  </div>
                ))}
             </div>
             
             {/* AI Underwriting Analysis */}
             <div className="mt-10 p-8 rounded-xl bg-[#1D9E75]/5 border border-[#1D9E75]/10">
                <div className="flex items-center gap-4 mb-4 text-[#1D9E75]">
                   <iconify-icon icon="lucide:sparkles" className="text-xl"></iconify-icon>
                   <h5 className="text-[10px] font-black uppercase tracking-[0.2em]">AI Underwriting Prediction</h5>
                </div>
                <p className="text-xs text-[#1A1A1A] dark:text-[#FAFAF8] leading-relaxed italic">"Probability of default is estimated at **0.8%**. Requester has displayed a linear liquidity flow pattern with seasonal peaks. Recommending Vouch Tier expansion."</p>
             </div>
          </div>
        </div>

        {/* ACTION TERMINAL */}
        <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
               <h4 className="text-lg font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest mb-6">Social Vouching</h4>
               <p className="text-xs text-[#8C8C8C] leading-relaxed mb-8">Stake **$25.00 equivalent** from your reputation pool to vouch for Siddharth. If he repays, you earn **0.8% QP boost**. If he defaults, your score is impacted.</p>
               <button className="w-full py-5 bg-[#F5A623] text-black rounded-[8px] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all active:scale-[0.98]">
                  Vouch for Siddharth
               </button>
            </div>
            <div className="border-l border-[#E8E8E8] dark:border-[#1E2A3A] md:pl-12">
               <h4 className="text-lg font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest mb-6">Direct Lending</h4>
               <p className="text-xs text-[#8C8C8C] leading-relaxed mb-8">Deploy capital directly to fund the remaining **$50.00**. Earn 4.2% yield. Capital is 100% principal protected by community treasury.</p>
               <button className="w-full py-5 border border-[#1D9E75] text-[#1D9E75] rounded-[8px] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-[#1D9E75] hover:text-white transition-all">
                  Deploy $50.00 Fund
               </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
