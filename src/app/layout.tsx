import type { Metadata } from 'next';
import '@/index.css';

export const metadata: Metadata = {
  title: 'LectorBook',
  description: 'Tutor de leitura inteligente para estudar repositórios GitHub com IA.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
