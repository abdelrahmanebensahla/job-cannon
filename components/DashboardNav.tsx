'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/dashboard', label: 'Today', mobileLabel: 'Today' },
  { href: '/dashboard/history', label: 'History', mobileLabel: 'History' },
  { href: '/dashboard/resume', label: 'Resume', mobileLabel: 'Resume' },
  { href: '/dashboard/billing', label: 'Billing', mobileLabel: 'Billing' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

export function DashboardSidebar() {
  const pathname = usePathname();
  return (
    <nav className="hidden shrink-0 sm:block sm:w-44">
      <ul className="sticky top-20 space-y-0.5 text-sm">
        {ITEMS.map(item => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'block rounded-md px-3 py-1.5 transition-colors',
                  active
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DashboardBottomBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur sm:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(item => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center py-2.5 text-xs transition-colors',
                  active
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.mobileLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
