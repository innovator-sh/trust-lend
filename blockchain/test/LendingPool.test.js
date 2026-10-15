const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const E = (n) => ethers.parseEther(String(n));
const DAY = 24 * 60 * 60;
const PATH = { Vouch: 0, Collateral: 1, TrustOnly: 2 };
const STATUS = { Active: 0n, Repaid: 1n, Defaulted: 2n };

async function deployFixture() {
  const [owner, lender, borrower, voucher, other, treasury] = await ethers.getSigners();

  const token = await (await ethers.getContractFactory("TrustToken")).deploy();
  const nft = await (await ethers.getContractFactory("ReputationNFT")).deploy(owner.address);
  const vouch = await (await ethers.getContractFactory("VouchSystem")).deploy(
    await token.getAddress(),
    treasury.address
  );
  const pool = await (await ethers.getContractFactory("LendingPool")).deploy(
    await token.getAddress(),
    await nft.getAddress(),
    await vouch.getAddress()
  );

  await nft.setLendingPool(await pool.getAddress());
  await vouch.setLendingPool(await pool.getAddress());

  // Seed the pool the same way deploy.js does: through depositToPool.
  await token.approve(await pool.getAddress(), E(500000));
  await pool.depositToPool(E(500000));

  // Give the other wallets tokens.
  for (const w of [lender, borrower, voucher, other]) {
    await token.transfer(w.address, E(10000));
  }

  return { owner, lender, borrower, voucher, other, treasury, token, nft, vouch, pool };
}

async function lenderDeposits(f, amount) {
  await f.token.connect(f.lender).approve(await f.pool.getAddress(), amount);
  await f.pool.connect(f.lender).depositToPool(amount);
}

async function borrow(f, amount = E(10), days = 30, path = PATH.TrustOnly) {
  await f.pool.connect(f.borrower).requestLoan(amount, days, path);
}

async function repayAll(f) {
  const owed = await f.pool.getRemainingDebt(f.borrower.address);
  await f.token.connect(f.borrower).approve(await f.pool.getAddress(), owed);
  await f.pool.connect(f.borrower).makeRepayment(owed);
}

