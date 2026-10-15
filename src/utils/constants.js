export const TIER_ORDER  = ['Entry', 'Bronze', 'Silver', 'Gold', 'Platinum'];
export const TIER_COLORS = { Entry: '#F5A623', Bronze: '#CD7F32', Silver: '#A8A9AD', Gold: '#FFD700', Platinum: '#2DD4BF' };
export const TIER_LIMITS = { Entry: 10, Bronze: 50, Silver: 200, Gold: 1000, Platinum: 5000 };
export const TIER_THRESHOLDS = { Entry: 0, Bronze: 40, Silver: 60, Gold: 75, Platinum: 90 };

export function getTier(score) {
  const s = Number(score);
  if (s >= 90) return 'Platinum';
  if (s >= 75) return 'Gold';
  if (s >= 60) return 'Silver';
  if (s >= 40) return 'Bronze';
  return 'Entry';
}

export function nextTierInfo(score) {
  const s = Number(score);
  const thresholds = [
    { tier: 'Bronze',   at: 40,  limit: 50   },
    { tier: 'Silver',   at: 60,  limit: 200  },
    { tier: 'Gold',     at: 75,  limit: 1000 },
    { tier: 'Platinum', at: 90,  limit: 5000 },
  ];
  const next = thresholds.find(t => s < t.at);
  if (!next) return null;
  return { ...next, ptsNeeded: next.at - s };
}
