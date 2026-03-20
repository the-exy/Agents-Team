const express = require('express');
const cors = require('cors');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const execPromise = util.promisify(exec);

// MySQL 连接池配置
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '123456',
  database: 'agent_monitor',
  waitForConnections: true,
  connectionLimit: 10
};


// Token 记录防重锁：{ agentId_sessionKey: timestamp }
const tokenRecordLock = {};
const TOKEN_RECORD_INTERVAL = 5 * 60 * 1000; // 5分钟

const app = express();
const PORT = process.env.PORT || 3001;

// OpenClaw 根目录
const OPENCLAW_HOME = os.homedir();

// Agent 配置 - 与 openclaw.json 中的 agents.list 对应
const agentConfigs = {
  'main': { id: 'main', name: '主Agent', emoji: '🤖', role: '协调者', workspace: 'workspace' },
  'backend': { id: 'backend', name: '后端开发', emoji: '⚙️', role: '后端开发', workspace: 'workspace-backend' },
  'frontend': { id: 'frontend', name: '前端开发', emoji: '🎨', role: '前端开发', workspace: 'workspace-frontend' },
  'pm': { id: 'pm', name: '产品经理', emoji: '📋', role: '产品经理', workspace: 'workspace-pm' },
  'db': { id: 'db', name: '数据库开发', emoji: '🗄️', role: '数据库开发', workspace: 'workspace-db' },
  'test': { id: 'test', name: '测试工程师', emoji: '🧪', role: '测试工程师', workspace: 'workspace-test' },
  'ops': { id: 'ops', name: '运维工程师', emoji: '🔧', role: '运维工程师', workspace: 'workspace-ops' },
  'codex': { id: 'codex', name: 'Codex', emoji: '💻', role: '编程助手', workspace: 'workspace-codex' }
};

// 读取所有 agent 的 sessions 文件路径
function getAllSessionsFiles() {
  const agentsDir = path.join(OPENCLAW_HOME, '.openclaw', 'agents');
  const files = {};
  try {
    const agentDirs = fs.readdirSync(agentsDir);
    for (const agentDir of agentDirs) {
      const sessionsFile = path.join(agentsDir, agentDir, 'sessions', 'sessions.json');
      if (fs.existsSync(sessionsFile)) {
        files[agentDir] = sessionsFile;
      }
    }
  } catch (e) {
    console.error('读取 agents 目录失败:', e.message);
  }
  return files;
}

// 读取所有 agent 的会话数据
function readAllSessionsData() {
  const sessionsByAgent = {};
  const files = getAllSessionsFiles();
  for (const [agentId, filePath] of Object.entries(files)) {
    try {
      sessionsByAgent[agentId] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`读取 ${agentId} 会话失败:`, e.message);
      sessionsByAgent[agentId] = {};
    }
  }
  return sessionsByAgent;
}

