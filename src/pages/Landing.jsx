import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

/* ─────────────── animated counter ─────────────── */
function Counter({ to, prefix = '', suffix = '', duration = 2 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = to / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= to) { setVal(to); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [to, duration]);
  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

/* ─────────────── floating orb ─────────────── */
function Orb({ x, y, size, color, delay }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none blur-3xl"
      style={{ left: x, top: y, width: size, height: size, background: color }}
      animate={{ y: [0, -30, 0], opacity: [0.15, 0.35, 0.15] }}
      transition={{ duration: 6, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

/* ─────────────── trust feature card ─────────────── */
function FeatureCard({ icon, title, desc, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -6, borderColor: 'rgba(245,166,35,0.5)' }}
      className="relative bg-[#111827] border border-[#1E2A3A] rounded-2xl p-8 overflow-hidden
                 transition-all duration-300 cursor-default group"
    >
      {/* glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F5A623]/5 to-transparent opacity-0
                      group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
      <div className="text-4xl mb-5">{icon}</div>
      <h3 className="text-[#FAFAF8] font-black text-lg font-cabinet tracking-tight mb-2">{title}</h3>
      <p className="text-[#8C8C8C] text-sm leading-relaxed">{desc}</p>
    </motion.div>
  );
}

/* ─────────────── step card ─────────────── */
function StepCard({ num, title, desc, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="flex gap-6 group"
    >
      <div className="flex-shrink-0 w-12 h-12 rounded-full border border-[#F5A623]/40
                      flex items-center justify-center text-[#F5A623] font-black font-cabinet
                      text-lg group-hover:bg-[#F5A623] group-hover:text-black transition-all duration-300">
        {num}
      </div>
      <div className="pt-2">
        <h4 className="text-[#FAFAF8] font-black font-cabinet tracking-tight mb-1">{title}</h4>
        <p className="text-[#8C8C8C] text-sm leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ─────────────── main component ─────────────── */
export default function Landing() {
  const navigate = useNavigate();
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletDone, setWalletDone] = useState(false);

  const handleConnectWallet = () => {
    navigate('/connect');
  };

  const stats = [
    { label: 'Total Lent', value: 4820000, prefix: '$', suffix: '+' },
    { label: 'Active Users', value: 12400, suffix: '+' },
    { label: 'Avg Trust Score', value: 74, suffix: '/100' },
    { label: 'Default Rate', value: 0, prefix: '', suffix: '%', fixed: '0.3%' },
  ];

  const features = [
    {
      icon: '🤝',
      title: 'Vouch-Based Trust',
      desc: 'Your reputation is built by your social graph — friends and colleagues vouch for you on-chain, unlocking real credit.',
    },
    {
      icon: '⚡',
      title: 'Instant Drawdowns',
      desc: 'Once your trust score is approved, capital flows to you in seconds — no paperwork, no waiting rooms.',
    },
    {
      icon: '📈',
      title: 'Yield for Lenders',
      desc: 'Deploy idle capital into trust-verified borrowers and earn dynamic yield proportional to risk exposure.',
    },
    {
      icon: '🔒',
      title: 'On-Chain Sovereignty',
      desc: 'Every vouch, loan, and repayment is immutable on-chain. Your credit history belongs to you — forever.',
    },
    {
      icon: '🌐',
      title: 'Group Lending Pools',
      desc: 'Form micro-communities that collectively back each other — a DeFi take on traditional rotating credit.',
    },
    {
      icon: '🛡️',
      title: 'Sovereign Audit Trail',
      desc: 'A live audit view of all platform activity ensures transparency, accountability, and censorship resistance.',
    },
  ];

  const steps = [
    { num: '01', title: 'Connect Your Wallet', desc: 'Link your Web3 wallet to establish your on-chain identity — no KYC, no forms.' },
    { num: '02', title: 'Build Your Trust Score', desc: 'Request vouches from peers, repay on time, and watch your score climb automatically.' },
    { num: '03', title: 'Borrow or Lend', desc: 'Choose your role — draw capital against your trust score, or deploy funds into verified borrowers.' },
    { num: '04', title: 'Grow Your Reputation', desc: 'Every on-time payment compounds your score, unlocking larger limits and better rates.' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#FAFAF8] overflow-x-hidden relative">
      {/* ── ambient orbs ── */}
      <Orb x="10%" y="5%"  size={500} color="rgba(245,166,35,0.12)"  delay={0} />
      <Orb x="65%" y="0%"  size={600} color="rgba(29,158,117,0.10)"  delay={1.5} />
      <Orb x="80%" y="50%" size={400} color="rgba(245,166,35,0.08)"  delay={3} />
      <Orb x="5%"  y="60%" size={350} color="rgba(29,158,117,0.07)"  delay={2} />

      {/* ──────────────── NAVBAR ──────────────── */}
      <nav className="relative z-50 flex items-center justify-between px-8 md:px-16 py-6
                      border-b border-[#1E2A3A]/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F5A623] to-[#D4AF37]
                          flex items-center justify-center text-black font-black text-sm font-cabinet">
            TL
          </div>
          <span className="text-[#FAFAF8] font-black font-cabinet tracking-tight text-xl">
            Trust<span className="text-[#F5A623]">Lend</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-[#8C8C8C]">
          {['Protocol', 'For Borrowers', 'For Lenders', 'Docs'].map(l => (
            <a key={l} href="#" className="hover:text-[#F5A623] transition-colors duration-200">{l}</a>
          ))}
        </div>

        <button
          id="nav-connect-wallet"
          onClick={handleConnectWallet}
          className="px-5 py-2.5 rounded-xl border border-[#F5A623]/50 text-[#F5A623]
                     text-[11px] font-black uppercase tracking-widest
                     hover:bg-[#F5A623] hover:text-black transition-all duration-300"
        >
          Connect Wallet
        </button>
      </nav>

      {/* ──────────────── HERO ──────────────── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-24 pb-32">
        {/* pill badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 px-5 py-2 rounded-full border border-[#F5A623]/30
                     bg-[#F5A623]/5 text-[10px] font-black uppercase tracking-widest text-[#F5A623]
                     flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-pulse inline-block" />
          Decentralised Trust — Now Live on Testnet
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-cabinet font-black text-5xl md:text-7xl tracking-tight leading-[1.05]
                     max-w-4xl"
        >
          Credit Without{' '}
          <span className="bg-gradient-to-r from-[#F5A623] to-[#D4AF37] bg-clip-text text-transparent">
            Banks.
          </span>
          <br />
          Trust Without{' '}
          <span className="bg-gradient-to-r from-[#1D9E75] to-[#13C296] bg-clip-text text-transparent">
            Borders.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-8 text-[#8C8C8C] text-lg md:text-xl max-w-2xl leading-relaxed"
        >
          TrustLend is a peer-to-peer lending protocol where your reputation — vouched by your
          community on-chain — is your collateral. No banks, no credit bureaus.{' '}
          <span className="text-[#FAFAF8] font-semibold">Just trust.</span>
        </motion.p>

        {/* CTA BUTTONS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-12 flex flex-col sm:flex-row gap-4"
        >
          <button
            id="cta-start-borrowing"
            onClick={() => navigate('/connect')}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                       text-black font-black text-[13px] uppercase tracking-widest
                       hover:opacity-90 active:scale-[0.98] transition-all duration-200
                       shadow-[0_0_40px_rgba(245,166,35,0.3)]"
          >
            Start Borrowing
          </button>

          <button
            id="cta-start-lending"
            onClick={() => navigate('/connect')}
            className="px-8 py-4 rounded-xl border border-[#1D9E75]/60 text-[#1D9E75]
                       font-black text-[13px] uppercase tracking-widest
                       hover:bg-[#1D9E75] hover:text-black transition-all duration-300
                       active:scale-[0.98]"
          >
            Start Lending
          </button>

          <button
            id="cta-connect-wallet"
            onClick={handleConnectWallet}
            disabled={walletConnecting}
            className="px-8 py-4 rounded-xl border border-[#1E2A3A] text-[#8C8C8C]
                       font-black text-[13px] uppercase tracking-widest
                       hover:border-[#F5A623]/40 hover:text-[#FAFAF8]
                       transition-all duration-300 active:scale-[0.98] relative overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {walletConnecting && !walletDone ? (
                <motion.span
                  key="connecting"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#F5A623" strokeWidth="3" strokeDasharray="40 20" />
                  </svg>
                  Connecting…
                </motion.span>
              ) : walletDone ? (
                <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-[#1D9E75]">✓ Connected</motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  Connect Wallet
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.div>

        {/* scroll hint */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-20 flex flex-col items-center gap-2 text-[#8C8C8C] text-[10px]
                     uppercase tracking-widest"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-0.5 h-10 bg-gradient-to-b from-[#F5A623] to-transparent"
          />
          Scroll to explore
        </motion.div>
      </section>

      {/* ──────────────── STATS BAND ──────────────── */}
      <section className="relative z-10 border-y border-[#1E2A3A] bg-[#111827]/60 backdrop-blur-sm py-12 px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <p className="text-3xl md:text-4xl font-black font-cabinet text-[#FAFAF8] tracking-tight">
                {s.fixed ? s.fixed : <Counter to={s.value} prefix={s.prefix} suffix={s.suffix} />}
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] mt-2">
                {s.label}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ──────────────── FEATURES ──────────────── */}
      <section className="relative z-10 px-8 md:px-16 py-28 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-[#F5A623] mb-4">
            The Protocol
          </p>
          <h2 className="font-cabinet font-black text-4xl md:text-5xl tracking-tight text-[#FAFAF8]">
            Built on Trust. Powered by Peers.
          </h2>
          <p className="mt-4 text-[#8C8C8C] max-w-xl mx-auto text-base leading-relaxed">
            A complete lending operating system where your social graph becomes your balance sheet.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} delay={i * 0.08} />
          ))}
        </div>
      </section>

      {/* ──────────────── HOW IT WORKS ──────────────── */}
      <section className="relative z-10 px-8 md:px-16 py-24 bg-[#111827]/40 border-y border-[#1E2A3A]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#F5A623] mb-4">
              How It Works
            </p>
            <h2 className="font-cabinet font-black text-4xl tracking-tight text-[#FAFAF8] mb-12">
              From Stranger to<br />
              <span className="text-[#F5A623]">Trusted Participant</span>
            </h2>
            <div className="space-y-10">
              {steps.map((s, i) => (
                <StepCard key={i} {...s} delay={i * 0.1} />
              ))}
            </div>
          </div>

          {/* visual panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-[#111827] border border-[#1E2A3A] rounded-2xl p-8 space-y-5"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">
              Live Trust Score Preview
            </p>
            {/* mock score ring */}
            <div className="flex justify-center py-6">
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.8" fill="transparent" stroke="#1E2A3A" strokeWidth="3" />
                  <motion.circle
                    cx="18" cy="18" r="15.8" fill="transparent" stroke="#F5A623" strokeWidth="3"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: '0 100' }}
                    whileInView={{ strokeDasharray: '74 100' }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black font-cabinet text-[#FAFAF8]">74</span>
                  <span className="text-[9px] text-[#8C8C8C] font-black uppercase tracking-widest">/ 100</span>
                </div>
              </div>
            </div>
            {/* mock vouchers */}
            {[
              { name: 'Arnab G.', status: 'Vouched', color: '#1D9E75' },
              { name: 'Megha S.', status: 'Vouched', color: '#1D9E75' },
              { name: 'Priya K.', status: 'Pending', color: '#F59E0B' },
            ].map((v, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3
                                      bg-[#0A0F1E] rounded-xl border border-[#1E2A3A]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1E2A3A] border border-[#F5A623]/20
                                  flex items-center justify-center text-[10px] font-black text-[#F5A623]">
                    {v.name[0]}
                  </div>
                  <span className="text-sm font-bold text-[#FAFAF8]">{v.name}</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: v.color }}>{v.status}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-[#1E2A3A] flex justify-between items-center">
              <span className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-widest">Borrow Limit</span>
              <span className="text-[#F5A623] font-black font-cabinet text-xl">$200.00</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ──────────────── FOR LENDERS ──────────────── */}
      <section className="relative z-10 px-8 md:px-16 py-28 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-[#1D9E75] mb-4">For Lenders</p>
          <h2 className="font-cabinet font-black text-4xl md:text-5xl tracking-tight text-[#FAFAF8] mb-6">
            Your Capital. Working Harder.
          </h2>
          <p className="text-[#8C8C8C] max-w-xl mx-auto text-base leading-relaxed mb-12">
            Deploy funds into a curated marketplace of trust-verified borrowers. Earn dynamic yield
            while the protocol manages risk through on-chain reputation scores.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              { label: 'Avg APY', value: '18.4%', color: '#1D9E75' },
              { label: 'Risk Rating', value: 'A+', color: '#F5A623' },
              { label: 'Liquidity', value: 'Instant', color: '#FAFAF8' },
            ].map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#111827] border border-[#1E2A3A] rounded-2xl p-8
                           hover:border-[#1D9E75]/40 transition-all duration-300"
              >
                <p className="text-4xl font-black font-cabinet" style={{ color: m.color }}>{m.value}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] mt-3">{m.label}</p>
              </motion.div>
            ))}
          </div>
          <button
            id="lender-cta"
            onClick={() => navigate('/portfolio')}
            className="px-10 py-4 rounded-xl bg-[#1D9E75] text-white font-black text-[13px]
                       uppercase tracking-widest hover:bg-[#13C296] transition-all duration-300
                       active:scale-[0.98] shadow-[0_0_30px_rgba(29,158,117,0.25)]"
          >
            Explore Lending →
          </button>
        </motion.div>
      </section>

      {/* ──────────────── FINAL CTA ──────────────── */}
      <section className="relative z-10 px-8 py-24 border-t border-[#1E2A3A]
                          bg-gradient-to-b from-[#111827]/60 to-[#0A0F1E]">
        <Orb x="30%" y="20%" size={500} color="rgba(245,166,35,0.08)" delay={0} />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center relative"
        >
          <h2 className="font-cabinet font-black text-4xl md:text-6xl tracking-tight text-[#FAFAF8] mb-6">
            Ready to Build<br />
            <span className="bg-gradient-to-r from-[#F5A623] to-[#D4AF37] bg-clip-text text-transparent">
              Your Trust Score?
            </span>
          </h2>
          <p className="text-[#8C8C8C] text-lg mb-12 leading-relaxed">
            Join thousands of users building financial identity on-chain.<br />
            No bank required. No paperwork. Just your word — and your community's.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              id="final-cta-borrow"
              onClick={() => navigate('/connect')}
              className="px-10 py-4 rounded-xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37]
                         text-black font-black text-[13px] uppercase tracking-widest
                         hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_40px_rgba(245,166,35,0.3)]"
            >
              Start Borrowing
            </button>
            <button
              id="final-cta-lend"
              onClick={() => navigate('/connect')}
              className="px-10 py-4 rounded-xl border border-[#1E2A3A] text-[#FAFAF8]
                         font-black text-[13px] uppercase tracking-widest
                         hover:border-[#F5A623]/40 transition-all duration-300 active:scale-[0.98]"
            >
              Start Lending
            </button>
          </div>
          <p className="mt-8 text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">
            No KYC · No Collateral · 100% On-Chain
          </p>
        </motion.div>
      </section>

      {/* ──────────────── FOOTER ──────────────── */}
      <footer className="relative z-10 border-t border-[#1E2A3A] px-8 md:px-16 py-10
                         flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F5A623] to-[#D4AF37]
                          flex items-center justify-center text-black font-black text-[10px]">TL</div>
          <span className="text-[#8C8C8C] text-[11px] font-bold">
            TrustLend Protocol · Hackathon Build 2026
          </span>
        </div>
        <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-[#8C8C8C]">
          {['Protocol', 'Docs', 'Audit', 'GitHub'].map(l => (
            <a key={l} href="#" className="hover:text-[#F5A623] transition-colors">{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
