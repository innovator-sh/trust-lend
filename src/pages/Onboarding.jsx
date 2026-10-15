import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getUser, updateUser } from '../lib/supabase';

/* ───────────────────────── helpers ───────────────────────── */
const shortAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

function mockWalletScan(address) {
  return {
    scanned_at: new Date().toISOString(),
    tx_count: rand(3, 48),
    wallet_age_days: rand(30, 800),
    defi_interactions: rand(0, 14),
    nft_holdings: rand(0, 6),
    risk_flag: 'CLEAN',
    chain: 'ethereum',
  };
}

/* ───────────────────────── tiny atoms ───────────────────────── */
function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">
        {label}{required && <span className="text-[#EF4444] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full bg-[#0A0F1E] border border-[#1E2A3A] rounded-xl px-4 py-3.5 text-[#FAFAF8] ' +
  'font-bold text-sm placeholder-[#8C8C8C]/60 focus:outline-none focus:border-[#F5A623]/50 transition-colors';

function TextInput({ value, onChange, placeholder, type = 'text', readOnly = false }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`${inputCls} ${readOnly ? 'opacity-50 cursor-default' : ''}`}
    />
  );
}

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

const STEP_LABELS = ['Scan', 'Trust Score', 'Profile', 'First Action'];

/* ═══════════════════════ STEP 1 – Wallet Scan ═══════════════════════ */
function StepScan({ wallet, onNext, setSnapshot }) {
  const [status, setStatus] = useState('idle');
  const [snap, setSnap]     = useState(null);

  const runScan = async () => {
    setStatus('scanning');
    await new Promise(r => setTimeout(r, 2400));
    const data = mockWalletScan(wallet);
    setSnap(data);
    setSnapshot(data);
    setStatus('done');
  };

  return (
    <div className="space-y-7">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F5A623] mb-2">Step 1 of 4</p>
        <h2 className="font-cabinet font-black text-3xl text-[#FAFAF8] tracking-tight">Wallet Intelligence Scan</h2>
        <p className="text-[#8C8C8C] text-sm mt-2 leading-relaxed">
          We read your on-chain history to build an initial risk portrait.
          Read-only — no gas, no transactions.
        </p>
      </div>

      {/* wallet pill */}
      <div className="flex items-center gap-3 px-5 py-4 bg-[#0A0F1E] rounded-2xl border border-[#1E2A3A]">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F5A623] to-[#D4AF37]
                        flex items-center justify-center text-black font-black font-cabinet text-sm">
          {wallet ? wallet[2]?.toUpperCase() : '?'}
        </div>
        <div>
          <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest">Connected Wallet</p>
          <p className="text-[#FAFAF8] font-mono font-bold text-sm">{shortAddr(wallet)}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#1D9E75] animate-pulse" />
          <span className="text-[9px] font-black text-[#1D9E75] uppercase tracking-widest">Live</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.button key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            id="btn-run-scan" onClick={runScan}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                       text-black font-black text-[13px] uppercase tracking-widest
                       hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(245,166,35,0.2)]">
            Begin Wallet Scan →
          </motion.button>
        )}

        {status === 'scanning' && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-4 py-2">
            {['Reading transaction history…', 'Detecting DeFi interactions…', 'Running risk analysis…'].map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.65 }}
                className="flex items-center gap-3 text-[12px] text-[#8C8C8C] font-bold">
                <svg className="animate-spin w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#F5A623" strokeWidth="2" strokeDasharray="40 20" strokeLinecap="round" />
                </svg>
                {msg}
              </motion.div>
            ))}
          </motion.div>
        )}

        {status === 'done' && snap && (
          <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#0A0F1E] rounded-2xl border border-[#1E2A3A] p-6 space-y-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] mb-4">Scan Results</p>
            {[
              { l: 'Transactions',       v: snap.tx_count,              c: '#FAFAF8' },
              { l: 'Wallet Age',         v: `${snap.wallet_age_days}d`, c: '#FAFAF8' },
              { l: 'DeFi Interactions',  v: snap.defi_interactions,     c: '#FAFAF8' },
              { l: 'NFT Holdings',       v: snap.nft_holdings,          c: '#FAFAF8' },
              { l: 'Risk Assessment',    v: snap.risk_flag,             c: '#1D9E75' },
              { l: 'Network',            v: 'Ethereum',                 c: '#FAFAF8' },
            ].map(({ l, v, c }, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}
                className="flex justify-between py-3 border-b border-[#1E2A3A] last:border-0">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#8C8C8C]">{l}</span>
                <span className="font-black text-sm font-cabinet" style={{ color: c }}>{v}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {status === 'done' && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onNext}
          className="w-full py-5 rounded-2xl border border-[#1D9E75] text-[#1D9E75]
                     font-black text-[13px] uppercase tracking-widest
                     hover:bg-[#1D9E75] hover:text-black transition-all duration-300 active:scale-[0.98]">
          Continue to Trust Score →
        </motion.button>
      )}
    </div>
  );
}

/* ═══════════════════════ STEP 2 – Trust Score ═══════════════════════ */
function StepTrustScore({ wallet, snapshot, onNext }) {
  const [phase, setPhase] = useState('computing');
  const score = 30;

  useEffect(() => { const t = setTimeout(() => setPhase('revealed'), 2000); return () => clearTimeout(t); }, []);

  const save = async () => {
    setPhase('saving');
    await updateUser(wallet, { trust_score: score, tier: 'Entry', wallet_snapshot: snapshot });
    setPhase('saved');
  };

  return (
    <div className="space-y-7">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F5A623] mb-2">Step 2 of 4</p>
        <h2 className="font-cabinet font-black text-3xl text-[#FAFAF8] tracking-tight">Your Trust Score</h2>
        <p className="text-[#8C8C8C] text-sm mt-2 leading-relaxed">
          All new members start at <strong className="text-[#F5A623]">30</strong> — your blank slate.
          Vouches, repayments, and on-chain activity build it higher.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'computing' && (
          <motion.div key="computing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-10">
            <svg className="animate-spin w-12 h-12" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#F5A623" strokeWidth="2.5" strokeDasharray="45 20" strokeLinecap="round" />
            </svg>
            <p className="text-[12px] font-black uppercase tracking-widest text-[#8C8C8C]">Computing initial score…</p>
          </motion.div>
        )}

        {['revealed', 'saving', 'saved'].includes(phase) && (
          <motion.div key="reveal" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-6">
            {/* ring */}
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.8" fill="transparent" stroke="#1E2A3A" strokeWidth="3" />
                <motion.circle cx="18" cy="18" r="15.8" fill="transparent" stroke="#F5A623" strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: '0 100' }}
                  animate={{ strokeDasharray: '30 100' }}
                  transition={{ duration: 1.4, ease: 'easeOut' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black font-cabinet text-[#FAFAF8]">{score}</span>
                <span className="text-[10px] text-[#8C8C8C] font-black uppercase tracking-widest">/ 100</span>
              </div>
            </div>

            <div className="px-6 py-2.5 rounded-full border border-[#F5A623]/30 bg-[#F5A623]/8">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#F5A623]">Entry Tier</span>
            </div>

            {/* growth tips */}
            <div className="w-full bg-[#0A0F1E] rounded-2xl border border-[#1E2A3A] p-5 space-y-3">
              <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest mb-3">How to grow your score</p>
              {[
                ['Get vouched by peers', '+10 pts', '#1D9E75'],
                ['Repay on time', '+5 pts', '#1D9E75'],
                ['Maintain repayment streak', '+3 pts', '#F5A623'],
                ['Join a group pool', '+8 pts', '#F5A623'],
                ['Complete KYC', '+5 pts', '#F5A623'],
              ].map(([l, p, c], i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-[#FAFAF8] font-bold">{l}</span>
                  <span className="text-[11px] font-black" style={{ color: c }}>{p}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'revealed' && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={save}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                     text-black font-black text-[13px] uppercase tracking-widest
                     hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(245,166,35,0.2)]">
          Lock In My Score →
        </motion.button>
      )}
      {phase === 'saving' && (
        <p className="text-center text-[11px] font-black text-[#8C8C8C] uppercase tracking-widest animate-pulse">
          Saving to Supabase…
        </p>
      )}
      {phase === 'saved' && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onNext}
          className="w-full py-5 rounded-2xl border border-[#1D9E75] text-[#1D9E75]
                     font-black text-[13px] uppercase tracking-widest
                     hover:bg-[#1D9E75] hover:text-black transition-all duration-300 active:scale-[0.98]">
          Continue to Profile →
        </motion.button>
      )}
    </div>
  );
}

/* ═══════════════════════ STEP 3 – Profile + Role ═══════════════════════ */
function StepProfile({ wallet, user, onNext, setRole: setParentRole }) {
  const [form, setForm] = useState({
    display_name: '',
    residential_address: '',
    phone: '',
    email: '',
    monthly_income: '',
    kyc_aadhar: '',
    kyc_pan: '',
  });
  const [role, setRole]     = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.display_name.trim())  e.display_name = 'Required';
    if (!form.phone.match(/^\d{10}$/)) e.phone = '10-digit number required';
    if (form.email && !form.email.includes('@')) e.email = 'Invalid email';
    if (!role) e.role = 'Please select a role';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const kycStatus = (form.kyc_aadhar || form.kyc_pan) ? 'submitted' : 'pending';
    await updateUser(wallet, {
      display_name: form.display_name.trim(),
      residential_address: form.residential_address.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      monthly_income: form.monthly_income ? parseFloat(form.monthly_income) : null,
      kyc_aadhar: form.kyc_aadhar.trim() || null,
      kyc_pan: form.kyc_pan.trim().toUpperCase() || null,
      kyc_status: kycStatus,
      role,
    });
    setParentRole(role);
    setSaving(false);
    onNext();
  };

  const err = key => errors[key] && (
    <p className="text-[10px] text-[#EF4444] font-bold mt-1">{errors[key]}</p>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F5A623] mb-2">Step 3 of 4</p>
        <h2 className="font-cabinet font-black text-3xl text-[#FAFAF8] tracking-tight">Your Profile</h2>
        <p className="text-[#8C8C8C] text-sm mt-2 leading-relaxed">
          Build your decentralised identity. KYC fields are encrypted and stored securely.
        </p>
      </div>

      {/* Auto-generated IDs — read-only */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">DID</label>
          <div className="px-4 py-3.5 rounded-xl border border-[#1E2A3A] bg-[#0A0F1E]/60 text-[#8C8C8C] font-mono text-[10px] truncate">
            {user?.did ? `${user.did.slice(0, 22)}…` : 'Generating…'}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">UID</label>
          <div className="px-4 py-3.5 rounded-xl border border-[#1E2A3A] bg-[#0A0F1E]/60 text-[#F5A623] font-mono text-sm font-black">
            {user?.uid || 'TL-…'}
          </div>
        </div>
      </div>

      {/* Wallet address — read-only */}
      <Field label="Wallet Address">
        <TextInput value={shortAddr(wallet)} onChange={() => {}} readOnly />
      </Field>

      {/* Personal Info */}
      <Field label="Full Name" required>
        <TextInput value={form.display_name} onChange={set('display_name')} placeholder="Kunal Sharma" />
        {err('display_name')}
      </Field>

      <Field label="Residential Address">
        <textarea
          value={form.residential_address}
          onChange={set('residential_address')}
          placeholder="123, MG Road, Bengaluru, Karnataka 560001"
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" required>
          <TextInput value={form.phone} onChange={set('phone')} placeholder="9876543210" type="tel" />
          {err('phone')}
        </Field>
        <Field label="Email">
          <TextInput value={form.email} onChange={set('email')} placeholder="kunal@email.com" type="email" />
          {err('email')}
        </Field>
      </div>

      <Field label="Monthly Income (₹)">
        <TextInput value={form.monthly_income} onChange={set('monthly_income')} placeholder="35000" type="number" />
      </Field>

      {/* KYC */}
      <div className="space-y-3 pt-2 border-t border-[#1E2A3A]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] pt-1">
          KYC Documents <span className="text-[#F5A623]">(optional — unlocks higher limits)</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Aadhaar Number">
            <TextInput value={form.kyc_aadhar} onChange={set('kyc_aadhar')} placeholder="XXXX XXXX XXXX" />
          </Field>
          <Field label="PAN Number">
            <TextInput value={form.kyc_pan} onChange={set('kyc_pan')} placeholder="ABCDE1234F" />
          </Field>
        </div>
        {(form.kyc_aadhar || form.kyc_pan) && (
          <p className="text-[10px] text-[#1D9E75] font-black">✓ KYC will be submitted for verification</p>
        )}
      </div>

      {/* Role selection */}
      <div className="space-y-3 pt-2 border-t border-[#1E2A3A]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] pt-1">
          I'm joining to… <span className="text-[#EF4444]">*</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'borrower', icon: '💸', label: 'Borrow',      desc: 'Access credit' },
            { id: 'lender',   icon: '📈', label: 'Lend & Earn', desc: 'Deploy capital' },
            { id: 'both',     icon: '⚡', label: 'Both',         desc: 'Borrow & lend' },
          ].map(r => (
            <button key={r.id} id={`role-${r.id}`} onClick={() => setRole(r.id)}
              className={`p-4 rounded-xl border text-left transition-all duration-300
                ${role === r.id
                  ? 'border-[#F5A623] bg-[#F5A623]/8 shadow-[0_0_15px_rgba(245,166,35,0.15)]'
                  : 'border-[#1E2A3A] hover:border-[#1E2A3A]/80'}`}>
              <div className="text-xl mb-2">{r.icon}</div>
              <p className="text-[#FAFAF8] font-black text-xs font-cabinet">{r.label}</p>
              <p className="text-[#8C8C8C] text-[9px] mt-0.5 leading-snug">{r.desc}</p>
            </button>
          ))}
        </div>
        {err('role')}
      </div>

      <button
        disabled={saving}
        onClick={save}
        className={`w-full py-5 rounded-2xl font-black text-[13px] uppercase tracking-widest
                   transition-all duration-300 active:scale-[0.98]
                   ${!saving
                     ? 'bg-gradient-to-r from-[#F5A623] to-[#D4AF37] text-black hover:opacity-90 shadow-[0_0_30px_rgba(245,166,35,0.2)]'
                     : 'bg-[#1E2A3A] text-[#8C8C8C] cursor-not-allowed'}`}>
        {saving ? 'Saving Profile…' : 'Save & Continue →'}
      </button>
    </div>
  );
}

