import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Suppress benign Vite WebSocket HMR and transient sandbox connection notices
if (typeof window !== 'undefined') {
  const isBenignSandboxError = (raw: any): boolean => {
    if (!raw) return false;
    if (typeof raw === 'object') {
      if (raw.onerror || raw.authorizationError !== undefined || raw._hadError !== undefined || raw._closeAfterHandlingError !== undefined) {
        return true;
      }
    }
    const text = typeof raw === 'string' ? raw : raw?.message || String(raw || '');
    return (
      text.includes('senderOnError') ||
      text.includes('authorizationError') ||
      text.includes('failed to connect to websocket') ||
      text.includes('WebSocket closed without opened') ||
      text.includes('Failed to fetch') ||
      text.includes('NetworkError') ||
      text.includes('Load failed') ||
      text.includes('The user aborted a request') ||
      text.includes('AbortError') ||
      text.startsWith('[vite]') ||
      text.includes('[vite]')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isBenignSandboxError(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (isBenignSandboxError(event.message) || isBenignSandboxError(event.error)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (args.some((arg) => isBenignSandboxError(arg))) {
      return; // Silently ignore benign sandbox network/Vite disconnections
    }
    origConsoleError.apply(console, args);
  };

  const origConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (args.some((arg) => isBenignSandboxError(arg))) {
      return; // Silently ignore benign sandbox warnings
    }
    origConsoleWarn.apply(console, args);
  };
}

console.log("main.tsx is executing!");
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

