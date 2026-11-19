import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom';
import './index.css';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { Overview } from './pages/Overview';

const ch13 = () => import('./content/chapters1to3');
const ch46 = () => import('./content/chapters4to6');
const Chapter1 = lazy(() => ch13().then((m) => ({ default: m.Chapter1 })));
const Chapter2 = lazy(() => ch13().then((m) => ({ default: m.Chapter2 })));
const Chapter3 = lazy(() => ch13().then((m) => ({ default: m.Chapter3 })));
const Chapter4 = lazy(() => ch46().then((m) => ({ default: m.Chapter4 })));
const Chapter5 = lazy(() => ch46().then((m) => ({ default: m.Chapter5 })));
const Chapter6 = lazy(() => ch46().then((m) => ({ default: m.Chapter6 })));
const Appendices = lazy(() => import('./content/appendices').then((m) => ({ default: m.Appendices })));
const ReportPage = lazy(() => import('./pages/Report').then((m) => ({ default: m.ReportPage })));
const ResourcesPage = lazy(() => import('./pages/Resources').then((m) => ({ default: m.ResourcesPage })));
const EDAgentPage = lazy(() => import('./edagent/EDAgentPage').then((m) => ({ default: m.EDAgentPage })));

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-serif text-3xl font-semibold">Page not found</h1>
      <p className="mt-3 text-ink-soft">
        <Link className="link" to="/">Return to the overview</Link>.
      </p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<div className="mx-auto max-w-7xl px-4"><Spinner label="Loading page…" /></div>}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/introduction" element={<Chapter1 />} />
            <Route path="/data-cleaning" element={<Chapter2 />} />
            <Route path="/visualization" element={<Chapter3 />} />
            <Route path="/feature-engineering" element={<Chapter4 />} />
            <Route path="/model-fitting" element={<Chapter5 />} />
            <Route path="/conclusion" element={<Chapter6 />} />
            <Route path="/appendices" element={<Appendices />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/edagent" element={<EDAgentPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  </StrictMode>,
);
