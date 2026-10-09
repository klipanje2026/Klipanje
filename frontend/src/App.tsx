import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider/AuthProvider';
import { RequireAccount } from './components/RequireAccount/RequireAccount';
import { EditorLayout } from './components/EditorLayout/EditorLayout';
import { NavigationEffects } from './components/NavigationEffects/NavigationEffects';
import { ThemeToggle } from './components/ThemeToggle';
import { AccountPage } from './pages/AccountPage/AccountPage';
import NotFound from './pages/NotFoundPage/NotFoundPage';
import { MainLayout } from './components/MainLayout';
import { LocalHome } from './pages/LocalHome';
import { LocalScripts } from './pages/LocalScripts';
import { Projects } from './pages/Projects';
import { Photos } from './pages/Photos';
import './components/LocalVideo.scss';
import { ProductionProvider } from './components/ProductionWorkspace';
import './components/Production.scss';
import './components/ProductionRefinements.scss';
import { ChangePassword } from './pages/ChangePassword';
import { Administration } from './pages/Administration';

const ProductionVideo = lazy(() => import('./pages/ProductionVideo').then(module => ({ default: module.ProductionVideo })));


export default function App() {
  return <BrowserRouter><AuthProvider><NavigationEffects /><ThemeToggle />
    <Suspense fallback={<main className="account-page"><p role="status">Učitavanje editora…</p></main>}>
      <Routes>
        <Route path="/login" element={<AccountPage />} />
        <Route element={<RequireAccount />}>
          <Route element={<ProductionProvider><Outlet/></ProductionProvider>}>
          <Route path="/promjena-lozinke" element={<ChangePassword/>}/>
          <Route element={<MainLayout/>}>
            <Route path="/" element={<LocalHome/>}/>
            <Route path="/projekti" element={<Projects/>}/>
            <Route path="/administracija" element={<Administration/>}/>
            <Route path="/skripte" element={<LocalScripts/>}/>
            <Route path="/fotografije" element={<Photos/>}/>
          </Route>
          <Route element={<EditorLayout />}>
          <Route path="/videa" element={<ProductionVideo/>}/>
          <Route path="/video-editor" element={<ProductionVideo/>}/>
          <Route path="/titlovi" element={<Navigate to="/videa" replace/>} />

        </Route></Route></Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </AuthProvider></BrowserRouter>;
}
