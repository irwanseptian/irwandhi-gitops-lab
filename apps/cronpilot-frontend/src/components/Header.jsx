import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function Header() {
  const queryClient = useQueryClient();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end">
      <button
        onClick={() => queryClient.invalidateQueries()}
        title="Refresh"
        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <RefreshCw size={17} />
      </button>
    </header>
  );
}
