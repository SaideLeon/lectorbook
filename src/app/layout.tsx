import type { Metadata } from 'next';
import '@/index.css';

export const metadata: Metadata = {
  title: 'Lectorbook',
  description: 'Leitor inteligente de artigos com conversação por IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
