import { Home, TrendingUp, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store';

export default function BottomTabBar() {
  const location = useLocation();
  const role = useStore((state) => state.user.role);
  
  const getTabClass = (path) => {
    return location.pathname === path ? 'text-[#F5A623]' : 'text-gray-400';
  };

  const homePath = role === 'lender' ? '/lender-dashboard' : '/borrower-dashboard';
  const investPath = '/marketplace';
  const profilePath = '/profile';

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[88px] bg-[#0F1420] border-t border-white/5 flex items-center justify-around px-4 z-50">
      <Link to={homePath} className={`flex flex-col items-center gap-1 transition-colors hover:text-[#F5A623] ${getTabClass(homePath)}`}>
        <Home className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
      </Link>
      <Link to={investPath} className={`flex flex-col items-center gap-1 transition-colors hover:text-[#F5A623] ${getTabClass(investPath)}`}>
        <TrendingUp className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Invest</span>
      </Link>
      <Link to={profilePath} className={`flex flex-col items-center gap-1 transition-colors hover:text-[#F5A623] ${getTabClass(profilePath)}`}>
        <User className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Profile</span>
      </Link>
    </nav>
  );
}
