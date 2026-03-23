import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: 'Harmonic Drive Tooth Design Calculator',
  description: 'An open source design software for building high torque compact gearboxes',
  keywords: ['harmonic drive', 'flexspline', 'gear calculator', 'tooth profile', 'DCT', 'harmonic gearbox', 'strain wave gear', 'gear design', 'mechanical engineering', 'open source', 'high torque', 'compact gearbox'],
  authors: [{ name: 'Harmonic Gearbox Calculator' }],
  metadataBase: new URL('https://harmonicgearboxcalculator.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Harmonic Drive Tooth Design Calculator',
    description: 'An open source design software for building high torque compact gearboxes',
    type: 'website',
    url: 'https://harmonicgearboxcalculator.com',
    siteName: 'Harmonic Drive Tooth Design Calculator',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Harmonic Drive Tooth Design Calculator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Harmonic Drive Tooth Design Calculator',
    description: 'An open source design software for building high torque compact gearboxes',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  other: {
    'application-name': 'Harmonic Drive Tooth Design Calculator',
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
        <script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Harmonic Drive Tooth Design Calculator',
              description: 'An open source design software for building high torque compact gearboxes',
              url: 'https://harmonicgearboxcalculator.com',
              applicationCategory: 'EngineeringApplication',
              operatingSystem: 'Any',
              browserRequirements: 'Requires JavaScript',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              featureList: [
                'Flexspline tooth profile calculation',
                'Interactive 3D model visualization',
                'Double-Circular-Arc Common-Tangent profile generation',
                'Export capabilities',
              ],
            }),
          }}
        />
      </head>
      <body className="h-full bg-surface-300 text-surface-900 antialiased text-sm">
        {children}
      </body>
    </html>
  );
}
