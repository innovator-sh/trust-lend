/**
 * NetworkGuard.jsx
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';

export default function NetworkGuard({ children }) {
  const { isConnected, isSupported, chainId, switchNetwork } = useWallet();

  if (!isConnected || isSupported) return children;

  return (
    <AnimatePresence>
      <motion.div
        key="network-guard"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center px-6 relative overflow-hidden"
      >
        <div className="w-full max-w-md z-10 text-center space-y-8">
          <div className="w-24 h-24 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center mx-auto">
            <span className="text-4xl">⚠️</span>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#EF4444] mb-2">Wrong Network</p>
            <h1 className="font-cabinet font-black text-2xl text-[#FAFAF8] tracking-tight">
              Switch to TrustLend Local or Polygon Amoy
            </h1>
            <p className="text-[#8C8C8C] text-sm mt-3 leading-relaxed">
              You're currently on chainID <span className="font-mono text-[#F5A623]">{chainId}</span>.
              Please connect to a supported network to continue.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <motion.button
              onClick={() => switchNetwork(31337)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#F5A623] to-[#D4AF37] text-black font-black text-[12px] uppercase tracking-widest"
            >
              Switch to Local (31337) →
            </motion.button>

            <motion.button
              onClick={() => switchNetwork(80002)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-xl border border-[#1E2A3A] bg-[#111827] text-[#FAFAF8] font-black text-[12px] uppercase tracking-widest"
            >
              Switch to Amoy (80002) →
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
