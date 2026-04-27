import { formatDistanceToNow, format } from 'date-fns';
import StatusBadge from './StatusBadge';

export default function ExecutionTable({ executions }) {
  if (!executions?.length) {
    return <p className="text-sm text-gray-400 py-8 text-center">No executions yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
            <th className="pb-3 pr-4 font-medium">Status</th>
            <th className="pb-3 pr-4 font-medium">Started</th>
            <th className="pb-3 pr-4 font-medium">Duration</th>
            <th className="pb-3 pr-4 font-medium">HTTP</th>
            <th className="pb-3 font-medium">Triggered By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {executions.map(exec => (
            <tr key={exec.id} className="hover:bg-gray-50">
              <td className="py-3 pr-4">
                <StatusBadge status={exec.status} />
              </td>
              <td className="py-3 pr-4 text-gray-600" title={format(new Date(exec.started_at), 'PPpp')}>
                {formatDistanceToNow(new Date(exec.started_at), { addSuffix: true })}
              </td>
              <td className="py-3 pr-4 text-gray-600">
                {exec.duration_ms != null ? `${exec.duration_ms}ms` : '—'}
              </td>
              <td className="py-3 pr-4">
                {exec.response_status ? (
                  <span className={exec.response_status < 400 ? 'text-green-600 font-mono' : 'text-red-600 font-mono'}>
                    {exec.response_status}
                  </span>
                ) : exec.error_message ? (
                  <span className="text-red-500 text-xs truncate max-w-xs block" title={exec.error_message}>
                    {exec.error_message.slice(0, 60)}
                  </span>
                ) : '—'}
              </td>
              <td className="py-3 text-gray-500 capitalize">{exec.triggered_by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
