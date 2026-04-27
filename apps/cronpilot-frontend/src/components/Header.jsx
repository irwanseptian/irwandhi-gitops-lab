import { RefreshCw, LogOut, UserCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    clearAuth();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link to="/profile" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
        <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 text-xs font-semibold group-hover:bg-sky-200 transition-colors select-none">
          {user?.email?.[0]?.toUpperCase()}
        </div>
        {user?.email}
      </Link>
      <div className="flex items-center gap-1">
        <Link
          to="/profile"
          title="Profile"
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <UserCircle size={17} />
        </Link>
        <button
          onClick={() => queryClient.invalidateQueries()}
          title="Refresh"
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw size={17} />
        </button>
        <button
          onClick={handleLogout}
          title="Logout"
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
