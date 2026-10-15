import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const DemoContext = createContext();

export function DemoProvider({ children }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoStateOverrides, setDemoStateOverrides] = useState(null);

  const initializeDemoWallets = () => {
    // Sets borrower score to 68, pool balance to 8,000 TRUST (demo spec)
    setDemoStateOverrides({
      trustScore: 68,
      poolLiquidity: 8000,
      vouchers: [
        { voucher: "0x123...abc", amount: 10 },
        { voucher: "0x456...def", amount: 15 },
        { voucher: "0x789...ghi", amount: 5 },
      ],
      userLoan: null // Initial state is no active loan
    });
    toast.success("Demo State Initialized (Starting Condition: 68 Score, 8k Liquidity)");
  };

  const simulateTx = async (realTxPromise) => {
    if (!isDemoMode) {
      return realTxPromise;
    }
    // Fire real transaction in background but swallow errors so demo doesn't break
    realTxPromise.catch(e => console.warn("Background real tx failed (demo mode):", e));

    // Return instant success after 1.5s
    await new Promise(r => setTimeout(r, 1500));
    return {
      hash: "DEMO_TX_" + Math.random().toString(36).substring(7),
      wait: async () => true // mock receipt
    };
  };

  return (
    <DemoContext.Provider value={{ 
        isDemoMode, setIsDemoMode, demoStateOverrides, initializeDemoWallets, simulateTx 
    }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
