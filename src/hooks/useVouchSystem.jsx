import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { ADDRESSES } from '../contracts/addresses';
import VouchSystemABI from '../contracts/VouchSystem.json';
import { useDemo } from '../context/DemoContext';
import { showTxLoading, showTxSuccess, showTxError } from '../utils/txToast';
import { translateContractError } from '../utils/contractErrors';

export function useVouchSystem() {
  const { provider, walletAddress } = useWallet();
  const { isDemoMode, demoStateOverrides, simulateTx } = useDemo();
  const [vouches, setVouches] = useState([]);
  const [vouchers, setVouchers] = useState([]); // list of unique voucher addresses
  const [vouchRequests, setVouchRequests] = useState([]); // simulated off-chain
  const [activeStake, setActiveStake] = useState("0.0");
  const [totalStaked, setTotalStaked] = useState("0.0");
  const [isLoading, setIsLoading] = useState(true);

  // Sync simulated requests from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('tl_vouch_requests');
    if (saved) setVouchRequests(JSON.parse(saved));
  }, []);

  const fetchData = useCallback(async () => {
    if (isDemoMode && demoStateOverrides) {
        setVouches(demoStateOverrides.vouchers || []);
        setVouchers((demoStateOverrides.vouchers || []).map(v => v.voucher));
        setActiveStake("30.0");
        setTotalStaked("30.0");
        setIsLoading(false);
        return;
    }

    if (!provider || !walletAddress || !ADDRESSES.VOUCH_SYSTEM) {
      setIsLoading(false);
      return;
    }

    try {
      const contract = new ethers.Contract(ADDRESSES.VOUCH_SYSTEM, VouchSystemABI.abi, provider);
      const active = await contract.getTotalActiveStake(walletAddress);
      setActiveStake(ethers.formatUnits(active, 18));
      const staked = await contract.totalStakedBy(walletAddress);
      setTotalStaked(ethers.formatUnits(staked, 18));

      const vouchIds = await contract.getBorrowerVouches(walletAddress);
      const vouchDetails = await Promise.all(
          vouchIds.map(async id => {
              const details = await contract.getVouch(id);
              return {
                  id: details.id.toString(),
                  voucher: details.voucher,
                  amount: ethers.formatUnits(details.amount, 18),
                  released: details.released,
                  slashed: details.slashed
              };
          })
      );
      setVouches(vouchDetails);
      setVouchers(vouchDetails.map(v => v.voucher));
    } catch (err) {
      console.warn("Vouch data fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [provider, walletAddress, isDemoMode, demoStateOverrides]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createVouchRequest = async (voucherAddress, amount) => {
      const newReq = {
          id: Date.now(),
          borrower: walletAddress,
          voucher: voucherAddress,
          amount: amount,
          status: 'pending',
          timestamp: Date.now()
      };
      const updated = [...vouchRequests, newReq];
      setVouchRequests(updated);
      localStorage.setItem('tl_vouch_requests', JSON.stringify(updated));
      showTxSuccess("Vouch request transmitted!", null, "vouch-req");
  };

  const stakeForBorrower = async (borrowerAddress, amount, requestId) => {
    if (!provider || !walletAddress) throw new Error("Wallet not connected");
    const id = showTxLoading("Locking stake into Vouch Network...");
    try {
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(ADDRESSES.VOUCH_SYSTEM, VouchSystemABI.abi, signer);
        const amountWei = ethers.parseUnits(amount.toString(), 18);
        const txPromise = contract.stakeForBorrower(borrowerAddress, amountWei);
        const tx = await simulateTx(txPromise);
        await tx.wait();
        
        // Remove request if accepted
        if (requestId) {
            const updated = vouchRequests.filter(r => r.id !== requestId);
            setVouchRequests(updated);
            localStorage.setItem('tl_vouch_requests', JSON.stringify(updated));
        }

        showTxSuccess(`Vouch established! Locked ${amount} TRUST`, tx.hash, id);
        await fetchData();
    } catch (err) {
        showTxError(translateContractError(err), id);
        throw err;
    }
  };

  return { 
    vouches, 
    vouchers, 
    vouchRequests, 
    activeStake, 
    totalStaked, 
    isLoading, 
    createVouchRequest, 
    stakeForBorrower, 
    refresh: fetchData 
  };
}
