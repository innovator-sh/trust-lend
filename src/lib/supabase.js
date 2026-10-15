import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY in .env.local (see .env.example).'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── User helpers ── */

/** Upsert a wallet-based user record. Returns the row. */
export async function upsertUser(walletAddress) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      { wallet_address: walletAddress.toLowerCase() },
      { onConflict: 'wallet_address', ignoreDuplicates: false }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Fetch a user by wallet address. */
export async function getUser(walletAddress) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Patch any fields on the user row. */
export async function updateUser(walletAddress, patch) {
  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('wallet_address', walletAddress.toLowerCase())
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ── Loan helpers ── */

/** Create a new loan record (status = pending). */
export async function createLoan({ walletAddress, amount, path = 'trust' }) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30); // 30-day term
  const { data, error } = await supabase
    .from('loans')
    .insert({
      wallet_address: walletAddress.toLowerCase(),
      amount,
      path,
      loan_status: 'pending',
      due_date: dueDate.toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Update a loan row (e.g. set status=active + tx_hash). */
export async function updateLoan(loanId, patch) {
  const { data, error } = await supabase
    .from('loans')
    .update(patch)
    .eq('id', loanId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Fetch all loans for a wallet. */
export async function getUserLoans(walletAddress) {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ── Score event helpers ── */

/** Log a trust score event (client-side fallback; DB trigger also handles repayments). */
export async function logScoreEvent({ walletAddress, eventType, delta, reason, loanId }) {
  const { error } = await supabase.from('score_events').insert({
    wallet_address: walletAddress.toLowerCase(),
    event_type: eventType,
    delta,
    reason,
    loan_id: loanId ?? null,
  });
  if (error) console.error('Score event log error:', error);
}

/** Fetch score event history for a wallet. */
export async function getScoreEvents(walletAddress) {
  const { data, error } = await supabase
    .from('score_events')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

/** Call the DB recalculate_trust_score() function and sync the user row. */
export async function refreshTrustScore(walletAddress) {
  // The DB trigger already handles this after repayment; call for manual refresh.
  const { data, error } = await supabase.rpc('recalculate_trust_score', {
    p_wallet: walletAddress.toLowerCase(),
  });
  if (error) throw error;
  const newScore = data;
  const { data: tierData } = await supabase.rpc('score_to_tier', { p_score: newScore });
  await updateUser(walletAddress, { trust_score: newScore, tier: tierData });
  return { score: newScore, tier: tierData };
}

/* ── Tier / Limit constants ──
 * Defined once in src/utils/constants.js (they must match the contract). Re-exported here
 * so older imports keep working.
 */
export {
  TIER_ORDER, TIER_COLORS, TIER_LIMITS, TIER_THRESHOLDS, NO_KYC_LIMIT, getTier, nextTierInfo,
} from '../utils/constants';

/* ── Vouch helpers ── */

/** Create a pending vouch invite from borrower toward a voucher address. */
export async function createVouch({ borrowerWallet, voucherWallet, stakeAmount = 5 }) {
  const { data, error } = await supabase
    .from('vouches')
    .insert({
      borrower_wallet: borrowerWallet.toLowerCase(),
      voucher_wallet:  voucherWallet.toLowerCase(),
      stake_amount:    stakeAmount,
      status:          'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Activate a vouch (voucher accepted + mock stake tx_hash). */
export async function activateVouch(vouchId, txHash) {
  const { data, error } = await supabase
    .from('vouches')
    .update({ status: 'active', tx_hash: txHash, accepted_at: new Date().toISOString() })
    .eq('id', vouchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Fetch vouches where wallet is the borrower. */
export async function getBorrowerVouches(walletAddress) {
  const { data, error } = await supabase
    .from('vouches')
    .select('*')
    .eq('borrower_wallet', walletAddress.toLowerCase())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ── Lender position helpers ── */

/** Fund a loan as a lender. Creates a position + updates loan status. */
export async function fundLoan({ lenderWallet, loanId, fundedAmount, apy, txHash }) {
  // insert lender position
  const { data, error } = await supabase
    .from('lender_positions')
    .insert({
      lender_wallet:  lenderWallet.toLowerCase(),
      loan_id:        loanId,
      funded_amount:  fundedAmount,
      apy,
      status:         'active',
      tx_hash:        txHash,
    })
    .select()
    .single();
  if (error) throw error;

  // flip loan to active
  await supabase.from('loans').update({ loan_status: 'active', tx_hash: txHash })
    .eq('id', loanId);

  return data;
}

/** Fetch all lender positions for a wallet. */
export async function getLenderPositions(walletAddress) {
  const { data, error } = await supabase
    .from('lender_positions')
    .select('*, loans(*)')
    .eq('lender_wallet', walletAddress.toLowerCase())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Fetch all pending loans available for lender funding. */
export async function getPendingLoans() {
  const { data, error } = await supabase
    .from('loans')
    .select('*, users(display_name, trust_score, tier, uid)')
    .eq('loan_status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
