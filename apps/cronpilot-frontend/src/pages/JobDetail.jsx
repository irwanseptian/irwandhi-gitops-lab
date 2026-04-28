import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Trash2, Zap, Pause, Play } from 'lucide-react';
import { format } from 'date-fns';
import { getJob, deleteJob, pauseJob, resumeJob, triggerJob } from '../api/jobs';
import { getExecutions } from '../api/executions';
import StatusBadge    from '../components/StatusBadge';
import ExecutionTable from '../components/ExecutionTable';

export default function JobDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const { data: job,        isLoading } = useQuery({ queryKey: ['jobs', id],        queryFn: () => getJob(id) });
  const { data: executions = [] }       = useQuery({ queryKey: ['executions', id],  queryFn: () => getExecutions(id), enabled: !!id });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['jobs'] });
    qc.invalidateQueries({ queryKey: ['executions', id] });
  };

  const pause   = useMutation({ mutationFn: () => pauseJob(id),   onSuccess: invalidate });
  const resume  = useMutation({ mutationFn: () => resumeJob(id),  onSuccess: invalidate });
  const trigger = useMutation({ mutationFn: () => triggerJob(id), onSuccess: invalidate });
  const remove  = useMutation({
    mutationFn: () => deleteJob(id),
    onSuccess:  () => navigate('/jobs'),
  });

  if (isLoading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;
  if (!job)      return <p className="text-gray-500">Job not found.</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link to="/jobs" className="p-2 mt-0.5 hover:bg-gray-100 rounded-lg text-gray-400 shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
            <StatusBadge status={job.status} />
          </div>
          {job.description && <p className="text-sm text-gray-500 mt-0.5">{job.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => trigger.mutate()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-colors"
          >
            <Zap size={14} /> Run Now
          </button>
          {job.status === 'active' && (
            <button
              onClick={() => pause.mutate()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 transition-colors"
            >
              <Pause size={14} /> Pause
            </button>
          )}
          {job.status === 'paused' && (
            <button
              onClick={() => resume.mutate()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Play size={14} /> Resume
            </button>
          )}
          <Link
            to={`/jobs/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Edit size={14} /> Edit
          </Link>
          <button
            onClick={() => { if (confirm(`Delete "${job.name}"?`)) remove.mutate(); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Schedule</h3>
          <div>
            <p className="text-xs text-gray-400 mb-1">Expression</p>
            <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{job.cron_expression}</code>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Timezone</p>
            <p className="text-sm text-gray-700">{job.timezone}</p>
          </div>
          {job.last_run_at && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Last Run</p>
              <p className="text-sm text-gray-700">{format(new Date(job.last_run_at), 'PPpp')}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 mb-1">Concurrency</p>
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
              job.concurrency_policy === 'Forbid'  ? 'bg-red-100 text-red-700' :
              job.concurrency_policy === 'Replace' ? 'bg-amber-100 text-amber-700' :
                                                     'bg-green-100 text-green-700'
            }`}>
              {job.concurrency_policy || 'Allow'}
            </span>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Request</h3>
          <div>
            <p className="text-xs text-gray-400 mb-1">Endpoint</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded shrink-0">
                {job.method}
              </span>
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-sky-600 hover:underline truncate"
              >
                {job.url}
              </a>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Timeout</p>
            <p className="text-sm text-gray-700">{job.timeout_seconds}s</p>
          </div>
          {job.body && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Body</p>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-28">{job.body}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Executions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Execution History</h3>
        <ExecutionTable executions={executions} />
      </div>
    </div>
  );
}
