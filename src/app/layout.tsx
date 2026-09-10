import type { Metadata } from 'next';
import { Montserrat, Open_Sans, Poppins } from 'next/font/google';
import './globals.css';

// Load the three house fonts from Google Fonts and expose them as CSS variables
// consumed by tailwind.config.js (font-heading / font-sans / font-numeric).
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});
const openSans = Open_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-open-sans',
  display: 'swap',
});
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GCO Partners Platform',
  description: 'Client portal and diligence workspace for GCO Partners.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${openSans.variable} ${poppins.variable}`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
