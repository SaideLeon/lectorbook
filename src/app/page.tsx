'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import App from '@/App';
import { ToastProvider } from '@/components/ui/Toast';
import { FullscreenProvider } from '@/contexts/FullscreenContext';
import LandingPage from '@/components/landing/LandingPage';

const ENTERED_APP_KEY = 'lectorbook-entered-app';

export default function HomePage() {
  // Start with null to avoid SSR mismatch
  const [showApp, setShowApp] = useState<boolean | null>(null);

  // Restore previous session preference on mount
  useEffect(() => {
    const previouslyEntered = localStorage.getItem(ENTERED_APP_KEY) === 'true';
    setShowApp(previouslyEntered);
  }, []);

  const handleEnterApp = () => {
    localStorage.setItem(ENTERED_APP_KEY, 'true');
    setShowApp(true);
  };

  // Avoid flash before hydration
  if (showApp === null) {
    return (
      <div className="h-screen w-screen bg-[#080810] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-indigo-500/40 border-t-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <FullscreenProvider>
        <AnimatePresence mode="wait">
          {!showApp ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <LandingPage onEnterApp={handleEnterApp} />
            </motion.div>
          ) : (
            <motion.div
              key="app"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="h-screen"
            >
              <App />
            </motion.div>
          )}
        </AnimatePresence>
      </FullscreenProvider>
    </ToastProvider>
  );
}
