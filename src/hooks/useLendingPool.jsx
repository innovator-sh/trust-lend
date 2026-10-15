import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { ADDRESSES } from '../contracts/addresses';
import LendingPoolABI from '../contracts/LendingPool.json';
import { useDemo } from '../context/DemoContext';
import { showTxLoading, showTxSuccess, showTxError } from '../utils/txToast';
import { translateContractError } from '../utils/contractErrors';

export function useLendingPool() {
  const { provider, walletAddress } = useWallet();
  const { isDemoMode, demoStateOverrides, simulateTx } = useDemo();
  const [borrowLimit, setBorrowLimit] = useState("0.0");
  const [userLoan, setUserLoan] = useState(null);
  const [poolStats, setPoolStats] = useState({
    liquidity: "0.0",
    totalLiquidity: "0.0",
    activeLoans: "0",
    lenderCount: "0",
    avgInterestRate: "0"
  });
  const [lenderBalance, setLenderBalance] = useState("0.0");
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (isDemoMode && demoStateOverrides) {
        setBorrowLimit("500.0");
        setPoolStats({
            liquidity: demoStateOverrides.poolLiquidity.toString(),
            totalLiquidity: demoStateOverrides.poolLiquidity.toString(),
            activeLoans: "42",
            lenderCount: "1337",
            avgInterestRate: "6.5"
        });
        setUserLoan(demoStateOverrides.userLoan);
        setLenderBalance("0.0");
        setIsLoading(false);
        return;
    }

    if (!provider || !ADDRESSES.LENDING_POOL) {
        setIsLoading(false);
        return;
    }

    try {
      const contract = new ethers.Contract(ADDRESSES.LENDING_POOL, LendingPoolABI.abi, provider);

      try {
        const stats = await contract.getPoolStats();
        setPoolStats({
            liquidity: ethers.formatUnits(stats.liquidity, 18),
            totalLiquidity: ethers.formatUnits(stats.liquidity, 18), // consistency
            activeLoans: stats.activeLoans.toString(),
            lenderCount: stats.lenderCount.toString(),
            avgInterestRate: stats.avgInterestRate.toString()
        });
      } catch (e) {
          console.warn("LendingPool stats fetch error:", e);
      }

      if (walletAddress) {
        try {
            const limit = await contract.getBorrowLimit(walletAddress);
            setBorrowLimit(ethers.formatUnits(limit, 18));
            
            const loan = await contract.getLoan(walletAddress);
            if (loan && loan.amount > 0n) {
                const owed = await contract.getTotalOwed(walletAddress);
                setUserLoan({
                    amount: ethers.formatUnits(loan.amount, 18),
                    repaidAmount: ethers.formatUnits(loan.repaidAmount, 18),
                    interestRate: loan.interestRate.toString(),
                    startTime: Number(loan.startTime) * 1000,
                    dueDate: Number(loan.dueDate) * 1000,
                    installmentsPaid: loan.installmentsPaid.toString(),
                    totalInstallments: loan.totalInstallments.toString(),
                    status: Number(loan.status),
                    path: Number(loan.path),
                    totalOwed: ethers.formatUnits(owed, 18)
                });
            } else {
                setUserLoan(null);
            }

            const lBalance = await contract.getLenderBalance(walletAddress);
            setLenderBalance(ethers.formatUnits(lBalance, 18));
        } catch (e) {
            console.warn("LendingPool user stats fetch error:", e);
        }
      }
    } catch (err) {
      console.warn("[useLendingPool] error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [provider, walletAddress, isDemoMode, demoStateOverrides, simulateTx]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const requestLoan = async (amount, durationDays, path) => {
    if (!provider || !walletAddress) throw new Error("Wallet not connected");
    const id = showTxLoading("Transmitting loan request to protocol...");
    try {
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(ADDRESSES.LENDING_POOL, LendingPoolABI.abi, signer);
        const amountWei = ethers.parseUnits(amount.toString(), 18);
        const txPromise = contract.requestLoan(amountWei, durationDays, path);
        const tx = await simulateTx(txPromise);
        await tx.wait();
        showTxSuccess(`Capital draw successful: ${amount} TRUST`, tx.hash, id);
        await fetchData();
        return tx;
    } catch (err) {
        showTxError(translateContractError(err), id);
        throw err;
    }
  };

  const makeRepayment = async (amount) => {
    if (!provider || !walletAddress) throw new Error("Wallet not connected");
    const id = showTxLoading("Processing loan repayment...");
    try {
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(ADDRESSES.LENDING_POOL, LendingPoolABI.abi, signer);
        const amountWei = ethers.parseUnits(amount.toString(), 18);
        const txPromise = contract.makeRepayment(amountWei);
        const tx = await simulateTx(txPromise);
        await tx.wait();
        showTxSuccess("Loan balance updated successfully!", tx.hash, id);
        await fetchData();
        return tx;
    } catch (err) {
        showTxError(translateContractError(err), id);
        throw err;
    }
  };
  
  const deposit = async (amount) => {
      if (!provider || !walletAddress) throw new Error("Wallet not connected");
      const id = showTxLoading("Deploying liquidity into pool...");
      try {
          const signer = await provider.getSigner();
          const contract = new ethers.Contract(ADDRESSES.LENDING_POOL, LendingPoolABI.abi, signer);
          const amountWei = ethers.parseUnits(amount.toString(), 18);
          const txPromise = contract.depositToPool(amountWei);
          const tx = await simulateTx(txPromise);
          await tx.wait();
          showTxSuccess(`Position established: ${amount} TRUST`, tx.hash, id);
          await fetchData();
          return tx;
      } catch (err) {
          showTxError(translateContractError(err), id);
          throw err;
      }
  };

  const withdraw = async (amount) => {
      if (!provider || !walletAddress) throw new Error("Wallet not connected");
      const id = showTxLoading("Withdrawing liquidity from pool...");
      try {
          const signer = await provider.getSigner();
          const contract = new ethers.Contract(ADDRESSES.LENDING_POOL, LendingPoolABI.abi, signer);
          const amountWei = ethers.parseUnits(amount.toString(), 18);
          const txPromise = contract.withdrawFromPool(amountWei);
          const tx = await simulateTx(txPromise);
          await tx.wait();
          showTxSuccess(`Liquidity reclaimed: ${amount} TRUST`, tx.hash, id);
          await fetchData();
          return tx;
      } catch (err) {
          showTxError(translateContractError(err), id);
          throw err;
      }
  };

  return { 
    borrowLimit, 
    userLoan, 
    poolStats, 
    lenderBalance, 
    isLoading, 
    requestLoan, 
    makeRepayment, 
    deposit, 
    withdraw, 
    refresh: fetchData 
  };
}
