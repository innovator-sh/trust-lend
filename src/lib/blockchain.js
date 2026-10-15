/**
 * blockchain.js — TrustLend ethers.js integration layer
 *
 * Strategy:
 *  - Always try real blockchain first
 *  - isBlockchainReady() tells callers whether MetaMask + correct network + deployed contracts
 *    are all available
 *  - Each exported function parses MetaMask error codes for user-friendly messages
 */

import { ethers } from 'ethers';
import ADDRESSES from './contracts.json';

/* ══════════════════════════════════════════
   MINIMAL ABIs
═══════════════════════════════════════════ */

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const LENDING_POOL_ABI = [
  'function depositToPool(uint256 amount)',
  'function requestLoan(uint256 amount, uint256 durationDays, uint8 path)',
  'function makeRepayment(uint256 amount)',
  'function markDefault(address borrower)',
  'function getLoan(address borrower) view returns (tuple(address borrower, uint256 amount, uint256 repaidAmount, uint256 interestRate, uint256 startTime, uint256 dueDate, uint8 installmentsPaid, uint8 totalInstallments, uint8 status, uint8 path))',
  'function totalPoolLiquidity() view returns (uint256)',
  'event LoanDisbursed(address indexed borrower, uint256 amount, uint256 dueDate, uint8 path)',
  'event RepaymentMade(address indexed borrower, uint256 amount, uint256 remaining, uint8 newTrustScore)'
];

const VOUCH_SYSTEM_ABI = [
  'function stakeForBorrower(address borrower, uint256 amount) returns (uint256)',
  'function releaseStake(uint256 vouchId)',
  'function slashStake(uint256 vouchId)',
  'function getVouch(uint256 vouchId) view returns (tuple(uint256 id, address voucher, address borrower, uint256 amount, bool released, bool slashed))',
  'function getBorrowerVouches(address borrower) view returns (uint256[])',
  'function getTotalActiveStake(address borrower) view returns (uint256)',
  'event VouchStaked(uint256 indexed vouchId, address indexed voucher, address indexed borrower, uint256 amount)',
];

/* ══════════════════════════════════════════
   ERROR PARSING
═══════════════════════════════════════════ */

/**
 * Convert raw MetaMask/ethers errors into clean user-facing messages.
 */
export function parseBlockchainError(err) {
  // User explicitly rejected in MetaMask
  if (err?.code === 4001 || err?.action === 'sendTransaction') {
    return 'Transaction cancelled. You rejected the request in MetaMask.';
  }
  // Insufficient gas balance
  if (err?.message?.includes('insufficient funds')) {
    return 'Not enough POL/MATIC in your wallet to pay gas fees.';
  }
  // Contract revert — extract the reason
  if (err?.message?.includes('execution reverted')) {
    const match = err.message.match(/reason="([^"]+)"/);
    return match ? `Contract error: ${match[1]}` : 'Transaction reverted. Check contract state.';
  }
  // Wrong network
  if (err?.message?.includes('network') || err?.message?.includes('chainId')) {
    return 'Wrong network. Please switch to Polygon Amoy in MetaMask.';
  }
  // Generic fallback
  return err?.message || 'Blockchain transaction failed. Please try again.';
}

/* ══════════════════════════════════════════
   NETWORK + READINESS CHECK
═══════════════════════════════════════════ */

/**
 * Returns true if:
 *  - MetaMask is available
 *  - Contracts are deployed (addresses non-empty)
 *  - MetaMask is on the same chainId the contracts were deployed to
 */
export async function isBlockchainReady() {
  try {
    if (!window.ethereum) return false;
    if (!ADDRESSES.LendingPool) return false;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const network  = await provider.getNetwork();
    const chainId  = Number(network.chainId).toString();

    return chainId === ADDRESSES.chainId;
  } catch {
    return false;
  }
}

/**
 * Returns a human-readable status string for debugging.
 */
export async function getNetworkStatus() {
  if (!window.ethereum) return { ready: false, reason: 'MetaMask not installed' };
  if (!ADDRESSES.LendingPool) return { ready: false, reason: 'Contracts not deployed' };
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network  = await provider.getNetwork();
    const chainId  = Number(network.chainId).toString();
    const ready    = chainId === ADDRESSES.chainId;
    return {
      ready,
      chainId,
      expectedChainId: ADDRESSES.chainId,
      network: network.name,
      reason: ready ? null : `Wrong network (on ${chainId}, need ${ADDRESSES.chainId})`,
    };
  } catch (e) {
    return { ready: false, reason: e.message };
  }
}

/* ══════════════════════════════════════════
   PROVIDER / SIGNER HELPERS
═══════════════════════════════════════════ */

export async function getSigner() {
  if (!window.ethereum) throw new Error('MetaMask not found. Please install it.');
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  return provider.getSigner();
}

export function getProvider() {
  if (!window.ethereum) throw new Error('MetaMask not found.');
  return new ethers.BrowserProvider(window.ethereum);
}

