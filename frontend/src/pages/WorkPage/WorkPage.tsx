import { useParams } from 'react-router-dom';
import { CaseStudyDetail } from '../../components/CaseStudyDetail/CaseStudyDetail';
import { englishCaseStudies } from '../../data/case-studies';
import NotFound from '../NotFoundPage/NotFoundPage';
export function WorkPage() {
  const { slug } = useParams(); const study = englishCaseStudies.find(entry => entry.slug === slug);
  return study ? <CaseStudyDetail study={study} /> : <NotFound />;
}
