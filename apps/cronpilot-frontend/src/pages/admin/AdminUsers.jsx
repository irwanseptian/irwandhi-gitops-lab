import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Pencil, Trash2, X, ShieldCheck, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/admin';
import { useAuth } from '../../context/AuthContext';

function RoleBadge({ role }) {
  return role === 'admin'
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><ShieldCheck size={11} />admin</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><User size={11} />user</span>;
}

const EMPTY_FORM = { email: '', password: '', role: 'user' };

function UserModal({ initial, onClose, onSave, loading, error }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(
    isEdit ? { email: initial.email, password: '', role: initial.role } : EMPTY_FORM
  );

  function handleSubmit(e) {
    e.preventDefault();
    const payload = isEdit
      ? { role: form.role, ...(form.password ? { password: form.password } : {}) }
      : { email: form.email, password: form.password, role: form.role };
    onSave(payload);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Edit User' : 'New User'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          {!isEdit && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="user@example.com" />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {isEdit ? 'New Password' : 'Password'}
              {isEdit && <span className="text-gray-400 font-normal ml-1">(leave blank to keep)</span>}
            </label>
            <input type="password" value={form.password} minLength={isEdit ? 0 : 6}
              required={!isEdit}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder={isEdit ? 'Leave blank to keep current' : 'At least 6 characters'} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg">
              {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [modal, setModal]   = useState(null); // null | { mode: 'create' | 'edit', data? }
  const [modalErr, setModalErr] = useState('');

  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => getUsers().then(r => r.data) });

  const createMut = useMutation({
    mutationFn: data => createUser(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setModal(null); },
    onError: err => setModalErr(err.response?.data?.error || 'Failed to create user'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setModal(null); },
    onError: err => setModalErr(err.response?.data?.error || 'Failed to update user'),
  });

  const deleteMut = useMutation({
    mutationFn: id => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: err => alert(err.response?.data?.error || 'Failed to delete user'),
  });

  function openCreate() { setModalErr(''); setModal({ mode: 'create' }); }
  function openEdit(u)  { setModalErr(''); setModal({ mode: 'edit', data: u }); }

  function handleSave(payload) {
    setModalErr('');
    if (modal.mode === 'create') createMut.mutate(payload);
    else updateMut.mutate({ id: modal.data.id, data: payload });
  }

  const mutLoading = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all CronPilot accounts</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <UserPlus size={16} /> Add User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">Jobs</th>
                <th className="px-4 py-3 font-medium text-gray-600">Joined</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {u.email}
                    {u.id === me?.id && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 text-center text-gray-600">{u.job_count}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)}
                        className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button
                        disabled={u.id === me?.id}
                        onClick={() => { if (confirm(`Delete ${u.email}?`)) deleteMut.mutate(u.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <UserModal
          initial={modal.data}
          onClose={() => setModal(null)}
          onSave={handleSave}
          loading={mutLoading}
          error={modalErr}
        />
      )}
    </div>
  );
}
