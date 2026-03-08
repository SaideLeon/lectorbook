'use client';

import App from '@/App';
import { ToastProvider } from '@/components/ui/Toast';
import { FullscreenProvider } from '@/contexts/FullscreenContext';

export default function HomePage() {
  return (
    <ToastProvider>
      <FullscreenProvider>
        <App />
      </FullscreenProvider>
    </ToastProvider>
  );
}
