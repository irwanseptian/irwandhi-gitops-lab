import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJob, updateJob } from '../api/jobs';
import JobForm from '../components/JobForm';

export default function EditJob() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const { data: job, isLoading } = useQuery({ queryKey: ['jobs', id], queryFn: () => getJob(id) });

  const mutation = useMutation({
    mutationFn: (data) => updateJob(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      navigate(`/jobs/${id}`);
    },
  });

  if (isLoading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;
  if (!job)      return <p className="text-gray-500">Job not found.</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Job</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <JobForm
          initial={job}
          onSubmit={data => mutation.mutate(data)}
          isLoading={mutation.isPending}
        />
        {mutation.error && (
          <p className="mt-3 text-sm text-red-600">
            {mutation.error.response?.data?.error ?? 'Failed to update job'}
          </p>
        )}
      </div>
    </div>
  );
}
