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

// 缓存进程列表，避免频繁调用系统命令
let processCache = {
  data: null,
  timestamp: 0
};
const CACHE_TTL = 5000; // 5秒缓存

// 默认 Agent 配置 - 当没有会话数据时使用
const defaultAgentConfigs = [
  { id: 'main', name: '主Agent', emoji: '🤖', role: '协调者', workspace: 'workspace' },
  { id: 'backend', name: '后端开发', emoji: '⚙️', role: '后端开发', workspace: 'workspace-backend' },
  { id: 'frontend', name: '前端开发', emoji: '🎨', role: '前端开发', workspace: 'workspace-frontend' },
  { id: 'pm', name: '产品经理', emoji: '📋', role: '产品经理', workspace: 'workspace-pm' }
];

// 从会话数据动态发现 Agent
async function discoverAgentsFromSessions(sessionsData) {
  const agentMap = new Map();
  
  for (const [key, data] of Object.entries(sessionsData)) {
    // 跳过 main session 自身
    if (key === 'agent:main:main') continue;
    
    // 解析 session key: agent:main:feishu:direct:ou_xxx 或 agent:main:subagent:backend
    const parts = key.split(':');
    
    if (parts[1] === 'main') {
      // 主 agent 的子会话
      if (parts[2] === 'subagent' && parts.length >= 4) {
        // 子 agent: agent:main:subagent:backend
        const subAgentId = parts[3];
        if (!agentMap.has(subAgentId)) {
          agentMap.set(subAgentId, {
            id: subAgentId,
            name: getAgentDisplayName(subAgentId),
            emoji: getAgentEmoji(subAgentId),
            role: getAgentRole(subAgentId),
            workspace: `workspace-${subAgentId}`,
            sessions: []
          });
        }
        agentMap.get(subAgentId).sessions.push(data);
      } else if (parts[2] !== 'main') {
        // 主 agent 的 channel 会话: agent:main:feishu:direct:ou_xxx
        const channelName = parts[2];
        if (!agentMap.has('main')) {
          agentMap.set('main', {
            id: 'main',
            name: '主Agent',
            emoji: '🤖',
            role: '协调者',
            workspace: 'workspace',
            sessions: []
          });
        }
        agentMap.get('main').sessions.push(data);
      }
    }
  }
  
  return Array.from(agentMap.values());
}

function getAgentDisplayName(id) {
  const names = {
    'backend': '后端开发',
    'frontend': '前端开发',
    'pm': '产品经理',
    'codex': 'Codex',
    'git-ops': 'Git运维'
  };
  return names[id] || `${id} Agent`;
}

function getAgentEmoji(id) {
  const emojis = {
    'backend': '⚙️',
    'frontend': '🎨',
    'pm': '📋',
    'codex': '💻',
    'git-ops': '🔧'
  };
  return emojis[id] || '🤖';
}

function getAgentRole(id) {
  const roles = {
    'backend': '后端开发',
    'frontend': '前端开发',
    'pm': '产品经理/文档',
    'codex': '编程助手',
    'git-ops': 'Git版本管理'
  };
  return roles[id] || 'Agent';
}

// 项目配置 - 用于任务板的项目管理
const projectConfigs = [
  {
    id: 'agent-monitor',
    name: 'Agent 监控系统',
    emoji: '📊',
    description: 'OpenClaw Agent 实时监测仪表盘',
    agents: ['main', 'backend', 'frontend'],
    status: 'active',
    progress: 75,
    createdAt: '2026-03-18T08:00:00Z'
  },
  {
    id: 'kaoyan-forum',
    name: '考研论坛',
    emoji: '🎓',
    description: '考研论坛项目开发',
    agents: ['pm', 'backend'],
    status: 'planning',
    progress: 20,
    createdAt: '2026-03-10T00:00:00Z'
  }
];

// 任务配置 - 简化为项目任务，不展示明细
const taskConfigs = [
  { id: 1, title: 'Agent监控端点开发', projectId: 'agent-monitor', type: 'backend' },
  { id: 2, title: '前端界面优化', projectId: 'agent-monitor', type: 'frontend' },
  { id: 3, title: '项目文档整理', projectId: 'agent-monitor', type: 'pm' },
  { id: 4, title: '考研论坛需求分析', projectId: 'kaoyan-forum', type: 'pm' }
];

/**
 * 获取真实的CPU使用率
 * 通过对比系统启动以来的平均CPU使用和当前瞬时负载
 */
