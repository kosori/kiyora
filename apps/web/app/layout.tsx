import { cn } from 'cn';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { BUILD_MARKER } from './build-marker';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  description: 'Kiyora web app',
  other: { 'kiyora-build': BUILD_MARKER },
  title: 'Kiyora',
};

const Layout = ({ children }: LayoutProps<'/'>) => (
  <html className={cn(geistSans.variable)} lang='en'>
    <body>{children}</body>
  </html>
);

export default Layout;
