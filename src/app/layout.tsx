import type { Metadata } from 'next';
import '@/index.css';

export const metadata: Metadata = {
  title: 'LectorBook',
  description: 'Tutor de leitura inteligente para estudar repositórios GitHub com IA.',
  manifest: '/manifest.webmanifest',
  themeColor: '#6366f1',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LectorBook',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