async function getCpuUsage() {
  const cpus = os.cpus();
  const cpuCount = cpus.length;
  
  // 计算总的CPU使用率
  let totalIdle = 0;
  let totalTick = 0;
  
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  
  // 简单返回基于idle时间的CPU使用率
  const idle = totalIdle / cpuCount;
  const total = totalTick / cpuCount;
  const usage = ((total - idle) / total) * 100;
  
  return {
    usage: Math.round(usage * 100) / 100,
    cores: cpuCount,
    model: cpus[0]?.model || 'Unknown',
    speed: cpus[0]?.speed || 0
  };
}

/**
 * 获取真实的内存使用情况
 */
function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usagePercent = (used / total) * 100;
  
  return {
    total: total,
    used: used,
    free: free,
    usage: Math.round(usagePercent * 100) / 100
  };
}

/**
 * 获取当前运行的进程列表
 * 使用Windows的tasklist命令
 */
async function getProcessList() {
  const now = Date.now();
  
  // 检查缓存
  if (processCache.data && (now - processCache.timestamp) < CACHE_TTL) {
    return processCache.data;
  }
  
  try {
    // 使用tasklist获取进程列表
    const { stdout } = await execPromise('tasklist /FO CSV /NH', { encoding: 'utf8' });
    
    const processes = [];
    const lines = stdout.trim().split('\n');
    
    for (const line of lines) {
      const parts = line.split('","').map(p => p.replace(/"/g, ''));
      if (parts.length >= 5) {
        processes.push({
          name: parts[0],
          pid: parseInt(parts[1]) || 0,
          sessionName: parts[2],
          sessionNum: parseInt(parts[3]) || 0,
          memUsage: parts[4]
        });
      }
    }
    
    // 按内存使用排序，取前20个
    const sortedProcesses = processes
      .filter(p => p.pid > 0)
      .sort((a, b) => {
        const memA = parseMemUsage(a.memUsage);
        const memB = parseMemUsage(b.memUsage);
        return memB - memA;
      })
      .slice(0, 20)
      .map(p => ({
        name: p.name,
        pid: p.pid,
        memory: p.memUsage
      }));
    
    processCache.data = sortedProcesses;
    processCache.timestamp = now;
    
    return sortedProcesses;
  } catch (error) {
    console.error('获取进程列表失败:', error.message);
    return [];
  }
}

/**
 * 解析内存字符串为KB数字
 */
function parseMemUsage(memStr) {
  if (!memStr) return 0;
  const match = memStr.match(/([\d,]+)\s*K/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''));
  }
  return 0;
}

/**
 * 获取网络接口信息
 */
function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const result = [];
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4') {
        result.push({
          name: name,
          address: addr.address,
          netmask: addr.netmask,
          mac: addr.mac,
          internal: addr.internal
        });
      }
    }
  }
  
  return result;
}

/**
 * 获取系统运行时间
 */
function getUptime() {
  const uptime = os.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  return {
    seconds: uptime,
    formatted: `${days}天 ${hours}小时 ${minutes}分钟`
  };
}

/**
 * 获取系统平台信息
 */
function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    type: os.type(),
    arch: os.arch(),
    homedir: os.homedir(),
    tmpdir: os.tmpdir(),
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem(),
    eol: os.EOL
  };
}

// ==================== API 端点 ====================

