import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { useReputationNFT } from '../hooks/useReputationNFT';
import { useTrustToken } from '../hooks/useTrustToken';
import Skeleton from '../components/Skeleton';
import toast from 'react-hot-toast';

export default function RepayLoan() {
  const navigate = useNavigate();
  const { address } = useWallet();

  const { userLoan, makeRepayment, isLoading: isLoanLoading } = useLendingPool();
  const { trustScore, isLoading: isRepLoading } = useReputationNFT();
  const { isApproved, approvePool } = useTrustToken();
  
  const [phase, setPhase] = useState('idle'); // idle|approving|blockchain|done|error
  const [errorMsg, setErrorMsg] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);

  useEffect(() => {
    async function check() {
        if (userLoan && userLoan.totalOwed > 0) {
            const approved = await isApproved(userLoan.totalOwed);
            setNeedsApproval(!approved);
        }
    }
    check();
  }, [userLoan, isApproved]);

  if (isLoanLoading || isRepLoading) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center p-8">
        <Skeleton w="300px" h="400px" r="24px" />
      </div>
    );
  }

  const handleApprove = async () => {
      setPhase('approving');
      const success = await approvePool(userLoan.totalOwed);
      if (success) {
          setNeedsApproval(false);
          setPhase('idle');
      } else {
          setPhase('error');
          setErrorMsg('Approval failed or rejected.');
      }
  };

  const handleRepay = async () => {
    if (!userLoan) return;
    setPhase('blockchain');
    setErrorMsg('');
    try {
        await makeRepayment(userLoan.totalOwed);
        setPhase('done');
    } catch (err) {
        console.error(err);
        setErrorMsg('Blockchain settlement failed or rejected. Please check sufficient Trust Tokens.');
        setPhase('error');
    }
  };

  /* ── SUCCESS screen ── */
  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
        <motion.div className="fixed top-0 left-0 w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(29,158,117,0.08)' }} animate={{ y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity }} />

        <div className="w-full max-w-md z-10 space-y-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 16 }}
            className="flex justify-center">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#1D9E75] to-[#13C296]
                            flex items-center justify-center shadow-[0_0_50px_rgba(29,158,117,0.35)]">
              <span className="text-5xl text-white">✓</span>
            </div>
          </motion.div>

          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#1D9E75] mb-2">Loan Settled</p>
            <h1 className="font-cabinet font-black text-4xl text-[#FAFAF8] tracking-tight">Well Done! 🔥</h1>
            <p className="text-[#8C8C8C] text-sm mt-2 leading-relaxed">
              Your repayment is recorded on-chain and your Reputation Protocol score was augmented automatically.
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] mb-5">Trust Score Evolution</p>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-4xl font-black font-cabinet text-[#FAFAF8]">{Number(trustScore)}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#8C8C8C] mt-1">Previous</p>
              </div>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }}
                className="flex flex-col items-center gap-1">
                <div className="text-[#1D9E75] text-xl font-black">+{8}</div>
                <div className="text-[#1D9E75] text-sm">→</div>
              </motion.div>
              <div className="text-center">
                <p className="text-4xl font-black font-cabinet text-[#1D9E75]">{Number(trustScore) + 8}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#1D9E75] mt-1">Current</p>
              </div>
            </div>
          </div>

          <button onClick={() => navigate('/dashboard')}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                       text-black font-black text-[13px] uppercase tracking-widest
                       hover:opacity-90 active:scale-[0.98] transition-all
                       shadow-[0_0_40px_rgba(245,166,35,0.3)]">
            Back to Terminal →
          </button>
        </div>
      </div>
    );
  }

  /* ── MAIN repay screen ── */
  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      <motion.div className="fixed bottom-0 right-0 w-[450px] h-[450px] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(245,166,35,0.06)' }} animate={{ y: [0, -15, 0] }} transition={{ duration: 8, repeat: Infinity }} />

      <button onClick={() => navigate('/dashboard')}
        className="absolute top-8 left-8 text-[#8C8C8C] text-[11px] font-black uppercase tracking-widest
                   hover:text-[#F5A623] transition-colors">
        ← Terminal Return
      </button>

      <div className="w-full max-w-md z-10 space-y-6">
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-3xl p-8 shadow-2xl space-y-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#F5A623] mb-2">Contract Settlement</p>
            <h1 className="font-cabinet font-black text-3xl text-[#FAFAF8] tracking-tight">Repay Debt Ledger</h1>
            <p className="text-[#8C8C8C] text-sm mt-2 leading-relaxed">
              Timely repayments unlock higher tier logic and increase your trust score dynamically on-chain.
            </p>
          </div>

          {!userLoan || userLoan.amount <= 0 ? (
            <div className="text-center py-10 text-[#8C8C8C] font-bold">No active loan to settle.</div>
          ) : (
            <>
              {/* Active loan breakdown */}
              <div className="bg-[#0A0F1E] border border-[#1E2A3A] rounded-2xl p-5 space-y-0">
                {[
                  { l: 'Base Amount',   v: `${userLoan.amount} TRUST`,                        c: '#FAFAF8' },
                  { l: 'Interest/Fees', v: `${(Number(userLoan.totalOwed) - Number(userLoan.amount)).toFixed(2)} TRUST`, c: '#1D9E75' },
                  { l: 'Total Owed',    v: `${userLoan.totalOwed} TRUST`,                     c: '#F5A623' },
                  { l: 'Network Route', v: userLoan.path === 0 ? "Vouch-Backed" : userLoan.path === 1 ? "Collateral" : "Reputation-Only", c: '#FAFAF8' },
                ].map(({ l, v, c }, i) => (
                  <div key={i} className="flex justify-between py-3.5 border-b border-[#1E2A3A] last:border-0">
                    <span className="text-[11px] font-black uppercase tracking-widest text-[#8C8C8C]">{l}</span>
                    <span className="font-black text-sm" style={{ color: c }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* blockchain flow indicator */}
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                {[
                  { l: 'Approve TRUST', active: phase === 'approving', done: !needsApproval && phase !== 'approving', icon: '🔑' },
                  { l: 'Settlement',  active: phase === 'blockchain', done: phase === 'done', icon: '⛓️' },
                  { l: 'Score Boost', active: false,                  done: phase === 'done', icon: '📈' },
                ].map((s, i) => (
                  <React.Fragment key={i}>
                    <div className={`flex flex-col items-center gap-1 transition-all duration-500
                      ${s.done ? 'opacity-100' : s.active ? 'opacity-100' : 'opacity-30'}`}>
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm
                        ${s.done ? 'border-[#1D9E75] bg-[#1D9E75]/10'
                                 : s.active ? 'border-[#F5A623] bg-[#F5A623]/10' : 'border-[#1E2A3A]'}`}>
                        {s.active
                          ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="9" stroke="#F5A623" strokeWidth="2" strokeDasharray="30 15" strokeLinecap="round"/>
                            </svg>
                          : s.icon}
                      </div>
                      <span className={s.done ? 'text-[#1D9E75]' : s.active ? 'text-[#F5A623]' : 'text-[#8C8C8C]'}>
                        {s.l}
                      </span>
                    </div>
                    {i < 2 && (
                      <div className={`flex-1 h-px transition-all duration-500 ${s.done ? 'bg-[#1D9E75]' : 'bg-[#1E2A3A]'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {phase === 'idle' && needsApproval && (
                  <motion.button key="approve" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={handleApprove}
                    className="w-full py-5 rounded-2xl bg-[#F5A623] text-black font-black text-[13px] uppercase tracking-widest hover:opacity-90 transition-all">
                    Authorize TRUST Spending
                  </motion.button>
                )}

                {phase === 'idle' && !needsApproval && (
                  <motion.button key="repay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={handleRepay}
                    className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#1D9E75] to-[#13C296]
                               text-white font-black text-[13px] uppercase tracking-widest
                               hover:opacity-90 active:scale-[0.98] transition-all
                               shadow-[0_0_30px_rgba(29,158,117,0.25)]">
                    ⚡ Authorize Settlement {Number(userLoan.totalOwed).toFixed(2)} TRUST
                  </motion.button>
                )}

                {(phase === 'blockchain' || phase === 'approving') && (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="w-full py-5 rounded-2xl border border-[#1E2A3A] text-center
                               text-[11px] font-black uppercase tracking-widest text-[#8C8C8C]">
                    Processing Protocol Action...
                  </motion.div>
                )}

                {phase === 'error' && (
                  <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <div className="py-4 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30
                                    text-center text-[10px] font-black uppercase tracking-widest text-[#EF4444] px-4">
                      {errorMsg}
                    </div>
                    <button onClick={() => setPhase('idle')}
                      className="w-full py-4 rounded-2xl border border-[#F5A623]/40 text-[#F5A623]
                                 font-black text-[11px] uppercase tracking-widest hover:bg-[#F5A623] hover:text-black transition-all">
                      Try Again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
