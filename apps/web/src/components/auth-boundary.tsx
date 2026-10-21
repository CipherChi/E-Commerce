'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest, refreshAccessToken, setAccessToken } from '@/lib/api';
import { getNavigationLinks } from '@/lib/auth-navigation.mjs';

// /auth/me exposes the current BusinessMember.role here; User.role is account metadata only.
type Profile = {
  id: string;
  name: string;
  email: string;
  businessId: string | null;
  role: string | null;
  business?: { name: string } | null;
};
type Module = { module: string; isEnabled: boolean };
const publicPaths = new Set(['/', '/login', '/register']);
const ownerOnly = [
  '/properties',
  '/bookings',
  '/products',
  '/inventory',
  '/expenses',
  '/staff',
  '/settings',
  '/business',
];

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pathname.startsWith('/public/receipt/')) {
      setChecking(false);
      return;
    }
    if (pathname === '/') {
      void refreshAccessToken()
        .then((token) => (token ? apiRequest<Profile>('/auth/me') : null))
        .then((user) => {
          if (user) router.replace(user.businessId ? '/dashboard' : '/business');
        })
        .catch(() => setAccessToken(null));
      return;
    }
    if (publicPaths.has(pathname)) {
      setChecking(false);
      return;
    }
    setChecking(true);
    let cancelled = false;
    void refreshAccessToken()
      .then((token) => {
        if (!token) throw new Error('Session expired');
        return apiRequest<Profile>('/auth/me');
      })
      .then(async (user) => {
        if (cancelled) return;
        setProfile(user);
        if (!user.businessId && pathname !== '/business') {
          router.replace('/business');
          return;
        }
        if (user.businessId) {
          const rows = await apiRequest<Module[]>('/businesses/modules');
          if (cancelled) return;
          setModules(rows);
          const staff = user.role !== 'OWNER';
          if (
            staff &&
            ownerOnly.some((path) => pathname === path || pathname.startsWith(`${path}/`))
          ) {
            router.replace('/dashboard');
            return;
          }
        }
        if (pathname === '/business' && user.businessId) router.replace('/dashboard');
      })
      .catch(() => {
        if (!cancelled) {
          setAccessToken(null);
          router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (pathname === '/') return children;
  if (pathname.startsWith('/public/receipt/')) return children;
  if (publicPaths.has(pathname)) return children;
  if (checking || !profile || (!profile.businessId && pathname !== '/business'))
    return (
      <main className="mx-auto max-w-4xl px-6 py-12 text-sm text-ink/60">
        Checking your session…
      </main>
    );

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      /* Clear local session regardless. */
    }
    setAccessToken(null);
    router.replace('/login');
  }
  const staff = profile.role !== 'OWNER';
  const enabled = new Set(modules.filter((m) => m.isEnabled).map((m) => m.module));
  const links = getNavigationLinks(profile.role, [...enabled]);
  const sidebar = (
    <aside className="flex h-full flex-col bg-primary px-4 py-6 text-white">
      <Link href="/dashboard" className="mb-8 px-3 text-sm font-bold tracking-[.18em] text-ink">
        STAYWISE
      </Link>
      <nav className="space-y-1">
        {links.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`block rounded-xl px-3 py-2.5 text-sm transition ${pathname === href || pathname.startsWith(`${href}/`) ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto border-t border-white/15 pt-4">
        <p className="px-3 text-sm font-semibold">{profile.name}</p>
        <p className="px-3 pt-1 text-xs text-white/60">
          {staff ? 'Staff' : 'Owner'}
          {profile.business?.name ? ` · ${profile.business.name}` : ''}
        </p>
        <button
          onClick={() => void logout()}
          className="mt-4 w-full rounded-xl px-3 py-2 text-left text-sm text-white/75 hover:bg-white/10"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
  return (
    <div className="min-h-screen bg-paper md:flex">
      <div className="hidden md:fixed md:inset-y-0 md:block md:w-64">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-72">{sidebar}</div>
        </div>
      )}
      <div className="min-w-0 flex-1 md:ml-64">
        <div className="sticky top-0 z-30 flex items-center border-b border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg border border-ink/10 px-3 py-2 text-sm"
          >
            ☰ Menu
          </button>
          <span className="ml-4 text-sm font-semibold">STAYWISE</span>
        </div>
        {children}
      </div>
    </div>
  );
}
