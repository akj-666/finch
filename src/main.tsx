import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Prevent any default browser alert/confirm/prompt dialogs from ever appearing
if (typeof window !== 'undefined') {
  window.alert = (message?: any) => {
    console.warn('[Finch UI] Native window.alert prevented:', message);
  };
  window.confirm = (message?: string) => {
    console.warn('[Finch UI] Native window.confirm prevented:', message);
    return false;
  };
  window.prompt = (message?: string) => {
    console.warn('[Finch UI] Native window.prompt prevented:', message);
    return null;
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
