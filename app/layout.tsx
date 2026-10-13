import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Semi_Condensed } from 'next/font/google';
import './globals.css';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-barlow', display: 'swap' });
const barlowSc = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['700', '800', '900'], variable: '--font-barlow-sc', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Reportes · Aquí Estamos', template: '%s · Aquí Estamos' },
  description: 'Reportes financieros y operativos de Aquí Estamos.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFBF3' },
    { media: '(prefers-color-scheme: dark)', color: '#071F2B' },
  ],
};

// Aplica el tema antes de pintar: preferencia guardada o, la primera vez, la del sistema.
const temaInicial = `(function(){try{var t=localStorage.getItem('ae-tema');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowSc.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