async function getContracts() {
  const signer = await getSigner();
  return {
    token: new ethers.Contract(ADDRESSES.StableToken, ERC20_ABI, signer),
    pool:  new ethers.Contract(ADDRESSES.LendingPool, LENDING_POOL_ABI, signer),
    vouch: new ethers.Contract(ADDRESSES.VouchSystem, VOUCH_SYSTEM_ABI, signer),
    signer,
  };
}

const toUnits   = (n) => ethers.parseUnits(String(n), 18);
const fromUnits = (n) => parseFloat(ethers.formatUnits(n, 18));

/* ══════════════════════════════════════════
   TOKEN
═══════════════════════════════════════════ */

export async function getTokenBalance(address) {
  if (!ADDRESSES.StableToken) return 0;
  const provider = getProvider();
  const token = new ethers.Contract(ADDRESSES.StableToken, ERC20_ABI, provider);
  return fromUnits(await token.balanceOf(address));
}

/* ══════════════════════════════════════════
   LENDING POOL
═══════════════════════════════════════════ */

/**
 * Lender deposits tokens into the pool.
 * Triggers two MetaMask popups: approve + deposit.
 */
export async function depositLiquidity(amount) {
  const { token, pool } = await getContracts();
  const units = toUnits(amount);

  const approveTx = await token.approve(ADDRESSES.LendingPool, units);
  await approveTx.wait();

  const depositTx = await pool.depositToPool(units);
  const receipt   = await depositTx.wait();
  return { txHash: receipt.hash };
}

/**
 * Borrower creates an active loan on-chain.
 * Returns the on-chain txHash.
 */
export async function requestLoan(amount, durationDays = 30, path = 2) {
  const { pool } = await getContracts();

  const tx      = await pool.requestLoan(toUnits(amount), durationDays, path);
  const receipt = await tx.wait();

  return { txHash: receipt.hash };
}

/**
 * Borrower repays their active loan.
 * Triggers two MetaMask popups: approve + repay.
 */
export async function repayLoan(amount) {
  const { token, pool } = await getContracts();
  const units = toUnits(amount);

  const approveTx = await token.approve(ADDRESSES.LendingPool, units);
  await approveTx.wait();

  const repayTx = await pool.makeRepayment(units);
  const receipt = await repayTx.wait();
  return { txHash: receipt.hash };
}

export async function getPoolLiquidity() {
  if (!ADDRESSES.LendingPool) return 0;
  const provider = getProvider();
  const pool = new ethers.Contract(ADDRESSES.LendingPool, LENDING_POOL_ABI, provider);
  return fromUnits(await pool.totalPoolLiquidity());
}

export async function getLoanOnChain(borrowerAddress) {
  if (!ADDRESSES.LendingPool) return null;
  const provider = getProvider();
  const pool  = new ethers.Contract(ADDRESSES.LendingPool, LENDING_POOL_ABI, provider);
  const loan  = await pool.getLoan(borrowerAddress);
  const STATUSES = ['Active', 'Repaid', 'Defaulted', 'Liquidated'];
  return {
    borrower:  loan.borrower,
    amount:    fromUnits(loan.amount),
    status:    STATUSES[Number(loan.status)],
    createdAt: Number(loan.startTime),
    dueDate:   Number(loan.dueDate),
    repaidAmount: fromUnits(loan.repaidAmount),
  };
}

/* ══════════════════════════════════════════
   VOUCH SYSTEM
═══════════════════════════════════════════ */

/**
 * Voucher stakes tokens for a borrower.
 * Triggers two MetaMask popups: approve + stake.
 */
export async function stakeForBorrower(borrowerAddress, amount) {
  const { token, vouch } = await getContracts();
  const units = toUnits(amount);

  const approveTx = await token.approve(ADDRESSES.VouchSystem, units);
  await approveTx.wait();

  const tx      = await vouch.stakeForBorrower(borrowerAddress, units);
  const receipt = await tx.wait();

  const event = receipt.logs
    .map((log) => { try { return vouch.interface.parseLog(log); } catch { return null; } })
    .find((e) => e?.name === 'VouchStaked');

  const vouchId = event ? Number(event.args.vouchId) : null;
  return { vouchId, txHash: receipt.hash };
}

export async function getTotalActiveStake(borrowerAddress) {
  if (!ADDRESSES.VouchSystem) return 0;
  const provider = getProvider();
  const vouch = new ethers.Contract(ADDRESSES.VouchSystem, VOUCH_SYSTEM_ABI, provider);
  return fromUnits(await vouch.getTotalActiveStake(borrowerAddress));
}

/* ══════════════════════════════════════════
   NETWORK SWITCHING
═══════════════════════════════════════════ */

export async function switchToAmoy() {
  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: '0x13882',
      chainName: 'Polygon Amoy Testnet',
      nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
      rpcUrls: ['https://rpc-amoy.polygon.technology'],
      blockExplorerUrls: ['https://amoy.polygonscan.com'],
    }],
  });
}

export async function switchToLocalhost() {
  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: '0x7A69', // 31337
      chainName: 'Hardhat Localhost',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['http://127.0.0.1:8545'],
    }],
  });
}
