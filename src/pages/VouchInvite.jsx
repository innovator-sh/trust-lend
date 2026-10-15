import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppShell from '../components/AppShell';
import { useVouchSystem } from '../hooks/useVouchSystem';
import { useWallet } from '../context/WalletContext';
import Skeleton from '../components/Skeleton';
import { useReputationNFT } from '../hooks/useReputationNFT';
import { useTranslation } from 'react-i18next';

const shortAddr = (a = '') => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';

export default function VouchInvite() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { address } = useWallet();
  const { vouchRequests, createVouchRequest, stakeForBorrower, isLoading } = useVouchSystem();
  const { trustScore } = useReputationNFT();

  const [voucherAddr, setVoucherAddr] = useState('');
  const [stakeAmt, setStakeAmt] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sentRequests = vouchRequests.filter(r => r.borrower.toLowerCase() === address.toLowerCase());
  const receivedRequests = vouchRequests.filter(r => r.voucher.toLowerCase() === address.toLowerCase());

  const handleSendRequest = async () => {
    if (!voucherAddr || !address) return;
    setIsSubmitting(true);
    await createVouchRequest(voucherAddr, stakeAmt);
    setVoucherAddr('');
    setIsSubmitting(false);
  };

  const handleAccept = async (req) => {
    try {
        await stakeForBorrower(req.borrower, req.amount, req.id);
    } catch (err) {
        console.error("Failed to accept vouch", err);
    }
  };

  if (isLoading) return <AppShell><Skeleton h="400px" /></AppShell>;

  return (
    <AppShell pageTitle={t('vouch.title')} pageSubtitle={t('vouch.subtitle')}>
      <div className="max-w-7xl mx-auto space-y-10 pb-24">
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Main Action Column */}
          <div className="lg:col-span-3 space-y-8">
            <div className="bg-white dark:bg-[#111827] p-10 rounded-[24px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
              <h3 className="text-lg font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest mb-2">{t('vouch.requestAttestationTitle')}</h3>
              <p className="text-[10px] text-[#8C8C8C] uppercase font-bold tracking-[0.2em] mb-10">{t('vouch.requestAttestationDesc')}</p>

              <div className="space-y-8">
                <div className="space-y-3">
                    <label className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-[0.2em]">Voucher Wallet Node</label>
                    <input 
                        type="text" 
                        value={voucherAddr}
                        onChange={(e) => setVoucherAddr(e.target.value)}
                        placeholder="0x..."
                        className="w-full bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A] p-5 rounded-xl text-sm font-mono text-[#1A1A1A] dark:text-[#FAFAF8] focus:border-[#F5A623] outline-none transition-all" 
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-[0.2em]">Capital Commitment (TRUST)</label>
                    <div className="grid grid-cols-4 gap-4">
                        {[50, 100, 250, 500].map(amt => (
                            <button 
                                key={amt}
                                onClick={() => setStakeAmt(amt)}
                                className={`p-4 rounded-xl text-xs font-black transition-all border ${stakeAmt === amt ? 'bg-[#F5A623] border-[#F5A623] text-black' : 'bg-transparent border-[#1E2A3A] text-[#8C8C8C] hover:border-[#F5A623]'}`}
                            >
                                {amt}
                            </button>
                        ))}
                    </div>
                </div>

                <button 
                    disabled={isSubmitting || !voucherAddr}
                    onClick={handleSendRequest}
                    className="w-full py-5 bg-[#F5A623] text-black rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
                >
                    {isSubmitting ? t('vouch.transmitting') : t('vouch.transmitInvitation')}
                </button>
              </div>
            </div>

            {/* Received Requests (Demo Role: Voucher) */}
            <div className="bg-white dark:bg-[#111827] p-10 rounded-[24px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest">Received Requests</h3>
                    <span className="px-3 py-1 rounded-full bg-[#1D9E75]/10 text-[9px] font-black text-[#1D9E75] uppercase tracking-widest">Role: Voucher</span>
                </div>

                {receivedRequests.length === 0 ? (
                    <div className="p-10 border-2 border-dashed border-[#1E2A3A] rounded-2xl text-center">
                        <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest">No pending attestations for this node</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {receivedRequests.map(req => (
                            <div key={req.id} className="p-6 bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A] rounded-2xl flex justify-between items-center">
                                <div>
                                    <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">From Borrower</p>
                                    <p className="text-xs font-black font-mono text-[#FAFAF8]">{shortAddr(req.borrower)}</p>
                                </div>
                                <div className="text-right flex items-center gap-6">
                                    <div>
                                        <p className="text-[9px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">Stake Req</p>
                                        <p className="text-xs font-black text-[#F5A623]">{req.amount} TRUST</p>
                                    </div>
                                    <button 
                                        onClick={() => handleAccept(req)}
                                        className="bg-[#1D9E75] text-white px-6 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                                    >
                                        Attest & Stake
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <p className="mt-6 text-[9px] text-[#8C8C8C] font-bold uppercase tracking-widest text-center italic">Tip: Switch to the voucher wallet in MetaMask to respond to requests.</p>
            </div>
          </div>

          {/* Activity/Status Sidebar */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-[#111827] p-8 rounded-[24px] border border-[#1E2A3A]">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] mb-6">Reputation Context</h4>
                <div className="flex justify-between items-center mb-6">
                    <p className="text-[10px] font-black text-[#FAFAF8] uppercase tracking-widest">Current Score</p>
                    <p className="text-3xl font-black text-[#F5A623] font-cabinet">{trustScore}</p>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-[#FAFAF8] uppercase tracking-widest">Vouch Potential</p>
                    <p className="text-xl font-black text-[#1D9E75] font-cabinet">+{sentRequests.length * 10} PTS</p>
                </div>
            </div>

            <div className="bg-white dark:bg-[#111827] p-8 rounded-[24px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] mb-6">Sent invitations</h4>
                <div className="space-y-4">
                    {sentRequests.length === 0 ? (
                        <p className="text-[9px] text-[#8C8C8C] font-bold uppercase tracking-widest text-center py-4">{t('vouch.noInvitesSent')}</p>
                    ) : (
                        sentRequests.map(req => (
                            <div key={req.id} className="p-4 bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#E8E8E8] dark:border-[#1E2A3A] rounded-xl flex justify-between items-center">
                                <div>
                                    <p className="text-[8px] font-black text-[#8C8C8C] uppercase tracking-widest mb-1">To Voucher</p>
                                    <p className="text-[10px] font-black font-mono text-[#FAFAF8]">{shortAddr(req.voucher)}</p>
                                </div>
                                <div className="text-[9px] font-black text-[#F59E0B] uppercase tracking-widest animate-pulse">
                                    Transmitting...
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}

