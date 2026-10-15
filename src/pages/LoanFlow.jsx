import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createLoan, updateLoan, getUser, getTier, TIER_LIMITS, TIER_COLORS, nextTierInfo } from '../lib/supabase';
import {
  isBlockchainReady,
  requestLoan as blockchainRequestLoan,
  parseBlockchainError,
} from '../lib/blockchain';

/* ── demo-mode mock (only used when blockchain not ready) ── */
async function mockBlockchainCreateLoan(amount) {
  await new Promise(r => setTimeout(r, 2200));
  const hash = '0x' + Array.from({ length: 64 }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('');
  return { tx_hash: hash };
}

/* ── step dot ── */
function StepDot({ n, active, done }) {
  return (
    <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center
      text-[11px] font-black transition-all duration-500 font-cabinet flex-shrink-0
      ${done  ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
             : active ? 'border-[#F5A623] text-[#F5A623]'
             : 'border-[#1E2A3A] text-[#8C8C8C]'}`}>
      {done ? '✓' : n}
    </div>
  );
}

/* ════════════ STEP 1 — Select Path ════════════ */
function StepSelectPath({ onNext, limit, tier, tierColor }) {
  const [selected, setSelected] = useState('trust');

  const paths = [
    {
      id: 'trust',
      icon: '🤝',
      label: 'Trust-Only',
      badge: `${tier} Level`,
      badgeColor: tierColor,
      desc: 'Borrow based on your Trust Score. No collateral, no vouchers needed.',
      limit: `$${limit}.00`,
      apr: '0% (Demo)',
      available: true,
    },
    {
      id: 'vouched',
      icon: '👥',
      label: 'Vouched',
      badge: 'Coming Soon',
      badgeColor: '#8C8C8C',
      desc: 'Get peers to vouch for you and unlock bigger loans. Need at least 1 active voucher.',
      limit: 'Up to $200',
      apr: '8% APR',
      available: false,
    },
    {
      id: 'group',
      icon: '🌐',
      label: 'Group Loan',
      badge: 'Coming Soon',
      badgeColor: '#8C8C8C',
      desc: 'Join a lending group where members share responsibility. Requires pool membership.',
      limit: 'Up to $500',
      apr: '5% APR',
      available: false,
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F5A623] mb-2">Step 1 of 3</p>
        <h2 className="font-cabinet font-black text-3xl text-[#FAFAF8] tracking-tight">How Do You Want to Borrow?</h2>
        <p className="text-[#8C8C8C] text-sm mt-2 leading-relaxed">
          Choose your loan type. Trust-only is available right away — no collateral needed.
        </p>
      </div>

      <div className="space-y-3">
        {paths.map(p => (
          <button
            key={p.id}
            id={`path-${p.id}`}
            onClick={() => p.available && setSelected(p.id)}
            className={`w-full p-5 rounded-2xl border text-left transition-all duration-300
              ${!p.available ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              ${selected === p.id && p.available
                ? 'border-[#F5A623] bg-[#F5A623]/6 shadow-[0_0_20px_rgba(245,166,35,0.12)]'
                : 'border-[#1E2A3A] hover:border-[#1E2A3A]/60'}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.icon}</span>
                <span className="font-black font-cabinet text-[#FAFAF8] text-base">{p.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {selected === p.id && p.available && (
                  <div className="w-2 h-2 rounded-full bg-[#F5A623]" />
                )}
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border"
                  style={{ color: p.badgeColor, borderColor: p.badgeColor + '40', background: p.badgeColor + '10' }}>
                  {p.badge}
                </span>
              </div>
            </div>
            <p className="text-[#8C8C8C] text-[12px] ml-9 leading-relaxed">{p.desc}</p>
            <div className="flex gap-6 ml-9 mt-3">
              <span className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest">
                Limit: <span className="text-[#FAFAF8]">{p.limit}</span>
              </span>
              <span className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest">
                Rate: <span className="text-[#FAFAF8]">{p.apr}</span>
              </span>
            </div>
          </button>
        ))}
      </div>

      <button
        id="btn-continue-path"
        onClick={() => onNext(selected)}
        className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                   text-black font-black text-[13px] uppercase tracking-widest
                   hover:opacity-90 active:scale-[0.98] transition-all
                   shadow-[0_0_30px_rgba(245,166,35,0.2)]"
      >
        Continue → Trust-Only Loan
      </button>
    </div>
  );
}

