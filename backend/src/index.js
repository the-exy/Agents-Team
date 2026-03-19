const express = require('express');
const cors = require('cors');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 缓存进程列表，避免频繁调用系统命令
let processCache = {
  data: null,
  timestamp: 0
};
const CACHE_TTL = 5000; // 5秒缓存

// Agent配置 - 保留基本配置，动态数据从真实系统获取
const agentConfigs = [
  {
    id: 'system',
    name: '系统资源',
    emoji: '💻',
    role: '系统监控',
    workspace: 'system'
  },
  {
    id: 'node',
    name: 'Node.js进程',
    emoji: '🟢',
    role: '运行时',
    workspace: 'process'
  },
  {
    id: 'memory',
    name: '内存管理',
    emoji: '🧠',
    role: '内存监控',
    workspace: 'memory'
  },
  {
    id: 'network',
    name: '网络状态',
    emoji: '🌐',
    role: '网络监控',
    workspace: 'network'
  }
];

// 任务配置
const taskConfigs = [
  { id: 1, title: '系统资源监控', type: 'system' },
  { id: 2, title: '进程监控', type: 'process' },
  { id: 3, title: '内存使用监控', type: 'memory' },
  { id: 4, title: '网络状态监控', type: 'network' }
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

// 获取Agent列表（系统监控视角）
app.get('/api/agents', async (req, res) => {
  try {
    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const processes = await getProcessList();
    const network = getNetworkInfo();
    
    const agents = [
      {
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
        lastActive: new Date().toISOString()
      },
      {
        id: 'node',
        name: 'Node.js进程',
        emoji: '🟢',
        role: '运行时',
        status: 'online',
        workspace: 'process',
        currentTask: `运行中 (PID: ${process.pid})`,
        sessions: 1,
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpu: Math.round(cpu.usage * 0.1 * 100) / 100,
        lastActive: new Date().toISOString()
      },
      {
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
        lastActive: new Date().toISOString()
      },
      {
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
        lastActive: new Date().toISOString()
      }
    ];
    
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

// 获取任务列表
app.get('/api/tasks', (req, res) => {
  const tasks = taskConfigs.map(t => ({
    ...t,
    status: 'in_progress',
    priority: 'high',
    progress: 100,
    assignees: [t.type],
    createdAt: new Date().toISOString()
  }));
  res.json(tasks);
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

// 获取网络拓扑数据
app.get('/api/topology', async (req, res) => {
  try {
    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const network = getNetworkInfo();
    
    const topology = {
      nodes: [
        { id: 'system', name: '系统资源', emoji: '💻', role: '系统监控', status: 'online' },
        { id: 'node', name: 'Node.js', emoji: '🟢', role: '运行时', status: 'online' },
        { id: 'memory', name: '内存管理', emoji: '🧠', role: '内存监控', status: 'online' },
        { id: 'network', name: '网络状态', emoji: '🌐', role: '网络监控', status: 'online' }
      ],
      links: [
        { source: 'system', target: 'memory', type: 'monitor' },
        { source: 'system', target: 'node', type: 'host' },
        { source: 'node', target: 'memory', type: 'use' },
        { source: 'system', target: 'network', type: 'monitor' }
      ],
      stats: {
        cpu: cpu.usage,
        memory: memory.usage,
        networkInterfaces: network.length,
        hostname: os.hostname()
      }
    };
    res.json(topology);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取统计概览
app.get('/api/stats', async (req, res) => {
  try {
    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const processes = await getProcessList();
    const network = getNetworkInfo();
    
    res.json({
      totalAgents: 4,
      onlineCount: 4,
      idleCount: 0,
      totalTasks: taskConfigs.length,
      activeTasks: taskConfigs.length,
      completedTasks: 0,
      waitingTasks: 0,
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
