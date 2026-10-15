import { Link } from 'react-router-dom';

export default function Header({ backTo, backLabel }) {
  return (
    <div className="screen__header">
      {backTo && (
        <Link to={backTo} className="back-link" style={{ marginBottom: 16 }}>
          <iconify-icon icon="lucide:chevron-left" width="20" height="20"></iconify-icon>
          <span>{backLabel || 'Back'}</span>
        </Link>
      )}
      <Link to="/dashboard" className="app-header" aria-label="TrustLend Home">
        <div className="app-header__logo">
          <iconify-icon icon="lucide:landmark"></iconify-icon>
        </div>
        <span className="app-header__brand">TrustLend</span>
      </Link>
    </div>
  );
}
