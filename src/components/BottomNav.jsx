import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/dashboard', icon: 'lucide:home', label: 'Home', key: 'home' },
  { to: '/group', icon: 'lucide:users', label: 'Groups', key: 'groups' },
  { to: '/marketplace', icon: 'lucide:trending-up', label: 'Invest', key: 'invest' },
  { to: '/profile', icon: 'lucide:user', label: 'Profile', key: 'profile' },
];

export default function BottomNav() {
  return (
    <nav className="tab-bar" aria-label="Main navigation">
      {tabs.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.to}
          className={({ isActive }) =>
            `tab-bar__item ${isActive ? 'tab-bar__item--active' : ''}`
          }
          aria-label={tab.label}
        >
          <iconify-icon icon={tab.icon} width="24" height="24"></iconify-icon>
          <span className="tab-bar__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
