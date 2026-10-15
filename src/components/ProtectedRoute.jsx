import { Navigate } from 'react-router-dom';

/**
 * Guards any route behind wallet authentication.
 * No wallet in sessionStorage → redirect to /connect.
 */
export default function ProtectedRoute({ children }) {
  const wallet = sessionStorage.getItem('tl_wallet');
  if (!wallet) return <Navigate to="/connect" replace />;
  return children;
}
