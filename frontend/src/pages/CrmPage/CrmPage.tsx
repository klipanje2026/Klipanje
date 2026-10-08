import { useAuth } from '../../context/auth-context';
import { StudioDashboard } from '../../components/StudioDashboard/StudioDashboard';
export function CrmPage() {
  const { session } = useAuth();
  return session.user?.isStaff ? <main className="studio-page"><header className="studio-header"><h1>Lead & booking CRM</h1></header><StudioDashboard /></main>
    : <main className="account-page"><p>Ovaj dio aplikacije dostupan je administratoru.</p></main>;
}
