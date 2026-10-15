import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import Skeleton from '../components/Skeleton';
import { useWallet } from '../context/WalletContext';
import { useLendingPool } from '../hooks/useLendingPool';
import { useLenderActivity } from '../hooks/useLenderActivity';
import { explorerTxUrl } from '../contracts/addresses';

const CARD = 'bg-white dark:bg-[#111827] rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]';
const LABEL = 'text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.25em]';

const num = (v) => Number(v || 0);
const fmt = (v, digits = 2) =>
  num(v).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function LenderPortfolio() {
  const { t } = useTranslation();
  const { walletAddress } = useWallet();
  const { poolStats, lenderPosition, poolUsage, isLoading, withdraw } = useLendingPool();

  const [refreshKey, setRefreshKey] = useState(0);
  const activity = useLenderActivity(refreshKey);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const value = num(lenderPosition.value);
  const principal = num(lenderPosition.principal);
  const earned = num(lenderPosition.yieldEarned);
  const free = num(poolStats.liquidity);
  const onLoan = num(poolUsage.onLoan);
  const poolValue = num(poolUsage.poolValue);
  const utilization = poolValue > 0 ? (onLoan / poolValue) * 100 : 0;

  // The most this lender can take out now: their share value, limited by the free part of the pool.
  const maxWithdraw = value <= free ? lenderPosition.value : poolStats.liquidity;
  const available = Math.min(value, free);

  const handleWithdraw = async () => {
    if (!walletAddress) { toast.error(t('portfolio.connectFirst')); return; }
    if (!(num(amount) > 0)) { toast.error(t('portfolio.enterAmount')); return; }
    if (num(amount) > available) { toast.error(t('portfolio.tooMuch')); return; }
    setBusy(true);
    try {
      await withdraw(amount);          // the hook shows the transaction toasts
      setAmount('');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);              // the hook already showed the reason
    } finally {
      setBusy(false);
    }
  };

  const earnedTone = earned > 0 ? 'text-[#1D9E75]' : earned < 0 ? 'text-[#EF4444]' : 'text-[#1A1A1A] dark:text-[#FAFAF8]';

  return (
    <AppShell pageTitle={t('portfolio.title')} pageSubtitle={t('portfolio.subtitle')}>
      <div className="max-w-7xl mx-auto space-y-10 pb-24">

        {/* Position */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { label: t('portfolio.deposited'), val: fmt(principal), sub: t('portfolio.depositedSub'), tone: 'text-[#1A1A1A] dark:text-[#FAFAF8]' },
            { label: t('portfolio.currentValue'), val: fmt(value), sub: t('portfolio.currentValueSub'), tone: 'text-[#1A1A1A] dark:text-[#FAFAF8]' },
            { label: t('portfolio.earned'), val: `${earned > 0 ? '+' : ''}${fmt(earned)}`, sub: earned < 0 ? t('portfolio.earnedLoss') : t('portfolio.earnedSub'), tone: earnedTone },
          ].map((c) => (
            <div key={c.label} className={`${CARD} p-8`}>
              <p className={LABEL}>{c.label}</p>
              {isLoading ? <Skeleton h="40px" /> : (
                <p className={`mt-3 text-4xl font-black font-cabinet ${c.tone}`}>{c.val} <span className="text-sm text-[#8C8C8C]">TRUST</span></p>
              )}
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#8C8C8C]">{c.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">

            {/* How the money is used */}
            <div className={`${CARD} p-8`}>
              <h3 className="text-sm font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest mb-3">
                {t('portfolio.usageTitle')}
              </h3>
              <p className="text-xs leading-relaxed text-[#8C8C8C] mb-6">{t('portfolio.usageDesc')}</p>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
                {[
                  [t('portfolio.poolValue'), `${fmt(poolValue)} TRUST`],
                  [t('portfolio.free'), `${fmt(free)} TRUST`],
                  [t('portfolio.onLoan'), `${fmt(onLoan)} TRUST`],
                  [t('portfolio.utilization'), `${utilization.toFixed(1)}%`],
                  [t('portfolio.activeLoans'), String(num(poolStats.activeLoans))],
                  [t('portfolio.defaultRate'),
                    poolUsage.defaultRatePct === null
                      ? t('portfolio.noData')
                      : `${poolUsage.defaultRatePct.toFixed(1)}% (${poolUsage.finishedLoans})`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className={LABEL}>{k}</dt>
                    <dd className="mt-1 text-sm font-black text-[#1A1A1A] dark:text-[#FAFAF8]">{isLoading ? '…' : v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Activity */}
            <div className={`${CARD} overflow-hidden`}>
              <div className="p-8 border-b border-[#E8E8E8] dark:border-[#1E2A3A]">
                <h3 className="text-sm font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8] uppercase tracking-widest">
                  {t('portfolio.activityTitle')}
                </h3>
              </div>
              {activity.state === 'loading' ? (
                <div className="p-8"><Skeleton h="80px" /></div>
              ) : activity.state === 'unavailable' ? (
                <p className="p-8 text-xs text-[#8C8C8C]">{t('portfolio.activityUnavailable')}</p>
              ) : activity.items.length === 0 ? (
                <p className="p-8 text-xs text-[#8C8C8C]">{t('portfolio.noActivity')}</p>
              ) : (
                <ul className="divide-y divide-[#E8E8E8] dark:divide-[#1E2A3A]">
                  {activity.items.map((a) => (
                    <li key={`${a.hash}-${a.index}`} className="flex items-center justify-between px-8 py-5">
                      <div>
                        <p className="text-sm font-black text-[#1A1A1A] dark:text-[#FAFAF8]">
                          {a.type === 'deposit' ? t('portfolio.deposit') : t('portfolio.withdrawal')}
                        </p>
                        <p className="text-[10px] text-[#8C8C8C] mt-1">
                          {a.time ? new Date(a.time * 1000).toLocaleString() : `block ${a.block}`}
                          {' · '}
                          <a className="underline hover:text-[#F5A623]" href={explorerTxUrl(a.hash)} target="_blank" rel="noreferrer">
                            {a.hash.slice(0, 10)}…
                          </a>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${a.type === 'deposit' ? 'text-[#1D9E75]' : 'text-[#1A1A1A] dark:text-[#FAFAF8]'}`}>
                          {a.type === 'deposit' ? '+' : '−'}{fmt(a.amount)} TRUST
                        </p>
                        {a.type === 'withdrawal' && num(a.yieldEarned) > 0 && (
                          <p className="text-[10px] text-[#1D9E75] mt-1">{t('portfolio.ofWhichYield', { amount: fmt(a.yieldEarned) })}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Withdraw + risk */}
          <div className="space-y-8">
            <div className={`${CARD} p-8`}>
              <h4 className="text-[10px] font-black text-[#F5A623] uppercase tracking-[0.3em] mb-4">{t('portfolio.withdrawTitle')}</h4>
              <p className="text-xs leading-relaxed text-[#8C8C8C] mb-5">{t('portfolio.withdrawDesc')}</p>

              <p className={LABEL}>{t('portfolio.availableNow')}</p>
              <p className="mt-1 mb-5 text-2xl font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8]">
                {isLoading ? '…' : `${fmt(available)} TRUST`}
              </p>

              <div className="flex gap-2">
                <input
                  type="number" min="0" step="any" inputMode="decimal" value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="w-full rounded-lg border border-[#E8E8E8] dark:border-[#1E2A3A] bg-transparent px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-[#FAFAF8]"
                />
                <button
                  type="button" onClick={() => setAmount(maxWithdraw)} disabled={available <= 0}
                  className="px-4 rounded-lg border border-[#F5A623]/40 text-[10px] font-black uppercase tracking-widest text-[#F5A623] disabled:opacity-40"
                >
                  {t('portfolio.max')}
                </button>
              </div>
              <button
                type="button" onClick={handleWithdraw} disabled={busy || isLoading || !walletAddress || available <= 0}
                className={`mt-4 w-full py-4 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all
                  ${(busy || isLoading || !walletAddress || available <= 0)
                    ? 'bg-[#1E2A3A] text-[#8C8C8C] cursor-not-allowed'
                    : 'bg-[#1D9E75] text-[#111827] hover:bg-opacity-90'}`}
              >
                {busy ? t('portfolio.withdrawing') : t('portfolio.withdrawButton')}
              </button>
            </div>

            <div className="rounded-[12px] border border-[#F5A623]/20 bg-[#F5A623]/5 p-6">
              <p className="text-[10px] leading-relaxed text-[#1A1A1A] dark:text-[#FAFAF8]">{t('portfolio.risk')}</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
