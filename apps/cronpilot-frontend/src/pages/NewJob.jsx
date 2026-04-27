import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createJob } from '../api/jobs';
import JobForm from '../components/JobForm';

export default function NewJob() {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const mutation = useMutation({
    mutationFn: createJob,
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      navigate(`/jobs/${job.id}`);
    },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Job</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <JobForm onSubmit={data => mutation.mutate(data)} isLoading={mutation.isPending} />
        {mutation.error && (
          <p className="mt-3 text-sm text-red-600">
            {mutation.error.response?.data?.error ?? 'Failed to create job'}
          </p>
        )}
      </div>
    </div>
  );
}
