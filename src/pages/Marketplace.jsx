import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useWallet } from '../context/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { useTranslation } from 'react-i18next';
import Skeleton from '../components/Skeleton';
import toast from 'react-hot-toast';

export default function Marketplace() {
  const { t } = useTranslation();
  const { walletAddress } = useWallet();
  const navigate = useNavigate();

  const { poolStats, lenderBalance, deposit, isLoading } = useLendingPool();

  const [depositAmount, setDepositAmount] = useState(500);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDeposit = async () => {
    if (!walletAddress) {
      toast.error("Please connect your wallet first.");
      return;
    }
    if (depositAmount <= 0) {
      toast.error("Deposit amount must be greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      await deposit(depositAmount);
        toast.success("Capital successfully supplied to TrustLend Core Pool!");
    } catch (err) {
      console.error(err);
      toast.error("Deposit transaction failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell pageTitle={t('marketplace.title')} pageSubtitle={t('marketplace.subtitle')}>
      <div className="max-w-7xl mx-auto space-y-12 pb-24">
        
        {/* Marketplace Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
            { l: t('marketplace.totalLiquidity'),   v: isLoading ? '...' : `$${Number(poolStats?.liquidity || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, c: '#1D9E75' },
            { l: t('marketplace.activeLoans'),      v: isLoading ? '...' : poolStats?.activeLoans || 0, c: '#F5A623' },
            { l: t('marketplace.lenderCount'),      v: isLoading ? '...' : poolStats?.lenderCount || 0, c: '#3B82F6' },
            { l: t('marketplace.averageReturn'),    v: isLoading ? '...' : `${Number(poolStats?.avgInterestRate || 0)}%`, c: '#1D9E75' },
            ].map((m, i) => (
            <div key={i} className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-[#E8E8E8] dark:border-[#1E2A3A]">
                <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mb-2">{m.l}</p>
                <p className={`text-2xl font-black font-cabinet`} style={{ color: m.c }}>{m.v}</p>
            </div>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Card: Deposit Capital */}
          <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] flex flex-col relative overflow-hidden">
            <h3 className="text-xl font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8] mb-3 uppercase tracking-widest">{t('marketplace.provideLiquidityTitle')}</h3>
            <p className="text-xs text-[#8C8C8C] leading-relaxed mb-8">{t('marketplace.provideLiquidityDesc')}</p>
            
            <div className="space-y-8 flex-1">
              <div className="p-6 rounded-xl bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                <div className="flex justify-between items-end mb-4">
                  <p className="text-[11px] font-black text-[#8C8C8C] uppercase tracking-widest">Supply Amount</p>
                  <p className="text-3xl font-black text-[#1D9E75] font-cabinet">${depositAmount.toFixed(2)}</p>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="10000"
                  step="50" 
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  className="w-full accent-[#1D9E75]" 
                />
              </div>

              <div className="flex justify-between items-end border-t border-[#E8E8E8] dark:border-[#1E2A3A] pt-6">
                 <div>
                    <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">Avg Loan Rate</p>
                    <p className="text-xl font-black text-[#1D9E75] font-cabinet">
                        {isLoading ? '...' : `${Number(poolStats?.avgInterestRate || 0)}%`}
                    </p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">Risk Profile</p>
                    <p className="text-sm font-black text-[#1D9E75] uppercase tracking-widest">Shared Pool Risk</p>
                 </div>
              </div>
            </div>

            <button 
                onClick={handleDeposit}
                disabled={isSubmitting || isLoading || !walletAddress}
                className={`w-full mt-10 py-5 rounded-[8px] text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]
                    ${(isSubmitting || isLoading || !walletAddress)
                        ? 'bg-[#1E2A3A] text-[#8C8C8C] cursor-not-allowed'
                        : 'bg-[#1D9E75] text-[#111827] hover:bg-opacity-90 shadow-[0_0_20px_rgba(29,158,117,0.2)]'
                    }`}>
              {isSubmitting ? t('marketplace.supplying') : t('marketplace.supplyCapital')}
            </button>
            <p className="mt-4 text-[10px] leading-relaxed text-[#8C8C8C]">{t('marketplace.riskNote')}</p>
          </div>

          {/* Card: Your active portfolio  */}
          <div className="bg-[#1D9E75]/5 p-10 rounded-[12px] border border-[#1D9E75]/10 flex flex-col justify-center items-center text-center">
            <iconify-icon icon="lucide:vault" className="text-5xl text-[#1D9E75] mb-6"></iconify-icon>
            <h4 className="text-lg font-black text-[#1A1A1A] dark:text-[#FAFAF8] font-cabinet mb-2">My Deployed Position</h4>
            
            {isLoading ? <Skeleton h="40px" /> : (
                <div className="mb-8">
                   <p className="text-[11px] text-[#8C8C8C] max-w-sm mb-2 uppercase tracking-widest">Active Balance in Core Pool</p>
                   <p className="text-4xl font-cabinet font-black text-[#1A1A1A] dark:text-[#FAFAF8]">${Number(lenderBalance).toLocaleString()}</p>
                </div>
            )}
            
            <button
                onClick={() => navigate('/portfolio')}
                className="px-10 py-4 bg-[#1D9E75] text-black text-[10px] font-black uppercase tracking-widest rounded-[8px] hover:scale-105 transition-all">
                Manage Portfolio
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
