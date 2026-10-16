import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { ADDRESSES } from '../contracts/addresses';
import LendingPoolABI from '../contracts/LendingPool.json';
import TrustTokenABI from '../contracts/TrustToken.json';
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
  const [lenderBalance, setLenderBalance] = useState("0.0"); // current value of the lender's shares
  const [lenderPosition, setLenderPosition] = useState({ principal: "0.0", value: "0.0", yieldEarned: "0.0" });
  const [poolUsage, setPoolUsage] = useState({ poolValue: "0.0", onLoan: "0.0", defaultRatePct: null, finishedLoans: 0 });
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
        setLenderPosition({ principal: "0.0", value: "0.0", yieldEarned: "0.0" });
        setPoolUsage({ poolValue: demoStateOverrides.poolLiquidity.toString(), onLoan: "0.0", defaultRatePct: null, finishedLoans: 0 });
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
            // The contract returns basis points (420 = 4.2%). The UI shows percent.
            avgInterestRate: (Number(stats.avgInterestRate) / 100).toString()
        });
      } catch (e) {
          console.warn("LendingPool stats fetch error:", e);
      }

      try {
        const [value, onLoan, rate] = await Promise.all([
          contract.getPoolValue(), contract.totalLoaned(), contract.getDefaultRate(),
        ]);
        const finished = Number(rate.finished);
        setPoolUsage({
          poolValue: ethers.formatUnits(value, 18),
          onLoan: ethers.formatUnits(onLoan, 18),
          // null = no finished loan yet, so no rate can be measured
          defaultRatePct: finished === 0 ? null : Number(rate.rateBps) / 100,
          finishedLoans: finished,
        });
      } catch (e) {
        console.warn("LendingPool usage fetch error:", e);
      }

      if (walletAddress) {
        try {
            const limit = await contract.getBorrowLimit(walletAddress);
            setBorrowLimit(ethers.formatUnits(limit, 18));
            
            const loan = await contract.getLoan(walletAddress);
            // LoanStatus.Active is 0, so an empty record also reads as 0. Check the amount too.
            // A repaid or defaulted loan is history, not an active loan.
            if (loan && loan.amount > 0n && Number(loan.status) === 0) {
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

            const pos = await contract.getLenderPosition(walletAddress);
            const principal = ethers.formatUnits(pos.principal, 18);
            const value = ethers.formatUnits(pos.value, 18);
            setLenderBalance(value);
            setLenderPosition({
              principal,
              value,
              // value minus principal. It is negative after a default, because lenders share the loss.
              yieldEarned: ethers.formatUnits(pos.value - pos.principal, 18),
            });
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
      const amountWei = ethers.parseUnits(amount.toString(), 18);
      const signer = await provider.getSigner();

      // 1. The pool pulls the tokens, so it needs an allowance first.
      const token = new ethers.Contract(ADDRESSES.TRUST_TOKEN, TrustTokenABI.abi, signer);
      const allowance = await token.allowance(walletAddress, ADDRESSES.LENDING_POOL);
      if (allowance < amountWei) {
          const approveId = showTxLoading("Approving TRUST for the pool...");
          try {
              const approveTx = await simulateTx(token.approve(ADDRESSES.LENDING_POOL, amountWei));
              await approveTx.wait();
              showTxSuccess(`${amount} TRUST approved`, approveTx.hash, approveId);
          } catch (err) {
              showTxError(translateContractError(err), approveId);
              throw err;
          }
      }

      // 2. Deposit.
      const id = showTxLoading("Deploying liquidity into pool...");
      try {
          const contract = new ethers.Contract(ADDRESSES.LENDING_POOL, LendingPoolABI.abi, signer);
          const tx = await simulateTx(contract.depositToPool(amountWei));
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
    lenderPosition,
    poolUsage,
    isLoading, 
    requestLoan, 
    makeRepayment, 
    deposit, 
    withdraw, 
    refresh: fetchData 
  };
}
