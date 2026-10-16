import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useWallet } from '../context/WalletContext';
import { useReputationNFT } from '../hooks/useReputationNFT';
import { useLendingPool } from '../hooks/useLendingPool';
import { useVouchSystem } from '../hooks/useVouchSystem';
import { useTransactionHistory } from '../hooks/useTransactionHistory';
import { currentTimeMs } from '../utils/time';
import { getTier, TIER_COLORS } from '../utils/constants';
import Skeleton from '../components/Skeleton';

const shortAddr = (a = '') => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';
const daysLeft = (due, t) => {
  if (!due) return '—';
  const d = Math.ceil((due - Date.now()) / 86400000);
  return d > 0 ? `${d} ${t('dashboard.days')}` : t('dashboard.overdue');
};

function StatCard({ label, value, sub, subColor = '#8C8C8C', accent = false, children }) {
  return (
    <div className={`bg-white dark:bg-[#111827] p-8 rounded-[12px] border
      ${accent ? 'border-[#F5A623]/40' : 'border-[#E8E8E8] dark:border-[#1E2A3A]'}
      flex flex-col justify-center group transition-all hover:border-[#F5A623]/50`}>
      {children}
      {label && <p className="text-[11px] font-black text-[#8C8C8C] uppercase tracking-widest mb-3">{label}</p>}
      {value !== undefined && <h3 className="text-2xl xl:text-3xl font-black tracking-tighter text-[#1A1A1A] dark:text-[#FAFAF8] font-cabinet break-words">{value}</h3>}
      {sub && <p className="text-[10px] font-bold mt-2 uppercase tracking-widest" style={{ color: subColor }}>{sub}</p>}
    </div>
  );
}

