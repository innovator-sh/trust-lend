import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import BottomTabBar from './BottomTabBar';

export default function Layout() {
  const location = useLocation();
  const hideBottomTabPaths = ['/', '/wallet-selection'];
  const showBottomTab = !hideBottomTabPaths.includes(location.pathname);

  return (
    <div className="app-container">
      {/* Decorative Background Elements */}
      <div className="blur-blob -top-20 -left-20"></div>
      <div className="blur-blob bottom-40 -right-20"></div>

      <Header />
      
      <main className={`flex-1 overflow-y-auto px-6 pt-6 z-10 ${showBottomTab ? 'pb-[122px]' : ''}`}>
        <Outlet />
      </main>

      {showBottomTab && <BottomTabBar />}
    </div>
  );
}
