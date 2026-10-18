import { cn } from 'cn';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-sans',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  description: 'Kiyora web app',
  title: 'Kiyora',
};

const Layout = ({ children }: LayoutProps<'/'>) => (
  <html className={cn(geistSans.variable, geistMono.variable)} lang='en'>
    <body>{children}</body>
  </html>
);

export default Layout;
