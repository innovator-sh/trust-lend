import { Navigate } from 'react-router-dom';
import { getValidSession } from '../lib/session';

/**
 * Guards any route behind a signed sign-in.
 * No valid, unexpired signature for the stored wallet → redirect to /connect.
 */
export default function ProtectedRoute({ children }) {
  if (!getValidSession()) return <Navigate to="/connect" replace />;
  return children;
}
