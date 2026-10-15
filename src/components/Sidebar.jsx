import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const currentPath = location.pathname;
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();

  const isActive = (path) => currentPath === path;

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 transform 
      ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} 
      lg:relative lg:translate-x-0 
      w-80 border-r transition-all duration-500 ease-in-out
      flex flex-col h-screen
      bg-white dark:bg-[#1A1A1A] border-[#E8E8E8] dark:border-[#333]
    `}>
      <div className="p-10 pb-16 flex justify-between items-center group">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#C9A961] flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-500">
            <iconify-icon icon="lucide:crown" className="text-2xl text-white animate-pulse"></iconify-icon>
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-[#1A1A1A] dark:text-white block leading-none">
              AETHER<span className="font-light opacity-60 ml-1">GOLD</span>
            </span>
            <span className="text-[9px] font-black tracking-[0.3em] text-[#D4AF37] uppercase leading-none mt-1 block">
              {t('sidebar.tagline')}
            </span>
          </div>
        </div>
        <button className={`lg:hidden text-2xl hover:rotate-90 transition-transform ${isDarkMode ? 'text-white' : 'text-[#1A1A1A]'}`} onClick={() => setMobileOpen(false)}>
          <iconify-icon icon="lucide:x"></iconify-icon>
        </button>
      </div>
      
      <nav className="flex-1 px-8 space-y-4 overflow-y-auto hide-scrollbar">
        <div className="mb-10">
          <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.4em] mb-6 ml-2">{t('sidebar.main')}</p>
          <div className="space-y-3">
            {[
              { to: '/dashboard',   label: t('sidebar.dashboard'),   icon: 'lucide:layout-grid' },
              { to: '/borrow',      label: t('sidebar.borrow'),      icon: 'lucide:landmark' },
              { to: '/marketplace', label: t('sidebar.marketplace'), icon: 'lucide:shopping-bag' }
            ].map((link) => (
              <Link 
                key={link.to}
                to={link.to} 
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-5 px-6 py-4 rounded-xl font-medium transition-all group ${
                  isActive(link.to) 
                    ? 'text-[#D4AF37] border-r-2 border-[#D4AF37] bg-[#D4AF37]/5'
                    : 'text-[#8C8C8C] hover:text-[#D4AF37] hover:bg-[#D4AF37]/5'
                }`}
              >
                <iconify-icon icon={link.icon} className="text-xl"></iconify-icon>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.4em] mb-6 ml-2">{t('sidebar.loansMoney')}</p>
          <div className="space-y-3">
            {[
              { to: '/loan/1',    label: t('sidebar.myLoans'),     icon: 'lucide:activity' },
              { to: '/portfolio', label: t('sidebar.myPortfolio'), icon: 'lucide:briefcase' },
              { to: '/ledger',    label: t('sidebar.transactions'),icon: 'lucide:scroll' }
            ].map((link) => (
              <Link 
                key={link.to}
                to={link.to} 
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-5 px-6 py-4 rounded-xl font-medium transition-all group ${
                  isActive(link.to) 
                    ? 'text-[#D4AF37] border-r-2 border-[#D4AF37] bg-[#D4AF37]/5'
                    : 'text-[#8C8C8C] hover:text-[#D4AF37] hover:bg-[#D4AF37]/5'
                }`}
              >
                <iconify-icon icon={link.icon} className="text-xl"></iconify-icon>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="pb-10">
          <p className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.4em] mb-6 ml-2">{t('sidebar.yourProfile')}</p>
          <div className="space-y-3">
            {[
              { to: '/audit',      label: t('sidebar.creditProfile'),  icon: 'lucide:shield-check' },
              { to: '/reputation', label: t('sidebar.trustScore'),      icon: 'lucide:award' },
              { to: '/network',    label: t('sidebar.vouchNetwork'),    icon: 'lucide:network' }
            ].map((link) => (
              <Link 
                key={link.to}
                to={link.to} 
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-5 px-6 py-4 rounded-xl font-medium transition-all group ${
                  isActive(link.to) 
                    ? 'text-[#D4AF37] border-r-2 border-[#D4AF37] bg-[#D4AF37]/5'
                    : 'text-[#8C8C8C] hover:text-[#D4AF37] hover:bg-[#D4AF37]/5'
                }`}
              >
                <iconify-icon icon={link.icon} className="text-xl"></iconify-icon>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
