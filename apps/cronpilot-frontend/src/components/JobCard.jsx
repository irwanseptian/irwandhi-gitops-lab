import { Link } from 'react-router-dom';
import { Clock, ExternalLink, Pause, Play, Trash2, Zap } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import StatusBadge from './StatusBadge';
import { pauseJob, resumeJob, deleteJob, triggerJob } from '../api/jobs';

export default function JobCard({ job }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['jobs'] });

  const pause   = useMutation({ mutationFn: () => pauseJob(job.id),   onSuccess: invalidate });
  const resume  = useMutation({ mutationFn: () => resumeJob(job.id),  onSuccess: invalidate });
  const remove  = useMutation({ mutationFn: () => deleteJob(job.id),  onSuccess: invalidate });
  const trigger = useMutation({ mutationFn: () => triggerJob(job.id), onSuccess: invalidate });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <Link
            to={`/jobs/${job.id}`}
            className="text-base font-semibold text-gray-900 hover:text-sky-600 truncate block"
          >
            {job.name}
          </Link>
          {job.description && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{job.description}</p>
          )}
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
        <Clock size={13} className="shrink-0" />
        <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{job.cron_expression}</code>
      </div>

      <a
        href={job.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-sky-500 truncate mb-4"
      >
        <ExternalLink size={11} className="shrink-0" />
        <span className="truncate">{job.url}</span>
      </a>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={() => trigger.mutate()}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors"
        >
          <Zap size={12} /> Run
        </button>

        {job.status === 'active' && (
          <button
            onClick={() => pause.mutate()}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors"
          >
            <Pause size={12} /> Pause
          </button>
        )}
        {job.status === 'paused' && (
          <button
            onClick={() => resume.mutate()}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
          >
            <Play size={12} /> Resume
          </button>
        )}

        <Link
          to={`/jobs/${job.id}/edit`}
          className="ml-auto text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Edit
        </Link>
        <button
          onClick={() => { if (confirm(`Delete "${job.name}"?`)) remove.mutate(); }}
          className="text-xs p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
