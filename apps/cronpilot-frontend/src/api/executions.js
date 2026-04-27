import client from './client';

export const getExecutions = (jobId, limit = 50) => {
  const params = { limit };
  if (jobId) params.job_id = jobId;
  return client.get('/executions', { params }).then(r => r.data);
};

export const getExecution = (id) => client.get(`/executions/${id}`).then(r => r.data);
