'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Profile = { id: string; name: string; email: string; businessId: string | null };
const publicPaths = new Set(['/', '/login', '/register']);

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (publicPaths.has(pathname)) {
      setChecking(false);
      return;
    }
    setChecking(true);
    if (!sessionStorage.getItem('staywise.accessToken')) {
      window.location.replace('/login');
      return;
    }
    apiRequest<Profile>('/auth/me')
      .then((user) => {
        setProfile(user);
        if (!user.businessId && pathname !== '/business') window.location.replace('/business');
        else if (user.businessId && pathname === '/business')
          window.location.replace('/properties');
      })
      .catch(() => {
        sessionStorage.removeItem('staywise.accessToken');
        sessionStorage.removeItem('staywise.refreshToken');
        sessionStorage.removeItem('staywise.user');
        window.location.replace('/login');
      })
      .finally(() => setChecking(false));
  }, [pathname]);

  if (publicPaths.has(pathname)) return children;
  if (checking || !profile || (!profile.businessId && pathname !== '/business')) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12 text-sm text-ink/60">
        Checking your session…
      </main>
    );
  }

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Clear the local session even when the server is unreachable.
    } finally {
      sessionStorage.removeItem('staywise.accessToken');
      sessionStorage.removeItem('staywise.refreshToken');
      sessionStorage.removeItem('staywise.user');
      window.location.assign('/login');
    }
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-ink/10 bg-white px-6 py-3 text-sm sm:px-10">
        <span className="text-ink/65">
          {profile.name} · {profile.email}
        </span>
        <button className="font-medium text-accent" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}
