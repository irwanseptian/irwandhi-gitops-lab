import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../api/auth';

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm]     = useState({ current: '', next: '', confirm: '' });
  const [success, setSuccess] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const mut = useMutation({
    mutationFn: () => changePassword(form.current, form.next),
    onSuccess: () => {
      setSuccess(true);
      setForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setSuccess(false), 4000);
    },
    onError: (err) => {
      setFieldError(err.response?.data?.error || 'Failed to update password');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setFieldError('');
    setSuccess(false);
    if (form.next !== form.confirm) {
      setFieldError('New passwords do not match');
      return;
    }
    if (form.next.length < 6) {
      setFieldError('New password must be at least 6 characters');
      return;
    }
    mut.mutate();
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Profile</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your account settings</p>

      {/* Account info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Account</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-semibold text-sm select-none">
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{user?.email}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <KeyRound size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Change Password</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.current}
              onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.next}
              onChange={e => setForm(f => ({ ...f, next: e.target.value }))}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              autoComplete="new-password"
            />
          </div>

          {fieldError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fieldError}</p>
          )}

          {success && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 size={15} />
              Password updated successfully
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={mut.isPending}
              className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {mut.isPending ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