/* ════════════ STEP 2 — Confirm ════════════ */
function StepConfirm({ wallet, amount, onSuccess }) {
  const [phase, setPhase] = useState('idle'); // idle|pending|blockchain|done|error
  const [error, setError] = useState('');

  const confirm = async () => {
    try {
      setPhase('pending');

      // 1. Create loan in Supabase → status: pending
      const loan = await createLoan({ walletAddress: wallet, amount, path: 'trust' });

      // 2. Blockchain: real if MetaMask on correct network, else mock
      setPhase('blockchain');
      const ready = await isBlockchainReady();
      let tx_hash;

      if (ready) {
        // Real blockchain path — one MetaMask popup
        const { txHash: createHash } = await blockchainRequestLoan(amount, 30, 2);
        tx_hash = createHash;
      } else {
        // Demo fallback — simulated hash, no MetaMask required
        const result = await mockBlockchainCreateLoan(amount);
        tx_hash = result.tx_hash;
      }

      // 3. Update Supabase → status: active + tx_hash
      const activeLoan = await updateLoan(loan.id, {
        loan_status: 'active',
        tx_hash,
      });

      setPhase('done');
      await new Promise(r => setTimeout(r, 800));
      onSuccess(activeLoan, tx_hash);
    } catch (err) {
      console.error('[LoanFlow] blockchain error:', err);
      setError(parseBlockchainError(err));
      setPhase('error');
    }
  };

  return (
    <div className="space-y-7">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F5A623] mb-2">Step 2 of 3</p>
        <h2 className="font-cabinet font-black text-3xl text-[#FAFAF8] tracking-tight">Review Your Loan</h2>
        <p className="text-[#8C8C8C] text-sm mt-2 leading-relaxed">
          Check the details before confirming. This will create your loan on-chain via{' '}
          <span className="font-mono text-[#F5A623]">createLoan()</span>.
        </p>
      </div>

      {/* Loan summary card */}
      <div className="bg-[#0A0F1E] border border-[#1E2A3A] rounded-2xl p-6 space-y-0">
        {[
          { l: 'Loan Amount',  v: `$${amount}.00`,      c: '#F5A623' },
          { l: 'Loan Path',    v: 'Trust-Only',          c: '#FAFAF8' },
          { l: 'Term',         v: '30 days',             c: '#FAFAF8' },
          { l: 'APR',          v: '0% (Demo)',           c: '#1D9E75' },
          { l: 'Collateral',   v: 'None',                c: '#1D9E75' },
          { l: 'Repayment',    v: `$${amount}.00 flat`, c: '#FAFAF8' },
        ].map(({ l, v, c }, i) => (
          <div key={i} className="flex justify-between py-3.5 border-b border-[#1E2A3A] last:border-0">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#8C8C8C]">{l}</span>
            <span className="font-black text-sm font-cabinet" style={{ color: c }}>{v}</span>
          </div>
        ))}
      </div>

      {/* blockchain flow visual */}
      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
        {[
          { l: 'Supabase',    active: phase === 'pending',    done: ['blockchain','done'].includes(phase), icon: '🗄️' },
          { l: 'Blockchain',  active: phase === 'blockchain', done: phase === 'done',                      icon: '⛓️' },
          { l: 'Active',      active: false,                  done: phase === 'done',                      icon: '✅' },
        ].map((s, i) => (
          <React.Fragment key={i}>
            <div className={`flex flex-col items-center gap-1 transition-all duration-500
              ${s.done ? 'opacity-100' : s.active ? 'opacity-100' : 'opacity-30'}`}>
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm
                ${s.done ? 'border-[#1D9E75] bg-[#1D9E75]/10'
                         : s.active ? 'border-[#F5A623] bg-[#F5A623]/10' : 'border-[#1E2A3A]'}`}>
                {s.active
                  ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#F5A623" strokeWidth="2" strokeDasharray="30 15" strokeLinecap="round"/></svg>
                  : s.icon}
              </div>
              <span className={s.done ? 'text-[#1D9E75]' : s.active ? 'text-[#F5A623]' : 'text-[#8C8C8C]'}>{s.l}</span>
            </div>
            {i < 2 && <div className={`flex-1 h-px transition-all duration-500 ${s.done ? 'bg-[#1D9E75]' : 'bg-[#1E2A3A]'}`} />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.button key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            id="btn-confirm-loan" onClick={confirm}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                       text-black font-black text-[13px] uppercase tracking-widest
                       hover:opacity-90 active:scale-[0.98] transition-all
                       shadow-[0_0_30px_rgba(245,166,35,0.25)]">
            ⚡ Confirm & Draw Funds
          </motion.button>
        )}

        {['pending','blockchain'].includes(phase) && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="w-full py-5 rounded-2xl border border-[#1E2A3A] text-center
                       text-[11px] font-black uppercase tracking-widest text-[#8C8C8C]">
            {phase === 'pending' ? 'Writing to Supabase…' : 'Awaiting blockchain confirmation…'}
          </motion.div>
        )}

        {phase === 'done' && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="w-full py-4 rounded-2xl bg-[#1D9E75]/10 border border-[#1D9E75]/30
                       text-center text-[11px] font-black uppercase tracking-widest text-[#1D9E75]">
            ✓ Loan Activated
          </motion.div>
        )}

        {phase === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="py-4 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30
                            text-center text-[11px] font-black uppercase tracking-widest text-[#EF4444] px-4">
              {error}
            </div>
            <button onClick={() => setPhase('idle')}
              className="w-full py-4 rounded-2xl border border-[#F5A623]/40 text-[#F5A623]
                         font-black text-[11px] uppercase tracking-widest hover:bg-[#F5A623] hover:text-black transition-all">
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════ STEP 3 — Success ════════════ */
function StepSuccess({ loan, txHash, navigate }) {
  return (
    <div className="space-y-7 text-center">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#1D9E75] mb-2">Loan Active</p>
        <h2 className="font-cabinet font-black text-3xl text-[#FAFAF8] tracking-tight">Money on Its Way! 🎉</h2>
        <p className="text-[#8C8C8C] text-sm mt-2 leading-relaxed">
          Your ${loan?.amount ?? '—'} loan is active. Repay it on time to grow your Trust Score.
        </p>
      </div>

      {/* amount celebration */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="w-32 h-32 rounded-full bg-gradient-to-br from-[#1D9E75] to-[#13C296]
                   flex items-center justify-center mx-auto
                   shadow-[0_0_50px_rgba(29,158,117,0.3)]"
      >
        <div>
          <p className="text-3xl font-black font-cabinet text-white">${loan?.amount ?? '—'}</p>
          <p className="text-[9px] font-black text-white/70 uppercase tracking-widest">Active</p>
        </div>
      </motion.div>

      {/* loan details */}
      <div className="bg-[#0A0F1E] border border-[#1E2A3A] rounded-2xl p-5 text-left space-y-0">
        {[
          { l: 'Status',    v: 'ACTIVE',                               c: '#1D9E75' },
          { l: 'Amount',    v: `$${loan?.amount ?? '—'}`,    c: '#FAFAF8' },
          { l: 'Due In',    v: '30 days',                              c: '#F59E0B' },
          { l: 'Loan ID',   v: loan?.id?.slice(0, 8) + '…' ?? '—',    c: '#8C8C8C' },
        ].map(({ l, v, c }, i) => (
          <div key={i} className="flex justify-between py-3 border-b border-[#1E2A3A] last:border-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">{l}</span>
            <span className="font-black text-sm font-mono" style={{ color: c }}>{v}</span>
          </div>
        ))}
      </div>

      {/* tx hash */}
      {txHash && (
        <div className="px-4 py-3 rounded-xl bg-[#0A0F1E] border border-[#1E2A3A] text-left">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#8C8C8C] mb-1">Tx Hash</p>
          <p className="font-mono text-[10px] text-[#F5A623] break-all">{txHash}</p>
        </div>
      )}

      <button
        id="btn-goto-dashboard"
        onClick={() => navigate('/dashboard')}
        className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                   text-black font-black text-[13px] uppercase tracking-widest
                   hover:opacity-90 active:scale-[0.98] transition-all
                   shadow-[0_0_40px_rgba(245,166,35,0.3)]"
      >
        View My Dashboard →
      </button>
    </div>
  );
}

/* ════════════ ROOT ════════════ */
export default function LoanFlow() {
  const navigate = useNavigate();
  const wallet   = sessionStorage.getItem('tl_wallet') || '';
  const [step, setStep]     = useState(0);
  const [path, setPath]     = useState('trust');
  const [loan, setLoan]     = useState(null);
  const [txHash, setTxHash] = useState('');
  const [user, setUser]     = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    if (!wallet) { setLoadingUser(false); return; }
    getUser(wallet).then(u => { setUser(u); setLoadingUser(false); });
  }, [wallet]);

  const score  = user?.trust_score ?? 30;
  const tier   = getTier(score);
  const limit  = TIER_LIMITS[tier];
  const tierColor = TIER_COLORS[tier];
  const next   = nextTierInfo(score);
  const STEP_LABELS = ['Select Path', 'Confirm', 'Success'];

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center
                    relative overflow-hidden py-12 px-4">
      {/* ambient */}
      <motion.div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none z-0"
        style={{ background: 'rgba(245,166,35,0.06)' }}
        animate={{ y: [0, -15, 0] }} transition={{ duration: 8, repeat: Infinity }} />

      {/* back */}
      <button onClick={() => navigate('/dashboard')}
        className="absolute top-8 left-8 text-[#8C8C8C] text-[11px] font-black uppercase tracking-widest
                   hover:text-[#F5A623] transition-colors">
        ← Dashboard
      </button>

      {/* Trust growth bar */}
      {!loadingUser && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="w-full max-w-md z-10 mb-2">
          <div className="flex items-center justify-between px-5 py-3 rounded-2xl
                          bg-[#111827] border border-[#1E2A3A]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center
                              font-black text-[11px] font-cabinet"
                style={{ borderColor: tierColor, color: tierColor }}>
                {score}
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest"
                   style={{ color: tierColor }}>{tier} Tier</p>
                <p className="text-[#FAFAF8] font-black text-sm">Limit: ${limit.toLocaleString()}</p>
              </div>
            </div>
            {next && (
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#8C8C8C]">
                  Next: {next.tier}
                </p>
                <p className="text-[#F5A623] font-black text-xs">
                  {next.ptsNeeded} pts → ${next.limit.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* step bar */}
      <div className="flex items-center gap-2 mb-10 z-10 w-full max-w-md">
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1">
              <StepDot n={i + 1} active={step === i} done={step > i} />
              <span className={`text-[9px] font-black uppercase tracking-widest hidden sm:block
                ${step === i ? 'text-[#F5A623]' : step > i ? 'text-[#1D9E75]' : 'text-[#8C8C8C]'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-px transition-colors duration-500
                ${step > i ? 'bg-[#1D9E75]' : 'bg-[#1E2A3A]'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* card */}
      <div className="w-full max-w-md z-10">
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-3xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <StepSelectPath onNext={(p) => { setPath(p); setStep(1); }}
                  limit={limit} tier={tier} tierColor={tierColor} />
              </motion.div>
            )}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <StepConfirm
                  wallet={wallet}
                  amount={limit}
                  onSuccess={(activeLoan, hash) => {
                    setLoan(activeLoan);
                    setTxHash(hash);
                    setStep(2);
                  }}
                />
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <StepSuccess loan={loan} txHash={txHash} navigate={navigate} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
