import { RefreshCw, LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
      <span className="text-sm text-gray-500">{user?.email}</span>
      <div className="flex items-center gap-1">
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
