import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { getJobs } from '../api/jobs';
import JobCard from '../components/JobCard';

export default function Jobs() {
  const [search, setSearch] = useState('');
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs'], queryFn: getJobs });

  const filtered = jobs.filter(j =>
    j.name.toLowerCase().includes(search.toLowerCase()) ||
    j.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <Link
          to="/jobs/new"
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition-colors"
        >
          <Plus size={16} /> New Job
        </Link>
      </div>

      <div className="relative mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          placeholder="Search by name or URL…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-52 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(job => <JobCard key={job.id} job={job} />)}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-400 mb-4">{search ? 'No jobs match your search.' : 'No jobs yet.'}</p>
          {!search && (
            <Link
              to="/jobs/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700"
            >
              <Plus size={16} /> Create your first job
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
