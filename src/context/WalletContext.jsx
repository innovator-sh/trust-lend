/**
 * WalletContext.jsx
 *
 * Single source of truth for wallet state across TrustLend.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

export const AMOY_CHAIN_ID  = 80002;
export const LOCAL_CHAIN_ID = 31337;

const SUPPORTED_NETWORKS = {
  31337: {
    name: "TrustLend Local",
    chainId: '0x7A69',
    rpcUrl: "http://127.0.0.1:8545",
    isLocal: true,
    params: {
      chainId: '0x7A69',
      chainName: 'TrustLend Local',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['http://127.0.0.1:8545'],
    }
  },
  80002: {
    name: "Polygon Amoy",
    chainId: '0x13882',
    rpcUrl: "https://rpc-amoy.polygon.technology",
    isLocal: false,
    params: {
      chainId: '0x13882',
      chainName: 'Polygon Amoy Testnet',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: ['https://rpc-amoy.polygon.technology'],
      blockExplorerUrls: ['https://amoy.polygonscan.com'],
    }
  }
};

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState('');
  const [chainId,       setChainId]       = useState(0);
  const [provider,      setProvider]      = useState(null);
  const [signer,        setSigner]        = useState(null);
  const [balance,       setBalance]       = useState('0.00');
  const [isConnected,   setIsConnected]   = useState(false);

  const isSupported = !!SUPPORTED_NETWORKS[chainId];

  const shortAddr = (addr) =>
    addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';

  const hydrateEthers = useCallback(async (address) => {
    if (!window.ethereum || !address) return;
    try {
      const p  = new ethers.BrowserProvider(window.ethereum);
      const s  = await p.getSigner();
      const raw = await p.getBalance(address);
      const bal = parseFloat(ethers.formatEther(raw)).toFixed(4);
      setProvider(p);
      setSigner(s);
      setBalance(bal);
    } catch (e) {
      console.warn('[WalletContext] hydrate error:', e);
    }
  }, []);

  const setAccount = useCallback((address, cid) => {
    const lower = address.toLowerCase();
    setWalletAddress(lower);
    setChainId(Number(cid));
    setIsConnected(true);
    sessionStorage.setItem('tl_wallet', lower);
    hydrateEthers(lower);
  }, [hydrateEthers]);

  useEffect(() => {
    if (!window.ethereum) return;
    const autoReconnect = async () => {
      const saved = sessionStorage.getItem('tl_wallet');
      if (!saved) return;
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0 && accounts[0].toLowerCase() === saved) {
          const cid = await window.ethereum.request({ method: 'eth_chainId' });
          setAccount(accounts[0], parseInt(cid, 16));
        }
      } catch (e) {
        console.warn('[WalletContext] auto-reconnect failed:', e);
      }
    };
    autoReconnect();
  }, [setAccount]);

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnectWallet();
      else {
        window.ethereum.request({ method: 'eth_chainId' }).then(cid => {
          setAccount(accounts[0], parseInt(cid, 16));
        });
      }
    };
    const onChainChanged = (hexChainId) => {
      const newId = parseInt(hexChainId, 16);
      setChainId(newId);
      if (walletAddress) hydrateEthers(walletAddress);
      
      if (SUPPORTED_NETWORKS[newId]) {
        toast.success(`Connected to ${SUPPORTED_NETWORKS[newId].name} ✓`, { id: 'chain-change' });
      } else {
        toast.error('Unsupported network — please switch to Local or Amoy', { id: 'chain-change' });
      }
    };
    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged',    onChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum.removeListener('chainChanged',    onChainChanged);
    };
  }, [walletAddress, setAccount, hydrateEthers]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('MetaMask not installed.', { duration: 5000 });
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const hexChainId = await window.ethereum.request({ method: 'eth_chainId' });
      const cid = parseInt(hexChainId, 16);
      setAccount(accounts[0], cid);
      if (!SUPPORTED_NETWORKS[cid]) {
        toast.error('Unsupported network. Please switch.');
      } else {
        toast.success(`Connected: ${shortAddr(accounts[0])}`);
      }
    } catch (err) {
      toast.error(err.message || 'Connection failed.');
    }
  }, [setAccount]);

  const switchNetwork = useCallback(async (id) => {
    if (!window.ethereum || !SUPPORTED_NETWORKS[id]) return;
    const net = SUPPORTED_NETWORKS[id];
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: net.chainId }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [net.params],
        });
      }
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setWalletAddress('');
    setChainId(0);
    setProvider(null);
    setSigner(null);
    setBalance('0.00');
    setIsConnected(false);
    sessionStorage.removeItem('tl_wallet');
  }, []);

  return (
    <WalletContext.Provider value={{
      walletAddress, isConnected, chainId, isSupported, provider, signer, balance,
      shortAddr: shortAddr(walletAddress), connectWallet, disconnectWallet, 
      switchNetwork, networks: SUPPORTED_NETWORKS
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
};
