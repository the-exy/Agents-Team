const express = require('express');
const cors = require('cors');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3001;

// OpenClaw 会话文件路径
const SESSIONS_FILE = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');

app.use(cors());
app.use(express.json());

// 缓存
let processCache = { data: null, timestamp: 0 };
const CACHE_TTL = 5000;

// Agent 配置 - 根据实际会话数据动态构建
const agentConfigs = {
  'main': { id: 'main', name: '主Agent', emoji: '🤖', role: '协调者', workspace: 'workspace' },
  'backend': { id: 'backend', name: '后端开发', emoji: '⚙️', role: '后端开发', workspace: 'workspace-backend' },
  'frontend': { id: 'frontend', name: '前端开发', emoji: '🎨', role: '前端开发', workspace: 'workspace-frontend' },
  'pm': { id: 'pm', name: '产品经理', emoji: '📋', role: '产品经理', workspace: 'workspace-pm' },
  'codex': { id: 'codex', name: 'Codex', emoji: '💻', role: '编程助手', workspace: 'workspace-codex' },
  'git-ops': { id: 'git-ops', name: 'Git运维', emoji: '🔧', role: 'Git管理', workspace: 'workspace-git' }
};

// 项目配置
const projectConfigs = [
  {
    id: 'agent-monitor',
    name: 'Agent 监控系统',
    emoji: '📊',
    description: 'OpenClaw Agent 实时监测仪表盘开发',
    agents: ['main', 'backend', 'frontend'],
    status: 'active',
    progress: 80
  }
];

// 任务配置 - 按 Agent 分组
const taskConfigs = {
  'main': [
    { id: 1, title: '协调各 Agent 工作', status: 'in_progress' },
    { id: 2, title: '任务分配与调度', status: 'in_progress' }
  ],
  'backend': [
    { id: 3, title: '后端 API 开发', status: 'in_progress' },
    { id: 4, title: '数据采集与处理', status: 'completed' }
  ],
  'frontend': [
    { id: 5, title: '前端界面开发', status: 'in_progress' },
    { id: 6, title: '组件化改造', status: 'pending' }
  ],
  'pm': [
    { id: 7, title: '项目文档编写', status: 'in_progress' },
    { id: 8, title: '需求分析', status: 'completed' }
  ]
};

// 读取会话数据
function readSessionsData() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('读取会话数据失败:', e.message);
  }
  return {};
}

// 格式化 Token 数量
function formatTokenCount(tokens) {
  if (!tokens) return '0';
  if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M';
  if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'K';
  return tokens.toString();
}

// 格式化时间差
function formatTimeAgo(timestamp) {
  if (!timestamp) return '从未';
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  return `${Math.floor(seconds / 86400)}天前`;
}

// 获取 CPU 使用率
async function getCpuUsage() {
  const cpus = os.cpus();
  const cpuCount = cpus.length;
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  const idle = totalIdle / cpuCount;
  const total = totalTick / cpuCount;
  const usage = ((total - idle) / total) * 100;
  return { usage: Math.round(usage * 100) / 100, cores: cpuCount, model: cpus[0]?.model || 'Unknown' };
}

// 获取内存使用
function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return { total, used, free, usage: Math.round((used / total) * 100 * 100) / 100 };
}

// 获取进程列表
async function getProcessList() {
  const now = Date.now();
  if (processCache.data && (now - processCache.timestamp) < CACHE_TTL) {
    return processCache.data;
  }
  try {
    const { stdout } = await execPromise('tasklist /FO CSV /NH', { encoding: 'utf8' });
    const processes = [];
    const lines = stdout.trim().split('\n');
    for (const line of lines.slice(0, 20)) {
      const parts = line.split('","').map(p => p.replace(/"/g, ''));
      if (parts.length >= 5) {
        processes.push({ name: parts[0], pid: parseInt(parts[1]) || 0, memory: parts[4] });
      }
    }
    processCache.data = processes;
    processCache.timestamp = now;
    return processes;
  } catch (error) {
    return [];
  }
}

// 获取网络接口
function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4') {
        result.push({ name, address: addr.address, mac: addr.mac, internal: addr.internal });
      }
    }
  }
  return result;
}

