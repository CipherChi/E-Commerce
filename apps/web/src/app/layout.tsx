import './globals.css';
import { AuthBoundary } from '@/components/auth-boundary';
import { PwaShell } from '@/components/PwaShell';
import { AppLoading } from '@/components/AppLoading';
import { HeroVideo } from '@/components/HeroVideo';

// Nonce-based CSP requires request-time rendering so each response gets matching nonces.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Staywise | Hotel Manager',
  description: 'Manage properties, rooms, reservations, and payments.',
  manifest: '/manifest.json',
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
