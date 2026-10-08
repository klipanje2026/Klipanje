import {AffiliateRequests} from '../components/AffiliateRequests';
import {LivePresence} from '../components/LivePresence';
import {AffiliateAdmin} from '../components/AffiliateAdmin';
import {useAuth} from '../context/auth-context';
import './AdminUsersPage/AdminUsersPage.scss';
export function AffiliateDashboard(){
 const {session}=useAuth();
 if(!session.user?.isStaff)return <main className="billing-workspace affiliate-dashboard"><h1>Affiliate administracija</h1><p>Ova stranica je dostupna samo administratorima.</p></main>;
 return <main className="billing-workspace affiliate-dashboard"><a href="/studio">← Korisnici i paketi</a><h1>Affiliatori</h1><AffiliateRequests admin/><AffiliateAdmin dashboard/><LivePresence/></main>;
}