// 获取所有系统指标
app.get('/api/metrics', async (req, res) => {
  try {
    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const uptime = getUptime();
    
    res.json({
      cpu,
      memory,
      uptime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取CPU使用率
app.get('/api/cpu', async (req, res) => {
  try {
    const cpu = await getCpuUsage();
    res.json(cpu);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取内存使用情况
app.get('/api/memory', (req, res) => {
  try {
    const memory = getMemoryUsage();
    res.json(memory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取进程列表
app.get('/api/processes', async (req, res) => {
  try {
    const processes = await getProcessList();
    res.json(processes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取网络信息
app.get('/api/network', (req, res) => {
  try {
    const interfaces = getNetworkInfo();
    res.json(interfaces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取系统基本信息
app.get('/api/system', (req, res) => {
  try {
    const info = getSystemInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取Agent列表（动态发现 + 关联会话数据）
app.get('/api/agents', async (req, res) => {
  try {
    // 读取真实会话数据
    let sessionsData = {};
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('读取会话数据失败:', e.message);
    }

    // 动态发现 Agent
    const discoveredAgents = await discoverAgentsFromSessions(sessionsData);
    
    // 合并默认配置和发现的 Agent
    const agentMap = new Map();
    
    // 先添加默认配置
    for (const config of defaultAgentConfigs) {
      agentMap.set(config.id, {
        ...config,
        sessions: [],
        tokenUsage: 0,
        channels: [],
        models: [],
        spawnCount: 0,
        lastActive: null,
        status: 'offline'
      });
    }
    
    // 合并发现的会话数据
    for (const agent of discoveredAgents) {
      if (agentMap.has(agent.id)) {
        const existing = agentMap.get(agent.id);
        existing.sessions = agent.sessions;
        agentMap.get(agent.id).sessions = agent.sessions;
      } else {
        agentMap.set(agent.id, {
          id: agent.id,
          name: agent.name,
          emoji: agent.emoji,
          role: agent.role,
          workspace: agent.workspace,
          sessions: agent.sessions,
          tokenUsage: 0,
          channels: [],
          models: [],
          spawnCount: 0,
          lastActive: null,
          status: 'offline'
        });
      }
    }
    
    // 为每个 Agent 计算详细信息
    const agents = Array.from(agentMap.values()).map(config => {
      const sessions = config.sessions || [];
      
      // 统计 Token
      const tokenUsage = sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0);
      
      // 收集渠道
      const channels = [...new Set(sessions.map(s => s.channel || s.lastChannel || 'unknown'))];
      
      // 收集模型
      const models = [...new Set(sessions.filter(s => s.model).map(s => s.model))];
      
      // 统计子 Agent 数量
      const spawnCount = sessions.filter(s => s.spawnDepth > 0).length;
      
      // 计算最后活跃时间
      const lastActive = sessions.length > 0 
        ? Math.max(...sessions.filter(s => s.updatedAt).map(s => s.updatedAt))
        : null;
      
      // 判断状态
      let status = 'offline';
      if (sessions.length > 0) {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const isRecent = lastActive && lastActive > fiveMinutesAgo;
        const hasActive = sessions.some(s => !s.abortedLastRun);
        status = isRecent && hasActive ? 'active' : (hasActive ? 'idle' : 'offline');
      }
      
      return {
        id: config.id,
        name: config.name,
        emoji: config.emoji,
        role: config.role,
        status: status,
        workspace: config.workspace,
        // 替换 CPU/内存 为有用的字段
        tokenUsage: tokenUsage,
        tokenUsageFormatted: formatTokenCount(tokenUsage),
        sessionCount: sessions.length,
        channels: channels,
        channelSummary: channels.join(', ') || '无',
        models: models,
        modelSummary: models.length > 0 ? models[0] : '未知',
        spawnCount: spawnCount,
        lastActive: lastActive ? new Date(lastActive).toISOString() : null,
        lastActiveAgo: lastActive ? formatTimeAgo(lastActive) : '从未'
      };
    });

    res.json(agents);
  } catch (error) {
    console.error('获取 Agent 列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 格式化 Token 数量
function formatTokenCount(tokens) {
  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(1) + 'M';
  } else if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'K';
  }
  return tokens.toString();
}

// 格式化时间差
function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  return `${Math.floor(seconds / 86400)}天前`;
}

// 获取单个Agent详情
app.get('/api/agents/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const processes = await getProcessList();
    const network = getNetworkInfo();
    
    let agent;
    switch (id) {
      case 'system':
        agent = {
          id: 'system',
          name: '系统资源',
          emoji: '💻',
          role: '系统监控',
          status: 'online',
          workspace: os.hostname(),
          currentTask: '系统资源监控',
          sessions: 1,
          memory: Math.round(memory.usage),
          cpu: cpu.usage,
          lastActive: new Date().toISOString(),
          details: {
            hostname: os.hostname(),
            platform: os.platform(),
            uptime: getUptime(),
            cpuCores: cpu.cores,
            cpuModel: cpu.model
          }
        };
        break;
      case 'node':
        const memUsage = process.memoryUsage();
        agent = {
          id: 'node',
          name: 'Node.js进程',
          emoji: '🟢',
          role: '运行时',
          status: 'online',
          workspace: 'process',
          currentTask: `运行中 (PID: ${process.pid})`,
          sessions: 1,
          memory: Math.round(memUsage.heapUsed / 1024 / 1024),
          cpu: Math.round(cpu.usage * 0.1 * 100) / 100,
          lastActive: new Date().toISOString(),
          details: {
            pid: process.pid,
            nodeVersion: process.version,
            uptime: process.uptime(),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
            external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
            rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB'
          }
        };
        break;
      case 'memory':
        agent = {
          id: 'memory',
          name: '内存管理',
          emoji: '🧠',
          role: '内存监控',
          status: 'online',
          workspace: 'memory',
          currentTask: '内存使用监控',
          sessions: 1,
          memory: Math.round(memory.usage),
          cpu: Math.round(cpu.usage * 0.05 * 100) / 100,
          lastActive: new Date().toISOString(),
          details: {
            total: Math.round(memory.total / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
            used: Math.round(memory.used / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
            free: Math.round(memory.free / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
            usagePercent: memory.usage + '%'
          }
        };
        break;
      case 'network':
        agent = {
          id: 'network',
          name: '网络状态',
          emoji: '🌐',
          role: '网络监控',
          status: 'online',
          workspace: 'network',
          currentTask: `监控 ${network.length} 个网络接口`,
          sessions: network.length,
          memory: 15,
          cpu: Math.round(cpu.usage * 0.02 * 100) / 100,
          lastActive: new Date().toISOString(),
          details: {
            interfaces: network
          }
        };
        break;
      default:
        return res.status(404).json({ error: 'Agent不存在' });
    }
    
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取任务列表 - 按项目分组
app.get('/api/tasks', (req, res) => {
  // 按项目分组的任务
  const projectsWithTasks = projectConfigs.map(project => {
    const projectTasks = taskConfigs.filter(t => t.projectId === project.id);
    return {
      ...project,
      taskCount: projectTasks.length,
      taskDetails: projectTasks // 保留任务明细但不在列表中显示
    };
  });
  
  res.json(projectsWithTasks);
});

// 获取单个项目的任务
app.get('/api/projects/:id/tasks', (req, res) => {
  const { id } = req.params;
  const project = projectConfigs.find(p => p.id === id);
  
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
  const tasks = taskConfigs.filter(t => t.projectId === id);
  res.json(tasks);
});

// 获取项目列表
app.get('/api/projects', (req, res) => {
  const projects = projectConfigs.map(project => {
    const projectTasks = taskConfigs.filter(t => t.projectId === project.id);
    return {
      ...project,
      taskCount: projectTasks.length
    };
  });
  res.json(projects);
});

// 获取单个项目
app.get('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const project = projectConfigs.find(p => p.id === id);
  
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
  const tasks = taskConfigs.filter(t => t.projectId === id);
  res.json({
    ...project,
    tasks: tasks
  });
});

// 获取活动日志
app.get('/api/logs', (req, res) => {
  const logs = [
    { id: 1, agent: 'system', action: '系统资源监控启动', time: new Date().toISOString() },
    { id: 2, agent: 'node', action: `Node.js进程运行中 (PID: ${process.pid})`, time: new Date().toISOString() },
    { id: 3, agent: 'memory', action: '内存监控数据采集', time: new Date().toISOString() },
    { id: 4, agent: 'network', action: '网络接口状态检查', time: new Date().toISOString() }
  ];
  res.json(logs);
});

// 获取网络拓扑数据 - 动态生成
app.get('/api/topology', async (req, res) => {
  try {
    // 读取真实会话数据
    let sessionsData = {};
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('读取会话数据失败:', e.message);
    }
    
    // 动态发现 Agent
    const discoveredAgents = await discoverAgentsFromSessions(sessionsData);
    
    // 构建节点
    const nodes = [];
    const links = [];
    
    // 主节点
    const mainAgent = discoveredAgents.find(a => a.id === 'main');
    nodes.push({
      id: 'main',
      name: '主Agent',
      emoji: '🤖',
      role: '协调者',
      status: mainAgent && mainAgent.sessions.length > 0 ? 'online' : 'idle'
    });
    
    // 子节点
    const subAgents = discoveredAgents.filter(a => a.id !== 'main');
    for (const agent of subAgents) {
      const lastActive = agent.sessions.length > 0 
        ? Math.max(...agent.sessions.filter(s => s.updatedAt).map(s => s.updatedAt))
        : null;
      const isActive = lastActive && (Date.now() - lastActive) < 5 * 60 * 1000;
      
      nodes.push({
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
        role: agent.role,
        status: isActive ? 'online' : 'idle'
      });
      
      // 建立与主节点的连接
      links.push({
        source: 'main',
        target: agent.id,
        type: 'coordination'
      });
    }
    
    // 添加系统节点
    const network = getNetworkInfo();
    nodes.push({
      id: 'system',
      name: '系统资源',
      emoji: '💻',
      role: '系统监控',
      status: 'online'
    });
    
    nodes.push({
      id: 'network',
      name: '网络状态',
      emoji: '🌐',
      role: '网络监控',
      status: network.length > 0 ? 'online' : 'idle'
    });
    
    links.push({
      source: 'system',
      target: 'main',
      type: 'host'
    });
    
    links.push({
      source: 'network',
      target: 'main',
      type: 'monitor'
    });
    
    // 系统指标
    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    
    res.json({
      nodes: nodes,
      links: links,
      stats: {
        cpu: cpu.usage,
        memory: memory.usage,
        networkInterfaces: network.length,
        hostname: os.hostname(),
        totalAgents: discoveredAgents.length + 1,
        activeAgents: nodes.filter(n => n.status === 'online').length
      }
    });
  } catch (error) {
    console.error('获取拓扑失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取统计概览
app.get('/api/stats', async (req, res) => {
  try {
    // 读取真实会话数据
    let sessionsData = {};
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('读取会话数据失败:', e.message);
    }
    
    // 动态发现 Agent
    const discoveredAgents = await discoverAgentsFromSessions(sessionsData);
    
    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const processes = await getProcessList();
    const network = getNetworkInfo();
    
    // 计算在线/空闲/离线 Agent 数量
    let onlineCount = 0;
    let idleCount = 0;
    let activeTasks = 0;
    
    for (const agent of discoveredAgents) {
      const lastActive = agent.sessions.length > 0 
        ? Math.max(...agent.sessions.filter(s => s.updatedAt).map(s => s.updatedAt))
        : null;
      const isRecent = lastActive && (Date.now() - lastActive) < 5 * 60 * 1000;
      const hasActive = agent.sessions.some(s => !s.abortedLastRun);
      
      if (isRecent && hasActive) {
        onlineCount++;
        activeTasks++;
      } else if (hasActive) {
        idleCount++;
      }
    }
    
    res.json({
      totalAgents: discoveredAgents.length + 1, // +1 for main
      onlineCount: onlineCount,
      idleCount: idleCount,
      totalTasks: taskConfigs.length,
      activeTasks: activeTasks,
      completedTasks: projectConfigs.filter(p => p.status === 'completed').length,
      waitingTasks: projectConfigs.filter(p => p.status === 'planning').length,
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

// 添加日志
app.post('/api/logs', (req, res) => {
  const { agent, action } = req.body;
  const newLog = {
    id: Date.now(),
    agent: agent || 'system',
    action: action || '未知操作',
    time: new Date().toISOString()
  };
  res.json(newLog);
});

// 获取 OpenClaw 真实会话数据
app.get('/api/sessions', (req, res) => {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) {
      return res.json({ sessions: [], count: 0 });
    }
    
    const sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    
    // 提取关键信息
    const sessions = Object.entries(sessionsData).map(([key, data]) => ({
      key: key,
      sessionId: data.sessionId,
      label: data.label || null,
      channel: data.channel || data.deliveryContext?.channel || 'unknown',
      lastChannel: data.lastChannel || null,
      updatedAt: data.updatedAt,
      model: data.model || null,
      totalTokens: data.totalTokens || 0,
      inputTokens: data.inputTokens || 0,
      outputTokens: data.outputTokens || 0,
      contextTokens: data.contextTokens || 0,
      abortedLastRun: data.abortedLastRun || false,
      spawnDepth: data.spawnDepth || 0,
      subagentRole: data.subagentRole || null,
      spawnedBy: data.spawnedBy || null
    }));
    
    // 按更新时间排序
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    res.json({
      sessions: sessions,
      count: sessions.length,
      activeCount: sessions.filter(s => !s.abortedLastRun).length,
      subagentCount: sessions.filter(s => s.spawnDepth > 0).length,
      totalTokens: sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    process: {
      uptime: process.uptime(),
      memory: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      pid: process.pid
    }
  });
});

app.listen(PORT, () => {
  console.log(`Agent监控服务运行在 http://localhost:${PORT}`);
});
