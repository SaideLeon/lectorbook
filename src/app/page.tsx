'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import App from '@/App';
import { ToastProvider } from '@/components/ui/Toast';
import { FullscreenProvider } from '@/contexts/FullscreenContext';
import LandingPage from '@/components/landing/LandingPage';

export default function HomePage() {
  const [showApp, setShowApp] = useState(false);

  const handleEnterApp = () => {
    setShowApp(true);
  };

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
