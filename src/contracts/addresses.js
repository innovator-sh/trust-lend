export const ADDRESSES = {
  TRUST_TOKEN: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  LENDING_POOL: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  REPUTATION_NFT: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  VOUCH_SYSTEM: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  CHAIN_ID: 31337,
  EXPLORER: ""
};

// A local chain has no block explorer. The helpers return "#" in that case.
export const explorerTxUrl = (hash) => ADDRESSES.EXPLORER ? `${ADDRESSES.EXPLORER}/tx/${hash}` : "#";
export const explorerAddrUrl = (addr) => ADDRESSES.EXPLORER ? `${ADDRESSES.EXPLORER}/address/${addr}` : "#";
