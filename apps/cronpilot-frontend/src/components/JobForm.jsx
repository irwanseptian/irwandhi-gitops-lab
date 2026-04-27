import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CronHelper from './CronHelper';

const METHODS  = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const PRESETS  = [
  { label: 'Every minute',      value: '* * * * *'    },
  { label: 'Every 5 min',       value: '*/5 * * * *'  },
  { label: 'Every 15 min',      value: '*/15 * * * *' },
  { label: 'Every hour',        value: '0 * * * *'    },
  { label: 'Daily midnight',    value: '0 0 * * *'    },
  { label: 'Mon 9am',           value: '0 9 * * 1'    },
];

export default function JobForm({ initial = {}, onSubmit, isLoading }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name:            '',
    description:     '',
    cron_expression: '0 * * * *',
    url:             '',
    method:          'GET',
    body:            '',
    timezone:        'UTC',
    timeout_seconds: 30,
    ...initial,
  });

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Name *</label>
          <input
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={form.name}
            onChange={set('name')}
            placeholder="My Cron Job"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={form.description}
            onChange={set('description')}
            placeholder="Optional description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cron Expression *</label>
          <input
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={form.cron_expression}
            onChange={set('cron_expression')}
            placeholder="0 * * * *"
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {PRESETS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, cron_expression: p.value }))}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-sky-100 hover:text-sky-700 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <CronHelper expression={form.cron_expression} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={form.timezone}
            onChange={set('timezone')}
            placeholder="UTC"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
          <div className="flex gap-2">
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.method}
              onChange={set('method')}
            >
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
            <input
              required
              type="url"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.url}
              onChange={set('url')}
              placeholder="https://example.com/webhook"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (seconds)</label>
          <input
            type="number"
            min={1}
            max={300}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={form.timeout_seconds}
            onChange={set('timeout_seconds')}
          />
        </div>

        {['POST', 'PUT', 'PATCH'].includes(form.method) && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Request Body</label>
            <textarea
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.body}
              onChange={set('body')}
              placeholder='{"key": "value"}'
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={isLoading}
          className="px-5 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Saving…' : 'Save Job'}
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-5 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
