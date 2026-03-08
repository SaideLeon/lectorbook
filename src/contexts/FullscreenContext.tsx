import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface FullscreenContextType {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

const FullscreenContext = createContext<FullscreenContextType>({
  isFullscreen: false,
  toggleFullscreen: () => {},
});

export const useFullscreen = () => useContext(FullscreenContext);

export function FullscreenProvider({ children }: { children: ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);

    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Erro ao alternar tela cheia:', err);
    }
  };

  return (
    <FullscreenContext.Provider value={{ isFullscreen, toggleFullscreen }}>
      {children}
    </FullscreenContext.Provider>
  );
}
