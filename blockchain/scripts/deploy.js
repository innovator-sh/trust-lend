const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment on:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Deploy TrustToken
  const TrustToken = await hre.ethers.getContractFactory("TrustToken");
  const trustToken = await TrustToken.deploy();
  await trustToken.waitForDeployment();
  const trustTokenAddr = await trustToken.getAddress();
  console.log("TRUST Token deployed to:", trustTokenAddr);

  // 2. Deploy ReputationNFT (passing deployer as initial lendingPool so we can mint in script)
  const ReputationNFT = await hre.ethers.getContractFactory("ReputationNFT");
  const reputationNFT = await ReputationNFT.deploy(deployer.address);
  await reputationNFT.waitForDeployment();
  const reputationNFTAddr = await reputationNFT.getAddress();
  console.log("ReputationNFT deployed to:", reputationNFTAddr);

  // 3. Deploy VouchSystem (needed for voucher demo)
  const VouchSystem = await hre.ethers.getContractFactory("VouchSystem");
  const vouchSystem = await VouchSystem.deploy(trustTokenAddr, deployer.address); // use deployer as treasury for now
  await vouchSystem.waitForDeployment();
  const vouchSystemAddr = await vouchSystem.getAddress();
  console.log("VouchSystem deployed to:", vouchSystemAddr);

  // 4. Deploy LendingPool (linking TrustToken, ReputationNFT and VouchSystem)
  const LendingPool = await hre.ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(trustTokenAddr, reputationNFTAddr, vouchSystemAddr);
  await lendingPool.waitForDeployment();
  const lendingPoolAddr = await lendingPool.getAddress();
  console.log("LendingPool deployed to:", lendingPoolAddr);

  // 5. Link ReputationNFT and VouchSystem to LendingPool
  console.log("Linking ReputationNFT and VouchSystem to LendingPool...");
  await (await reputationNFT.setLendingPool(lendingPoolAddr)).wait();
  await (await vouchSystem.setLendingPool(lendingPoolAddr)).wait();

  // 5b. Production switches. A test network keeps the faucet and open vouching.
  //     Any other network gets the faucet off and a repaid-loan rule for vouchers.
  const isTestNetwork = ["hardhat", "localhost", "amoy"].includes(hre.network.name);
  if (!isTestNetwork) {
    console.log("Real network: disabling the faucet and requiring voucher history...");
    await (await trustToken.setFaucetEnabled(false)).wait();
    await (await vouchSystem.setMinVoucherRepaidLoans(1)).wait();
  } else if (process.env.REQUIRE_VOUCHER_HISTORY === "true") {
    await (await vouchSystem.setMinVoucherRepaidLoans(1)).wait();
  }

  // 6. Seed the pool with liquidity (500k TRUST).
  //    Use depositToPool so the pool counts the tokens. A plain transfer is NOT counted.
  console.log("Seeding pool with 500,000 TRUST...");
  const seed = hre.ethers.parseEther("500000");
  await (await trustToken.approve(lendingPoolAddr, seed)).wait();
  await (await lendingPool.depositToPool(seed)).wait();

  // 7. Write addresses to frontend src/contracts/addresses.js and blockchain/deployed.json
  const explorerUrl = hre.network.name === "amoy" ? "https://amoy.polygonscan.com" : "";
  const addressesPath = path.join(__dirname, "../../src/contracts/addresses.js");
  const addressesContent = `export const ADDRESSES = {
  TRUST_TOKEN: "${trustTokenAddr}",
  LENDING_POOL: "${lendingPoolAddr}",
  REPUTATION_NFT: "${reputationNFTAddr}",
  VOUCH_SYSTEM: "${vouchSystemAddr}",
  CHAIN_ID: ${hre.network.config.chainId || 31337},
  EXPLORER: "${explorerUrl}"
};

// A local chain has no block explorer. The helpers return "#" in that case.
export const explorerTxUrl = (hash) => ADDRESSES.EXPLORER ? \`\${ADDRESSES.EXPLORER}/tx/\${hash}\` : "#";
export const explorerAddrUrl = (addr) => ADDRESSES.EXPLORER ? \`\${ADDRESSES.EXPLORER}/address/\${addr}\` : "#";
`;

  fs.writeFileSync(addressesPath, addressesContent);
  console.log("✓ Addresses written to frontend.");

  const deployed = {
    network: hre.network.name,
    chainId: String(hre.network.config.chainId || 31337),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    TrustToken: trustTokenAddr,
    ReputationNFT: reputationNFTAddr,
    VouchSystem: vouchSystemAddr,
    LendingPool: lendingPoolAddr,
  };
  fs.writeFileSync(path.join(__dirname, "../deployed.json"), JSON.stringify(deployed, null, 2) + "\n");
  console.log("✓ deployed.json written.");

  // 8. Auto-export ABIs to frontend src/contracts/
  const contractsDir = path.join(__dirname, "../../src/contracts");
  const abiFiles = [
    { name: "TrustToken.json", path: "TrustToken.json" },
    { name: "LendingPool.json", path: "LendingPool.json" },
    { name: "ReputationNFT.json", path: "ReputationNFT.json" },
    { name: "VouchSystem.json", path: "VouchSystem.json" },
  ];

  abiFiles.forEach(file => {
    const artifact = hre.artifacts.readArtifactSync(file.name.split('.')[0]);
    fs.writeFileSync(path.join(contractsDir, file.name), JSON.stringify(artifact, null, 2));
  });
  console.log("✓ ABIs exported to frontend.");

  console.log("──────────────────────────────────────────────────");
  console.log("DEPLOYMENT COMPLETE");
  console.log("TRUST Token:", trustTokenAddr);
  console.log("LendingPool:", lendingPoolAddr);
  console.log("ReputationNFT:", reputationNFTAddr);
  console.log("VouchSystem:", vouchSystemAddr);
  console.log("──────────────────────────────────────────────────");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
