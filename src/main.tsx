import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppProviders } from './app/AppProviders';
import { GlobalErrorBoundary } from './app/GlobalErrorBoundary';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Opening Trainer root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </GlobalErrorBoundary>
  </StrictMode>,
);
