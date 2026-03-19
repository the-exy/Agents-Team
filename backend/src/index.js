const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Agent配置数据
const agents = [
  {
    id: 'main',
    name: '主Agent',
    emoji: '🤖',
    role: '协调者',
    status: 'online',
    workspace: 'workspace',
    currentTask: '协调各子Agent完成考研论坛项目',
    sessions: 3,
    memory: 45,
    cpu: 12,
    lastActive: new Date().toISOString()
  },
  {
    id: 'backend',
    name: '后端开发',
    emoji: '⚙️',
    role: '后端开发',
    status: 'online',
    workspace: 'workspace-backend',
    currentTask: '开发考研论坛API接口',
    sessions: 1,
    memory: 38,
    cpu: 8,
    lastActive: new Date(Date.now() - 300000).toISOString()
  },
  {
    id: 'frontend',
    name: '前端开发',
    emoji: '🎨',
    role: '前端开发',
    status: 'online',
    workspace: 'workspace-frontend',
    currentTask: '开发考研论坛用户界面',
    sessions: 1,
    memory: 42,
    cpu: 10,
    lastActive: new Date(Date.now() - 600000).toISOString()
  },
  {
    id: 'pm',
    name: '产品经理',
    emoji: '📋',
    role: '产品经理',
    status: 'online',
    workspace: 'workspace-pm',
    currentTask: '规划产品功能迭代',
    sessions: 1,
    memory: 28,
    cpu: 5,
    lastActive: new Date(Date.now() - 900000).toISOString()
  },
  {
    id: 'db',
    name: '数据库开发',
    emoji: '🗄️',
    role: '数据库开发',
    status: 'idle',
    workspace: 'workspace-db',
    currentTask: '等待任务分配',
    sessions: 0,
    memory: 22,
    cpu: 2,
    lastActive: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 'test',
    name: '测试工程师',
    emoji: '🧪',
    role: '测试',
    status: 'idle',
    workspace: 'workspace-test',
    currentTask: '等待任务分配',
    sessions: 0,
    memory: 20,
    cpu: 1,
    lastActive: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'ops',
    name: '运维工程师',
    emoji: '🔧',
    role: '运维',
    status: 'idle',
    workspace: 'workspace-ops',
    currentTask: '监控系统运行状态',
    sessions: 1,
    memory: 35,
    cpu: 7,
    lastActive: new Date(Date.now() - 120000).toISOString()
  }
];

// 活跃任务
const tasks = [
  {
    id: 1,
    title: '考研论坛系统开发',
    status: 'in_progress',
    priority: 'high',
    assignees: ['main', 'backend', 'frontend'],
    progress: 65,
    createdAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 2,
    title: '后端API接口开发',
    status: 'in_progress',
    priority: 'high',
    assignees: ['backend'],
    progress: 80,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 3,
    title: '前端页面开发',
    status: 'in_progress',
    priority: 'high',
    assignees: ['frontend'],
    progress: 55,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 4,
    title: '数据库设计',
    status: 'completed',
    priority: 'medium',
    assignees: ['db'],
    progress: 100,
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 5,
    title: '系统测试',
    status: 'waiting',
    priority: 'medium',
    assignees: ['test'],
    progress: 0,
    createdAt: new Date().toISOString()
  }
];

// 活动日志
let logs = [
  { id: 1, agent: 'main', action: '创建项目规格说明书', time: new Date(Date.now() - 7200000).toISOString() },
  { id: 2, agent: 'backend', action: '完成数据库设计', time: new Date(Date.now() - 3600000).toISOString() },
  { id: 3, agent: 'frontend', action: '创建React项目结构', time: new Date(Date.now() - 3000000).toISOString() },
  { id: 4, agent: 'backend', action: '开发用户API接口', time: new Date(Date.now() - 2400000).toISOString() },
  { id: 5, agent: 'frontend', action: '开发首页组件', time: new Date(Date.now() - 1800000).toISOString() },
  { id: 6, agent: 'pm', action: '更新产品需求文档', time: new Date(Date.now() - 1200000).toISOString() },
  { id: 7, agent: 'ops', action: '监控系统运行状态', time: new Date(Date.now() - 600000).toISOString() },
  { id: 8, agent: 'main', action: '协调后端和前端开发进度', time: new Date(Date.now() - 300000).toISOString() }
];

// 获取所有Agent状态
app.get('/api/agents', (req, res) => {
  // 模拟数据动态变化
  const updatedAgents = agents.map(agent => ({
    ...agent,
    memory: Math.max(10, agent.memory + Math.floor(Math.random() * 10) - 5),
    cpu: Math.max(1, agent.cpu + Math.floor(Math.random() * 5) - 2),
    lastActive: new Date().toISOString()
  }));
  res.json(updatedAgents);
});

// 获取单个Agent详情
app.get('/api/agents/:id', (req, res) => {
  const agent = agents.find(a => a.id === req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent不存在' });
  }
  res.json(agent);
});

// 获取任务列表
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

// 获取活动日志
app.get('/api/logs', (req, res) => {
  res.json(logs.slice(0, 20));
});

// 获取网络拓扑数据
app.get('/api/topology', (req, res) => {
  const topology = {
    nodes: agents.map(a => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      role: a.role,
      status: a.status
    })),
    links: [
      { source: 'main', target: 'backend', type: 'coordination' },
      { source: 'main', target: 'frontend', type: 'coordination' },
      { source: 'main', target: 'pm', type: 'coordination' },
      { source: 'main', target: 'db', type: 'coordination' },
      { source: 'main', target: 'test', type: 'coordination' },
      { source: 'main', target: 'ops', type: 'coordination' },
      { source: 'backend', target: 'db', type: 'dependency' },
      { source: 'frontend', target: 'backend', type: 'dependency' },
      { source: 'test', target: 'backend', type: 'testing' },
      { source: 'test', target: 'frontend', type: 'testing' },
      { source: 'ops', target: 'main', type: 'support' }
    ]
  };
  res.json(topology);
});

// 获取统计概览
app.get('/api/stats', (req, res) => {
  const onlineCount = agents.filter(a => a.status === 'online').length;
  const idleCount = agents.filter(a => a.status === 'idle').length;
  const activeTasks = tasks.filter(t => t.status === 'in_progress').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  res.json({
    totalAgents: agents.length,
    onlineCount,
    idleCount,
    totalTasks: tasks.length,
    activeTasks,
    completedTasks,
    waitingTasks: tasks.filter(t => t.status === 'waiting').length
  });
});

// 添加日志
app.post('/api/logs', (req, res) => {
  const { agent, action } = req.body;
  const newLog = {
    id: logs.length + 1,
    agent,
    action,
    time: new Date().toISOString()
  };
  logs.unshift(newLog);
  if (logs.length > 50) logs.pop();
  res.json(newLog);
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Agent监控服务运行在 http://localhost:${PORT}`);
});
