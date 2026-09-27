import './globals.css';

export const metadata = {
  title: 'Staywise | Hotel Manager',
  description: 'Manage properties, rooms, reservations, and payments.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
