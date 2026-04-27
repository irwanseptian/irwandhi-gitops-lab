import client from './client';

// Users
export const getUsers    = ()           => client.get('/admin/users');
export const createUser  = (data)       => client.post('/admin/users', data);
export const updateUser  = (id, data)   => client.patch(`/admin/users/${id}`, data);
export const deleteUser  = (id)         => client.delete(`/admin/users/${id}`);

// Jobs
export const getAllJobs   = ()           => client.get('/admin/jobs');
export const createJob   = (data)       => client.post('/admin/jobs', data);
export const updateJob   = (id, data)   => client.put(`/admin/jobs/${id}`, data);
export const deleteJob   = (id)         => client.delete(`/admin/jobs/${id}`);
export const pauseJob    = (id)         => client.post(`/admin/jobs/${id}/pause`);
export const resumeJob   = (id)         => client.post(`/admin/jobs/${id}/resume`);
export const triggerJob  = (id)         => client.post(`/admin/jobs/${id}/trigger`);
