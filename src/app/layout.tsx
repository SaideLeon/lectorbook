import type { Metadata } from 'next';
import '@/index.css';

export const metadata: Metadata = {
  title: 'Brada Iota',
  description: 'Analisador de repositórios com IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