// 读取单个 agent 的会话数据（向后兼容）
function readSessionsData() {
  const sessionsFile = path.join(OPENCLAW_HOME, '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
  try {
    if (fs.existsSync(sessionsFile)) {
      return JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
    }
  } catch (e) {
    console.error('读取会话数据失败:', e.message);
  }
  return {};
}

app.use(cors());
app.use(express.json());

// 缓存
let processCache = { data: null, timestamp: 0 };
const CACHE_TTL = 5000;

// MySQL 连接池
let dbPool = null;
async function initDB() {
  try {
    // 先用临时连接建库（不指定 database）
    const tempPool = mysql.createPool({
      host: '127.0.0.1', port: 3306, user: 'root', password: '123456',
      waitForConnections: true, connectionLimit: 2
    });
    await tempPool.query(`CREATE DATABASE IF NOT EXISTS agent_monitor`);
    await tempPool.end();

    // 正式连接池
    dbPool = mysql.createPool({
      host: '127.0.0.1', port: 3306, user: 'root', password: '123456',
      database: 'agent_monitor', waitForConnections: true,
      connectionLimit: 10, queueLimit: 0
    });

    // 建表
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL, agent_name VARCHAR(128) NOT NULL,
        session_key VARCHAR(256), parent_session VARCHAR(256),
        input_tokens BIGINT DEFAULT 0, output_tokens BIGINT DEFAULT 0,
        total_tokens BIGINT DEFAULT 0, channel VARCHAR(64), model VARCHAR(128),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_agent_id (agent_id), INDEX idx_created_at (created_at),
        INDEX idx_agent_date (agent_id, created_at)
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS agent_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL, event_type VARCHAR(64) NOT NULL,
        session_key VARCHAR(256), parent_session VARCHAR(256),
        event_data JSON, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_agent_id (agent_id), INDEX idx_event_type (event_type),
        INDEX idx_created_at (created_at)
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS daily_token_summary (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL, agent_name VARCHAR(128) NOT NULL,
        record_date DATE NOT NULL,
        total_input_tokens BIGINT DEFAULT 0, total_output_tokens BIGINT DEFAULT 0,
        total_tokens BIGINT DEFAULT 0, session_count INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_agent_date (agent_id, record_date)
      )
    `);

    console.log('[DB] MySQL 连接成功，表已初始化');
    return true;
  } catch (e) {
    console.error('[DB] MySQL 连接/初始化失败:', e.message);
    dbPool = null;
    return false;
  }
}

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

// ==================== 数据库初始化 ====================

async function initDatabase() {
  if (!dbPool) {
    dbPool = mysql.createPool(dbConfig);
  }
  try {
    // 先创建数据库（不指定 database 连接）
    const tempPool = mysql.createPool({ host: dbConfig.host, port: dbConfig.port, user: dbConfig.user, password: dbConfig.password, waitForConnections: true, connectionLimit: 2 });
    await tempPool.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await tempPool.end();

    // 使用正式 pool 建表
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        agent_name VARCHAR(128) NOT NULL,
        session_key VARCHAR(256),
        parent_session VARCHAR(256),
        input_tokens BIGINT DEFAULT 0,
        output_tokens BIGINT DEFAULT 0,
        total_tokens BIGINT DEFAULT 0,
        channel VARCHAR(64),
        model VARCHAR(128),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_agent_id (agent_id),
        INDEX idx_created_at (created_at),
        INDEX idx_agent_date (agent_id, created_at)
      )
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS agent_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        session_key VARCHAR(256),
        parent_session VARCHAR(256),
        event_data JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_agent_id (agent_id),
        INDEX idx_event_type (event_type),
        INDEX idx_created_at (created_at)
      )
    `);

    console.log('[DB] 数据库初始化完成');
  } catch (err) {
    console.warn('[DB] 数据库初始化失败:', err.message);
    dbPool = null;
  }
}

// 记录 Token 使用量（upsert 逻辑，同 agent_id+session_key+同分钟则更新）
async function recordTokenUsage() {
  if (!dbPool) return;
  try {
    const allSessions = readAllSessionsData();
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000); // 分钟级别 key

    for (const [agentId, sessionsData] of Object.entries(allSessions)) {
      const config = agentConfigs[agentId] || { id: agentId, name: `${agentId} Agent`, emoji: '🤖' };

      for (const [sessionKey, data] of Object.entries(sessionsData)) {
        const lockKey = `${agentId}_${sessionKey}`;
        if (tokenRecordLock[lockKey] === minuteKey) continue; // 本分钟已记录
        tokenRecordLock[lockKey] = minuteKey;

        const inputTokens = data.inputTokens || 0;
        const outputTokens = data.outputTokens || 0;
        const totalTokens = data.totalTokens || (inputTokens + outputTokens);
        const channel = data.lastChannel || data.channel || null;
        const model = data.model || null;
        const parentSession = data.parentSessionKey || null;

        // Upsert: INSERT ... ON DUPLICATE KEY UPDATE
        await dbPool.query(`
          INSERT INTO token_usage (agent_id, agent_name, session_key, parent_session, input_tokens, output_tokens, total_tokens, channel, model, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            agent_name = VALUES(agent_name),
            input_tokens = VALUES(input_tokens),
            output_tokens = VALUES(output_tokens),
            total_tokens = VALUES(total_tokens),
            channel = VALUES(channel),
            model = VALUES(model),
            created_at = NOW()
        `, [agentId, config.name, sessionKey, parentSession, inputTokens, outputTokens, totalTokens, channel, model]);

        // 记录 session_start 事件（首次活跃会话）
        if (data.updatedAt && data.spawnDepth !== undefined) {
          await dbPool.query(`
            INSERT INTO agent_events (agent_id, event_type, session_key, parent_session, event_data, created_at)
            VALUES (?, 'session_start', ?, ?, ?, NOW())
          `, [agentId, sessionKey, parentSession, JSON.stringify({ spawnDepth: data.spawnDepth || 0, channel, model })]);
        }
      }
    }
  } catch (err) {
    console.warn('[DB] 记录 token 使用量失败:', err.message);
  }
}

