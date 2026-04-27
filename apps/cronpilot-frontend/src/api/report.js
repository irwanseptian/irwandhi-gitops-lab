import client from './client';

export const getReportSummary  = ()          => client.get('/report/summary').then(r => r.data);
export const getReportTimeline = (days = 30) => client.get('/report/timeline', { params: { days } }).then(r => r.data);
export const getReportJobs     = ()          => client.get('/report/jobs').then(r => r.data);

export async function downloadCsv(jobId, days = 30) {
  const params = new URLSearchParams({ days });
  if (jobId) params.set('job_id', jobId);

  const resp = await client.get(`/report/executions.csv?${params}`, { responseType: 'blob' });
  const url  = URL.createObjectURL(resp.data);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `executions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
