import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { useTranslation } from 'react-i18next';
import Skeleton from '../components/Skeleton';
import toast from 'react-hot-toast';

export default function Borrow() {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const { address } = useWallet();
  const navigate = useNavigate();

  const { borrowLimit, requestLoan, isLoading } = useLendingPool();

  const [amount, setAmount] = useState(50);
  // Paths: 0 = VouchBacked, 1 = Collateral, 2 = TrustOnly
  const [pathway, setPathway] = useState(2); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper formatting
  const limitValue = isLoading ? 0 : Number(borrowLimit);
  const safeAmount = Math.min(amount, limitValue);

  const pathways = [
    { id: 2, label: t('borrow.reputationOnlyTitle'), desc: t('borrow.reputationOnlyDesc'), icon: "lucide:trending-up", rate: "7.1%", vouchers: 0 },
    { id: 0, label: t('borrow.communityVouchingTitle'), desc: t('borrow.communityVouchingDesc'), icon: "lucide:users-2", rate: "4.2%", vouchers: 3 },
    { id: 1, label: t('borrow.digitalCollateralTitle'), desc: t('borrow.digitalCollateralDesc'), icon: "lucide:shield-check", rate: "2.8%", vouchers: 0 }
  ];

  const handleRequestLoan = async () => {
    if (!address) {
      toast.error("Please connect your wallet first.");
      return;
    }
    if (safeAmount <= 0) {
      toast.error("Borrow amount must be greater than 0.");
      return;
    }
    if (safeAmount > limitValue) {
      toast.error("Borrow amount exceeds your authorized limit.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 30 days, 4 installments for simple demo
      await requestLoan(safeAmount, 30, pathway);
      toast.success(`Loan approved! ${safeAmount} TRUST sent to wallet`, { duration: 4000 });
      
      // Auto redirect after 2 seconds
      setTimeout(() => {
        navigate('/loan/active'); 
      }, 2000);
    } catch (err) {
      console.error(err);
      // useLendingPool already shows detailed toast via showTxError
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPath = pathways.find(p => p.id === pathway);
  const rateNum = parseFloat(selectedPath.rate) / 100;
  const totalRepay = safeAmount * (1 + rateNum);
  const weeklyInstallment = totalRepay / 4;

  return (
    <AppShell pageTitle={t('borrow.title')} pageSubtitle={t('borrow.subtitle')}>
      <div className="max-w-7xl mx-auto space-y-12 pb-24">
        
        {/* Pathway Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {pathways.map((path) => (
             <div key={path.id} 
                onClick={() => setPathway(path.id)}
                className={`bg-white dark:bg-[#111827] p-8 rounded-[12px] border-2 cursor-pointer flex flex-col relative overflow-hidden group transition-all
                  ${pathway === path.id ? 'border-[#F5A623] shadow-[0_0_20px_rgba(245,166,35,0.1)]' : 'border-[#E8E8E8] dark:border-[#1E2A3A] hover:border-[#F5A623]/30'}`}>
                
                {pathway === path.id && (
                  <div className="absolute top-0 right-0 p-4">
                    <span className="bg-[#F5A623] text-black text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Selected</span>
                  </div>
                )}
                
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-8 transition-colors
                    ${pathway === path.id ? 'bg-[#F5A623]/10 border border-[#F5A623]/20 text-[#F5A623]' : 'bg-[#1E2A3A] border border-[#E8E8E8] dark:border-[#1E2A3A] text-[#8C8C8C]'}`}>
                  <iconify-icon icon={path.icon} className="text-2xl"></iconify-icon>
                </div>
                
                <h3 className="text-xl font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8] mb-3 uppercase tracking-widest">{path.label}</h3>
                <p className="text-xs text-[#8C8C8C] leading-relaxed mb-8">{path.desc}</p>
                
                <div className="space-y-6 mb-10 flex-1">
                  {path.id === 0 && (
                    <div>
                      <p className="text-[9px] font-black text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-[0.2em] mb-4">Voucher Status (1/3)</p>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1D9E75] border-2 border-[#111827] flex items-center justify-center text-[10px] font-black text-white relative">
                          A <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#1D9E75] border-2 border-[#111827]"></div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#1E2A3A] border-2 border-[#111827] flex items-center justify-center text-[10px] font-black text-[#8C8C8C] relative">
                          ? <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#F59E0B] border-2 border-[#111827]"></div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#1E2A3A] border-2 border-[#111827] flex items-center justify-center text-[10px] font-black text-[#8C8C8C] relative">
                          ? <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#F59E0B] border-2 border-[#111827]"></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(path.id === 1 || path.id === 2) && (
                     <div className="p-4 rounded-lg bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                       <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">Authorization Base</p>
                       {isLoading ? <Skeleton h="20px" w="100px" /> : (
                           <p className="text-sm font-black text-[#1A1A1A] dark:text-[#FAFAF8]">Limit: ${limitValue}</p>
                       )}
                     </div>
                  )}

                  <div className="flex justify-between items-end border-t border-[#E8E8E8] dark:border-[#1E2A3A] pt-6">
                    <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest">Interest Rate</p>
                    <div className="text-right">
                        <p className="text-xl font-black text-[#1D9E75] font-cabinet">{path.rate}</p>
                    </div>
                  </div>
                </div>
             </div>
          ))}
        </div>

        {/* Loan Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
            <h4 className="text-lg font-black font-cabinet tracking-tight text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest mb-10">Loan Infrastructure</h4>
            
            <div className="space-y-12">
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <p className="text-[11px] font-black text-[#8C8C8C] uppercase tracking-widest">{t('borrow.drawdownAmount')}</p>
                  <p className="text-3xl font-black text-[#F5A623] font-cabinet">${safeAmount.toFixed(2)}</p>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max={Math.max(limitValue, 5)} 
                  disabled={isSubmitting || isLoading || limitValue < 5}
                  value={safeAmount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full accent-[#F5A623]" 
                />
                <div className="flex justify-between text-[9px] font-black text-[#8C8C8C] uppercase">
                  <span>Min $5</span>
                  <span>Max ${limitValue} (Authorized Limit)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-xl bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                  <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mb-2">Weekly Installment</p>
                  <p className="text-xl font-black text-[#FAFAF8] font-cabinet">${weeklyInstallment.toFixed(2)} TRUST</p>
                </div>
                <div className="p-6 rounded-xl bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                  <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mb-2">{t('borrow.totalRepayment')}</p>
                  <p className="text-xl font-black text-[#FAFAF8] font-cabinet">${totalRepay.toFixed(2)} TRUST</p>
                </div>
                <div className="p-6 rounded-xl bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                  <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mb-2">Collateral Required</p>
                  <p className="text-xl font-black text-[#1D9E75] font-cabinet">{pathway === 1 ? '50% Staked' : 'None'}</p>
                </div>
              </div>

              <div className="p-8 rounded-xl bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mb-6">Execution Readiness</p>
                <div className="pt-6 border-t border-[#E8E8E8] dark:border-[#1E2A3A] flex flex-col gap-6 lg:flex-row lg:justify-between items-center text-xl font-black font-cabinet">
                  <span className="text-[#1A1A1A] dark:text-[#FAFAF8] tracking-tight uppercase text-sm">Target Disbursal</span>
                  <button 
                     onClick={handleRequestLoan}
                     disabled={isSubmitting || isLoading || !address || safeAmount <= 0}
                     className={`px-10 py-5 rounded-xl uppercase tracking-widest text-[12px] transition-all transform active:scale-95 flex items-center gap-3
                        ${(isSubmitting || isLoading || !address || safeAmount <= 0) 
                            ? 'bg-[#1E2A3A] text-[#8C8C8C] cursor-not-allowed' 
                            : 'bg-gradient-to-r from-[#F5A623] to-[#D4AF37] text-black hover:opacity-90 shadow-[0_0_30px_rgba(245,166,35,0.2)]'
                        }`}>
                    {isSubmitting && <svg className="animate-spin h-4 w-4 text-black" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                    {isSubmitting ? t('dashboard.loading') : `${t('borrow.requestLoan')} $${safeAmount.toFixed(2)}`}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white dark:bg-[#111827] p-8 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
              <h5 className="text-[10px] font-black text-[#F5A623] uppercase tracking-[0.3em] mb-6">AI Execution Audit</h5>
              {isLoading ? (
                  <Skeleton h="100px" />
              ) : (
                  <>
                      <div className="text-center py-6">
                        <p className="text-5xl font-black font-cabinet text-[#1D9E75]">{pathway === 0 ? "88" : pathway === 1 ? "95" : "72"}</p>
                        <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mt-2">{pathways.find(p=>p.id===pathway).label} Score</p>
                      </div>
                      <div className="p-4 rounded-lg bg-[#1D9E75]/10 border border-[#1D9E75]/20 text-[#1D9E75] text-center text-[10px] font-black uppercase tracking-widest mb-6">
                        Ready for Execution
                      </div>
                  </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
