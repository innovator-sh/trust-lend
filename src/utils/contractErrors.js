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

  // Revert reasons from LendingPool and VouchSystem
  if (lowerMsg.includes('active loan exists') || lowerMsg.includes('already has active loan')) {
    return 'You have an active loan. Repay it before borrowing again.';
  }

  if (lowerMsg.includes('unpaid defaulted loan')) {
    return 'You have an unpaid defaulted loan. Repay it before borrowing again.';
  }

  if (lowerMsg.includes('exceeds trust limit')) {
    return 'This amount is above your borrowing limit.';
  }

  if (lowerMsg.includes('trust score too low')) {
    return 'Your trust score is too low to borrow right now.';
  }

  if (lowerMsg.includes('collateral path unavailable')) {
    return 'Collateral loans are not available yet. Choose another option.';
  }

  if (lowerMsg.includes('not enough vouch stake')) {
    return 'This option needs at least 5 TRUST of vouch stake. Ask a voucher first.';
  }

  if (lowerMsg.includes('insufficient pool liquidity') || lowerMsg.includes('insufficient free liquidity')) {
    return 'Not enough free liquidity in the pool right now.';
  }

  if (lowerMsg.includes('loan not overdue')) {
    return 'This loan is not overdue yet.';
  }

  if (lowerMsg.includes('overpayment')) {
    return 'The payment is more than the amount you owe.';
  }

  if (lowerMsg.includes('lendingpool: exceeds balance')) {
    return 'You cannot withdraw more than your pool balance.';
  }

  if (lowerMsg.includes('stake below minimum')) {
    return 'The minimum stake is 1 TRUST.';
  }

  if (lowerMsg.includes('too many active vouches')) {
    return 'This borrower already has the maximum number of vouches.';
  }

  if (lowerMsg.includes('borrower has an active loan')) {
    return 'You cannot take back this stake while the borrower has an active loan.';
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
