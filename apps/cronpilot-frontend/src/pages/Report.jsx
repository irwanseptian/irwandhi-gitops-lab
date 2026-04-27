import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, CheckCircle2, XCircle, Clock, Activity, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getReportSummary, getReportTimeline, getReportJobs, downloadCsv } from '../api/report';

// ── Tiny SVG bar chart ────────────────────────────────────────────────────────

function BarChart({ data }) {
  const W = 700, H = 140, PAD_B = 28, PAD_T = 8, BAR_GAP = 2;
  if (!data?.length) return null;

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const barW     = (W - BAR_GAP * (data.length - 1)) / data.length;
  const chartH   = H - PAD_B - PAD_T;

  // Show every 7th label to avoid crowding
  const labelStep = Math.ceil(data.length / 10);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {data.map((d, i) => {
        const x       = i * (barW + BAR_GAP);
        const totalH  = (d.total   / maxTotal) * chartH;
        const successH= (d.success / maxTotal) * chartH;
        const failH   = (d.failure / maxTotal) * chartH;

        return (
          <g key={d.date}>
            {/* failure bar (bottom) */}
            {failH > 0 && (
              <rect x={x} y={PAD_T + chartH - failH} width={barW} height={failH} fill="#f87171" rx="1" />
            )}
            {/* success bar (on top of failure) */}
            {successH > 0 && (
              <rect x={x} y={PAD_T + chartH - totalH} width={barW} height={successH} fill="#34d399" rx="1" />
            )}
            {/* label every N days */}
            {i % labelStep === 0 && (
              <text
                x={x + barW / 2} y={H - 6}
                textAnchor="middle" fontSize="9" fill="#94a3b8"
              >
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ rate = 0 }) {
  const R = 52, stroke = 16;
  const circ  = 2 * Math.PI * R;
  const arc   = (rate / 100) * circ;
  const color = rate >= 90 ? '#34d399' : rate >= 70 ? '#fbbf24' : '#f87171';

  return (
    <svg viewBox="0 0 128 128" className="w-32 h-32">
      <circle cx="64" cy="64" r={R} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx="64" cy="64" r={R} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${arc} ${circ - arc}`}
        strokeLinecap="round"
        transform="rotate(-90 64 64)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="64" y="60" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1e293b">
        {rate.toFixed(0)}%
      </text>
      <text x="64" y="76" textAnchor="middle" fontSize="9" fill="#94a3b8">success</text>
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'sky' }) {
  const colors = {
    sky:   'bg-sky-50 text-sky-600',
    green: 'bg-green-50 text-green-600',
    red:   'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Report() {
  const [days, setDays]           = useState(30);
  const [filterJob, setFilterJob] = useState('');
  const [downloading, setDownload]= useState(false);

  const { data: summary  } = useQuery({ queryKey: ['report-summary'],           queryFn: getReportSummary });
  const { data: timeline } = useQuery({ queryKey: ['report-timeline', days],    queryFn: () => getReportTimeline(days) });
  const { data: jobStats = [] } = useQuery({ queryKey: ['report-jobs'],         queryFn: getReportJobs });

  async function handleDownload() {
    setDownload(true);
    try { await downloadCsv(filterJob, days); } finally { setDownload(false); }
  }

  const rate = summary?.success_rate ?? 0;
  const avgMs = summary?.avg_duration_ms ?? 0;
  const avgDisplay = avgMs >= 1000
    ? `${(avgMs / 1000).toFixed(1)}s`
    : `${Math.round(avgMs)}ms`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Execution history and job performance</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <select
            value={filterJob}
            onChange={e => setFilterJob(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 max-w-[200px]"
          >
            <option value="">All jobs</option>
            {jobStats.map(j => (
              <option key={j.job_id} value={j.job_id}>{j.job_name}</option>
            ))}
          </select>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <Download size={15} />
            {downloading ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity}     label="Total Executions" value={summary?.total_executions ?? '—'} color="sky" />
        <StatCard icon={CheckCircle2} label="Successful"       value={summary?.success_count ?? '—'}    color="green" sub={`${rate.toFixed(1)}% success rate`} />
        <StatCard icon={XCircle}      label="Failed"           value={summary?.failure_count ?? '—'}     color="red" />
        <StatCard icon={Clock}        label="Avg Duration"     value={summary ? avgDisplay : '—'}        color="amber" sub={`${summary?.active_jobs ?? 0} active jobs`} />
      </div>

      {/* Timeline + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Execution Timeline</h2>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" />Success</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />Failure</span>
            </div>
          </div>
          {timeline?.length ? (
            <BarChart data={timeline} />
          ) : (
            <div className="h-36 flex items-center justify-center text-sm text-gray-400">No data yet</div>
          )}
        </div>

        {/* Donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700 self-start">Overall Success Rate</h2>
          <DonutChart rate={rate} />
          <div className="w-full space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Success</span>
              <span className="font-medium text-gray-700">{summary?.success_count ?? 0}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Failure</span>
              <span className="font-medium text-gray-700">{summary?.failure_count ?? 0}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />Running</span>
              <span className="font-medium text-gray-700">{summary?.running_count ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-job stats */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Per-Job Performance</h2>
        </div>
        {jobStats.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No jobs yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                <th className="px-4 py-3 font-medium text-gray-600">Job</th>
                <th className="px-4 py-3 font-medium text-gray-600">Schedule</th>
                <th className="px-4 py-3 font-medium text-gray-600">Executions</th>
                <th className="px-4 py-3 font-medium text-gray-600 w-48">Success Rate</th>
                <th className="px-4 py-3 font-medium text-gray-600">Avg Duration</th>
                <th className="px-4 py-3 font-medium text-gray-600">Last Run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobStats.map(j => {
                const r    = j.success_rate;
                const bar  = r >= 90 ? 'bg-green-400' : r >= 70 ? 'bg-amber-400' : 'bg-red-400';
                const text = r >= 90 ? 'text-green-700' : r >= 70 ? 'text-amber-700' : 'text-red-700';
                const ms   = j.avg_duration_ms;
                const dur  = ms >= 1000 ? `${(ms/1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
                return (
                  <tr key={j.job_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[180px]">{j.job_name}</p>
                      <p className={`text-xs capitalize ${j.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>{j.status}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{j.cron_expression}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="font-medium">{j.total_executions}</span>
                      <span className="text-gray-400 text-xs ml-1">({j.success_count}✓ {j.failure_count}✗)</span>
                    </td>
                    <td className="px-4 py-3">
                      {j.total_executions > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${bar} rounded-full`} style={{ width: `${r}%` }} />
                          </div>
                          <span className={`text-xs font-medium ${text} w-10 text-right`}>{r.toFixed(1)}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">no runs</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {j.total_executions > 0 ? dur : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {j.last_run_at
                        ? formatDistanceToNow(new Date(j.last_run_at), { addSuffix: true })
                        : <span className="text-gray-300">never</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
