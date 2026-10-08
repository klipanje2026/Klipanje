import {initializeTheme} from './lib/theme';
import { createRoot } from 'react-dom/client';
import App from './App';
import ControlTooltips from './components/ControlTooltips';
import '@fontsource-variable/manrope';
import './styles/tailwind.css';
import './styles/index.scss';
initializeTheme();

createRoot(document.getElementById('root')!).render(<><App /><ControlTooltips /></>);
