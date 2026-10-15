import React from 'react';
import AppShell from '../components/AppShell';
import { useReputationNFT } from '../hooks/useReputationNFT';
import Skeleton from '../components/Skeleton';

export default function ReputationBreakdown() {
  const { trustScore, reputationData, isLoading } = useReputationNFT();

  if (isLoading) {
    return (
        <AppShell pageTitle="Reputation Breakdown" pageSubtitle="Granular Score Analysis">
            <div className="max-w-7xl mx-auto space-y-12 pb-24">
                <Skeleton h="200px" />
                <Skeleton h="300px" />
            </div>
        </AppShell>
    )
  }

  const scoreNum = Number(trustScore);

  return (
    <AppShell pageTitle="Reputation Breakdown" pageSubtitle="Granular Score Analysis">
      <div className="max-w-7xl mx-auto space-y-12 pb-24">
        
        {/* Factor Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {[
             { label: 'Financial Fidelity', score: `${scoreNum}/100`, status: 'Verified', sub: `Based on ${reputationData?.loansRepaid || 0} repayments`, color: 'text-[#1D9E75]' },
             { label: 'Network Archetype', score: `${reputationData?.tier || 'Entry'}`, status: 'Active', sub: 'Current Protocol Status', color: 'text-[#F5A623]' },
             { label: 'Protocol Volume', score: `$${reputationData?.totalRepaid || 0}`, status: 'High', sub: 'Verified Lifetime Clearance', color: 'text-[#1A1A1A] dark:text-[#FAFAF8]' }
           ].map((f, i) => (
             <div key={i} className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] relative group">
                <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.3em] mb-4">{f.label}</p>
                <div className="flex justify-between items-end mb-6">
                   <p className={`text-4xl font-black font-cabinet ${f.color}`}>{f.score}</p>
                   <span className={`text-[9px] font-black uppercase tracking-widest ${f.color} bg-white/5 px-3 py-1 rounded`}>{f.status}</span>
                </div>
                <div className="w-full bg-[#1E2A3A] h-1 rounded-full overflow-hidden">
                   <div className={`h-full bg-current ${f.color}`} style={{ width: f.score.includes('/') ? f.score.split('/')[0] + '%' : '100%' }}></div>
                </div>
                <p className="text-[9px] font-bold text-[#8C8C8C] mt-4 uppercase tracking-widest">{f.sub}</p>
             </div>
           ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
           {/* Recent Impact Feed */}
           <div className="bg-white dark:bg-[#111827] rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] overflow-hidden">
              <div className="p-8 border-b border-[#E8E8E8] dark:border-[#1E2A3A]">
                 <h3 className="text-sm font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest">Recent Reputation Events</h3>
              </div>
              <div className="divide-y divide-[#1E2A3A]">
                 {[
                   { action: `Protocol Onboard (Streak: ${reputationData?.repaymentStreak || 0})`, impact: 'Active', date: 'Ongoing', positive: true },
                   { action: 'Soulbound Mint', impact: '+30 pts', date: 'Initial', positive: true },
                 ].map((e, i) => (
                   <div key={i} className="p-8 flex justify-between items-center bg-[#FAFAF8]/30 dark:bg-[#0A0F1E]/30">
                      <div>
                         <p className="text-sm font-black text-[#1A1A1A] dark:text-[#FAFAF8]">{e.action}</p>
                         <p className="text-[10px] text-[#8C8C8C] uppercase tracking-widest mt-1">{e.date}</p>
                      </div>
                      <span className={`text-sm font-black ${e.positive ? 'text-[#1D9E75]' : 'text-[#EF4444]'}`}>{e.impact}</span>
                   </div>
                 ))}
                 {Number(reputationData?.totalBorrowed) > 0 && (
                     <div className="p-8 flex justify-between items-center bg-[#FAFAF8]/30 dark:bg-[#0A0F1E]/30">
                          <div>
                             <p className="text-sm font-black text-[#1A1A1A] dark:text-[#FAFAF8]">Drawdown Registered</p>
                             <p className="text-[10px] text-[#8C8C8C] uppercase tracking-widest mt-1">History</p>
                          </div>
                          <span className="text-sm font-black text-[#1D9E75]">Risk Adjusted</span>
                       </div>
                 )}
              </div>
           </div>

           {/* AI Projection & Strategy */}
           <div className="space-y-8">
              <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#F5A623] opacity-[0.05] blur-3xl"></div>
                 <h4 className="text-[10px] font-black text-[#F5A623] uppercase tracking-[0.3em] mb-8">AI Strategy Projection</h4>
                 <div className="space-y-6">
                    <div className="bg-[#FAFAF8] dark:bg-[#0A0F1E] p-6 rounded border border-[#E8E8E8] dark:border-[#1E2A3A]">
                       <p className="text-[11px] text-[#1A1A1A] dark:text-[#FAFAF8] leading-relaxed">Based on your current transaction velocity, your active score <span className="text-[#F5A623] font-black">{scoreNum}/100</span> puts you on track to elevate to the next Tier. Maintaining your Repayment Streak of {reputationData?.repaymentStreak || 0} is key to unlocking expanded limits.</p>
                    </div>
                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest">Recommended Actions:</p>
                       {[
                         { label: 'Maintain Active Overcollateralization', prize: 'Rate Cut' },
                         { label: 'Secure 1 more Voucher Node', prize: '+15 pts' }
                       ].map((r, i) => (
                         <div key={i} className="flex justify-between items-center p-4 rounded border border-[#E8E8E8] dark:border-[#1E2A3A] bg-[#FAFAF8]/50 dark:bg-[#0A0F1E]/50">
                            <span className="text-[10px] font-bold text-[#1A1A1A] dark:text-[#FAFAF8]">{r.label}</span>
                            <span className="text-[9px] font-black text-[#F5A623] uppercase tracking-widest">{r.prize}</span>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="p-8 rounded-[12px] bg-[#1D9E75]/5 border border-[#1D9E75]/10">
                 <p className="text-[10px] text-[#1A1A1A] dark:text-[#FAFAF8] leading-relaxed">Your **"Behavioral Fidelity"** is currently evaluated off-chain by zero-knowledge inputs alongside your purely mathematical on-chain {scoreNum} score.</p>
              </div>
           </div>
        </div>
      </div>
    </AppShell>
  );
}
