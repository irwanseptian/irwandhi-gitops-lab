import client from './client';

export const getJobs      = ()           => client.get('/jobs').then(r => r.data);
export const getJob       = (id)         => client.get(`/jobs/${id}`).then(r => r.data);
export const createJob    = (data)       => client.post('/jobs', data).then(r => r.data);
export const updateJob    = (id, data)   => client.put(`/jobs/${id}`, data).then(r => r.data);
export const deleteJob    = (id)         => client.delete(`/jobs/${id}`);
export const pauseJob     = (id)         => client.post(`/jobs/${id}/pause`).then(r => r.data);
export const resumeJob    = (id)         => client.post(`/jobs/${id}/resume`).then(r => r.data);
export const triggerJob   = (id)         => client.post(`/jobs/${id}/trigger`).then(r => r.data);
