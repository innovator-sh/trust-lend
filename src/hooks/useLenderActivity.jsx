import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { ADDRESSES } from '../contracts/addresses';
import LendingPoolABI from '../contracts/LendingPool.json';
import { queryInChunks, addBlockTimes } from '../lib/chainEvents';

const MAX_ITEMS = 20;

/**
 * The signed-in lender's deposits and withdrawals, read from LendingPool events.
 * state: 'loading' | 'ready' | 'unavailable'
 * Pass a changing `refreshKey` to reload after a transaction.
 */
export function useLenderActivity(refreshKey = 0) {
  const { provider, walletAddress } = useWallet();
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');

  // Without a wallet or a deployed pool there is nothing to load.
  const canLoad = Boolean(provider && walletAddress && ADDRESSES.LENDING_POOL);

  useEffect(() => {
    if (!canLoad) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const pool = new ethers.Contract(ADDRESSES.LENDING_POOL, LendingPoolABI.abi, provider);
        const latest = await provider.getBlockNumber();
        const from = Number(ADDRESSES.DEPLOY_BLOCK || 0);

        const [deposits, withdrawals] = await Promise.all([
          queryInChunks(pool, pool.filters.PoolDeposit(walletAddress), from, latest),
          queryInChunks(pool, pool.filters.PoolWithdrawal(walletAddress), from, latest),
        ]);

        const rows = [
          ...deposits.map((e) => ({
            type: 'deposit', amount: ethers.formatUnits(e.args.amount, 18), yieldEarned: '0',
            hash: e.transactionHash, block: e.blockNumber, index: e.index,
          })),
          ...withdrawals.map((e) => ({
            type: 'withdrawal', amount: ethers.formatUnits(e.args.amount, 18),
            yieldEarned: ethers.formatUnits(e.args.yieldEarned, 18),
            hash: e.transactionHash, block: e.blockNumber, index: e.index,
          })),
        ].sort((a, b) => b.block - a.block || b.index - a.index).slice(0, MAX_ITEMS);

        await addBlockTimes(provider, rows);

        if (!cancelled) { setItems(rows); setState('ready'); }
      } catch (err) {
        console.warn('[useLenderActivity]', err?.message || err);
        if (!cancelled) setState('unavailable');
      }
    })();

    return () => { cancelled = true; };
  }, [canLoad, provider, walletAddress, refreshKey]);

  return { items: canLoad ? items : [], state: canLoad ? state : 'unavailable' };
}