// 获取运行时间
function getUptime() {
  const uptime = os.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  return { seconds: uptime, formatted: `${days}天 ${hours}小时 ${minutes}分钟` };
}

// ==================== API 端点 ====================

// 获取所有 Agent 状态
app.get('/api/agents', (req, res) => {
  try {
    const sessionsData = readSessionsData();
    const sessionsArray = Object.entries(sessionsData);
    
    // 构建 Agent 列表
    const agents = [];
    
    // 1. 主 Agent - 从所有会话聚合数据
    const mainSession = sessionsData['agent:main:main'];
    const feishuSession = sessionsData['agent:main:feishu:direct:ou_7fc141fb34f21e8e581975c3b0799087'];
    
    // 计算主 Agent 的总 token（从所有相关会话）
    let mainTotalTokens = 0;
    let mainInputTokens = 0;
    let mainOutputTokens = 0;
    let mainLastActive = null;
    let mainModel = 'MiniMax-M2.7';
    let mainChannel = 'feishu';
    
    for (const [key, data] of sessionsArray) {
      if (key.startsWith('agent:main:')) {
        if (data.totalTokens) mainTotalTokens += data.totalTokens;
        if (data.inputTokens) mainInputTokens += data.inputTokens;
        if (data.outputTokens) mainOutputTokens += data.outputTokens;
        if (data.updatedAt && (!mainLastActive || data.updatedAt > mainLastActive)) {
          mainLastActive = data.updatedAt;
        }
        if (data.model) mainModel = data.model;
        if (data.lastChannel) mainChannel = data.lastChannel;
      }
    }
    
    // 判断主 Agent 状态
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const isMainActive = mainLastActive && mainLastActive > fiveMinutesAgo;
    
    agents.push({
      id: 'main',
      name: '主Agent',
      emoji: '🤖',
      role: '协调者',
      status: isMainActive ? 'active' : 'idle',
      tokenUsage: mainTotalTokens,
      tokenUsageFormatted: formatTokenCount(mainTotalTokens),
      inputTokens: mainInputTokens,
      outputTokens: mainOutputTokens,
      sessionCount: sessionsArray.filter(([k]) => k.startsWith('agent:main:')).length,
      channel: mainChannel,
      model: mainModel,
      spawnCount: 0,
      lastActive: mainLastActive ? new Date(mainLastActive).toISOString() : null,
      lastActiveAgo: formatTimeAgo(mainLastActive),
      tasks: taskConfigs['main'] || []
    });
    
    // 2. 子 Agent - 从 sessions_spawn 的 subagent 会话发现
    const subagentSessions = sessionsArray.filter(([key]) => key.includes('subagent'));
    const discoveredSubagents = new Set(subagentSessions.map(([key]) => key.split(':')[3]).filter(Boolean));
    
    // 添加发现的 subagent
    for (const subagentId of discoveredSubagents) {
      const config = agentConfigs[subagentId] || { id: subagentId, name: `${subagentId} Agent`, emoji: '🤖', role: 'Agent' };
      const subagentData = subagentSessions.filter(([key]) => key.includes(`:${subagentId}`));
      
      let totalTokens = 0;
      let lastActive = null;
      for (const [key, data] of subagentData) {
        if (data.totalTokens) totalTokens += data.totalTokens;
        if (data.updatedAt && (!lastActive || data.updatedAt > lastActive)) lastActive = data.updatedAt;
      }
      
      agents.push({
        id: config.id,
        name: config.name,
        emoji: config.emoji,
        role: config.role,
        status: lastActive && lastActive > fiveMinutesAgo ? 'active' : 'idle',
        tokenUsage: totalTokens,
        tokenUsageFormatted: formatTokenCount(totalTokens),
        inputTokens: 0,
        outputTokens: 0,
        sessionCount: subagentData.length,
        channel: 'subagent',
        model: 'unknown',
        spawnCount: 0,
        lastActive: lastActive ? new Date(lastActive).toISOString() : null,
        lastActiveAgo: formatTimeAgo(lastActive),
        tasks: taskConfigs[subagentId] || []
      });
    }
    
    // 3. 添加默认的子 Agent（即使没有会话）
    for (const [id, config] of Object.entries(agentConfigs)) {
      if (id === 'main') continue; // 已添加
      if (discoveredSubagents.has(id)) continue; // 已添加
      
      agents.push({
        id: config.id,
        name: config.name,
        emoji: config.emoji,
        role: config.role,
        status: 'offline',
        tokenUsage: 0,
        tokenUsageFormatted: '0',
        inputTokens: 0,
        outputTokens: 0,
        sessionCount: 0,
        channel: '无',
        model: '未使用',
        spawnCount: 0,
        lastActive: null,
        lastActiveAgo: '从未',
        tasks: taskConfigs[id] || []
      });
    }
    
    res.json(agents);
  } catch (error) {
    console.error('获取 Agent 列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取单个 Agent 详情
app.get('/api/agents/:id', (req, res) => {
  const { id } = req.params;
  try {
    const sessionsData = readSessionsData();
    
    if (id === 'main') {
      // 主 Agent 详情
      let totalTokens = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let lastActive = null;
      let sessions = [];
      
      for (const [key, data] of Object.entries(sessionsData)) {
        if (key.startsWith('agent:main:')) {
          if (data.totalTokens) totalTokens += data.totalTokens;
          if (data.inputTokens) inputTokens += data.inputTokens;
          if (data.outputTokens) outputTokens += data.outputTokens;
          if (data.updatedAt && (!lastActive || data.updatedAt > lastActive)) lastActive = data.updatedAt;
          sessions.push({ key, ...data });
        }
      }
      
      res.json({
        id: 'main',
        name: '主Agent',
        emoji: '🤖',
        role: '协调者',
        status: lastActive && lastActive > Date.now() - 300000 ? 'active' : 'idle',
        tokenUsage: totalTokens,
        tokenUsageFormatted: formatTokenCount(totalTokens),
        inputTokens,
        outputTokens,
        sessionCount: sessions.length,
        sessions,
        lastActive: lastActive ? new Date(lastActive).toISOString() : null,
        lastActiveAgo: formatTimeAgo(lastActive)
      });
    } else {
      // 子 Agent 详情
      const config = agentConfigs[id] || { id, name: `${id} Agent`, emoji: '🤖', role: 'Agent' };
      const agentSessions = Object.entries(sessionsData).filter(([key]) => key.includes(`:${id}`));
      
      let totalTokens = 0;
      let lastActive = null;
      for (const [key, data] of agentSessions) {
        if (data.totalTokens) totalTokens += data.totalTokens;
        if (data.updatedAt && (!lastActive || data.updatedAt > lastActive)) lastActive = data.updatedAt;
      }
      
      res.json({
        id: config.id,
        name: config.name,
        emoji: config.emoji,
        role: config.role,
        status: lastActive && lastActive > Date.now() - 300000 ? 'active' : 'idle',
        tokenUsage: totalTokens,
        tokenUsageFormatted: formatTokenCount(totalTokens),
        sessionCount: agentSessions.length,
        sessions: agentSessions.map(([key, data]) => ({ key, ...data })),
        lastActive: lastActive ? new Date(lastActive).toISOString() : null,
        lastActiveAgo: formatTimeAgo(lastActive)
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取统计概览
app.get('/api/stats', async (req, res) => {
  try {
    const sessionsData = readSessionsData();
    const sessionsArray = Object.entries(sessionsData);
    
    // 计算活跃的会话
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    let activeCount = 0;
    let idleCount = 0;
    let totalTokens = 0;
    
    for (const [key, data] of sessionsArray) {
      if (data.totalTokens) totalTokens += data.totalTokens;
      if (data.updatedAt) {
        if (data.updatedAt > fiveMinutesAgo) activeCount++;
        else idleCount++;
      }
    }
    
    // 统计发现的 subagent
    const subagentSessions = sessionsArray.filter(([key]) => key.includes('subagent'));
    const subagentCount = new Set(subagentSessions.map(([key]) => key.split(':')[3])).size;
    
    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const processes = await getProcessList();
    const network = getNetworkInfo();
    
    // Agent 总数 = 1 (main) + 已发现的 subagent
    const totalAgents = 1 + subagentCount;
    
    res.json({
      totalAgents,
      onlineCount: activeCount > 0 ? 1 : 0, // 主 Agent
      idleCount: idleCount > 0 ? subagentCount : 0,
      totalTasks: Object.values(taskConfigs).reduce((sum, tasks) => sum + tasks.length, 0),
      activeTasks: Object.values(taskConfigs).reduce((sum, tasks) => sum + tasks.filter(t => t.status === 'in_progress').length, 0),
      completedTasks: Object.values(taskConfigs).reduce((sum, tasks) => sum + tasks.filter(t => t.status === 'completed').length, 0),
      waitingTasks: Object.values(taskConfigs).reduce((sum, tasks) => sum + tasks.filter(t => t.status === 'pending').length, 0),
      system: {
        cpuUsage: cpu.usage,
        cpuCores: cpu.cores,
        memoryUsage: memory.usage,
        totalMemoryGB: Math.round(memory.total / 1024 / 1024 / 1024 * 100) / 100,
        uptime: getUptime().formatted,
        hostname: os.hostname(),
        platform: os.type(),
        processCount: processes.length,
        networkInterfaces: network.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取项目列表
app.get('/api/projects', (req, res) => {
  const projects = projectConfigs.map(p => ({
    ...p,
    taskCount: Object.values(taskConfigs).reduce((sum, tasks) => sum + tasks.length, 0)
  }));
  res.json(projects);
});

// 获取项目详情
app.get('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const project = projectConfigs.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  
  // 收集所有任务按 Agent 分组
  const allTasks = Object.entries(taskConfigs).map(([agentId, tasks]) => ({
    agentId,
    agentName: agentConfigs[agentId]?.name || agentId,
    agentEmoji: agentConfigs[agentId]?.emoji || '🤖',
    tasks
  })).filter(g => g.tasks.length > 0);
  
  res.json({ ...project, taskGroups: allTasks });
});

// 获取任务列表（按项目）
app.get('/api/tasks', (req, res) => {
  const project = projectConfigs[0];
  const taskGroups = Object.entries(taskConfigs).map(([agentId, tasks]) => ({
    agentId,
    agentName: agentConfigs[agentId]?.name || agentId,
    agentEmoji: agentConfigs[agentId]?.emoji || '🤖',
    tasks
  })).filter(g => g.tasks.length > 0);
  
  res.json([{ ...project, taskGroups }]);
});

// 获取网络拓扑
app.get('/api/topology', async (req, res) => {
  try {
    const sessionsData = readSessionsData();
    const sessionsArray = Object.entries(sessionsData);
    
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    // 发现所有 Agent
    const nodes = [];
    const links = [];
    
    // 主节点
    let mainLastActive = null;
    let mainTokens = 0;
    for (const [key, data] of sessionsArray) {
      if (key.startsWith('agent:main:')) {
        if (data.updatedAt && (!mainLastActive || data.updatedAt > mainLastActive)) mainLastActive = data.updatedAt;
        if (data.totalTokens) mainTokens += data.totalTokens;
      }
    }
    
    nodes.push({
      id: 'main',
      name: '主Agent',
      emoji: '🤖',
      role: '协调者',
      status: mainLastActive && mainLastActive > fiveMinutesAgo ? 'online' : 'idle',
      tokens: mainTokens
    });
    
    // 子节点 - 从会话发现
    const subagentSessions = sessionsArray.filter(([key]) => key.includes('subagent'));
    const discoveredSubagents = new Set(subagentSessions.map(([key]) => key.split(':')[3]).filter(Boolean));
    
    for (const subagentId of discoveredSubagents) {
      const config = agentConfigs[subagentId] || { id: subagentId, name: `${subagentId} Agent`, emoji: '🤖', role: 'Agent' };
      let lastActive = null;
      let tokens = 0;
      for (const [key, data] of subagentSessions) {
        if (key.includes(`:${subagentId}`)) {
          if (data.updatedAt && (!lastActive || data.updatedAt > lastActive)) lastActive = data.updatedAt;
          if (data.totalTokens) tokens += data.totalTokens;
        }
      }
      
      nodes.push({
        id: config.id,
        name: config.name,
        emoji: config.emoji,
        role: config.role,
        status: lastActive && lastActive > fiveMinutesAgo ? 'online' : 'idle',
        tokens
      });
      
      links.push({ source: 'main', target: config.id, type: 'coordination' });
    }
    
    // 添加系统节点
    nodes.push({ id: 'system', name: '系统', emoji: '💻', role: '监控', status: 'online' });
    nodes.push({ id: 'network', name: '网络', emoji: '🌐', role: '通信', status: 'online' });
    links.push({ source: 'system', target: 'main', type: 'host' });
    links.push({ source: 'network', target: 'main', type: 'monitor' });
    
    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const network = getNetworkInfo();
    
    res.json({
      nodes,
      links,
      stats: {
        cpu: cpu.usage,
        memory: memory.usage,
        networkInterfaces: network.length,
        hostname: os.hostname(),
        totalAgents: nodes.filter(n => !['system', 'network'].includes(n.id)).length,
        activeAgents: nodes.filter(n => n.status === 'online').length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取会话列表
app.get('/api/sessions', (req, res) => {
  try {
    const sessionsData = readSessionsData();
    const sessions = Object.entries(sessionsData).map(([key, data]) => ({
      key,
      sessionId: data.sessionId,
      label: data.label || null,
      channel: data.channel || data.lastChannel || 'unknown',
      updatedAt: data.updatedAt,
      model: data.model || null,
      totalTokens: data.totalTokens || 0,
      inputTokens: data.inputTokens || 0,
      outputTokens: data.outputTokens || 0,
      abortedLastRun: data.abortedLastRun || false,
      spawnDepth: data.spawnDepth || 0
    }));
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json({
      sessions,
      count: sessions.length,
      activeCount: sessions.filter(s => s.updatedAt && s.updatedAt > Date.now() - 300000).length,
      totalTokens: sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取日志
app.get('/api/logs', (req, res) => {
  const logs = [
    { id: 1, agent: 'main', action: '会话协调', time: new Date().toISOString() },
    { id: 2, agent: 'system', action: '系统监控运行中', time: new Date().toISOString() }
  ];
  res.json(logs);
});

// 添加日志
app.post('/api/logs', (req, res) => {
  const { agent, action } = req.body;
  res.json({ id: Date.now(), agent: agent || 'system', action: action || '未知', time: new Date().toISOString() });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 获取系统指标
app.get('/api/metrics', async (req, res) => {
  try {
    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const uptime = getUptime();
    res.json({ cpu, memory, uptime, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取 CPU
app.get('/api/cpu', async (req, res) => {
  try {
    res.json(await getCpuUsage());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取内存
app.get('/api/memory', (req, res) => {
  try {
    res.json(getMemoryUsage());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取进程
app.get('/api/processes', async (req, res) => {
  try {
    res.json(await getProcessList());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取网络
app.get('/api/network', (req, res) => {
  try {
    res.json(getNetworkInfo());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取系统信息
app.get('/api/system', (req, res) => {
  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    type: os.type(),
    arch: os.arch(),
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem()
  });
});

app.listen(PORT, () => {
  console.log(`Agent监控服务运行在 http://localhost:${PORT}`);
});
