import React from 'react';
import AppShell from '../components/AppShell';
import { useTheme } from '../context/ThemeContext';
import { useTransactionHistory } from '../hooks/useTransactionHistory';
import Skeleton, { SkeletonRow } from '../components/Skeleton';

export default function TransactionHistory() {
  const { isDarkMode } = useTheme();
  const { transactions, isLoading } = useTransactionHistory();

  return (
    <AppShell pageTitle="Transaction History" pageSubtitle="Universal Activity Ledger">
      <div className="max-w-7xl mx-auto space-y-12 pb-24">
        
        {/* Filter Navigation */}
        <div className="flex gap-4 p-1 bg-white dark:bg-[#111827] rounded-[10px] w-fit border border-[#E8E8E8] dark:border-[#1E2A3A]">
           {['All Activity', 'Lending', 'Borrowing', 'Reputation'].map((t, i) => (
             <button key={i} className={`px-6 py-3 rounded-[8px] text-[10px] font-black uppercase tracking-widest transition-all ${i === 0 ? 'bg-[#F5A623] text-black' : 'text-[#8C8C8C] hover:text-[#1A1A1A] dark:text-[#FAFAF8]'}`}>
                {t}
             </button>
           ))}
        </div>

        {/* Transaction Table */}
        <div className="bg-white dark:bg-[#111827] rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead>
                    <tr className="border-b border-[#E8E8E8] dark:border-[#1E2A3A] bg-[#FAFAF8]/50 dark:bg-[#0A0F1E]/50">
                       <th className="px-8 py-6 text-[9px] font-black text-[#8C8C8C] uppercase tracking-[0.2em]">Transaction</th>
                       <th className="px-8 py-6 text-[9px] font-black text-[#8C8C8C] uppercase tracking-[0.2em]">Entity</th>
                       <th className="px-8 py-6 text-[9px] font-black text-[#8C8C8C] uppercase tracking-[0.2em]">Value</th>
                       <th className="px-8 py-6 text-[9px] font-black text-[#8C8C8C] uppercase tracking-[0.2em]">Status</th>
                       <th className="px-8 py-6 text-[9px] font-black text-[#8C8C8C] uppercase tracking-[0.2em] text-right">Execution</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-[#1E2A3A]">
                    {isLoading ? (
                      <tr><td colSpan={5} className="p-8"><SkeletonRow count={4} /></td></tr>
                    ) : transactions.length === 0 ? (
                      <tr><td colSpan={5} className="p-12 text-center text-[#8C8C8C] text-sm">No transaction history found for your ledger.</td></tr>
                    ) : transactions.map((tx, i) => (
                      <tr key={i} className="hover:bg-[#FAFAF8] dark:bg-[#0A0F1E] transition-all group">
                         <td className="px-8 py-8">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A] flex items-center justify-center text-[#F5A623]">
                                  <iconify-icon icon={tx.icon} className="text-xl"></iconify-icon>
                               </div>
                               <span className="text-sm font-black text-[#1A1A1A] dark:text-[#FAFAF8]">{tx.type}</span>
                            </div>
                         </td>
                         <td className="px-8 py-8">
                            <span className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest">{tx.entity}</span>
                         </td>
                         <td className="px-8 py-8">
                            <span className={`text-sm font-black ${tx.positive ? 'text-[#1D9E75]' : 'text-[#1A1A1A] dark:text-[#FAFAF8]'}`}>{tx.value}</span>
                         </td>
                         <td className="px-8 py-8">
                            <span className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest ${tx.status === 'Verified' ? 'bg-[#1D9E75]/10 text-[#1D9E75]' : 'bg-[#F5A623]/10 text-[#F5A623]'}`}>
                               {tx.status}
                            </span>
                         </td>
                         <td className="px-8 py-8 text-right">
                            <p className="text-[10px] font-black text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest">
                               {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                            </p>
                            <a 
                                href={`https://amoy.polygonscan.com/tx/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[8px] text-[#8C8C8C] mt-1 font-mono hover:text-[#F5A623] cursor-pointer block"
                            >
                                hash: {tx.hash}
                            </a>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </AppShell>
  );
}
