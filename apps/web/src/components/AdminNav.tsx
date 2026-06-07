import { Link, useLocation } from 'react-router-dom';

const ITEMS = [
  { to: '/admin', label: '概览' },
  { to: '/admin/reports', label: '举报审核' },
  { to: '/admin/users', label: '用户管理' },
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
