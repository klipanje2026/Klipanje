import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
export function RequireAccount() {
  const { session } = useAuth();
  const location = useLocation();
  if (!session.user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
  if (session.user.mustChangePassword && location.pathname !== '/promjena-lozinke') return <Navigate to="/promjena-lozinke" replace />;
  return <Outlet />;
}
