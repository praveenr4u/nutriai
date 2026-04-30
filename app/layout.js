import './globals.css';
import ServiceWorker from '../components/ServiceWorker';

export const metadata = {
  title: 'NutriAI – AI Calorie Counter',
  description: 'AI-powered food scanner & personalised calorie tracker. Scan food, track macros, get a meal plan.',
  keywords: ['calorie counter', 'food scanner', 'nutrition tracker', 'meal plan', 'AI diet'],
  authors: [{ name: 'Praveen Ramachandran' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NutriAI',
  },
  openGraph: {
    title: 'NutriAI – AI Calorie Counter',
    description: 'Scan food with AI, track calories and get a personalised meal plan.',
    url: 'https://nutriai-sigma.vercel.app',
    siteName: 'NutriAI',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#111111',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS PWA support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NutriAI" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />

        {/* iOS splash screen colour */}
        <meta name="msapplication-TileColor" content="#111111" />
        <meta name="msapplication-TileImage" content="/icon-512.png" />

        {/* Favicon */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="shortcut icon" href="/icon-192.png" />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