// 自动记录 token（带锁，5分钟内相同数据不重复记录）
function autoRecordTokenUsage() {
  const now = Date.now();
  const minuteKey = Math.floor(now / 60000);
  const allSessions = readAllSessionsData();
  let hasNewData = false;

  for (const [agentId, sessionsData] of Object.entries(allSessions)) {
    for (const [sessionKey] of Object.entries(sessionsData)) {
      const lockKey = `${agentId}_${sessionKey}`;
      if (!tokenRecordLock[lockKey] || tokenRecordLock[lockKey] !== minuteKey) {
        hasNewData = true;
        break;
      }
    }
    if (hasNewData) break;
  }

  if (hasNewData) {
    recordTokenUsage().catch(() => {});
  }
}

// 同步 sessions 到 MySQL（调用 recordTokenUsage）
async function syncSessionsToDB() {
  if (!dbPool) return;
  await recordTokenUsage().catch(e => console.warn('[DB] syncSessionsToDB 失败:', e.message));
}

// ==================== API 端点 ====================

// 获取所有 Agent 状态
app.get('/api/agents', async (req, res) => {
  try {
    await syncSessionsToDB();
    const allSessions = readAllSessionsData();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const agents = [];

    for (const [agentId, config] of Object.entries(agentConfigs)) {
      const sessionsData = allSessions[agentId] || {};
      const sessionsArray = Object.entries(sessionsData);

      let totalTokens = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let lastActive = null;
      let channel = '无';
      let model = '未知';

      for (const [key, data] of sessionsArray) {
        if (data.totalTokens) totalTokens += data.totalTokens;
        if (data.inputTokens) inputTokens += data.inputTokens;
        if (data.outputTokens) outputTokens += data.outputTokens;
        if (data.updatedAt && (!lastActive || data.updatedAt > lastActive)) {
          lastActive = data.updatedAt;
        }
        if (data.lastChannel) channel = data.lastChannel;
        if (data.model) model = data.model;
      }

      const isActive = lastActive && lastActive > fiveMinutesAgo;
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const isIdle = lastActive && lastActive > oneHourAgo;

      let heartbeatStatus, heartbeatLabel, statusColor;
      if (isActive) {
        heartbeatStatus = 'active';
        heartbeatLabel = '🟢 活跃';
        statusColor = '#10b981';
      } else if (isIdle) {
        heartbeatStatus = 'idle';
        heartbeatLabel = '🟡 空闲';
        statusColor = '#f59e0b';
      } else {
        heartbeatStatus = 'offline';
        heartbeatLabel = '🔴 离线';
        statusColor = '#ef4444';
      }

      const status = lastActive ? (isActive ? 'active' : 'idle') : 'offline';

      agents.push({
        id: config.id,
        name: config.name,
        emoji: config.emoji,
        role: config.role,
        status,
        heartbeatStatus,
        heartbeatLabel,
        statusColor,
        tokenUsage: totalTokens,
        tokenUsageFormatted: formatTokenCount(totalTokens),
        inputTokens,
        outputTokens,
        sessionCount: sessionsArray.length,
        channel,
        model,
        spawnCount: 0,
        lastActive: lastActive ? new Date(lastActive).toISOString() : null,
        lastActiveAgo: formatTimeAgo(lastActive),
        tasks: taskConfigs[agentId] || []
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
    const allSessions = readAllSessionsData();
    const sessionsData = allSessions[id] || {};

    const config = agentConfigs[id] || { id, name: `${id} Agent`, emoji: '🤖', role: 'Agent' };

    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let lastActive = null;
    let channel = '无';
    let model = '未知';
    const sessions = [];

    for (const [key, data] of Object.entries(sessionsData)) {
      if (data.totalTokens) totalTokens += data.totalTokens;
      if (data.inputTokens) inputTokens += data.inputTokens;
      if (data.outputTokens) outputTokens += data.outputTokens;
      if (data.updatedAt && (!lastActive || data.updatedAt > lastActive)) lastActive = data.updatedAt;
      if (data.lastChannel) channel = data.lastChannel;
      if (data.model) model = data.model;
      sessions.push({ key, ...data });
    }

    const isActive = lastActive && lastActive > Date.now() - 5 * 60 * 1000;
    const status = lastActive ? (isActive ? 'active' : 'idle') : 'offline';

    res.json({
      id: config.id,
      name: config.name,
      emoji: config.emoji,
      role: config.role,
      status,
      tokenUsage: totalTokens,
      tokenUsageFormatted: formatTokenCount(totalTokens),
      inputTokens,
      outputTokens,
      sessionCount: sessions.length,
      channel,
      model,
      sessions,
      lastActive: lastActive ? new Date(lastActive).toISOString() : null,
      lastActiveAgo: formatTimeAgo(lastActive),
      tasks: taskConfigs[id] || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agents/:id/skills - 获取 Agent 的 Skills
app.get('/api/agents/:id/skills', (req, res) => {
  const { id } = req.params;

  const allSkills = [
    { name: 'feishu-bitable', description: '飞书多维表格（Bitable）的创建、查询、编辑和管理工具', enabled: true },
    { name: 'feishu-calendar', description: '飞书日历与日程管理工具集', enabled: true },
    { name: 'feishu-channel-rules', description: 'Lark/Feishu channel output rules', enabled: true },
    { name: 'feishu-create-doc', description: '创建飞书云文档', enabled: true },
    { name: 'feishu-fetch-doc', description: '获取飞书云文档内容', enabled: true },
    { name: 'feishu-im-read', description: '飞书 IM 消息读取工具', enabled: true },
    { name: 'feishu-task', description: '飞书任务管理工具', enabled: true },
    { name: 'feishu-troubleshoot', description: '飞书插件问题排查工具', enabled: true },
    { name: 'feishu-update-doc', description: '更新飞书云文档', enabled: true },
    { name: 'coding-agent', description: '编码任务代理工具', enabled: true },
    { name: 'healthcheck', description: '主机安全与健康检查', enabled: true },
    { name: 'self-improvement', description: '持续自我改进与学习捕获', enabled: true },
    { name: 'find-skills', description: '技能搜索与安装助手', enabled: true },
    { name: 'skill-vetter', description: 'AI Agent 技能安全审查工具', enabled: true }
  ];

  // 所有 Agent 都有基础飞书技能 + coding-agent + healthcheck + self-improvement
  const baseSkills = allSkills.filter(s =>
    s.name.startsWith('feishu-') || ['coding-agent', 'healthcheck', 'self-improvement'].includes(s.name)
  );

  let skills;
  switch (id) {
    case 'main':
      // main 有全部技能
      skills = allSkills;
      break;
    case 'backend':
      // backend: 全部飞书技能 + coding + healthcheck + self-improvement + skill-vetter
      skills = allSkills.filter(s =>
        s.name.startsWith('feishu-') ||
        ['coding-agent', 'healthcheck', 'self-improvement', 'skill-vetter'].includes(s.name)
      );
      break;
    case 'pm':
      // pm: 全部飞书技能 + find-skills + self-improvement
      skills = allSkills.filter(s =>
        s.name.startsWith('feishu-') ||
        ['find-skills', 'self-improvement'].includes(s.name)
      );
      break;
    case 'frontend':
      // frontend: 部分飞书技能 + coding + find-skills
      skills = allSkills.filter(s =>
        ['feishu-bitable', 'feishu-calendar', 'feishu-channel-rules', 'feishu-create-doc',
          'feishu-fetch-doc', 'feishu-im-read', 'feishu-task', 'feishu-update-doc',
          'coding-agent', 'find-skills', 'self-improvement'].includes(s.name)
      );
      break;
    default:
      skills = baseSkills;
  }

  res.json(skills);
});

// GET /api/agents/:id/files - 获取 Agent 工作空间的 MD 文件
app.get('/api/agents/:id/files', (req, res) => {
  const { id } = req.params;

  const workspaceMap = {
    'main': path.join(OPENCLAW_HOME, '.openclaw', 'workspace'),
    'backend': path.join(OPENCLAW_HOME, '.openclaw', 'workspace-backend'),
    'pm': path.join(OPENCLAW_HOME, '.openclaw', 'workspace-pm'),
    'frontend': path.join(OPENCLAW_HOME, '.openclaw', 'workspace-frontend')
  };

  const checkFiles = [
    'AGENTS.md', 'SOUL.md', 'MEMORY.md', 'USER.md',
    'HEARTBEAT.md', 'TOOLS.md', 'IDENTITY.md', 'PROJECT_DOC.md'
  ];

  const workspacePath = workspaceMap[id];
  const result = [];

  if (!workspacePath) {
    return res.status(404).json({ error: 'Agent workspace not found' });
  }

  for (const file of checkFiles) {
    const filePath = path.join(workspacePath, file);
    let exists = false;
    let lastModified = null;
    try {
      const stat = fs.statSync(filePath);
      exists = true;
      lastModified = stat.mtime.toISOString();
    } catch (e) {
      exists = false;
    }
    result.push({ name: file, path: filePath, exists, lastModified });
  }

  res.json({ files: result });
});

// GET /api/agents/:id/tasks - 获取 Agent 的任务
app.get('/api/agents/:id/tasks', (req, res) => {
  const { id } = req.params;
  const tasks = taskConfigs[id] || [];
  res.json(tasks);
});

// 获取统计概览
app.get('/api/stats', async (req, res) => {
  try {
    const allSessions = readAllSessionsData();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    let totalAgents = 0;
    let onlineCount = 0;
    let idleCount = 0;
    let totalTokens = 0;

    for (const [agentId, sessionsData] of Object.entries(allSessions)) {
      const config = agentConfigs[agentId];
      if (!config) continue;

      totalAgents++;
      let hasActiveSession = false;
      let hasAnySession = false;

      for (const [key, data] of Object.entries(sessionsData)) {
        if (data.totalTokens) totalTokens += data.totalTokens;
        if (data.updatedAt) {
          hasAnySession = true;
          if (data.updatedAt > fiveMinutesAgo) hasActiveSession = true;
        }
      }

      if (hasActiveSession) onlineCount++;
      else if (hasAnySession) idleCount++;
    }

    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const processes = await getProcessList();
    const network = getNetworkInfo();

    res.json({
      totalAgents,
      onlineCount,
      idleCount,
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
    const allSessions = readAllSessionsData();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    let nodes = [];
    const links = [];

    for (const [agentId, sessionsData] of Object.entries(allSessions)) {
      const config = agentConfigs[agentId];
      if (!config) continue;

      let lastActive = null;
      let totalTokens = 0;
      for (const [key, data] of Object.entries(sessionsData)) {
        if (data.updatedAt && (!lastActive || data.updatedAt > lastActive)) lastActive = data.updatedAt;
        if (data.totalTokens) totalTokens += data.totalTokens;
      }

      const status = lastActive && lastActive > fiveMinutesAgo ? 'online' : (lastActive ? 'idle' : 'offline');

      nodes.push({
        id: config.id,
        name: config.name,
        emoji: config.emoji,
        role: config.role,
        status,
        tokens: totalTokens
      });

      if (agentId !== 'main') {
        links.push({ source: 'main', target: config.id, type: 'coordination' });
      }
    }

    nodes.push({ id: 'system', name: '系统', emoji: '💻', role: '监控', status: 'online' });
    nodes.push({ id: 'network', name: '网络', emoji: '🌐', role: '通信', status: 'online' });
    links.push({ source: 'system', target: 'main', type: 'host' });
    links.push({ source: 'network', target: 'main', type: 'monitor' });

    const cpu = await getCpuUsage();
    const memory = getMemoryUsage();
    const network = getNetworkInfo();

    // 计算节点位置 - 基于节点数量动态布局
    const viewBoxWidth = 1000;
    const viewBoxHeight = 500;
    const centerX = 400;
    const centerY = 220;
    const mainRadius = 280;

    // 重新分配节点位置
    const agentNodes = nodes.filter(n => !['system', 'network', 'main'].includes(n.id));
    const totalSlots = agentNodes.length;
    const angleStep = totalSlots > 0 ? (2 * Math.PI * 0.65) / totalSlots : 0;
    const startAngle = -Math.PI * 0.35; // 从左上方开始

    const nodePositions = {};
    nodePositions['main'] = { x: 120, y: 160 };
    nodePositions['system'] = { x: 860, y: 100 };
    nodePositions['network'] = { x: 860, y: 200 };

    agentNodes.forEach((node, idx) => {
      const angle = startAngle + idx * angleStep;
      nodePositions[node.id] = {
        x: Math.round(centerX + mainRadius * Math.cos(angle)),
        y: Math.round(centerY + mainRadius * Math.sin(angle))
      };
    });

    // 应用位置到节点
    nodes = nodes.map(node => ({
      ...node,
      position: nodePositions[node.id] || { x: centerX, y: centerY }
    }));

    res.json({
      nodes,
      links,
      viewBox: { width: viewBoxWidth, height: viewBoxHeight },
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
    const allSessions = readAllSessionsData();
    const sessions = [];

    for (const [agentId, sessionsData] of Object.entries(allSessions)) {
      const config = agentConfigs[agentId] || { id: agentId, name: `${agentId} Agent`, emoji: '🤖' };
      for (const [key, data] of Object.entries(sessionsData)) {
        sessions.push({
          key,
          sessionId: data.sessionId,
          label: data.label || null,
          channel: data.channel || data.lastChannel || 'unknown',
          lastChannel: data.lastChannel || null,
          updatedAt: data.updatedAt,
          model: data.model || null,
          totalTokens: data.totalTokens || 0,
          inputTokens: data.inputTokens || 0,
          outputTokens: data.outputTokens || 0,
          abortedLastRun: data.abortedLastRun || false,
          spawnDepth: data.spawnDepth || 0,
          agentId,
          agentName: config.name,
          agentEmoji: config.emoji
        });
      }
    }

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

// 获取排行榜
app.get('/api/rankings', (req, res) => {
  try {
    const allSessions = readAllSessionsData();

    // 计算每个 agent 的 token 使用量和会话数
    const agentStats = {};
    for (const [agentId, sessionsData] of Object.entries(allSessions)) {
      const config = agentConfigs[agentId] || { id: agentId, name: `${agentId} Agent`, emoji: '🤖' };
      let totalTokens = 0;
      let sessionCount = 0;
      let lastActive = null;

      for (const [key, data] of Object.entries(sessionsData)) {
        if (data.totalTokens) totalTokens += data.totalTokens;
        sessionCount++;
        if (data.updatedAt && (!lastActive || data.updatedAt > lastActive)) {
          lastActive = data.updatedAt;
        }
      }

      agentStats[agentId] = {
        agentId,
        agentName: config.name,
        emoji: config.emoji,
        tokenUsage: totalTokens,
        sessionCount,
        lastActive
      };
    }

    // Token 排行榜 - 按 tokenUsage 降序，取前5
    const tokenRanking = Object.values(agentStats)
      .sort((a, b) => b.tokenUsage - a.tokenUsage)
      .slice(0, 5)
      .map((stat, idx) => ({
        rank: idx + 1,
        agentId: stat.agentId,
        agentName: stat.agentName,
        emoji: stat.emoji,
        tokenUsage: stat.tokenUsage,
        formatted: formatTokenCount(stat.tokenUsage)
      }));

    // 活跃度排行榜 - 按 sessionCount 降序，再按 lastActive 降序，取前5
    const activityRanking = Object.values(agentStats)
      .sort((a, b) => {
        if (b.sessionCount !== a.sessionCount) return b.sessionCount - a.sessionCount;
        return (b.lastActive || 0) - (a.lastActive || 0);
      })
      .slice(0, 5)
      .map((stat, idx) => ({
        rank: idx + 1,
        agentId: stat.agentId,
        agentName: stat.agentName,
        emoji: stat.emoji,
        sessionCount: stat.sessionCount,
        lastActive: formatTimeAgo(stat.lastActive)
      }));

    res.json({ tokenRanking, activityRanking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取纪念册（已结束的会话和已完成的任务）
app.get('/api/memorials', (req, res) => {
  try {
    const allSessions = readAllSessionsData();
    const memorialList = [];
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

    // 从会话中提取已结束的会话
    for (const [agentId, sessionsData] of Object.entries(allSessions)) {
      const config = agentConfigs[agentId] || { id: agentId, name: `${agentId} Agent`, emoji: '🤖' };

      for (const [key, data] of Object.entries(sessionsData)) {
        const isEnded = data.abortedLastRun || (data.lastActive && data.lastActive < thirtyMinutesAgo);

        if (isEnded) {
          memorialList.push({
            id: `session-${agentId}-${key}`,
            type: 'session_ended',
            agentId,
            agentName: config.name,
            agentEmoji: config.emoji,
            title: `${config.name} 会话结束`,
            description: `${data.model || '未知'} · ${formatTokenCount(data.totalTokens || 0)} tokens`,
            timestamp: data.lastActive ? new Date(data.lastActive).toISOString() : new Date().toISOString(),
            timeAgo: formatTimeAgo(data.lastActive)
          });
        }
      }
    }

    // 从任务中提取已完成的任务
    for (const [agentId, tasks] of Object.entries(taskConfigs)) {
      const config = agentConfigs[agentId] || { id: agentId, name: `${agentId} Agent`, emoji: '🤖' };

      for (const task of tasks) {
        if (task.status === 'completed') {
          memorialList.push({
            id: `task-${agentId}-${task.id}`,
            type: 'task_completed',
            agentId,
            agentName: config.name,
            agentEmoji: config.emoji,
            title: task.title,
            description: '已完成',
            timestamp: task.completedAt ? new Date(task.completedAt).toISOString() : new Date().toISOString(),
            timeAgo: formatTimeAgo(task.completedAt ? task.completedAt : Date.now())
          });
        }
      }
    }

    // 按时间戳降序排序，限制50条
    memorialList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const memorials = memorialList.slice(0, 50);

    res.json({ memorials });
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
  res.json({ status: 'ok', time: new Date().toISOString(), db: !!dbPool });
});

// GET /api/token-stats - Token 使用统计（支持按日期查询）
app.get('/api/token-stats', async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({ error: '数据库未连接', hint: '请确保 MySQL 服务运行中' });
  }
  try {
    const { start_date, end_date, agent_id } = req.query;

    let query = `SELECT agent_id, record_date, total_input_tokens, total_output_tokens,
                 total_tokens, session_count FROM daily_token_summary WHERE 1=1`;
    const params = [];

    if (start_date) { query += ' AND record_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND record_date <= ?'; params.push(end_date); }
    if (agent_id) { query += ' AND agent_id = ?'; params.push(agent_id); }

    query += ' ORDER BY record_date DESC, agent_id ASC';

    const [rows] = await dbPool.execute(query, params);

    // 同时返回汇总
    const [summary] = await dbPool.execute(
      `SELECT agent_id, SUM(total_tokens) as total, SUM(input_tokens) as input, SUM(output_tokens) as output, COUNT(DISTINCT session_key) as sessions FROM token_usage GROUP BY agent_id`
    );

    res.json({
      daily: rows,
      summary: summary,
      query: { start_date, end_date, agent_id }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/token-daily - 每日 Token 趋势（最近30天）
app.get('/api/token-daily', async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: '数据库未连接' });
  try {
    const [rows] = await dbPool.execute(
      `SELECT record_date, agent_id, total_tokens, input_tokens, output_tokens, session_count
       FROM daily_token_summary
       WHERE record_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY record_date ASC, agent_id ASC`
    );
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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

// ==================== SubAgent 追踪 API ====================

// GET /api/subagents - 获取当前活跃的 SubAgent
app.get('/api/subagents', (req, res) => {
  try {
    const allSessions = readAllSessionsData();
    const subagents = [];
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    for (const [agentId, sessionsData] of Object.entries(allSessions)) {
      for (const [sessionKey, data] of Object.entries(sessionsData)) {
        // spawnDepth > 0 表示是 SubAgent
        if ((data.spawnDepth !== undefined && data.spawnDepth > 0) || (data.parentSessionKey)) {
          const isActive = data.updatedAt && data.updatedAt > fiveMinutesAgo;
          subagents.push({
            sessionKey,
            agentId,
            parentSessionKey: data.parentSessionKey || null,
            spawnDepth: data.spawnDepth || 0,
            model: data.model || null,
            channel: data.lastChannel || null,
            totalTokens: data.totalTokens || 0,
            inputTokens: data.inputTokens || 0,
            outputTokens: data.outputTokens || 0,
            status: isActive ? 'running' : 'completed',
            lastActive: data.updatedAt ? new Date(data.updatedAt).toISOString() : null,
            lastActiveAgo: formatTimeAgo(data.updatedAt)
          });
        }
      }
    }

    subagents.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
    res.json({ subagents, count: subagents.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/subagent-tree - 获取 SubAgent 树状结构
app.get('/api/subagent-tree', (req, res) => {
  try {
    const allSessions = readAllSessionsData();
    const tree = [];

    for (const [agentId, sessionsData] of Object.entries(allSessions)) {
      const config = agentConfigs[agentId] || { id: agentId, name: `${agentId} Agent`, emoji: '🤖' };

      for (const [sessionKey, data] of Object.entries(sessionsData)) {
        if (data.spawnDepth !== undefined && data.spawnDepth > 0) {
          tree.push({
            agentId,
            agentName: config.name,
            agentEmoji: config.emoji,
            sessionKey,
            parentSessionKey: data.parentSessionKey || null,
            spawnDepth: data.spawnDepth,
            totalTokens: data.totalTokens || 0,
            status: data.updatedAt && data.updatedAt > Date.now() - 300000 ? 'running' : 'completed'
          });
        }
      }
    }

    res.json({ tree, count: tree.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/agent-events - 获取 Agent 事件
app.get('/api/agent-events', async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: '数据库未连接' });
  try {
    const { agentId, eventType, limit = 50 } = req.query;
    let query = 'SELECT * FROM agent_events WHERE 1=1';
    const params = [];
    if (agentId) { query += ' AND agent_id = ?'; params.push(agentId); }
    if (eventType) { query += ' AND event_type = ?'; params.push(eventType); }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    const [rows] = await dbPool.execute(query, params);
    res.json({ events: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 初始化数据库
initDB();

app.listen(PORT, () => {
  console.log(`Agent监控服务运行在 http://localhost:${PORT}`);
});
