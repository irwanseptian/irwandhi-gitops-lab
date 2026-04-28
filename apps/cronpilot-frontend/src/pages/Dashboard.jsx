import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, PauseCircle, AlertCircle, Activity, Plus, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getJobs } from '../api/jobs';
import { getExecutions, getRunningExecutions } from '../api/executions';
import StatusBadge    from '../components/StatusBadge';

function StatCard({ icon: Icon, label, value, cls }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${cls}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ElapsedTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <span>{m > 0 ? `${m}m ` : ''}{s}s</span>;
}

export default function Dashboard() {
  const { data: jobs = [] }       = useQuery({ queryKey: ['jobs'],       queryFn: getJobs });
  const { data: executions = [] } = useQuery({ queryKey: ['executions'], queryFn: () => getExecutions(null, 10) });
  const { data: running = [] }    = useQuery({
    queryKey: ['executions', 'running'],
    queryFn:  getRunningExecutions,
    refetchInterval: 3000,
  });

  const active  = jobs.filter(j => j.status === 'active').length;
  const paused  = jobs.filter(j => j.status === 'paused').length;
  const failed  = executions.filter(e => e.status === 'failure').length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Running now banner */}
      {running.length > 0 && (
        <div className="mb-6 bg-sky-50 border border-sky-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 size={15} className="text-sky-500 animate-spin" />
            <h2 className="text-sm font-semibold text-sky-800">
              Running Now — {running.length} job{running.length > 1 ? 's' : ''} in progress
            </h2>
          </div>
          <div className="space-y-1.5">
            {running.map(exec => (
              <Link
                key={exec.id}
                to={`/jobs/${exec.job_id}`}
                className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-sky-100 hover:border-sky-300 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <span className="text-sm font-medium text-gray-800 truncate">{exec.job_name}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    via {exec.triggered_by}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-xs font-mono text-sky-600 tabular-nums">
                    <ElapsedTimer startedAt={exec.started_at} />
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(exec.started_at), { addSuffix: true })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Clock}        label="Total Jobs"       value={jobs.length} cls="bg-sky-50 text-sky-600"    />
        <StatCard icon={CheckCircle2} label="Active"          value={active}      cls="bg-green-50 text-green-600" />
        <StatCard icon={PauseCircle}  label="Paused"          value={paused}      cls="bg-yellow-50 text-yellow-600" />
        <StatCard icon={AlertCircle}  label="Recent Failures" value={failed}      cls="bg-red-50 text-red-600"    />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Jobs</h2>
            <Link to="/jobs" className="text-sm text-sky-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-1">
            {jobs.slice(0, 6).map(job => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm text-gray-800 truncate mr-3">{job.name}</span>
                <StatusBadge status={job.status} />
              </Link>
            ))}
            {!jobs.length && (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400 mb-3">No jobs yet.</p>
                <Link
                  to="/jobs/new"
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
                >
                  <Plus size={14} /> Create first job
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={17} className="text-gray-400" />
            <h2 className="font-semibold text-gray-900">Recent Executions</h2>
          </div>
          <div className="space-y-1">
            {executions.slice(0, 8).map(exec => (
              <div
                key={exec.id}
                className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm text-gray-700 truncate flex-1 mr-3">{exec.job_name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={exec.status} />
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(exec.started_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
            {!executions.length && (
              <p className="text-sm text-gray-400 text-center py-6">No executions yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
