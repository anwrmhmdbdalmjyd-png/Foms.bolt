import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { queryClient } from './lib/queryClient.js';
import './index.css';

// ============================================================
//  src/main.jsx
//
//  App entry point. Provider order matters:
//  1. BrowserRouter      — outermost, everything needs routing
//  2. QueryClientProvider — React Query cache available app-wide
//  3. AuthProvider        — depends on nothing else here, but
//                           pages/hooks below it need useAuth()
//  4. App                 — the actual router config + pages
// ============================================================

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
