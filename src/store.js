import { create } from 'zustand';

// Calculate tier based on score
function getTierInfo(score) {
  if (score >= 800) return { name: 'Diamond', limit: 5000, collateralReq: 'None' };
  if (score >= 700) return { name: 'Platinum', limit: 3000, collateralReq: '10%' };
  if (score >= 600) return { name: 'Gold', limit: 1250, collateralReq: 'None' }; // Standard 
  if (score >= 500) return { name: 'Silver', limit: 500, collateralReq: '50%' };
  return { name: 'Bronze', limit: 100, collateralReq: '100%' };
}

export const useStore = create((set, get) => ({
  user: {
    walletConnected: false,
    walletAddress: null,
    role: null, // 'borrower' | 'lender'
    reputationScore: 650,
    tier: getTierInfo(650).name,
    borrowLimit: getTierInfo(650).limit,
    collateralRequired: getTierInfo(650).collateralReq,
    loansRepaid: 3,
    streak: 3,
    balanceUsd: 2500,
  },
  activeLoan: null,
  pastLoans: [],
  lenderPortfolio: [],
  groups: [],
  notifications: [],

  // Actions
  connectWallet: (address) => set((state) => ({
    user: { ...state.user, walletConnected: true, walletAddress: address }
  })),

  setRole: (role) => set((state) => ({
    user: { ...state.user, role }
  })),

  borrowFunds: (amount, duration) => set((state) => {
    const newLoan = {
      id: `LN-${Math.floor(Math.random() * 10000)}`,
      amount,
      duration,
      status: 'active',
      dueDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
      interestRate: 5.5,
      healthRatio: 1.5, // 150% SAFE mock
    };
    return {
      activeLoan: newLoan,
      user: { ...state.user, balanceUsd: state.user.balanceUsd + amount }
    };
  }),

  repayLoan: () => set((state) => {
    if (!state.activeLoan) return state;
    
    // increase score on repay
    const newScore = Math.min(850, state.user.reputationScore + 15);
    const tierInfo = getTierInfo(newScore);

    return {
      pastLoans: [...state.pastLoans, { ...state.activeLoan, status: 'repaid' }],
      activeLoan: null,
      user: {
        ...state.user,
        balanceUsd: state.user.balanceUsd - state.activeLoan.amount * 1.055, // approx repayment with interest
        reputationScore: newScore,
        tier: tierInfo.name,
        borrowLimit: tierInfo.limit,
        collateralRequired: tierInfo.collateralReq,
        loansRepaid: state.user.loansRepaid + 1,
        streak: state.user.streak + 1
      }
    };
  }),

  fundMarketplaceLoan: (loanId, amountFunded) => set((state) => {
    const investment = { loanId, amountFunded, status: 'active', expectedReturn: amountFunded * 1.06 };
    return {
      lenderPortfolio: [...state.lenderPortfolio, investment],
      user: { ...state.user, balanceUsd: state.user.balanceUsd - amountFunded }
    };
  }),
}));
