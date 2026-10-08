import { createContext, useContext } from 'react';
export type Session = { user: { id: number; username: string; name: string; isStaff: boolean; mustChangePassword?:boolean; avatar?:string; role?:string; affiliateLink?:string|null } | null;
  workspaces: { id: string; name: string; role: string }[] };
export const AuthContext = createContext<{ session: Session; refresh: () => Promise<void> } | null>(null);
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider required');
  return auth;
}
