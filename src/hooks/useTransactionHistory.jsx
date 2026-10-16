import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { ADDRESSES } from '../contracts/addresses';
import LendingPoolABI from '../contracts/LendingPool.json';
import VouchSystemABI from '../contracts/VouchSystem.json';
import { queryInChunks, addBlockTimes } from '../lib/chainEvents';

const MAX_ITEMS = 50;
const fmt = (wei) => Number(ethers.formatUnits(wei, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });

/**
 * The signed-in wallet's activity, read from LendingPool and VouchSystem events.
 * Each row: { id, category, type, entity, value, positive, status, date, hash, icon }
 * category is one of: lending, borrowing, reputation
 */
export function useTransactionHistory(refreshKey = 0) {
  const { provider, walletAddress } = useWallet();
  const [transactions, setTransactions] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | unavailable

  const canLoad = Boolean(provider && walletAddress && ADDRESSES.LENDING_POOL && ADDRESSES.VOUCH_SYSTEM);

  useEffect(() => {
    if (!canLoad) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const pool = new ethers.Contract(ADDRESSES.LENDING_POOL, LendingPoolABI.abi, provider);
        const vouch = new ethers.Contract(ADDRESSES.VOUCH_SYSTEM, VouchSystemABI.abi, provider);
        const latest = await provider.getBlockNumber();
        const from = Number(ADDRESSES.DEPLOY_BLOCK || 0);
        const q = (c, f) => queryInChunks(c, f, from, latest);

        const [deposits, withdrawals, loans, repayments, defaults, staked, vouchedFor] = await Promise.all([
          q(pool, pool.filters.PoolDeposit(walletAddress)),
          q(pool, pool.filters.PoolWithdrawal(walletAddress)),
          q(pool, pool.filters.LoanDisbursed(walletAddress)),
          q(pool, pool.filters.RepaymentMade(walletAddress)),
          q(pool, pool.filters.LoanDefaulted(walletAddress)),
          q(vouch, vouch.filters.VouchStaked(null, walletAddress, null)),
          q(vouch, vouch.filters.VouchStaked(null, null, walletAddress)),
        ]);

        const base = (e) => ({ id: `${e.transactionHash}-${e.index}`, hash: e.transactionHash, block: e.blockNumber, index: e.index, status: 'Confirmed' });
        const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

        const rows = [
          ...deposits.map((e) => ({ ...base(e), category: 'lending', type: 'Pool Deposit', entity: 'Lending pool', value: `+${fmt(e.args.amount)} TRUST`, positive: true, icon: 'lucide:arrow-down-left' })),
          ...withdrawals.map((e) => ({ ...base(e), category: 'lending', type: 'Pool Withdrawal', entity: 'Lending pool', value: `-${fmt(e.args.amount)} TRUST`, positive: false, icon: 'lucide:arrow-up-right' })),
          ...loans.map((e) => ({ ...base(e), category: 'borrowing', type: 'Loan Drawdown', entity: 'Lending pool', value: `+${fmt(e.args.amount)} TRUST`, positive: true, icon: 'lucide:banknote' })),
          ...repayments.map((e) => ({
            ...base(e), category: 'borrowing', type: Number(e.args.remaining) === 0 ? 'Final Repayment' : 'Repayment',
            entity: `Remaining ${fmt(e.args.remaining)} TRUST`, value: `-${fmt(e.args.amount)} TRUST`, positive: false, icon: 'lucide:refresh-ccw',
          })),
          ...defaults.map((e) => ({ ...base(e), category: 'borrowing', type: 'Loan Defaulted', entity: `Debt ${fmt(e.args.outstandingDebt)} TRUST`, value: `${fmt(e.args.amount)} TRUST`, positive: false, status: 'Defaulted', icon: 'lucide:alert-triangle' })),
          ...staked.map((e) => ({ ...base(e), category: 'reputation', type: 'Vouch Given', entity: `For ${short(e.args.borrower)}`, value: `${fmt(e.args.amount)} TRUST staked`, positive: false, icon: 'lucide:handshake' })),
          ...vouchedFor.map((e) => ({ ...base(e), category: 'reputation', type: 'Vouch Received', entity: `From ${short(e.args.voucher)}`, value: `${fmt(e.args.amount)} TRUST staked`, positive: true, icon: 'lucide:award' })),
        ].sort((a, b) => b.block - a.block || b.index - a.index).slice(0, MAX_ITEMS);

        await addBlockTimes(provider, rows);
        rows.forEach((r) => { r.date = r.time ? new Date(r.time * 1000) : null; });

        if (!cancelled) { setTransactions(rows); setState('ready'); }
      } catch (err) {
        console.warn('[useTransactionHistory]', err?.message || err);
        if (!cancelled) setState('unavailable');
      }
    })();

    return () => { cancelled = true; };
  }, [canLoad, provider, walletAddress, refreshKey]);

  return {
    transactions: canLoad ? transactions : [],
    state: canLoad ? state : 'unavailable',
    isLoading: canLoad && state === 'loading',
  };
}
