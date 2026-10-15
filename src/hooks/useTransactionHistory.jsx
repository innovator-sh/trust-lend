import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';

// Mock hook pending an off-chain indexer or unified TheGraph implementation
export function useTransactionHistory() {
  const { address } = useWallet();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      // Simulate network delay
      await new Promise(r => setTimeout(r, 600));

      if (!address) {
        setTransactions([]);
        setIsLoading(false);
        return;
      }

      // Provide a blended mock transaction list for UI robustness testing
      setTransactions([
        {
          id: 'tx-101',
          type: 'Loan Drawdown',
          entity: 'Facility 0x92...f2',
          value: '$200.00',
          status: 'Verified',
          date: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
          positive: true,
          hash: '0x82...1e',
          icon: 'lucide:arrow-up-right'
        },
        {
          id: 'tx-102',
          type: 'Repayment #02',
          entity: 'Active Loan #84',
          value: '-$47.50',
          status: 'Verified',
          date: new Date(Date.now() - 1000 * 60 * 60 * 120), // 5 days ago
          positive: false,
          hash: '0x1c...4a',
          icon: 'lucide:refresh-ccw'
        },
        {
          id: 'tx-103',
          type: 'Reputation Mined',
          entity: 'Trust Network Vouch',
          value: '+12 QP',
          status: 'Verified',
          date: new Date(Date.now() - 1000 * 60 * 60 * 240), // 10 days ago
          positive: true,
          hash: '0x9a...b2',
          icon: 'lucide:award'
        },
        {
          id: 'tx-104',
          type: 'Yield Claim',
          entity: 'Agri-Credit Node',
          value: '+$4.20',
          status: 'Verified',
          date: new Date(Date.now() - 1000 * 60 * 60 * 360), // 15 days ago
          positive: true,
          hash: '0xfa...6c',
          icon: 'lucide:trending-up'
        }
      ]);
      setIsLoading(false);
    };

    fetchHistory();
  }, [address]);

  return {
    transactions,
    isLoading
  };
}
