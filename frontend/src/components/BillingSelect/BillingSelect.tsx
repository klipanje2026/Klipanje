import { LanguageDropdown } from '../LanguageDropdown/LanguageDropdown';
import './BillingSelect.scss';

export function BillingSelect(props: Parameters<typeof LanguageDropdown>[0]) {
  return <div className="billing-select"><LanguageDropdown {...props}/></div>;
}
