'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/dashboard', label: 'Today' },
  { href: '/dashboard/history', label: 'History' },
  { href: '/dashboard/resume', label: 'Resume' },
  { href: '/dashboard/review', label: 'Review' },
  { href: '/dashboard/billing', label: 'Billing' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

export function DashboardSidebar() {
  const pathname = usePathname();
  return (
    <nav className="hidden shrink-0 sm:block sm:w-40">
      <ul className="sticky top-20 space-y-3 text-[0.9375rem]">
        {ITEMS.map(item => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block py-1 transition-colors',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
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
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background sm:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(item => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  // min-h enforces a 44px touch target on mobile (WCAG 2.5.5).
                  'flex min-h-[44px] flex-col items-center justify-center py-3 text-[0.75rem] transition-colors',
                  active
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
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
