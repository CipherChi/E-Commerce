import './globals.css';
import { AuthBoundary } from '@/components/auth-boundary';

export const metadata = {
  title: 'Staywise | Hotel Manager',
  description: 'Manage properties, rooms, reservations, and payments.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthBoundary>{children}</AuthBoundary>
      </body>
    </html>
  );
}
