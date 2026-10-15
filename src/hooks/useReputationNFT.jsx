import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { ADDRESSES } from '../contracts/addresses';
import ReputationNFTABI from '../contracts/ReputationNFT.json';
import { useDemo } from '../context/DemoContext';
import { showTxLoading, showTxSuccess, showTxError } from '../utils/txToast';
import { translateContractError } from '../utils/contractErrors';

export function useReputationNFT() {
  const { provider, walletAddress } = useWallet();
  const { isDemoMode, demoStateOverrides, simulateTx } = useDemo();
  const [hasNFT, setHasNFT] = useState(false);
  const [tokenId, setTokenId] = useState(null);
  const [reputationData, setReputationData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReputation = useCallback(async () => {
    if (isDemoMode && demoStateOverrides) {
        setHasNFT(true);
        setTokenId("42");
        setReputationData({
            trustScore: demoStateOverrides.trustScore,
            tier: "Silver",
            loansRepaid: "3",
            totalBorrowed: "450",
            totalRepaid: "450",
            memberSince: new Date(Date.now() - 30 * 86400000).toISOString(),
            repaymentStreak: 3,
            earningArchetype: "Monthly",
        });
        setIsLoading(false);
        return;
    }

    if (!provider || !walletAddress || !ADDRESSES.REPUTATION_NFT) {
      setIsLoading(false);
      return;
    }

    try {
      const contract = new ethers.Contract(ADDRESSES.REPUTATION_NFT, ReputationNFTABI.abi, provider);
      const has = await contract.hasNFT(walletAddress);
      setHasNFT(has);

      if (has) {
        const id = await contract.tokenIdOf(walletAddress);
        setTokenId(id.toString());
        const data = await contract.getReputation(walletAddress);
        setReputationData({
          trustScore: data.trustScore,
          tier: data.tier,
          loansRepaid: data.loansRepaid.toString(),
          totalBorrowed: ethers.formatUnits(data.totalBorrowed, 18),
          totalRepaid: ethers.formatUnits(data.totalRepaid, 18),
          memberSince: new Date(Number(data.memberSince) * 1000).toISOString(),
          repaymentStreak: data.repaymentStreak,
          earningArchetype: data.earningArchetype,
        });
      } else {
        setReputationData(null);
      }
    } catch (err) {
      console.warn("Reputation fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [provider, walletAddress, isDemoMode, demoStateOverrides]);

  useEffect(() => {
    fetchReputation();
  }, [fetchReputation]);

  const mintNFT = async () => {
    if (!provider || !walletAddress) throw new Error("Wallet not connected");
    const id = showTxLoading("Minting your Reputation NFT...");
    try {
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(ADDRESSES.REPUTATION_NFT, ReputationNFTABI.abi, signer);
        const txPromise = contract.mintReputationNFT(walletAddress);
        const tx = await simulateTx(txPromise);
        await tx.wait();
        showTxSuccess("Identity established!", tx.hash, id);
        await fetchReputation();
    } catch (err) {
        showTxError(translateContractError(err), id);
        throw err;
    }
  };

  return { hasNFT, tokenId, reputationData, trustScore: reputationData?.trustScore || 0, isLoading, mintNFT, refresh: fetchReputation };
}
