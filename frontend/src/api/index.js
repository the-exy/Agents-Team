import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000
});

export const agentAPI = {
  getAgents: () => api.get('/agents'),
  getAgent: (id) => api.get(`/agents/${id}`),
  getAgentHistory: (id) => api.get(`/agents/${id}/history`),
  getAgentSkills: (id) => api.get(`/agents/${id}/skills`),
  getAgentFiles: (id) => api.get(`/agents/${id}/files`),
  getAgentTasks: (id) => api.get(`/agents/${id}/tasks`)
};

export const projectAPI = {
  getProjects: () => api.get('/projects'),
  getProject: (id) => api.get(`/projects/${id}`),
  getProjectTasks: (id) => api.get(`/projects/${id}/tasks`)
};

export const sessionsAPI = {
  getSessions: () => api.get('/sessions')
};

export const rankingsAPI = {
  getRankings: () => api.get('/rankings')
};

export const memorialsAPI = {
  getMemorials: () => api.get('/memorials')
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

export const tokenStatsAPI = {
  getTokenStats: (params) => api.get('/token-stats', { params })
};

export const tokenAPI = {
  queryDailySummary: (params) => api.get('/token-usage/daily-summary', { params }),
  queryDetails: (params) => api.get('/token-usage/query', { params }),
  record: () => api.post('/token-usage/record')
};

export const subagentAPI = {
  getSubagents: () => api.get('/subagents'),
  getSubagentTree: () => api.get('/subagent-tree')
};

export const eventsAPI = {
  getAgentEvents: (params) => api.get('/agent-events', { params })
};

export const modelAPI = {
  getModels: () => api.get('/models')
};

export const modelDashboardAPI = {
  getModelStats: (params) => api.get('/model-updates/stats', { params }),
  getCurrentModels: () => api.get('/model-updates/current'),
  getModelHistory: (params) => api.get('/model-updates', { params })
};

export default api;
