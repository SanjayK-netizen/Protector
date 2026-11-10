import type { AppRoute } from '../lib/routing';
import { formatHash } from '../lib/routing';

interface AppNavigationProps {
  route: AppRoute;
}

const items: { page: AppRoute['page']; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: '▦' },
  { page: 'inspect', label: 'Inspect a QR', icon: '⌕' },
  { page: 'history', label: 'History & export', icon: '▤' },
  { page: 'limitations', label: 'Limitations', icon: 'ⓘ' },
];

export function AppNavigation({ route }: AppNavigationProps) {
  return (
    <nav className="app-navigation" aria-label="Main navigation">
      <a className="brand-link" href="#/dashboard" aria-label="QRShield dashboard">
        <span className="brand-mark" aria-hidden="true">Q</span>
        <span>QRShield <small>Research prototype</small></span>
      </a>
      <div className="navigation-items">
        {items.map(item => {
          const active = route.page === item.page;
          const href = formatHash({ page: item.page } as AppRoute);
          return (
            <a
              key={item.page}
              className={`navigation-link${active ? ' active' : ''}`}
              href={href}
              aria-current={active ? 'page' : undefined}
            >
              <span className="navigation-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>
      <p className="navigation-footnote">Offline checks · No QR authenticity verification</p>
    </nav>
  );
}
