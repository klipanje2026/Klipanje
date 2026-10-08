import { Navigate, useParams } from 'react-router-dom';
import { ServiceDetail } from '../../components/ServiceDetail/ServiceDetail';
import { englishServices } from '../../data/service-content';
import NotFound from '../NotFoundPage/NotFoundPage';
const aliases: Record<string, string> = { 'custom-crm': 'custom-software-development', 'booking-systems': 'custom-software-development', 'business-automation': 'ai-automation' };
export function ServicePage() {
  const { slug } = useParams();
  if (slug && aliases[slug]) return <Navigate to={`/services/${aliases[slug]}`} replace />;
  const service = englishServices.find(entry => entry.slug === slug);
  return service ? <ServiceDetail service={service} /> : <NotFound />;
}
