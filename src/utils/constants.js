/**
 * Tier table. One source of truth for the app.
 * It MUST match LendingPool.getBorrowLimit in blockchain/contracts/LendingPool.sol:
 *   score 20-39 = $10 (Entry), 40-59 = $50 (Bronze), 60-79 = $200 (Silver), 80-100 = $500 (Gold).
 * A score below 20 cannot borrow. Platinum is kept as a key for old UI code. No score reaches it.
 */
export const TIER_ORDER  = ['Entry', 'Bronze', 'Silver', 'Gold', 'Platinum'];
export const TIER_COLORS = { Entry: '#F5A623', Bronze: '#CD7F32', Silver: '#A8A9AD', Gold: '#FFD700', Platinum: '#2DD4BF' };
export const TIER_LIMITS = { Entry: 10, Bronze: 50, Silver: 200, Gold: 500, Platinum: 500 };
export const TIER_THRESHOLDS = { Entry: 0, Bronze: 40, Silver: 60, Gold: 80, Platinum: 101 };

/** Largest loan, in TRUST, that needs no verified KYC. */
export const NO_KYC_LIMIT = TIER_LIMITS.Entry;

export function getTier(score) {
  const s = Number(score);
  if (s >= 80) return 'Gold';
  if (s >= 60) return 'Silver';
  if (s >= 40) return 'Bronze';
  return 'Entry';
}

export function nextTierInfo(score) {
  const s = Number(score);
  const thresholds = [
    { tier: 'Bronze', at: 40, limit: 50  },
    { tier: 'Silver', at: 60, limit: 200 },
    { tier: 'Gold',   at: 80, limit: 500 },
  ];
  const next = thresholds.find(t => s < t.at);
  if (!next) return null;
  return { ...next, ptsNeeded: next.at - s };
}
