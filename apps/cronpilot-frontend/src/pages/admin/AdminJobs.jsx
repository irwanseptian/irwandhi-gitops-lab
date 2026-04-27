import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pause, Play, Trash2, Zap, ChevronDown, Pencil, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getAllJobs, pauseJob, resumeJob, deleteJob, triggerJob, updateJob, getUsers } from '../../api/admin';
import StatusBadge from '../../components/StatusBadge';
import JobForm from '../../components/JobForm';

export default function AdminJobs() {
  const qc = useQueryClient();
  const [filterUser, setFilterUser] = useState('');
  const [editJob, setEditJob]       = useState(null); // job being edited

  const { data: jobs  = [], isLoading } = useQuery({ queryKey: ['admin-jobs'],  queryFn: () => getAllJobs().then(r => r.data) });
  const { data: users = [] }            = useQuery({ queryKey: ['admin-users'], queryFn: () => getUsers().then(r => r.data) });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-jobs'] });

  const pauseMut   = useMutation({ mutationFn: id => pauseJob(id),   onSuccess: invalidate });
  const resumeMut  = useMutation({ mutationFn: id => resumeJob(id),  onSuccess: invalidate });
  const deleteMut  = useMutation({ mutationFn: id => deleteJob(id),  onSuccess: invalidate });
  const triggerMut = useMutation({ mutationFn: id => triggerJob(id), onSuccess: invalidate });
  const updateMut  = useMutation({
    mutationFn: ({ id, data }) => updateJob(id, data),
    onSuccess: () => { invalidate(); setEditJob(null); },
  });

  const displayed = filterUser ? jobs.filter(j => j.user_id === filterUser) : jobs;

  // Normalise job data for JobForm initial values
  const toFormInitial = (job) => ({
    name:            job.name            || '',
    description:     job.description     || '',
    cron_expression: job.cron_expression || '0 * * * *',
    url:             job.url             || '',
    method:          job.method          || 'GET',
    body:            job.body            || '',
    timezone:        job.timezone        || 'UTC',
    timeout_seconds: job.timeout_seconds || 30,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Jobs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{jobs.length} jobs across {users.length} users</p>
        </div>

        <div className="relative">
          <select
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
          >
            <option value="">All users</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No jobs found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Job</th>
                <th className="px-4 py-3 font-medium text-gray-600">Owner</th>
                <th className="px-4 py-3 font-medium text-gray-600">Schedule</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Last Run</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.map(job => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-[180px]">{job.name}</p>
                    {job.description && <p className="text-xs text-gray-400 truncate max-w-[180px]">{job.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {job.owner_email
                      ? <span className="font-mono text-xs">{job.owner_email}</span>
                      : <span className="text-gray-300 text-xs italic">no owner</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{job.cron_expression}</td>
                  <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {job.last_run_at
                      ? formatDistanceToNow(new Date(job.last_run_at), { addSuffix: true })
                      : <span className="text-gray-300">never</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => triggerMut.mutate(job.id)}
                        className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="Trigger now">
                        <Zap size={14} />
                      </button>
                      <button
                        onClick={() => setEditJob(job)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      {job.status === 'active' ? (
                        <button onClick={() => pauseMut.mutate(job.id)}
                          className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title="Pause">
                          <Pause size={14} />
                        </button>
                      ) : (
                        <button onClick={() => resumeMut.mutate(job.id)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Resume">
                          <Play size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm(`Delete "${job.name}"?`)) deleteMut.mutate(job.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit drawer */}
      {editJob && (
        <div className="fixed inset-0 z-40 flex">
          {/* backdrop */}
          <div className="flex-1 bg-black/40" onClick={() => setEditJob(null)} />

          {/* panel */}
          <div className="w-full max-w-xl bg-white shadow-xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Edit Job</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Owner: <span className="font-mono">{editJob.owner_email || 'no owner'}</span>
                </p>
              </div>
              <button onClick={() => setEditJob(null)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 flex-1">
              {updateMut.isError && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {updateMut.error?.response?.data?.error || 'Failed to update job'}
                </div>
              )}
              <JobForm
                key={editJob.id}
                initial={toFormInitial(editJob)}
                isLoading={updateMut.isPending}
                onSubmit={(data) => updateMut.mutate({ id: editJob.id, data })}
                onCancel={() => setEditJob(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
