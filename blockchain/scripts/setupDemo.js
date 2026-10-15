const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting Demo Setup on:", hre.network.name);

  // 1. Get contract addresses from the published frontend file
  const addressesPath = path.join(__dirname, "../../src/contracts/addresses.js");
  if (!fs.existsSync(addressesPath)) {
    throw new Error("Addresses file not found. Run deploy.js first.");
  }
  const content = fs.readFileSync(addressesPath, 'utf8');
  const trustTokenAddr = content.match(/TRUST_TOKEN: "([^"]+)"/)[1];
  const lendingPoolAddr = content.match(/LENDING_POOL: "([^"]+)"/)[1];
  const reputationNFTAddr = content.match(/REPUTATION_NFT: "([^"]+)"/)[1];
  const vouchSystemAddr = content.match(/VOUCH_SYSTEM: "([^"]+)"/)[1];

  console.log("Using contracts:");
  console.log("- TRUST:", trustTokenAddr);
  console.log("- Pool:", lendingPoolAddr);

  // 2. Get the 4 wallets from signers (assuming Hardhat node)
  const [deployer, borrower, lender, voucher] = await hre.ethers.getSigners();
  console.log("Demo Wallets:");
  console.log("- DEPLOYER:", deployer.address);
  console.log("- BORROWER:", borrower.address);
  console.log("- LENDER:", lender.address);
  console.log("- VOUCHER:", voucher.address);

  // 3. Contracts
  const trustToken = await hre.ethers.getContractAt("TrustToken", trustTokenAddr);
  const lendingPool = await hre.ethers.getContractAt("LendingPool", lendingPoolAddr);
  const vouchSystem = await hre.ethers.getContractAt("VouchSystem", vouchSystemAddr);

  // 4. Multi-wallet setup actions
  const trustUnits = (amt) => hre.ethers.parseEther(amt.toString());

  console.log("1. Transferring 10,000 TRUST to LENDER...");
  await trustToken.connect(deployer).transfer(lender.address, trustUnits(10000));

  console.log("2. Transferring 500 TRUST to VOUCHER...");
  await trustToken.connect(deployer).transfer(voucher.address, trustUnits(500));

  console.log("3. Transferring 0.1 ETH/MATIC to BORROWER for gas...");
  // On local node, they already have 10000 ETH, so this is just protocol check
  await deployer.sendTransaction({ to: borrower.address, value: hre.ethers.parseEther("0.1") });

  console.log("4. LENDER: Approving and Depositing 8,000 TRUST into pool...");
  await trustToken.connect(lender).approve(lendingPoolAddr, trustUnits(8000));
  await lendingPool.connect(lender).depositToPool(trustUnits(8000));

  console.log("5. Call lendingPool.updateTrustScore(BORROWER, 68)...");
  await lendingPool.connect(deployer).updateTrustScore(borrower.address, 68);

  console.log("6. Mint ReputationNFT for BORROWER...");
  // The updateTrustScore already synced the NFT if it existed, but we need to mint it first
  // Actually, we'll mint it now.
  await lendingPool.connect(deployer).mintReputationNFT(borrower.address);
  // Re-syncing score to 68 since mint default is 30
  await lendingPool.connect(deployer).updateTrustScore(borrower.address, 68);

  // 7. Log final state
  console.log("──────────────────────────────────────────────────");
  console.log("DEMO STATE READY");
  console.log("- Pool Liquidity: 508,000 TRUST (500k seed + 8k lender)");
  console.log("- Borrower Address:", borrower.address);
  console.log("- Borrower Score: 68 (Silver Tier)");
  console.log("- Borrower Limit: $200");
  console.log("- Lender Deposit: 8,000 TRUST");
  console.log("──────────────────────────────────────────────────");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
