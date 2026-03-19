import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000
});

export const agentAPI = {
  getAgents: () => api.get('/agents'),
  getAgent: (id) => api.get(`/agents/${id}`),
  getAgentHistory: (id) => api.get(`/agents/${id}/history`)
};

export const taskAPI = {
  getTasks: () => api.get('/tasks')
};

export const logAPI = {
  getLogs: () => api.get('/logs'),
  addLog: (data) => api.post('/logs', data)
};

export const topologyAPI = {
  getTopology: () => api.get('/topology')
};

export const statsAPI = {
  getStats: () => api.get('/stats')
};

export default api;
