require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { 
  PRIVATE_KEY_DEPLOYER, 
  PRIVATE_KEY_BORROWER, 
  PRIVATE_KEY_LENDER, 
  PRIVATE_KEY_VOUCHER, 
  AMOY_RPC_URL, 
  LOCAL_RPC_URL 
} = process.env;

const ALL_KEYS = [
  PRIVATE_KEY_DEPLOYER,
  PRIVATE_KEY_BORROWER,
  PRIVATE_KEY_LENDER,
  PRIVATE_KEY_VOUCHER
].filter(Boolean).map(k => k.startsWith("0x") ? k : `0x${k}`);

// Without keys in .env, the local node uses its own funded accounts ("remote").
const LOCAL_ACCOUNTS = ALL_KEYS.length ? ALL_KEYS : "remote";

module.exports = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      viaIR: true,
    },
  },

  networks: {
    localhost: {
      url: LOCAL_RPC_URL || "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: LOCAL_ACCOUNTS
    },
    amoy: {
      url: AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: ALL_KEYS
    },
  },

  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY || "",
  },

  paths: {
    sources:   "./contracts",
    artifacts: "./artifacts",
  },
};
