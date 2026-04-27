import { NavLink } from 'react-router-dom';
import { LayoutDashboard, List, PlusCircle, Clock } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/jobs',      icon: List,            label: 'Jobs'      },
  { to: '/jobs/new',  icon: PlusCircle,      label: 'New Job'   },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Clock className="text-sky-400" size={20} />
          <span className="text-lg font-bold">CronPilot</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Cron-as-a-Service</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/jobs'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-sky-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-3 border-t border-gray-700">
        <p className="text-xs text-gray-500">v1.0.0</p>
      </div>
    </aside>
  );
}