/* ═══════════════════════ STEP 4 – First Action ═══════════════════════ */
function StepFirstAction({ wallet, role, navigate }) {
  const isBorrower = role === 'borrower' || role === 'both';
  const isLender   = role === 'lender'   || role === 'both';

  return (
    <div className="space-y-7">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F5A623] mb-2">Step 4 of 4</p>
        <h2 className="font-cabinet font-black text-3xl text-[#FAFAF8] tracking-tight">Your First Action</h2>
        <p className="text-[#8C8C8C] text-sm mt-2 leading-relaxed">
          You're in. Take your first step on TrustLend — or head straight to your dashboard.
        </p>
      </div>

      {/* Trust score card */}
      <div className="flex items-center gap-4 p-5 bg-[#0A0F1E] rounded-2xl border border-[#1E2A3A]">
        <div className="w-14 h-14 rounded-full border-2 border-[#F5A623]/60
                        flex items-center justify-center font-black font-cabinet text-[#F5A623] text-xl">
          30
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">Trust Score · Entry Tier</p>
          <p className="text-[#FAFAF8] font-bold text-sm mt-0.5">Borrow limit: <span className="text-[#F5A623] font-black">$10.00</span></p>
        </div>
        <div className="ml-auto">
          <span className="px-3 py-1 rounded-full bg-[#F5A623]/10 border border-[#F5A623]/20
                           text-[9px] font-black text-[#F5A623] uppercase tracking-widest">Entry</span>
        </div>
      </div>

      {/* Borrower actions */}
      {isBorrower && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">Borrower Actions</p>
          <button id="action-borrow-10"
            onClick={async () => {
              await updateUser(wallet, { onboarding_done: true });
              navigate('/loan-flow');
            }}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                       text-black font-black text-[13px] uppercase tracking-widest
                       hover:opacity-90 active:scale-[0.98] transition-all
                       shadow-[0_0_25px_rgba(245,166,35,0.25)] flex items-center justify-between">
            <span>💸 Borrow My First $10</span>
            <span className="text-black/60 text-[11px]">No collateral →</span>
          </button>
          <button id="action-invite-vouchers"
            onClick={async () => {
              await updateUser(wallet, { onboarding_done: true });
              navigate('/invite-vouch');
            }}
            className="w-full py-4 px-6 rounded-2xl border border-[#1E2A3A]
                       text-[#FAFAF8] font-black text-[13px] uppercase tracking-widest
                       hover:border-[#F5A623]/40 transition-all duration-300 active:scale-[0.98]
                       flex items-center justify-between">
            <span>🤝 Invite Vouchers First</span>
            <span className="text-[#8C8C8C] text-[11px]">Grows limit →</span>
          </button>
        </div>
      )}

      {/* Lender actions */}
      {isLender && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">Lender Actions</p>
          <button id="action-deposit"
            onClick={async () => {
              await updateUser(wallet, { onboarding_done: true });
              navigate('/marketplace');
            }}
            className="w-full py-4 px-6 rounded-2xl bg-[#1D9E75]
                       text-white font-black text-[13px] uppercase tracking-widest
                       hover:bg-[#13C296] active:scale-[0.98] transition-all
                       shadow-[0_0_25px_rgba(29,158,117,0.2)] flex items-center justify-between">
            <span>📈 Explore Lending</span>
            <span className="text-white/60 text-[11px]">Earn yield →</span>
          </button>
        </div>
      )}

      {/* Skip to dashboard */}
      <div className="pt-2 border-t border-[#1E2A3A]">
        <button id="btn-enter-dashboard"
          onClick={async () => {
            await updateUser(wallet, { onboarding_done: true });
            navigate('/dashboard');
          }}
          className="w-full py-4 rounded-2xl border border-[#1E2A3A] text-[#8C8C8C]
                     font-black text-[12px] uppercase tracking-widest
                     hover:border-[#F5A623]/30 hover:text-[#FAFAF8] transition-all duration-300">
          Skip → Enter Dashboard
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════ ROOT COMPONENT ═══════════════════════ */
export default function Onboarding() {
  const navigate = useNavigate();
  const wallet   = sessionStorage.getItem('tl_wallet') || '';
  const [step, setStep]       = useState(0);
  const [snapshot, setSnapshot] = useState(null);
  const [role, setRole]       = useState('');
  const [user, setUser]       = useState(null);

  // redirect if no wallet
  useEffect(() => {
    if (!wallet) { navigate('/connect', { replace: true }); return; }
    import('../lib/supabase').then(({ getUser }) =>
      getUser(wallet).then(u => {
        if (u) {
          setUser(u);
          // already onboarded → skip to dashboard
          if (u.onboarding_done) navigate('/dashboard', { replace: true });
        }
      })
    );
  }, [wallet]);

  const next = () => setStep(s => s + 1);

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center
                    relative overflow-y-auto py-12 px-4">
      {/* ambient */}
      <motion.div
        className="fixed top-[-5%] left-[-5%] w-[550px] h-[550px] rounded-full blur-3xl pointer-events-none z-0"
        style={{ background: 'rgba(245,166,35,0.06)' }}
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 9, repeat: Infinity }}
      />

      {/* step bar */}
      <div className="flex items-center gap-2 mb-10 z-10 w-full max-w-md">
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <StepDot n={i + 1} active={step === i} done={step > i} />
              <span className={`text-[8px] font-black uppercase tracking-widest hidden sm:block whitespace-nowrap
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
                <StepScan wallet={wallet} onNext={next} setSnapshot={setSnapshot} />
              </motion.div>
            )}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <StepTrustScore wallet={wallet} snapshot={snapshot} onNext={next} />
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <StepProfile wallet={wallet} user={user} onNext={next} setRole={setRole} />
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <StepFirstAction wallet={wallet} role={role} navigate={navigate} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
