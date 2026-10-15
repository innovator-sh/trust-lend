/**
 * useTrustToken.jsx
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import TrustTokenABI from '../contracts/TrustToken.json';
import { ADDRESSES } from '../contracts/addresses';
import { useDemo } from '../context/DemoContext';
import { showTxLoading, showTxSuccess, showTxError } from '../utils/txToast';
import { translateContractError } from '../utils/contractErrors';

const POLL_INTERVAL = 30_000;

export function useTrustToken() {
  const { walletAddress, isConnected, provider, signer, isSupported } = useWallet();
  const { simulateTx } = useDemo();

  const [trustBalance,     setTrustBalance]     = useState('0.00');
  const [maticBalance,     setMaticBalance]     = useState('0.00');
  const [cooldownSeconds,  setCooldownSeconds]  = useState(0);
  const [isLoading,        setIsLoading]        = useState(false);
  const intervalRef = useRef(null);

  const fetchBalances = useCallback(async () => {
    if (!isConnected || !provider || !walletAddress) return;
    try {
      const rawMatic = await provider.getBalance(walletAddress);
      setMaticBalance(parseFloat(ethers.formatEther(rawMatic)).toFixed(4));

      if (ADDRESSES.TRUST_TOKEN) {
        const token = new ethers.Contract(ADDRESSES.TRUST_TOKEN, TrustTokenABI.abi, provider);
        const rawTrust = await token.balanceOf(walletAddress);
        setTrustBalance(parseFloat(ethers.formatEther(rawTrust)).toFixed(2));

        const remaining = await token.timeUntilNextClaim(walletAddress);
        setCooldownSeconds(Number(remaining));
      }
    } catch (err) {
      console.warn('[useTrustToken] balance fetch error:', err.message);
    }
  }, [isConnected, provider, walletAddress]);

  useEffect(() => {
    fetchBalances();
    intervalRef.current = setInterval(fetchBalances, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchBalances]);

  const claimTestTokens = useCallback(async () => {
    if (!signer || !isSupported) return;
    const id = showTxLoading('Claiming 1,000 TRUST…');
    setIsLoading(true);

    try {
      const token = new ethers.Contract(ADDRESSES.TRUST_TOKEN, TrustTokenABI.abi, signer);
      const txPromise = token.claimTestTokens();
      const tx = await simulateTx(txPromise);
      await tx.wait();
      showTxSuccess("1,000 TRUST added!", tx.hash, id);
      await fetchBalances();
    } catch (err) {
      showTxError(translateContractError(err), id);
    } finally {
      setIsLoading(false);
    }
  }, [signer, isSupported, fetchBalances, simulateTx]);

  const approvePool = useCallback(async (amount) => {
    if (!signer || !isSupported) return false;
    const id = showTxLoading(`Approving ${amount} TRUST…`);
    setIsLoading(true);

    try {
      const token = new ethers.Contract(ADDRESSES.TRUST_TOKEN, TrustTokenABI.abi, signer);
      const units = ethers.parseUnits(String(amount), 18);
      const txPromise = token.approve(ADDRESSES.LENDING_POOL, units);
      const tx = await simulateTx(txPromise);
      await tx.wait();
      showTxSuccess(`${amount} TRUST approved`, tx.hash, id);
      return true;
    } catch (err) {
      showTxError(translateContractError(err), id);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [signer, isSupported, simulateTx]);

  const isApproved = useCallback(async (amount) => {
    if (!provider || !walletAddress || !ADDRESSES.TRUST_TOKEN) return false;
    try {
      const token = new ethers.Contract(ADDRESSES.TRUST_TOKEN, TrustTokenABI.abi, provider);
      const allowance = await token.allowance(walletAddress, ADDRESSES.LENDING_POOL);
      const needed = ethers.parseUnits(String(amount), 18);
      return allowance >= needed;
    } catch {
      return false;
    }
  }, [provider, walletAddress]);

  return {
    trustBalance, maticBalance, cooldownSeconds, canClaim: cooldownSeconds === 0,
    isLoading, claimTestTokens, approvePool, isApproved, refreshBalances: fetchBalances,
  };
}
