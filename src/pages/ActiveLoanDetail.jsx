import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useWallet } from '../context/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { useVouchSystem } from '../hooks/useVouchSystem';
import { motion } from 'framer-motion';
import Skeleton, { SkeletonCard } from '../components/Skeleton';

const daysLeft = (dueTime) => {
  if (!dueTime) return '—';
  const d = Math.ceil((dueTime - Date.now()) / 86400000);
  return d > 0 ? `${d} Days` : 'Overdue';
};

export default function ActiveLoanDetail() {
  const { address } = useWallet();
  const navigate = useNavigate();
  
  const { userLoan, isLoading: isLoanLoading } = useLendingPool();
  const { vouches, isLoading: isVouchLoading } = useVouchSystem();

  const isLoading = isLoanLoading || isVouchLoading;

  if (isLoading) {
    return (
        <AppShell pageTitle="Active Lifecycle" pageSubtitle="Monitoring...">
            <div className="max-w-7xl mx-auto space-y-10 pb-24">
                <SkeletonCard h="200px" />
                <SkeletonCard h="300px" />
            </div>
        </AppShell>
    );
  }

  if (!userLoan || userLoan.amount <= 0) {
      return (
          <AppShell pageTitle="Active Lifecycle" pageSubtitle="Real-time Capital Monitoring">
               <div className="max-w-7xl mx-auto py-24 text-center">
                   <p className="text-4xl mb-4">🙌</p>
                   <p className="font-cabinet text-2xl font-black text-[#FAFAF8]">No Active Loan</p>
                   <p className="text-[#8C8C8C] mt-2 mb-8 text-sm">Your slate is clean. No active positions to monitor.</p>
                   <button onClick={() => navigate('/borrow')} className="px-8 py-3 bg-[#F5A623] text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:scale-105 transition-transform">
                       Drawdown New Capitol
                   </button>
               </div>
          </AppShell>
      )
  }

  const start = userLoan.startTime;
  const due = userLoan.dueDate;
  const now = Date.now();
  const pct = Math.min(100, Math.max(0, ((now - start) / (due - start)) * 100));
  
  // Calculate array for timeline UI
  const totalInstallments = Number(userLoan.totalInstallments);
  const paidCount = Number(userLoan.installmentsPaid);
  const stepAmount = Number(userLoan.totalOwed) / (totalInstallments > 0 ? totalInstallments : 1);

  return (
    <AppShell pageTitle="Active Lifecycle" pageSubtitle="Real-time Capital Monitoring">
      <div className="max-w-7xl mx-auto space-y-10 pb-24">
        
        {/* TOP SECTION: Loan Identity Card */}
        <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#1D9E75]"></div>
          <div>
            <div className="flex items-center gap-4 mb-4">
              <span className="font-mono text-xs text-[#8C8C8C] tracking-widest uppercase">
                  TL-HASH-{address.slice(-6).toUpperCase()}
              </span>
              <span className="px-3 py-1 rounded-full bg-[#1D9E75]/10 border border-[#1D9E75]/20 text-[9px] font-black uppercase text-[#1D9E75] tracking-[0.2em]">
                  Active — On Track
              </span>
            </div>
            <h2 className="text-5xl font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8] tracking-tighter mb-2">
                ${Number(userLoan.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </h2>
            <div className="flex gap-6 mt-4">
               <div>
                  <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">Disbursed</p>
                  <p className="text-xs font-bold text-[#1A1A1A] dark:text-[#FAFAF8]">
                      {new Date(userLoan.startTime).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                  </p>
               </div>
               <div>
                  <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">Due Date</p>
                  <p className="text-xs font-bold text-[#1A1A1A] dark:text-[#FAFAF8]">
                      {new Date(userLoan.dueDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                  </p>
               </div>
               <div>
                  <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">Remains</p>
                  <p className="text-xs font-black text-[#F5A623]">{daysLeft(userLoan.dueDate)}</p>
               </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="px-4 py-2 rounded-xl bg-[#1D9E75]/10 border border-[#1D9E75]/20 text-[10px] font-black uppercase text-[#1D9E75] tracking-widest mb-4">
                Total Owed: ${Number(userLoan.totalOwed).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </span>
            <div className="text-right">
              <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">Current Balance Repaid</p>
              <p className="text-xl font-black text-[#1A1A1A] dark:text-[#FAFAF8] font-mono">
                  ${Number(userLoan.repaidAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}
              </p>
            </div>
          </div>
        </div>

        {/* CAPITAL HEALTH MONITOR */}
        <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
          <h4 className="text-lg font-black font-cabinet tracking-tight text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest mb-10 text-center">Capital Health Monitor</h4>
          <div className="space-y-8">
            <div className="relative h-4 w-full bg-[#1E2A3A] rounded-full overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-r from-[#1D9E75] via-[#F5A623] to-[#EF4444] opacity-20"></div>
               <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${100 - pct}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-[#1D9E75] relative shadow-[0_0_15px_rgba(29,158,117,0.5)]"
               />
               <div className="absolute top-0 left-[75%] bottom-0 w-0.5 bg-white/50 z-20"></div>
            </div>
            <div className="flex justify-between w-full px-2 text-[9px] font-black uppercase tracking-widest text-[#8C8C8C]">
                <span>Healthy (100%)</span>
                <span>Default Threshold (0%)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="p-6 rounded-xl bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                 <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mb-2">Execution Protocol</p>
                 <p className="text-2xl font-black text-[#1D9E75] font-cabinet">
                     100% Healthy
                     <span className="text-xs text-[#8C8C8C] font-black tracking-widest ml-2 uppercase">— SECURED</span>
                 </p>
                 <p className="text-[9px] font-bold text-[#8C8C8C] mt-2 uppercase">Score Projection: Next Payment +2 PTS</p>
              </div>
              <div className="p-6 rounded-xl bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                 <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mb-2">Social Backing Context</p>
                 <p className="text-2xl font-black text-[#F5A623] font-cabinet">{vouches.length} Vouchers <span className="text-xs text-[#8C8C8C] font-black tracking-widest ml-2 uppercase">— CONNECTED</span></p>
                 <p className="text-[9px] font-bold text-[#8C8C8C] mt-2 uppercase">Strengthening your score by {vouches.length > 0 ? "12%" : "0%"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* TIMELINE - Note this is a simplistic mapping purely for visual tracking of fractional repayments */}
        <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
          <div className="flex justify-between items-center mb-12">
            <h4 className="text-lg font-black font-cabinet tracking-tight text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest">Repayment Progress</h4>
            <div className="flex items-center gap-2 text-[#F5A623]">
              <span className="text-2xl">🔥</span>
              <p className="text-[10px] font-black uppercase tracking-widest">Building your on-chain streak</p>
            </div>
          </div>
          
          <div className="relative flex justify-between items-start pt-8 pb-12 px-4 md:px-12">
            <div className="absolute top-12 left-0 right-0 h-1 bg-[#1E2A3A] z-0"></div>
            {Array.from({ length: totalInstallments }).map((_, i) => {
              const status = i < paidCount ? 'Paid' : i === paidCount ? 'Current' : 'Upcoming';
              return (
                <div key={i} className="relative z-10 flex flex-col items-center gap-4">
                  <div className={`w-8 h-8 rounded-full border-4 flex items-center justify-center transition-all duration-500
                    ${status === 'Paid' ? 'bg-[#1D9E75] border-[#111827] shadow-[0_0_10px_rgba(29,158,117,1)] text-white' : 
                      status === 'Current' ? 'bg-[#F5A623] border-[#111827] shadow-[0_0_10px_rgba(245,166,35,1)] animate-pulse' : 
                      'bg-[#1E2A3A] border-[#111827]'}`}>
                    {status === 'Paid' && <iconify-icon icon="lucide:check" className="text-xs"></iconify-icon>}
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest mb-1">{status}</p>
                    <p className="text-[8px] font-mono text-[#8C8C8C] mt-1">${stepAmount.toFixed(2)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4">
            <button 
                onClick={() => navigate('/repay')}
                className="flex-1 py-5 bg-[#F5A623] text-black rounded-[8px] text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all active:scale-[0.98]">
              Make Settlement Repayment
            </button>
            <button 
                onClick={() => navigate('/dashboard')}
                className="flex-1 py-5 border border-[#E8E8E8] dark:border-[#1E2A3A] text-[#8C8C8C] rounded-[8px] text-[11px] font-black uppercase tracking-widest hover:border-[#F5A623] hover:text-[#F5A623] transition-all">
              Return to Terminal
            </button>
        </div>
      </div>
    </AppShell>
  );
}
