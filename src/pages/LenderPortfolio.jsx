import React from 'react';
import AppShell from '../components/AppShell';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import Skeleton from '../components/Skeleton';

export default function LenderPortfolio() {
  const { isDarkMode } = useTheme();
  const { address } = useWallet();
  const { poolStats, lenderBalance, isLoading } = useLendingPool();

  const balanceNum = Number(lenderBalance);

  return (
    <AppShell pageTitle="Lender Portfolio" pageSubtitle="Capital Performance Monitor">
      <div className="max-w-7xl mx-auto space-y-12 pb-24">
        
        {/* Portfolio Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {[
             { label: 'Deployed Principal', val: isLoading ? '...' : `$${balanceNum.toLocaleString()}`, sub: 'TrustLend Core Pool', color: 'text-[#1A1A1A] dark:text-[#FAFAF8]' },
             { label: 'Network APY', val: isLoading ? '...' : `${Number(poolStats?.avgInterestRate || 0)}%`, sub: 'Current Active Yield', color: 'text-[#1D9E75]' },
             { label: 'Reputation Mined', val: 'Active', sub: 'Mining Enabled', color: 'text-[#F5A623]' }
           ].map((p, i) => (
             <div key={i} className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#F5A623] opacity-[0.02] blur-3xl group-hover:opacity-[0.05] transition-opacity"></div>
                <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.3em] mb-4">{p.label}</p>
                <p className={`text-4xl font-black font-cabinet ${p.color}`}>{p.val}</p>
                <p className="text-[10px] font-bold text-[#8C8C8C] mt-2 uppercase tracking-widest">{p.sub}</p>
             </div>
           ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Active Deployments List */}
          <div className="lg:col-span-2 bg-white dark:bg-[#111827] rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] overflow-hidden">
             <div className="p-8 border-b border-[#E8E8E8] dark:border-[#1E2A3A] flex justify-between items-center">
                <h3 className="text-sm font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest">Active Deployments</h3>
                <span className="px-3 py-1 rounded bg-[#1D9E75]/10 text-[#1D9E75] text-[8px] font-black uppercase tracking-widest">Protocol Healthy</span>
             </div>
             
             {isLoading ? <div className="p-8"><Skeleton h="100px" /></div> : balanceNum <= 0 ? (
                 <div className="p-12 text-center text-[10px] text-[#8C8C8C] uppercase tracking-widest font-black">
                     No capital deployed yet. Visit the Marketplace to supply liquidity.
                 </div>
             ) : (
                <div className="divide-y divide-[#1E2A3A]">
                   <div className="p-8 hover:bg-[#FAFAF8] dark:bg-[#0A0F1E] transition-all flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                         <div className="w-10 h-10 rounded-full bg-[#1E2A3A] flex items-center justify-center font-black text-xs text-[#1A1A1A] dark:text-[#FAFAF8] border border-[#F5A623]/20">
                            P
                         </div>
                         <div>
                            <p className="text-sm font-black text-[#1A1A1A] dark:text-[#FAFAF8]">TrustLend Core Protocol Pool</p>
                            <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mt-1">Liquid / No Lockup</p>
                         </div>
                      </div>
                      <div className="text-right flex items-center gap-12">
                         <div>
                            <p className="text-sm font-black text-[#1A1A1A] dark:text-[#FAFAF8]">${balanceNum.toLocaleString()}</p>
                            <p className="text-[9px] font-black text-[#1D9E75] uppercase tracking-widest mt-1">{Number(poolStats?.avgInterestRate || 0)}% Yield</p>
                         </div>
                         <div className="hidden md:block">
                            <button className="px-6 py-3 rounded border border-[#E8E8E8] dark:border-[#1E2A3A] text-[9px] font-black uppercase tracking-widest text-[#8C8C8C] cursor-auto group-hover:text-[#F5A623] group-hover:border-[#F5A623] transition-all">Algorithmic Risk</button>
                         </div>
                      </div>
                   </div>
                </div>
             )}
          </div>

          {/* Reputation Gains / QP Mined */}
          <div className="space-y-8">
             <div className="bg-white dark:bg-[#111827] p-8 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                <h4 className="text-[10px] font-black text-[#F5A623] uppercase tracking-[0.3em] mb-8">Reputation Mining (QP)</h4>
                <div className="space-y-6">
                   <div className="flex justify-between items-end h-32 gap-2">
                      {[30, 45, 25, 78, 60, 90, 100].map((v, i) => (
                        <div key={i} className="flex-1 bg-[#F5A623]/10 hover:bg-[#F5A623] transition-all rounded-t-sm" style={{ height: `${v}%` }}></div>
                      ))}
                   </div>
                   <div className="pt-6 border-t border-[#E8E8E8] dark:border-[#1E2A3A]">
                      <div className="flex justify-between items-center mb-4">
                         <span className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest">Total QP Mined</span>
                         <span className="text-sm font-black text-[#1A1A1A] dark:text-[#FAFAF8]">{balanceNum > 0 ? "1,420" : "0"} QP</span>
                      </div>
                      <div className="w-full bg-[#1E2A3A] h-1 rounded-full overflow-hidden">
                         <div className="bg-[#F5A623] h-full transition-all" style={{ width: balanceNum > 0 ? '68%' : '0%' }}></div>
                      </div>
                      <p className="text-[8px] font-bold text-[#8C8C8C] mt-4 uppercase text-center tracking-widest">
                          {balanceNum > 0 ? "142 QP until Silver Tier upgrade" : "Deploy capital to mine QP"}
                      </p>
                   </div>
                </div>
             </div>

             <div className="bg-[#F5A623]/5 p-8 rounded-[12px] border border-[#F5A623]/10 relative overflow-hidden">
                <iconify-icon icon="lucide:zap" className="absolute -right-4 -top-4 text-6xl text-[#F5A623] opacity-10"></iconify-icon>
                <h5 className="text-[10px] font-black text-[#F5A623] uppercase tracking-widest mb-2">Yield Booster {balanceNum > 0 ? "Active" : "Eligible"}</h5>
                <p className="text-[10px] text-[#1A1A1A] dark:text-[#FAFAF8] leading-relaxed">Your "Social Voucher" status grants you a **+0.4%** yield bonus on all active deployments.</p>
             </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
