import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: 'Harmonic Drive DCT Tooth Calculator',
  description: 'Double-Circular-Arc Common-Tangent Flexspline Tooth Profile Calculator for Harmonic Drives',
  keywords: ['harmonic drive', 'flexspline', 'gear calculator', 'tooth profile', 'DCT'],
  openGraph: {
    title: 'Harmonic Drive DCT Tooth Calculator',
    description: 'Double-Circular-Arc Common-Tangent Flexspline Tooth Profile Calculator for Harmonic Drives',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-surface-300 text-surface-900 antialiased text-sm">
        {children}
      </body>
    </html>
  );
}
