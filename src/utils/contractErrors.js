/**
 * contractErrors.js
 * 
 * Map all contract revert reasons to plain English.
 */

export function translateContractError(error) {
  const msg = error?.message || error?.toString() || '';
  const lowerMsg = msg.toLowerCase();

  if (lowerMsg.includes('user rejected') || lowerMsg.includes('user denied')) {
    return 'Transaction rejected in wallet.';
  }

  if (lowerMsg.includes('insufficient allowance')) {
    return 'Please approve TRUST spending first.';
  }

  if (lowerMsg.includes('transfer amount exceeds balance') || lowerMsg.includes('not enough trust')) {
    return 'Not enough TRUST. Claim test tokens first.';
  }

  if (lowerMsg.includes('already has active loan')) {
    return 'You have an active loan. Repay it before borrowing again.';
  }

  if (lowerMsg.includes('score too low')) {
    return 'Trust score too low for this amount.';
  }

  if (lowerMsg.includes('pool insufficient')) {
    return 'Not enough liquidity in the pool right now.';
  }

  if (lowerMsg.includes('not owner')) {
    return 'Only the contract owner can do this.';
  }

  if (lowerMsg.includes('cooldown active')) {
    return 'Wait 24 hours between token claims.';
  }

  if (lowerMsg.includes('execution reverted')) {
    return 'Transaction failed. Try again.';
  }

  return 'Network error occurred. Please try again.';
}
