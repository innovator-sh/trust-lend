import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAssessment } from '../lib/mlApi';
import { getValidSession } from '../lib/session';
import Skeleton from './Skeleton';

const CARD = 'bg-white dark:bg-[#111827] p-10 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A]';

function Pill({ tone, children }) {
  const tones = {
    good: 'bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/30',
    bad: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30',
    muted: 'bg-[#8C8C8C]/10 text-[#8C8C8C] border-[#8C8C8C]/30',
  };
  return (
    <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${tones[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Advisory ML estimate for the signed-in wallet.
 * It never changes the on-chain score. The card says so.
 */
export default function MlAssessmentCard() {
  const { t } = useTranslation();
  const [result, setResult] = useState({ state: 'loading' });

  useEffect(() => {
    const address = getValidSession();
    if (!address) return undefined;
    let cancelled = false;
    fetchAssessment(address).then((r) => { if (!cancelled) setResult(r); });
    return () => { cancelled = true; };
  }, []);

  const header = (
    <h4 className="text-[10px] font-black text-[#F5A623] uppercase tracking-[0.3em] mb-6">{t('ml.title')}</h4>
  );

  if (result.state === 'loading') {
    return <div className={CARD}>{header}<Skeleton h="160px" /></div>;
  }

  if (result.state !== 'ok') {
    const key = { not_configured: 'ml.notConfigured', offline: 'ml.offline', error: 'ml.error' }[result.state];
    return (
      <div className={CARD}>
        {header}
        <p className="text-xs leading-relaxed text-[#8C8C8C]">{t(key)}</p>
        {result.message && <p className="mt-2 text-[10px] text-[#EF4444]">{result.message}</p>}
        <p className="mt-4 text-[10px] leading-relaxed text-[#8C8C8C]">{t('ml.onChainUnaffected')}</p>
      </div>
    );
  }

  const { data } = result;
  const { trust, fraud, schedule } = data;

  return (
    <div className={`${CARD} space-y-8`}>
      <div>
        {header}
        <p className="text-[10px] leading-relaxed text-[#8C8C8C]">{t('ml.disclaimer')}</p>
      </div>

      {/* Trust estimate */}
      <section>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] mb-3">{t('ml.trustEstimate')}</p>
        {trust.status === 'ok' ? (
          <>
            <div className="flex items-end gap-6">
              <span className="text-5xl font-black font-cabinet text-[#1A1A1A] dark:text-[#FAFAF8]">{trust.trust_score}</span>
              <span className="pb-2 text-xs text-[#8C8C8C]">/ 100 · {t('ml.suggestedLimit', { amount: trust.suggested_limit_usd })}</span>
            </div>
            <ul className="mt-5 space-y-2">
              {trust.factors.slice(0, 4).map((f) => (
                <li key={f.feature} className="flex items-center justify-between text-[11px]">
                  <span className="text-[#1A1A1A] dark:text-[#FAFAF8]">{t(`ml.factor.${f.feature}`)}</span>
                  <span className={`font-black ${f.impact_points >= 0 ? 'text-[#1D9E75]' : 'text-[#EF4444]'}`}>
                    {f.impact_points >= 0 ? '+' : ''}{f.impact_points}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-[#8C8C8C]">{t('ml.needsHistory')}</p>
        )}
      </section>

      {/* Fraud check */}
      <section>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] mb-3">{t('ml.vouchCheck')}</p>
        {fraud.status === 'ok' ? (
          <>
            <Pill tone={fraud.is_fraudulent ? 'bad' : 'good'}>
              {fraud.is_fraudulent ? t('ml.flagged') : t('ml.looksNormal')}
            </Pill>
            {fraud.reasons.map((r) => (
              <p key={r} className="mt-2 text-[10px] text-[#8C8C8C]">{r}</p>
            ))}
          </>
        ) : (
          <Pill tone="muted">{t('ml.notApplicable')}</Pill>
        )}
      </section>

      {/* Repayment pattern */}
      <section>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8C8C] mb-3">{t('ml.repaymentPattern')}</p>
        {schedule.status === 'ok' ? (
          <p className="text-xs text-[#1A1A1A] dark:text-[#FAFAF8]">
            <strong>{schedule.archetype}</strong> · {schedule.schedule_type}
            <span className="text-[#8C8C8C]"> · {t('ml.installments', { count: schedule.recommended_installments })}</span>
          </p>
        ) : (
          <p className="text-xs text-[#8C8C8C]">{t('ml.patternNeedsHistory')}</p>
        )}
      </section>

      <p className="border-t border-[#E8E8E8] dark:border-[#1E2A3A] pt-5 text-[10px] leading-relaxed text-[#8C8C8C]">
        {t('ml.onChainLine', { score: data.on_chain_trust_score })}
      </p>
    </div>
  );
}
