import './globals.css';
import { AuthBoundary } from '@/components/auth-boundary';
import { PwaShell } from '@/components/PwaShell';
import { AppLoading } from '@/components/AppLoading';
import { HeroVideo } from '@/components/HeroVideo';

export const metadata = {
  title: 'E Commerce Site',
  description:
    'Multi-tenant business tools for property operations, catalog, inventory, sales, receipts, and reporting.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'E Commerce Site',
    description:
      'Multi-tenant business tools for property operations, catalog, inventory, sales, receipts, and reporting.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'E Commerce Site',
    description:
      'Multi-tenant business tools for property operations, catalog, inventory, sales, receipts, and reporting.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app-shell">
        <HeroVideo />
        <div className="app-content">
          <AuthBoundary>
            {children}
            <PwaShell />
            <AppLoading />
          </AuthBoundary>
        </div>
      </body>
    </html>
  );
}
