import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { ADDRESSES } from '../contracts/addresses';
import LendingPoolABI from '../contracts/LendingPool.json';

// Read-only RPC endpoints, so the public pages need no wallet.
const PUBLIC_RPC = {
  31337: 'http://127.0.0.1:8545',
  80002: 'https://rpc-amoy.polygon.technology',
};

const TIMEOUT_MS = 6000;

const withTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), TIMEOUT_MS)),
  ]);

/**
 * Real numbers from the LendingPool contract. No invented values.
 * status: 'loading' | 'ready' | 'unavailable'
 */
export function usePublicPoolStats() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = PUBLIC_RPC[ADDRESSES.CHAIN_ID];
        if (!url || !ADDRESSES.LENDING_POOL) throw new Error('No RPC for this chain');

        const provider = new ethers.JsonRpcProvider(url, ADDRESSES.CHAIN_ID, { staticNetwork: true });
        const pool = new ethers.Contract(ADDRESSES.LENDING_POOL, LendingPoolABI.abi, provider);

        const [stats, issued, rate] = await withTimeout(
          Promise.all([pool.getPoolStats(), pool.totalLoansIssued(), pool.getDefaultRate()])
        );
        provider.destroy();

        if (cancelled) return;
        const finished = Number(rate.finished);
        setState({
          status: 'ready',
          liquidity: Number(ethers.formatUnits(stats.liquidity, 18)),
          activeLoans: Number(stats.activeLoans),
          lenders: Number(stats.lenderCount),
          loansIssued: Number(issued),
          finishedLoans: finished,
          // null means there is no finished loan yet, so no rate can be measured.
          defaultRatePct: finished === 0 ? null : Number(rate.rateBps) / 100,
        });
      } catch {
        if (!cancelled) setState({ status: 'unavailable' });
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}
