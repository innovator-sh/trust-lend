import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { upsertUser } from '../lib/supabase';

/* ── Ethereum / MetaMask helpers ── */
async function connectMetaMask() {
  if (!window.ethereum) throw new Error('MetaMask not installed');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
}

async function signSIWE(address) {
  const domain = window.location.host;
  const nonce = Math.random().toString(36).slice(2);
  const issuedAt = new Date().toISOString();
  const message =
    `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n` +
    `Welcome to TrustLend! Signing this message creates your on-chain identity.\n\n` +
    `URI: ${window.location.origin}\nVersion: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
  const signature = await window.ethereum.request({
    method: 'personal_sign',
    params: [message, address],
  });
  return { message, signature, nonce };
}

/* ── tiny sub-components ── */
function Orb({ style }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none blur-3xl"
      style={style}
      animate={{ y: [0, -20, 0], opacity: [0.1, 0.25, 0.1] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function Step({ n, label, active, done }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-8 h-8 rounded-full border flex items-center justify-center
        text-[11px] font-black transition-all duration-500
        ${done  ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
               : active ? 'border-[#F5A623] text-[#F5A623]'
               : 'border-[#1E2A3A] text-[#8C8C8C]'}`}>
        {done ? '✓' : n}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-widest
        ${active ? 'text-[#F5A623]' : done ? 'text-[#1D9E75]' : 'text-[#8C8C8C]'}`}>
        {label}
      </span>
    </div>
  );
}

const STEPS = ['Connect', 'Sign', 'Verify', 'Done'];

export default function ConnectWallet() {
  const navigate = useNavigate();
  const [phase, setPhase]     = useState(0); // 0=idle, 1=connecting, 2=signing, 3=verifying, 4=done, -1=error
  const [error, setError]     = useState('');
  const [wallet, setWallet]   = useState('');

  const handleConnect = async () => {
    setError('');
    try {
      // Phase 1 – connect
      setPhase(1);
      const address = await connectMetaMask();
      setWallet(address);

      // Phase 2 – sign SIWE message
      setPhase(2);
      const { signature } = await signSIWE(address);
      if (!signature) throw new Error('Signature cancelled');

      // Phase 3 – write to Supabase
      setPhase(3);
      await upsertUser(address);

      // persist wallet in sessionStorage so Onboarding can read it
      sessionStorage.setItem('tl_wallet', address.toLowerCase());

      // Phase 4 – done
      setPhase(4);
      await new Promise(r => setTimeout(r, 1200));
      navigate('/onboarding');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong');
      setPhase(-1);
    }
  };

  const stepsActive = [phase >= 1, phase >= 2, phase >= 3];
  const stepsDone   = [phase >= 2, phase >= 3, phase >= 4];

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* ambient */}
      <Orb style={{ top: '-10%', left: '-5%', width: 500, height: 500, background: 'rgba(245,166,35,0.10)' }} />
      <Orb style={{ bottom: '-10%', right: '-5%', width: 500, height: 500, background: 'rgba(29,158,117,0.08)' }} />

      {/* back link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 flex items-center gap-2 text-[#8C8C8C]
                   text-[11px] font-black uppercase tracking-widest hover:text-[#F5A623] transition-colors"
      >
        ← Back
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="w-full max-w-md z-10"
      >
        {/* Card */}
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-3xl p-10 shadow-2xl">
          {/* logo */}
          <div className="flex justify-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F5A623] to-[#D4AF37]
                            flex items-center justify-center text-black font-black font-cabinet text-xl">
              TL
            </div>
          </div>

          <h1 className="text-center font-cabinet font-black text-3xl text-[#FAFAF8] tracking-tight mb-2">
            Connect Your Wallet
          </h1>
          <p className="text-center text-[#8C8C8C] text-sm mb-10 leading-relaxed">
            Your wallet is your identity on TrustLend.
            One signature establishes your on-chain profile — no email, no password.
          </p>

          {/* step tracker */}
          <div className="flex items-center justify-center gap-3 mb-10">
            {STEPS.slice(0, 3).map((label, i) => (
              <React.Fragment key={i}>
                <Step n={i + 1} label={label} active={stepsActive[i]} done={stepsDone[i]} />
                {i < 2 && (
                  <div className={`flex-1 h-px transition-colors duration-500
                    ${stepsDone[i] ? 'bg-[#1D9E75]' : 'bg-[#1E2A3A]'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* main action */}
          <AnimatePresence mode="wait">
            {phase === 0 && (
              <motion.button
                key="idle"
                id="btn-connect-metamask"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={handleConnect}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                           text-black font-black text-[13px] uppercase tracking-widest
                           hover:opacity-90 active:scale-[0.98] transition-all
                           shadow-[0_0_40px_rgba(245,166,35,0.25)] flex items-center justify-center gap-3"
              >
                {/* MetaMask fox emoji stand-in */}
                <span className="text-2xl">🦊</span> Connect MetaMask
              </motion.button>
            )}

            {(phase === 1 || phase === 2 || phase === 3) && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="w-full py-5 rounded-2xl border border-[#1E2A3A]
                           flex flex-col items-center gap-3"
              >
                <svg className="animate-spin w-7 h-7" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#F5A623" strokeWidth="2.5" strokeDasharray="45 20" strokeLinecap="round" />
                </svg>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#8C8C8C]">
                  {phase === 1 ? 'Connecting to MetaMask…'
                   : phase === 2 ? 'Waiting for signature…'
                   : 'Writing identity on-chain…'}
                </p>
              </motion.div>
            )}

            {phase === 4 && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full py-5 rounded-2xl bg-[#1D9E75]/10 border border-[#1D9E75]/30
                           flex flex-col items-center gap-2"
              >
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  className="text-3xl"
                >✅</motion.div>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#1D9E75]">
                  Identity Confirmed
                </p>
                <p className="text-[10px] text-[#8C8C8C] font-mono mt-1">
                  {wallet.slice(0, 6)}…{wallet.slice(-4)}
                </p>
              </motion.div>
            )}

            {phase === -1 && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="w-full py-4 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30
                                text-center text-[11px] font-black uppercase tracking-widest text-[#EF4444] px-6">
                  {error}
                </div>
                <button
                  onClick={() => { setPhase(0); setError(''); }}
                  className="w-full py-4 rounded-2xl border border-[#F5A623]/40 text-[#F5A623]
                             font-black text-[11px] uppercase tracking-widest
                             hover:bg-[#F5A623] hover:text-black transition-all duration-300"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* metadata note */}
          <div className="mt-8 space-y-3">
            {[
              '🔒 We never store your private key',
              '⛓️ Signature is off-chain SIWE — no gas',
              '📄 Your wallet becomes your user ID',
            ].map((note, i) => (
              <p key={i} className="text-[10px] text-[#8C8C8C] flex items-start gap-2 leading-relaxed">
                <span>{note}</span>
              </p>
            ))}
          </div>
        </div>

        {/* no metamask help */}
        <p className="text-center mt-6 text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">
          No MetaMask?{' '}
          <a href="https://metamask.io" target="_blank" rel="noreferrer"
             className="text-[#F5A623] hover:underline">Install it free →</a>
        </p>
      </motion.div>
    </div>
  );
}
