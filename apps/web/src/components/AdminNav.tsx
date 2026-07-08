import { Link, useLocation } from 'react-router-dom';

const ITEMS = [
  { to: '/admin', label: '姒傝' },
  { to: '/admin/reports', label: '涓炬姤瀹℃牳' },
  { to: '/admin/ai', label: 'AI 统计' },
  { to: '/admin/users', label: '鐢ㄦ埛绠＄悊' },
];

export function AdminNav() {
  const location = useLocation();

  return (
    <nav className="admin-nav">
      {ITEMS.map((item) => {
        const active =
          item.to === '/admin'
            ? location.pathname === '/admin'
            : location.pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`admin-nav-link glass-panel ${active ? 'active' : ''}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}