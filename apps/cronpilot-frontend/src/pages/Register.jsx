import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, Zap, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { register } from '../api/auth';

const highlights = [
  { icon: Zap,         text: 'Sub-minute scheduling precision'      },
  { icon: ShieldCheck, text: 'Secure, token-based API access'       },
  { icon: Users,       text: 'Built for teams and shared workflows' },
];

export default function Register() {
  const { setAuth } = useAuth();
  const navigate    = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await register(form.email, form.password);
      setAuth(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 flex-col justify-between p-12">
        <div className="flex items-center gap-2.5">
          <Clock className="text-sky-400" size={22} />
          <span className="text-white text-xl font-bold tracking-tight">CronPilot</span>
          <span className="text-xs text-gray-500 border border-gray-700 rounded px-1.5 py-0.5 font-mono ml-1">v1.0</span>
        </div>

        <div className="space-y-10">
          <div>
            <h2 className="text-3xl font-bold text-white leading-snug">
              Your team's cron<br />control plane.
            </h2>
            <p className="text-gray-400 mt-3 text-sm leading-relaxed max-w-sm">
              One place to define, monitor, and audit all scheduled jobs across your services — without touching a crontab.
            </p>
          </div>

          <div className="space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                  <Icon size={15} className="text-sky-400" />
                </div>
                <span className="text-sm text-gray-300">{text}</span>
              </div>
            ))}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 font-mono text-xs space-y-1.5">
            <div className="text-gray-500"># get started in seconds</div>
            <div className="text-gray-300">
              <span className="text-sky-400">POST</span> /api/jobs
            </div>
            <div className="text-gray-400 pl-2 space-y-0.5">
              <div><span className="text-purple-400">"cron_expression"</span>: <span className="text-emerald-400">"0 * * * *"</span></div>
              <div><span className="text-purple-400">"url"</span>: <span className="text-emerald-400">"https://…"</span></div>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-600">© {new Date().getFullYear()} CronPilot. Internal tooling.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Clock className="text-sky-500" size={20} />
            <span className="text-gray-900 text-lg font-bold">CronPilot</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
          <p className="text-sm text-gray-500 mt-1 mb-8">
            Start scheduling jobs in under a minute.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Work email</label>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                placeholder="engineer@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                placeholder="At least 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors mt-2"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>

            <p className="text-xs text-gray-400 text-center leading-relaxed">
              By creating an account you agree to our terms of service and acceptable use policy.
            </p>
          </form>

          <p className="mt-6 text-sm text-gray-500 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-sky-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
