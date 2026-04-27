import { NavLink } from 'react-router-dom';
import { LayoutDashboard, List, PlusCircle, Clock, Users, Briefcase, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/jobs',      icon: List,            label: 'Jobs'      },
  { to: '/jobs/new',  icon: PlusCircle,      label: 'New Job'   },
];

const adminItems = [
  { to: '/admin/jobs',  icon: Briefcase, label: 'All Jobs' },
  { to: '/admin/users', icon: Users,     label: 'Users'    },
];

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive ? 'bg-sky-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }`
      }
    >
      <Icon size={17} />
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { isAdmin } = useAuth();

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
        {navItems.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} end={to === '/jobs'} />
        ))}
      </nav>

      {isAdmin && (
        <div className="px-3 pb-4 border-t border-gray-700 pt-3">
          <div className="flex items-center gap-1.5 px-3 mb-2">
            <ShieldAlert size={13} className="text-amber-400" />
            <span className="text-xs text-amber-400 font-medium uppercase tracking-wider">Admin</span>
          </div>
          <div className="space-y-1">
            {adminItems.map(({ to, icon, label }) => (
              <NavItem key={to} to={to} icon={icon} label={label} />
            ))}
          </div>
        </div>
      )}

      <div className="px-5 py-3 border-t border-gray-700">
        <p className="text-xs text-gray-500">v1.0.0</p>
      </div>
    </aside>
  );
}
