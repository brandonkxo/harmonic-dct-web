import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Harmonic Drive DCT Tooth Calculator',
  description: 'Double-Circular-Arc Common-Tangent Flexspline Tooth Profile Calculator for Harmonic Drives',
  keywords: ['harmonic drive', 'flexspline', 'gear calculator', 'tooth profile', 'DCT'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface-950 text-surface-100 antialiased">
        {children}
      </body>
    </html>
  );
}
