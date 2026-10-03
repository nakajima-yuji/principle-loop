import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useServerActivity } from '../data/server-activity.ts';
import { useToast } from '../data/toast.ts';
import { href, navigate, type Route } from '../router.ts';
import { Icon, Logo, type IconName } from './Icon.tsx';

interface NavDef {
  path: string;
  label: string;
  sub: string;
  icon: IconName;
}

export const MAIN_NAV: readonly NavDef[] = [
  { path: '/daily', label: 'DAILY', sub: '今日の原理', icon: 'sun' },
  { path: '/deep', label: 'DEEP', sub: '原理を深く分解', icon: 'search' },
  { path: '/diary', label: 'DIARY', sub: '保存した原理', icon: 'book' },
  { path: '/connect', label: 'CONNECT', sub: '原理をつなげる', icon: 'connect' },
  { path: '/build', label: 'BUILD', sub: '試してつくる', icon: 'cube' },
];

function activeSection(path: string): string {
  if (path === '/' || path === '/daily' || path === '/read') return '/daily';
  return path;
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const section = activeSection(route.path);
  const server = useServerActivity();
  const paused = server.activity?.paused === true;
  const toast = useToast();
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState(route.path === '/search' ? route.params.get('q') ?? '' : '');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (route.path === '/search') setQ(route.params.get('q') ?? '');
  }, [route]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate('/search', { q: q.trim() });
  };

  return (
    <div className="app">
      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <a className="brand" href={href('/daily')} aria-label="PRINCIPLE LOOP ホーム">
          <Logo size={44} />
          <span className="brand-name">PRINCIPLE LOOP</span>
        </a>
        <span className="brand-tagline">あらゆる現象から、原理を見つけ、分解し、保存し、試す。</span>
        <span className="header-spacer" />
        <form className="search-box" role="search" onSubmit={onSearch}>
          <Icon name="search" size={17} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="原理・タグ・キーワードで検索…"
            aria-label="検索"
          />
        </form>
        <a className="icon-btn mobile-only" href={href('/search')} aria-label="検索">
          <Icon name="search" />
        </a>
        <a
          className="icon-btn"
          href={href('/activity')}
          aria-label={paused ? 'お知らせ：一時停止中' : 'お知らせ・アクティビティ'}
          title={paused ? 'PRINCIPLE LOOP は一時停止中です' : 'アクティビティ'}
        >
          <Icon name="bell" />
          {paused && <span className="dot" />}
        </a>
        <a className="icon-btn" href={href('/settings')} aria-label="設定" title="設定">
          <span className="avatar">
            <Icon name="user" size={20} stroke={2} />
          </span>
        </a>
      </header>

      <nav className="sidebar" aria-label="メインメニュー">
        {MAIN_NAV.map((n) => (
          <a key={n.path} className={`nav-item ${section === n.path ? 'active' : ''}`} href={href(n.path)}>
            <Icon name={n.icon} size={26} stroke={1.6} className="nav-icon" />
            <span>
              <span className="nav-label">{n.label}</span>
              <span className="nav-sub">{n.sub}</span>
            </span>
          </a>
        ))}
        <div className="nav-divider" />
        <a className={`nav-sub-item ${section === '/activity' ? 'active' : ''}`} href={href('/activity')}>
          <Icon name="chart" size={19} />
          <span>統計・アクティビティ</span>
        </a>
        <a className={`nav-sub-item ${section === '/settings' ? 'active' : ''}`} href={href('/settings')}>
          <Icon name="gear" size={19} />
          <span>設定</span>
        </a>
        <div className="sidebar-quote">
          日常にひそむ原理が、
          <br />
          次のアイデアをつくる。
          <svg viewBox="0 0 200 56" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 30 C 40 14, 70 40, 110 26 S 170 12, 200 24 L200 56 L0 56Z" fill="#dfe8f4" />
            <path d="M0 40 C 50 26, 90 50, 130 36 S 180 28, 200 34 L200 56 L0 56Z" fill="#cfdcee" />
          </svg>
        </div>
      </nav>

      <main className="main" id="main">
        {children}
      </main>

      <nav className="tabbar" aria-label="メインメニュー">
        {MAIN_NAV.map((n) => (
          <a key={n.path} className={section === n.path ? 'active' : ''} href={href(n.path)}>
            <Icon name={n.icon} size={22} />
            {n.label}
          </a>
        ))}
      </nav>

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <Icon name="check" size={16} />
          {toast.message}
        </div>
      )}
    </div>
  );
}