describe("LendingPool", () => {
  describe("pool accounting", () => {
    it("counts the seeded 500k as pool liquidity, so it can be borrowed", async () => {
      const f = await loadFixture(deployFixture);
      expect(await f.pool.totalPoolLiquidity()).to.equal(E(500000));
      await borrow(f);
      expect(await f.pool.totalLoaned()).to.equal(E(10));
    });

    it("pays a lender exactly the principal when there is no interest (no drain of the seed)", async () => {
      const f = await loadFixture(deployFixture);
      await lenderDeposits(f, E(8000));
      const before = await f.token.balanceOf(f.lender.address);
      await f.pool.connect(f.lender).withdrawFromPool(E(8000));
      const after = await f.token.balanceOf(f.lender.address);
      expect(after - before).to.equal(E(8000));
      expect(await f.pool.totalPoolLiquidity()).to.equal(E(500000));
    });

    it("does not count tokens sent straight to the contract as yield", async () => {
      const f = await loadFixture(deployFixture);
      await lenderDeposits(f, E(1000));
      await f.token.connect(f.other).transfer(await f.pool.getAddress(), E(5000));
      expect(await f.pool.getLenderBalance(f.lender.address)).to.equal(E(1000));
      const before = await f.token.balanceOf(f.lender.address);
      await f.pool.connect(f.lender).withdrawFromPool(E(1000));
      expect((await f.token.balanceOf(f.lender.address)) - before).to.equal(E(1000));
    });

    it("shares interest between all lenders by their share of the pool", async () => {
      const f = await loadFixture(deployFixture);
      await lenderDeposits(f, E(8000)); // 8000 of 508000 shares
      await borrow(f, E(10), 30, PATH.TrustOnly); // 7.1% => owes 10.71
      await time.increase(2 * DAY);
      await repayAll(f);

      const interest = E("0.71");
      const expectedLenderValue = E(8000) + (interest * E(8000)) / E(508000);
      const value = await f.pool.getLenderBalance(f.lender.address);
      // allow 1 wei per share rounding
      expect(value).to.be.closeTo(expectedLenderValue, 10n);

      const before = await f.token.balanceOf(f.lender.address);
      await expect(f.pool.connect(f.lender).withdrawFromPool(value))
        .to.emit(f.pool, "PoolWithdrawal");
      expect((await f.token.balanceOf(f.lender.address)) - before).to.equal(value);
    });

    it("reports yield in the withdrawal event", async () => {
      const f = await loadFixture(deployFixture);
      await lenderDeposits(f, E(8000));
      await borrow(f);
      await time.increase(2 * DAY);
      await repayAll(f);
      const value = await f.pool.getLenderBalance(f.lender.address);
      const tx = await f.pool.connect(f.lender).withdrawFromPool(value);
      const receipt = await tx.wait();
      const ev = receipt.logs
        .map((l) => { try { return f.pool.interface.parseLog(l); } catch { return null; } })
        .find((l) => l && l.name === "PoolWithdrawal");
      expect(ev.args.yieldEarned).to.equal(value - E(8000));
      expect(ev.args.yieldEarned).to.be.gt(0n);
    });

    it("cannot withdraw more than the lender balance", async () => {
      const f = await loadFixture(deployFixture);
      await lenderDeposits(f, E(1000));
      await expect(f.pool.connect(f.lender).withdrawFromPool(E(1001)))
        .to.be.revertedWith("LendingPool: exceeds balance");
    });

    it("addRecovery raises the value of every lender share", async () => {
      const f = await loadFixture(deployFixture);
      await lenderDeposits(f, E(1000));
      const before = await f.pool.getLenderBalance(f.lender.address);
      await f.token.connect(f.other).approve(await f.pool.getAddress(), E(1000));
      await f.pool.connect(f.other).addRecovery(E(1000));
      expect(await f.pool.getLenderBalance(f.lender.address)).to.be.gt(before);
    });
  });

  describe("borrowing", () => {
    it("lets a new wallet take its first loan (starting score 30, limit $10) and mints the NFT", async () => {
      const f = await loadFixture(deployFixture);
      expect(await f.pool.getBorrowLimit(f.borrower.address)).to.equal(E(10));
      await borrow(f, E(10));
      const loan = await f.pool.getLoan(f.borrower.address);
      expect(loan.amount).to.equal(E(10));
      expect(loan.status).to.equal(STATUS.Active);
      expect(await f.pool.getTrustScore(f.borrower.address)).to.equal(30);
      expect(await f.nft.hasNFT(f.borrower.address)).to.equal(true);
    });

    it("rejects an amount above the limit", async () => {
      const f = await loadFixture(deployFixture);
      await expect(f.pool.connect(f.borrower).requestLoan(E(11), 30, PATH.TrustOnly))
        .to.be.revertedWith("LendingPool: exceeds trust limit");
    });

    it("rejects a second loan while one is active", async () => {
      const f = await loadFixture(deployFixture);
      await borrow(f);
      await expect(f.pool.connect(f.borrower).requestLoan(E(5), 30, PATH.TrustOnly))
        .to.be.revertedWith("LendingPool: active loan exists");
    });

    it("rejects the unavailable collateral path", async () => {
      const f = await loadFixture(deployFixture);
      await expect(f.pool.connect(f.borrower).requestLoan(E(5), 30, PATH.Collateral))
        .to.be.revertedWith("LendingPool: collateral path unavailable");
    });

    it("blocks a wallet with a score below the minimum", async () => {
      const f = await loadFixture(deployFixture);
      await f.pool.updateTrustScore(f.borrower.address, 15);
      expect(await f.pool.getBorrowLimit(f.borrower.address)).to.equal(0n);
      await expect(f.pool.connect(f.borrower).requestLoan(E(5), 30, PATH.TrustOnly))
        .to.be.revertedWith("LendingPool: trust score too low");
    });

    it("rejects a loan above the free pool liquidity", async () => {
      const f = await loadFixture(deployFixture);
      await f.pool.updateTrustScore(f.borrower.address, 85); // limit $500
      // Make the pool smaller than the limit: owner withdraws almost all.
      await f.pool.withdrawFromPool(E(500000) - E(100));
      await expect(f.pool.connect(f.borrower).requestLoan(E(500), 30, PATH.TrustOnly))
        .to.be.revertedWith("LendingPool: insufficient pool liquidity");
    });
  });

  describe("scoring", () => {
    it("gives no bonus for a loan repaid inside one day (farming guard)", async () => {
      const f = await loadFixture(deployFixture);
      await borrow(f);
      await repayAll(f);
      expect(await f.pool.getTrustScore(f.borrower.address)).to.equal(30);
      expect((await f.pool.getLoan(f.borrower.address)).status).to.equal(STATUS.Repaid);
    });

    it("gives +12 for an early repayment after one day", async () => {
      const f = await loadFixture(deployFixture);
      await borrow(f);
      await time.increase(2 * DAY);
      await repayAll(f);
      expect(await f.pool.getTrustScore(f.borrower.address)).to.equal(42);
      const rep = await f.nft.getReputation(f.borrower.address);
      expect(rep.trustScore).to.equal(42);
      expect(rep.loansRepaid).to.equal(1n);
    });

    it("gives +3 for a late repayment", async () => {
      const f = await loadFixture(deployFixture);
      await borrow(f, E(10), 10);
      await time.increase(12 * DAY);
      await repayAll(f);
      expect(await f.pool.getTrustScore(f.borrower.address)).to.equal(33);
    });

    it("updateTrustScore updates the NFT and keeps the loan counters", async () => {
      const f = await loadFixture(deployFixture);
      await f.pool.updateTrustScore(f.borrower.address, 68);
      const rep = await f.nft.getReputation(f.borrower.address);
      expect(rep.trustScore).to.equal(68);
      expect(rep.loansRepaid).to.equal(0n);
      expect(await f.pool.getBorrowLimit(f.borrower.address)).to.equal(E(200));
    });
  });

  describe("defaults", () => {
    it("cannot mark a loan as defaulted before the due date", async () => {
      const f = await loadFixture(deployFixture);
      await borrow(f, E(10), 30);
      await expect(f.pool.markDefault(f.borrower.address))
        .to.be.revertedWith("LendingPool: loan not overdue");
    });

    it("cannot mark a wallet with no loan as defaulted", async () => {
      const f = await loadFixture(deployFixture);
      await expect(f.pool.markDefault(f.other.address))
        .to.be.revertedWith("LendingPool: not active");
    });

    it("writes off the unpaid principal and all lenders share the loss", async () => {
      const f = await loadFixture(deployFixture);
      await lenderDeposits(f, E(8000));
      const valueBefore = await f.pool.getPoolValue();
      await borrow(f, E(10), 30);
      await time.increase(31 * DAY);
      await expect(f.pool.markDefault(f.borrower.address))
        .to.emit(f.pool, "LossRealized").withArgs(f.borrower.address, E(10));

      expect(await f.pool.getPoolValue()).to.equal(valueBefore - E(10));
      expect(await f.pool.totalLoaned()).to.equal(0n);
      expect(await f.pool.getLenderBalance(f.lender.address)).to.be.lt(E(8000));
      expect(await f.pool.getTrustScore(f.borrower.address)).to.equal(15);
      const rep = await f.nft.getReputation(f.borrower.address);
      expect(rep.loansRepaid).to.equal(0n);
    });

    it("keeps the pool solvent so every lender can still withdraw after a default", async () => {
      const f = await loadFixture(deployFixture);
      await lenderDeposits(f, E(8000));
      await borrow(f, E(10), 30);
      await time.increase(31 * DAY);
      await f.pool.markDefault(f.borrower.address);

      const lenderValue = await f.pool.getLenderBalance(f.lender.address);
      await f.pool.connect(f.lender).withdrawFromPool(lenderValue);
      const ownerValue = await f.pool.getLenderBalance(f.owner.address);
      await f.pool.withdrawFromPool(ownerValue);
      expect(await f.pool.totalShares()).to.be.lte(2n);
    });

    it("blocks a new loan until the defaulted loan is repaid", async () => {
      const f = await loadFixture(deployFixture);
      await f.pool.updateTrustScore(f.borrower.address, 85);
      await borrow(f, E(100), 30);
      await time.increase(31 * DAY);
      await f.pool.markDefault(f.borrower.address);

      expect(await f.pool.getTrustScore(f.borrower.address)).to.equal(70);
      await expect(f.pool.connect(f.borrower).requestLoan(E(50), 30, PATH.TrustOnly))
        .to.be.revertedWith("LendingPool: unpaid defaulted loan");

      // Repaying the defaulted debt returns value to the pool and clears the block.
      const valueBefore = await f.pool.getPoolValue();
      const owed = await f.pool.getRemainingDebt(f.borrower.address);
      await f.token.connect(f.borrower).approve(await f.pool.getAddress(), owed);
      await f.pool.connect(f.borrower).makeRepayment(owed);
      expect(await f.pool.getPoolValue()).to.equal(valueBefore + owed);
      expect((await f.pool.getLoan(f.borrower.address)).status).to.equal(STATUS.Repaid);
      expect(await f.pool.getTrustScore(f.borrower.address)).to.equal(70); // no bonus

      await f.pool.connect(f.borrower).requestLoan(E(50), 30, PATH.TrustOnly);
    });
  });

  describe("vouching", () => {
    it("rejects a VouchBacked loan without enough stake", async () => {
      const f = await loadFixture(deployFixture);
      await expect(f.pool.connect(f.borrower).requestLoan(E(5), 30, PATH.Vouch))
        .to.be.revertedWith("LendingPool: not enough vouch stake");
    });

    it("accepts a VouchBacked loan with stake, returns the stake on repayment", async () => {
      const f = await loadFixture(deployFixture);
      await f.token.connect(f.voucher).approve(await f.vouch.getAddress(), E(5));
      await f.vouch.connect(f.voucher).stakeForBorrower(f.borrower.address, E(5));

      await f.pool.connect(f.borrower).requestLoan(E(5), 30, PATH.Vouch);
      const before = await f.token.balanceOf(f.voucher.address);
      await time.increase(2 * DAY);
      await repayAll(f);
      expect((await f.token.balanceOf(f.voucher.address)) - before).to.equal(E(5));
      expect(await f.vouch.getTotalActiveStake(f.borrower.address)).to.equal(0n);
    });

    it("slashes the stake to the treasury on default", async () => {
      const f = await loadFixture(deployFixture);
      await f.token.connect(f.voucher).approve(await f.vouch.getAddress(), E(5));
      await f.vouch.connect(f.voucher).stakeForBorrower(f.borrower.address, E(5));
      await f.pool.connect(f.borrower).requestLoan(E(5), 30, PATH.Vouch);

      const before = await f.token.balanceOf(f.treasury.address);
      await time.increase(31 * DAY);
      await f.pool.markDefault(f.borrower.address);
      expect((await f.token.balanceOf(f.treasury.address)) - before).to.equal(E(5));
    });

    it("lets the voucher reclaim a stake while the borrower has no active loan", async () => {
      const f = await loadFixture(deployFixture);
      await f.token.connect(f.voucher).approve(await f.vouch.getAddress(), E(5));
      await f.vouch.connect(f.voucher).stakeForBorrower(f.borrower.address, E(5));
      const before = await f.token.balanceOf(f.voucher.address);
      await f.vouch.connect(f.voucher).reclaimStake(0);
      expect((await f.token.balanceOf(f.voucher.address)) - before).to.equal(E(5));
    });

    it("blocks a reclaim while the borrower has an active loan", async () => {
      const f = await loadFixture(deployFixture);
      await f.token.connect(f.voucher).approve(await f.vouch.getAddress(), E(5));
      await f.vouch.connect(f.voucher).stakeForBorrower(f.borrower.address, E(5));
      await f.pool.connect(f.borrower).requestLoan(E(5), 30, PATH.Vouch);
      await expect(f.vouch.connect(f.voucher).reclaimStake(0))
        .to.be.revertedWith("Borrower has an active loan");
    });

    it("rejects a stake below the minimum and a self-vouch", async () => {
      const f = await loadFixture(deployFixture);
      await f.token.connect(f.voucher).approve(await f.vouch.getAddress(), E(100));
      await expect(f.vouch.connect(f.voucher).stakeForBorrower(f.borrower.address, 1n))
        .to.be.revertedWith("Stake below minimum");
      await expect(f.vouch.connect(f.voucher).stakeForBorrower(f.voucher.address, E(2)))
        .to.be.revertedWith("Cannot vouch for yourself");
    });

    it("caps the active vouches per borrower", async () => {
      const f = await loadFixture(deployFixture);
      await f.token.connect(f.voucher).approve(await f.vouch.getAddress(), E(100));
      for (let i = 0; i < 10; i++) {
        await f.vouch.connect(f.voucher).stakeForBorrower(f.borrower.address, E(1));
      }
      await expect(f.vouch.connect(f.voucher).stakeForBorrower(f.borrower.address, E(1)))
        .to.be.revertedWith("Too many active vouches");
    });

    it("requires repaid-loan history when the owner sets a minimum", async () => {
      const f = await loadFixture(deployFixture);
      await f.vouch.setMinVoucherRepaidLoans(1);
      await f.token.connect(f.voucher).approve(await f.vouch.getAddress(), E(5));
      await expect(f.vouch.connect(f.voucher).stakeForBorrower(f.borrower.address, E(5)))
        .to.be.revertedWith("Voucher needs repaid loan history");
    });
  });

  describe("access control", () => {
    it("only the owner can set scores, mark defaults, mint and pause", async () => {
      const f = await loadFixture(deployFixture);
      const nonOwner = f.other;
      await expect(f.pool.connect(nonOwner).updateTrustScore(f.borrower.address, 90))
        .to.be.revertedWithCustomError(f.pool, "OwnableUnauthorizedAccount");
      await expect(f.pool.connect(nonOwner).markDefault(f.borrower.address))
        .to.be.revertedWithCustomError(f.pool, "OwnableUnauthorizedAccount");
      await expect(f.pool.connect(nonOwner).mintReputationNFT(f.borrower.address))
        .to.be.revertedWithCustomError(f.pool, "OwnableUnauthorizedAccount");
      await expect(f.pool.connect(nonOwner).pause())
        .to.be.revertedWithCustomError(f.pool, "OwnableUnauthorizedAccount");
    });

    it("only the pool or the owner can settle vouch stakes", async () => {
      const f = await loadFixture(deployFixture);
      await expect(f.vouch.connect(f.other).settleBorrower(f.borrower.address, true))
        .to.be.revertedWith("VouchSystem: not owner or pool");
      await expect(f.nft.connect(f.other).syncScore(f.borrower.address, 50))
        .to.be.revertedWith("ReputationNFT: caller is not LendingPool");
    });

    it("uses a two-step ownership transfer", async () => {
      const f = await loadFixture(deployFixture);
      await f.pool.transferOwnership(f.other.address);
      expect(await f.pool.owner()).to.equal(f.owner.address); // not changed yet
      await f.pool.connect(f.other).acceptOwnership();
      expect(await f.pool.owner()).to.equal(f.other.address);
    });

    it("stops deposits, loans and repayments while paused", async () => {
      const f = await loadFixture(deployFixture);
      await f.pool.pause();
      await expect(f.pool.connect(f.borrower).requestLoan(E(5), 30, PATH.TrustOnly))
        .to.be.revertedWithCustomError(f.pool, "EnforcedPause");
    });
  });
});