function LoanHealthBar({ loan }) {
  const { t } = useTranslation();
  const due = loan.dueDate;
  const now = currentTimeMs();
  const start = loan.startTime;
  const pct = Math.min(100, Math.max(0, ((now - start) / (due - start)) * 100));
  const urgency = pct < 50 ? '#1D9E75' : pct < 80 ? '#F59E0B' : '#EF4444';

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
        <span className="text-[#8C8C8C]">{t('dashboard.timeElapsed')}</span>
        <span style={{ color: urgency }}>{t('dashboard.termUsed', { pct: Math.round(pct || 0) })}</span>
      </div>
      <div className="h-2 w-full bg-[#1E2A3A] rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: urgency }}
           initial={{ width: 0 }} animate={{ width: `${pct || 0}%` }} transition={{ duration: 1 }} />
      </div>
      <div className="flex justify-between text-[9px] text-[#8C8C8C] font-bold">
        <span>{t('dashboard.borrowed')}</span>
        <span>{t('dashboard.dueIn', { time: daysLeft(due, t) })}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { walletAddress: address } = useWallet();

  const { trustScore, isLoading: isRepLoading } = useReputationNFT();
  const { borrowLimit, userLoan, poolStats, isLoading: isPoolLoading } = useLendingPool();
  const { vouches } = useVouchSystem();
  const { transactions } = useTransactionHistory();

  const score = Number(trustScore) || 30; // fallback default
  const tier = getTier(score);
  const tierColor = TIER_COLORS[tier];
  const hasLoan = !!userLoan && userLoan?.amount > 0;
  
  const getPathName = (pathInt) => {
      if (pathInt === 0) return 'Vouch-Backed';
      if (pathInt === 1) return 'Collateral';
      return 'Trust-Only';
  };

  return (
    <AppShell pageTitle={address ? t('dashboard.welcome') : t('common.dashboard')}
              pageSubtitle={address ? `${shortAddr(address)}` : t('common.connectWallet')}>
      <div className="max-w-7xl mx-auto space-y-10 pb-24">

        {/* ── TOP ROW: stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <StatCard>
            {isRepLoading ? (
               <div className="flex flex-col items-center py-4"><Skeleton w="80px" h="80px" r="50%" /><div className="mt-4 w-full flex flex-col items-center gap-2"><Skeleton w="60%" h="12px" /><Skeleton w="40%" h="10px" /></div></div>
            ) : (
                <div className="flex flex-col items-center">
                  <div className="relative w-36 h-36">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                      <circle cx="18" cy="18" r="15.8" fill="transparent" stroke="#1E2A3A" strokeWidth="3" />
                      <motion.circle cx="18" cy="18" r="15.8" fill="transparent" strokeWidth="3"
                        style={{ stroke: tierColor }}
                        strokeDasharray={`${score} 100`}
                        initial={{ strokeDasharray: '0 100' }}
                        animate={{ strokeDasharray: `${score} 100` }}
                        transition={{ duration: 1.5, ease: 'easeOut' }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8]">{score}</span>
                      <span className="text-[10px] text-[#8C8C8C] font-black uppercase tracking-widest mt-1">/ 100</span>
                    </div>
                  </div>
                  <div className="text-center mt-4">
                    <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                      style={{ color: tierColor, borderColor: tierColor + '40', background: tierColor + '15' }}>
                      {tier} Tier
                    </span>
                  </div>
                </div>
            )}
          </StatCard>

          {isPoolLoading ? <div className="space-y-4 pt-12"><Skeleton w="40%" h="10px" /><Skeleton w="70%" h="32px" /><Skeleton w="80%" h="10px" /></div> : (
              <StatCard label="Borrow Limit"
                value={`$${Number(borrowLimit).toLocaleString()}`}
                sub={score >= 40 ? `You're at ${tier} level — repay to grow` : 'Repay loans to increase your limit'}
                subColor={score >= 40 ? '#1D9E75' : '#F5A623'} />
          )}

          {isPoolLoading ? <div className="space-y-4 pt-12"><Skeleton w="40%" h="10px" /><Skeleton w="70%" h="32px" /><Skeleton w="80%" h="10px" /></div> : (
              <StatCard label="Pool Balance"
                value={`${Number(poolStats?.totalLiquidity || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} TRUST`}
                sub="Community Liquidity Pool"
                subColor="#1D9E75" />
          )}

          {isPoolLoading ? <div className="space-y-4 pt-12"><Skeleton w="40%" h="10px" /><Skeleton w="70%" h="32px" /><Skeleton w="80%" h="10px" /></div> : (
              hasLoan ? (
                <div className="bg-white dark:bg-[#111827] p-8 rounded-[12px] border border-[#F59E0B]/40
                                flex flex-col justify-center group transition-all">
                  <p className="text-[11px] font-black text-[#8C8C8C] uppercase tracking-widest mb-3">Active Loan</p>
                  <h3 className="text-4xl font-black tracking-tighter text-[#1A1A1A] dark:text-[#FAFAF8] font-cabinet mb-4">
                    {userLoan.amount} TRUST
                  </h3>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                    <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">
                      Due {daysLeft(userLoan.dueDate, t)}
                    </p>
                  </div>
                  <button id="btn-repay-now" onClick={() => navigate(`/repay?loanId=active`)}
                    className="w-full py-3 rounded-xl bg-[#1D9E75] text-white text-[11px] font-black
                               uppercase tracking-widest hover:bg-[#13C296] transition-all active:scale-[0.98]">
                    ⚡ Repay Now
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#111827] p-8 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]
                                flex flex-col justify-center items-center text-center group transition-all hover:border-[#F5A623]/40">
                  <div className="text-4xl mb-4">💸</div>
                  <p className="text-[11px] font-black text-[#8C8C8C] uppercase tracking-widest mb-2">{t('dashboard.noActiveLoan')}</p>
                  <p className="text-[#8C8C8C] text-xs mb-6 leading-relaxed">{t('dashboard.limitReady')}</p>
                  <button id="btn-get-first-loan" onClick={() => navigate('/borrow')}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                               text-black text-[11px] font-black uppercase tracking-widest
                               hover:opacity-90 active:scale-[0.98] transition-all
                               shadow-[0_0_20px_rgba(245,166,35,0.25)]">
                    Borrow →
                  </button>
                </div>
              )
          )}
        </div>

        {/* ── ACTIVE LOAN HEALTH ── */}
        <AnimatePresence>
          {hasLoan && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#F59E0B]/20 dark:border-[#F59E0B]/20">
              <div className="flex justify-between items-center mb-8">
                <h4 className="text-lg font-black font-cabinet tracking-tight text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest">
                  {t('dashboard.activeLoan')}
                </h4>
                <span className="px-3 py-1 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20
                                 text-[9px] font-black uppercase text-[#F59E0B] tracking-widest">
                  Active
                </span>
              </div>
              <div className="space-y-8">
                <LoanHealthBar loan={userLoan} />
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { l: t('dashboard.borrowed'),  v: `$${userLoan.amount}`,           c: 'currentColor' },
                    { l: t('dashboard.repaid'),    v: `$${userLoan.repaidAmount}`,     c: '#1D9E75' },
                    { l: t('dashboard.loanPath'), v: getPathName(userLoan.path),      c: '#F5A623' },
                  ].map(({ l, v, c }, i) => (
                    <div key={i} className="text-center p-4 bg-[#FAFAF8] dark:bg-[#0A0F1E] rounded-xl border border-[#E8E8E8] dark:border-[#1E2A3A] text-[#1A1A1A] dark:text-[#FAFAF8]">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#8C8C8C] mb-2">{l}</p>
                      <p className="font-black font-cabinet text-[15px] capitalize truncate" style={{ color: c }}>{v}</p>
                    </div>
                  ))}
                </div>
                <button id="btn-health-repay" onClick={() => navigate(`/repay?loanId=active`)}
                  className="w-full py-4 rounded-xl bg-[#1D9E75] text-white font-black text-[12px]
                             uppercase tracking-widest hover:bg-[#13C296] transition-all active:scale-[0.98]
                             shadow-[0_0_25px_rgba(29,158,117,0.2)]">
                  {t('dashboard.repayBalance')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MIDDLE ROW ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
            <h4 className="text-lg font-black font-cabinet tracking-tight text-[#1A1A1A] dark:text-[#FAFAF8] mb-8 uppercase tracking-widest">
              {t('dashboard.vouchNetwork', { count: vouches.length })}
            </h4>
            
            {vouches.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center border border-[#E8E8E8] dark:border-[#1E2A3A] rounded-lg mb-8">
                  <p className="text-[#8C8C8C] text-sm font-bold mb-2">{t('dashboard.noVouches')}</p>
                  <p className="text-[#8C8C8C] text-[10px] leading-relaxed">{t('dashboard.vouchDesc')}</p>
              </div>
            ) : (
              <div className="space-y-4 mb-8">
                {vouches.slice(0, 3).map((v, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#FAFAF8]/50 dark:bg-[#0A0F1E]/50 p-3 rounded-lg border border-[#E8E8E8]/50 dark:border-[#1E2A3A]/50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#FAFAF8] dark:bg-[#0A0F1E] border border-[#F5A623]/20 flex items-center justify-center text-[10px] font-bold text-[#F5A623]">
                        {v.voucher.slice(2, 3).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[#1A1A1A] dark:text-[#FAFAF8]">{shortAddr(v.voucher)}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1D9E75]">
                            {v.slashed ? 'Slashed' : v.released ? 'Released' : 'Active'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-black text-[#1A1A1A] dark:text-[#FAFAF8] font-mono">${v.amount} Backed</span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-3 mt-2">
              <button onClick={() => navigate('/invite-vouch')}
                id="btn-invite-voucher"
                className="flex-1 py-4 rounded-[8px] bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                           text-black text-[10px] font-black uppercase tracking-widest
                           hover:opacity-90 active:scale-[0.98] transition-all">
                + {t('dashboard.inviteVoucher')}
              </button>
              <button onClick={() => navigate('/network')}
                className="flex-1 py-4 border border-[#F5A623] text-[#F5A623] rounded-[8px]
                           text-[10px] font-black uppercase tracking-widest hover:bg-[#F5A623] hover:text-black transition-all">
                View Network
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
            <div className="flex justify-between items-start mb-8">
              <h4 className="text-lg font-black font-cabinet tracking-tight text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest">
                Reputation Identity
              </h4>
            </div>

            <div className="flex flex-col items-center justify-center h-48 text-center border border-[#E8E8E8] dark:border-[#1E2A3A] rounded-lg">
                <div className="text-5xl mb-4">🎭</div>
                <p className="text-[#8C8C8C] text-sm font-bold mb-2">On-Chain Credit Profile</p>
                <p className="text-[#8C8C8C] text-xs leading-relaxed max-w-[200px] mx-auto">
                    Manage your Soulbound Reputation NFT unlocking capital paths.
                </p>
                <button onClick={() => navigate('/audit')} className="mt-4 px-6 py-2 border border-[#8C8C8C] text-[#8C8C8C] hover:text-white hover:border-white transition-all text-[10px] rounded uppercase font-black tracking-widest">
                    Run Sovereign Audit
                </button>
            </div>
          </div>
        </div>

        {/* ── RECENT ACTIVITY ── */}
        <div className="bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]">
          <h4 className="text-lg font-black font-cabinet tracking-tight text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest mb-8">
            Recent Ledger Activity
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[#E8E8E8] dark:border-[#1E2A3A]">
                <tr>
                  {['Event', 'Amount/Impact', 'Date', 'Status', 'Tx Hash'].map(h => (
                    <th key={h} className="pb-5 text-left text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2A3A]">
                {transactions.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-xs text-[#8C8C8C]">No activity yet for this wallet.</td></tr>
                )}
                {transactions.slice(0, 4).map((l) => (
                  <tr key={l.id} className="hover:bg-white/[0.02] transition-all duration-300">
                    <td className="py-5 text-sm font-bold text-[#1A1A1A] dark:text-[#FAFAF8]">
                      {l.type}
                    </td>
                    <td className={`py-5 font-mono font-black text-sm ${l.positive ? 'text-[#1D9E75]' : 'text-[#1A1A1A] dark:text-[#FAFAF8]'}`}>
                      {l.value}
                    </td>
                    <td className="py-5 text-[11px] font-black text-[#8C8C8C] uppercase tracking-widest">
                      {l.date ? l.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="py-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-[#1D9E75]/10 text-[#1D9E75]`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-5">
                      {l.hash && <span className="font-mono text-[10px] text-[#8C8C8C]">{l.hash.slice(0, 10)}…</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => navigate('/ledger')} className="w-full text-center text-[#8C8C8C] hover:text-white transition-all text-[10px] uppercase font-black pt-6 tracking-widest">
              View Complete Ledger →
          </button>
        </div>
      </div>
    </AppShell>
  );
}
