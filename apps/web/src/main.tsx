import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App';
import './styles.css';
import { AuthProvider } from './context/AuthContext';
import { OnboardingProvider } from './context/OnboardingContext';
import { resetBodyScroll } from './utils/scrollLock';
import { destroyOnboardingDriver } from './onboarding/driver';
import { initSentry, isSentryEnabled } from './monitoring/sentry';

resetBodyScroll();
destroyOnboardingDriver();
initSentry();

const appTree = (
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OnboardingProvider>
          <App />
        </OnboardingProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

createRoot(document.getElementById('root')!).render(
  isSentryEnabled() ? (
    <Sentry.ErrorBoundary
      fallback={
        <div className="app-bg">
          <div className="loading">页面加载失败，请刷新后重试</div>
        </div>
      }
    >
      {appTree}
    </Sentry.ErrorBoundary>
  ) : (
    appTree
  ),
);
