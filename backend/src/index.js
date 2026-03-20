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

    // 建表 - token_usage（Token 使用明细）
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL, agent_name VARCHAR(128) NOT NULL,
        session_key VARCHAR(256), parent_session VARCHAR(256),
        input_tokens BIGINT DEFAULT 0, output_tokens BIGINT DEFAULT 0,
        total_tokens BIGINT DEFAULT 0, channel VARCHAR(64), model VARCHAR(128),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_agent_id (agent_id), INDEX idx_created_at (created_at),
        INDEX idx_agent_date (agent_id, created_at),
        INDEX idx_model (model)
      )
    `);

    // 建表 - agent_events（Agent 事件）
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

    // 建表 - daily_token_summary（每日 Token 汇总）
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

    // 建表 - model_updates（模型切换记录）【新增】
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS model_updates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        old_model VARCHAR(128) DEFAULT NULL,
        new_model VARCHAR(128) NOT NULL,
        switch_reason VARCHAR(256) DEFAULT NULL,
        triggered_by VARCHAR(128) DEFAULT NULL,
        session_key VARCHAR(256) DEFAULT NULL,
        switch_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_agent_id (agent_id),
        INDEX idx_new_model (new_model),
        INDEX idx_switch_time (switch_time)
      )
    `);

    // 建表 - model_daily_stats（模型每日调用统计）【新增】
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS model_daily_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        model VARCHAR(128) NOT NULL,
        record_date DATE NOT NULL,
        total_calls BIGINT DEFAULT 0,
        total_input_tokens BIGINT DEFAULT 0,
        total_output_tokens BIGINT DEFAULT 0,
        total_tokens BIGINT DEFAULT 0,
        unique_sessions INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_agent_model_date (agent_id, model, record_date)
      )
    `);

    console.log('[DB] MySQL 连接成功，表已初始化（含 model_updates / model_daily_stats）');
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

// 记录 Token 使用量（upsert 逻辑，同 agent_id+session_key+同分钟则更新）
// 同时检测模型切换并更新 model_updates 和 model_daily_stats
async function recordTokenUsage() {
  if (!dbPool) return;
  try {
    const allSessions = readAllSessionsData();
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000); // 分钟级别 key
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

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

        // 【新增】检测模型切换：与上次记录对比，发现模型变化则写入 model_updates
        if (model) {
          const prevEntry = lastKnownModel[agentId];
          if (!prevEntry || prevEntry !== model) {
            // 模型发生了变化
            await dbPool.query(`
              INSERT INTO model_updates (agent_id, old_model, new_model, session_key, switch_time)
              VALUES (?, ?, ?, ?, NOW())
            `, [agentId, prevEntry || null, model, sessionKey]);
            lastKnownModel[agentId] = model;
          }
        }

        // 【新增】更新 model_daily_stats（每日聚合）
        if (model) {
          await dbPool.query(`
            INSERT INTO model_daily_stats (agent_id, model, record_date, total_calls, total_input_tokens, total_output_tokens, total_tokens, unique_sessions)
            VALUES (?, ?, ?, 1, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
              total_calls = total_calls + 1,
              total_input_tokens = total_input_tokens + VALUES(total_input_tokens),
              total_output_tokens = total_output_tokens + VALUES(total_output_tokens),
              total_tokens = total_tokens + VALUES(total_tokens)
          `, [agentId, model, today, inputTokens, outputTokens, totalTokens]);
        }
      }
    }
  } catch (err) {
    console.warn('[DB] 记录 token 使用量失败:', err.message);
  }
}

// 跟踪每个 Agent 最近一次记录的模型（用于检测模型切换）
const lastKnownModel = {};

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

  res.json({ skills });
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

    let dailyQuery = `SELECT agent_id, agent_name, record_date, total_input_tokens,
                      total_output_tokens, total_tokens, session_count
                      FROM daily_token_summary WHERE 1=1`;
    const params = [];

    if (start_date) { dailyQuery += ' AND record_date >= ?'; params.push(start_date); }
    if (end_date) { dailyQuery += ' AND record_date <= ?'; params.push(end_date); }
    if (agent_id) { dailyQuery += ' AND agent_id = ?'; params.push(agent_id); }

    dailyQuery += ' ORDER BY record_date DESC, agent_id ASC';

    const [rows] = await dbPool.execute(dailyQuery, params);

    // 返回全局汇总（扁平格式，供 TokenStats 概览卡片使用）
    const [globalSummary] = await dbPool.execute(
      `SELECT
         COALESCE(SUM(total_input_tokens), 0)  AS total_input_tokens,
         COALESCE(SUM(total_output_tokens), 0) AS total_output_tokens,
         COALESCE(SUM(total_tokens), 0)        AS total_tokens,
         COALESCE(SUM(session_count), 0)       AS total_sessions
       FROM daily_token_summary
       ${agent_id ? 'WHERE agent_id = ?' : ''}
       ${agent_id ? [] : []}`,
      agent_id ? [agent_id] : []
    );

    res.json({
      daily: rows.map(r => ({
        date: r.record_date,
        agent_id: r.agent_id,
        agent_name: r.agent_name,
        input_tokens: r.total_input_tokens,
        output_tokens: r.total_output_tokens,
        total_tokens: r.total_tokens,
        session_count: r.session_count
      })),
      summary: Array.isArray(globalSummary) && globalSummary.length > 0 ? globalSummary[0] : {
        total_input_tokens: 0, total_output_tokens: 0, total_tokens: 0, total_sessions: 0
      },
      query: { start_date, end_date, agent_id }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/token-usage/daily-summary - 每日 Token 趋势（供 TokenHistory 图表使用）
// Frontend: tokenAPI.queryDailySummary({ startDate, endDate, agentId })
app.get('/api/token-usage/daily-summary', async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: '数据库未连接' });
  try {
    const { startDate, endDate, agentId } = req.query;

    let query = `SELECT record_date AS date, agent_id,
                        SUM(input_tokens)  AS inputTokens,
                        SUM(output_tokens) AS outputTokens,
                        SUM(total_tokens)  AS totalTokens
                 FROM token_usage WHERE 1=1`;
    const params = [];

    if (startDate) { query += ' AND DATE(created_at) >= ?'; params.push(startDate); }
    if (endDate)   { query += ' AND DATE(created_at) <= ?'; params.push(endDate); }
    if (agentId && agentId !== 'all') { query += ' AND agent_id = ?'; params.push(agentId); }

    query += ' GROUP BY record_date, agent_id ORDER BY record_date ASC';

    const [rows] = await dbPool.execute(query, params);

    res.json(rows.map(r => ({
      date: r.date,
      agentId: r.agent_id,
      inputTokens: Number(r.inputTokens) || 0,
      outputTokens: Number(r.outputTokens) || 0,
      totalTokens: Number(r.totalTokens) || 0
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/token-usage/query - Token 使用明细（供 TokenHistory 明细表格使用）
// Frontend: tokenAPI.queryDetails({ startDate, endDate, agentId, limit })
app.get('/api/token-usage/query', async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: '数据库未连接' });
  try {
    const { startDate, endDate, agentId, limit = 100 } = req.query;

    let query = `SELECT session_key, channel, model, created_at AS createdAt,
                        input_tokens AS inputTokens, output_tokens AS outputTokens,
                        total_tokens AS totalTokens, agent_id
                 FROM token_usage WHERE 1=1`;
    const params = [];

    if (startDate) { query += ' AND DATE(created_at) >= ?'; params.push(startDate); }
    if (endDate)   { query += ' AND DATE(created_at) <= ?'; params.push(endDate); }
    if (agentId && agentId !== 'all') { query += ' AND agent_id = ?'; params.push(agentId); }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await dbPool.execute(query, params);

    res.json(rows.map(r => ({
      sessionKey: r.session_key,
      channel: r.channel,
      model: r.model,
      createdAt: r.createdAt,
      inputTokens: Number(r.inputTokens) || 0,
      outputTokens: Number(r.outputTokens) || 0,
      agentId: r.agent_id
    })));
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

// GET /api/models - 获取模型使用统计（从 sessions.json 读取）
app.get('/api/models', (req, res) => {
  try {
    const allSessions = readAllSessionsData();
    const modelStats = {};      // model -> { totalTokens, inputTokens, outputTokens, sessionCount, agents }
    const agentModels = {};    // agentId -> { currentModel, tokens, sessions }
    const modelHistory = [];   // 历史模型切换记录

    for (const [agentId, sessionsData] of Object.entries(allSessions)) {
      const config = agentConfigs[agentId] || { id: agentId, name: `${agentId} Agent`, emoji: '🤖' };
      agentModels[agentId] = {
        agentId,
        agentName: config.name,
        agentEmoji: config.emoji,
        currentModel: null,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        sessionCount: 0,
        sessions: []
      };

      for (const [sessionKey, data] of Object.entries(sessionsData)) {
        const model = data.model || 'unknown';
        const inputTokens = data.inputTokens || 0;
        const outputTokens = data.outputTokens || 0;
        const totalTokens = data.totalTokens || (inputTokens + outputTokens);
        const updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;

        // Agent 级别统计
        agentModels[agentId].sessionCount++;
        agentModels[agentId].totalTokens += totalTokens;
        agentModels[agentId].inputTokens += inputTokens;
        agentModels[agentId].outputTokens += outputTokens;
        // 最新的 model 作为当前 model
        if (updatedAt && (!agentModels[agentId].currentModel || agentModels[agentId].currentModel === 'unknown')) {
          agentModels[agentId].currentModel = model;
        }
        agentModels[agentId].sessions.push({
          sessionKey,
          model,
          totalTokens,
          inputTokens,
          outputTokens,
          updatedAt: updatedAt ? updatedAt.toISOString() : null,
          channel: data.lastChannel || data.channel || null
        });

        // 全局 model 统计
        if (!modelStats[model]) {
          modelStats[model] = { totalTokens: 0, inputTokens: 0, outputTokens: 0, sessionCount: 0, agents: new Set() };
        }
        modelStats[model].totalTokens += totalTokens;
        modelStats[model].inputTokens += inputTokens;
        modelStats[model].outputTokens += outputTokens;
        modelStats[model].sessionCount++;
        modelStats[model].agents.add(agentId);

        // 历史记录（最近 50 条）
        if (updatedAt) {
          modelHistory.push({
            agentId,
            agentName: config.name,
            agentEmoji: config.emoji,
            sessionKey,
            model,
            totalTokens,
            updatedAt: updatedAt.toISOString(),
            channel: data.lastChannel || data.channel || null
          });
        }
      }
    }

    // 汇总 model 列表
    const modelList = Object.entries(modelStats).map(([model, stats]) => ({
      model,
      totalTokens: stats.totalTokens,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      sessionCount: stats.sessionCount,
      agentCount: stats.agents.size,
      agents: Array.from(stats.agents)
    })).sort((a, b) => b.totalTokens - a.totalTokens);

    // 按 tokens 排序 agent models
    const agentModelList = Object.values(agentModels)
      .map(a => ({ ...a, sessions: a.sessions.sort((s1, s2) => (s2.updatedAt || 0) - (s1.updatedAt || 0)) }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    // 历史记录取最近 50 条
    modelHistory.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const recentHistory = modelHistory.slice(0, 50);

    res.json({
      models: modelList,
      agents: agentModelList,
      history: recentHistory,
      totalModels: modelList.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 初始化数据库
initDB();

app.listen(PORT, () => {
  console.log(`Agent监控服务运行在 http://localhost:${PORT}`);
});

// ==================== 模型更新仪表盘 API ====================

// GET /api/model-updates - 获取模型切换记录
// Query: agentId, limit, startTime, endTime
app.get('/api/model-updates', async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: '数据库未连接' });
  try {
    const { agentId, limit = 50, startTime, endTime } = req.query;
    let query = 'SELECT * FROM model_updates WHERE 1=1';
    const params = [];
    if (agentId) { query += ' AND agent_id = ?'; params.push(agentId); }
    if (startTime) { query += ' AND switch_time >= ?'; params.push(startTime); }
    if (endTime)   { query += ' AND switch_time <= ?'; params.push(endTime); }
    const safeLimit = parseInt(limit, 10);
    query += ` ORDER BY switch_time DESC LIMIT ${safeLimit}`;
    const [rows] = await dbPool.execute(query, params);
    res.json({ records: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/model-updates/stats - 模型调用量统计（按模型分组）
// Query: agentId, startDate, endDate
app.get('/api/model-updates/stats', async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: '数据库未连接' });
  try {
    const { agentId, startDate, endDate } = req.query;

    // 优先查 model_daily_stats 表（聚合好的数据）
    let query = `SELECT agent_id, model, record_date,
                        total_calls, total_input_tokens, total_output_tokens,
                        total_tokens, unique_sessions
                 FROM model_daily_stats WHERE 1=1`;
    const params = [];
    if (agentId)    { query += ' AND agent_id = ?'; params.push(agentId); }
    if (startDate)  { query += ' AND record_date >= ?'; params.push(startDate); }
    if (endDate)    { query += ' AND record_date <= ?'; params.push(endDate); }
    query += ' ORDER BY record_date DESC, total_tokens DESC';

    const [rows] = await dbPool.execute(query, params);

    // 如果 model_daily_stats 为空（表刚创建），从 token_usage 聚合
    if (rows.length === 0) {
      const fallback = `SELECT agent_id, model, DATE(created_at) AS record_date,
                              COUNT(*)              AS total_calls,
                              SUM(input_tokens)    AS total_input_tokens,
                              SUM(output_tokens)   AS total_output_tokens,
                              SUM(total_tokens)    AS total_tokens,
                              COUNT(DISTINCT session_key) AS unique_sessions
                       FROM token_usage
                       WHERE model IS NOT NULL AND model != ''`;
      const fbParams = [];
      if (agentId)    { fbParams.push(agentId); }
      const fbConds = [];
      if (agentId)    fbConds.push('agent_id = ?');
      if (startDate)  { fbConds.push('DATE(created_at) >= ?'); fbParams.push(startDate); }
      if (endDate)    { fbConds.push('DATE(created_at) <= ?'); fbParams.push(endDate); }
      const fbWhere = fbConds.length ? ' AND ' + fbConds.join(' AND ') : '';
      const [fbRows] = await dbPool.execute(fallback + fbWhere + ' GROUP BY agent_id, model, DATE(created_at) ORDER BY total_tokens DESC', fbParams);
      return res.json({ stats: fbRows, count: fbRows.length, source: 'token_usage' });
    }

    res.json({ stats: rows, count: rows.length, source: 'model_daily_stats' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/model-updates/current - 当前各 Agent 使用的模型版本
// 从 token_usage 中取每个 agent_id 最近一次有 model 记录的
app.get('/api/model-updates/current', async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: '数据库未连接' });
  try {
    const query = `SELECT t.agent_id, t.model, t.created_at AS last_seen,
                          t.input_tokens, t.output_tokens, t.total_tokens
                   FROM token_usage t
                   INNER JOIN (
                     SELECT agent_id, MAX(created_at) AS max_created
                     FROM token_usage
                     WHERE model IS NOT NULL AND model != ''
                     GROUP BY agent_id
                   ) latest ON t.agent_id = latest.agent_id AND t.created_at = latest.max_created
                   ORDER BY t.agent_id`;
    const [rows] = await dbPool.execute(query);
    res.json({
      models: rows.map(r => ({
        agentId: r.agent_id,
        model: r.model,
        lastSeen: r.last_seen,
        inputTokens: Number(r.input_tokens) || 0,
        outputTokens: Number(r.output_tokens) || 0,
        totalTokens: Number(r.total_tokens) || 0
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/model-updates - 记录一次模型切换
app.post('/api/model-updates', async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: '数据库未连接' });
  try {
    const { agent_id, old_model, new_model, switch_reason, triggered_by, session_key } = req.body;
    if (!agent_id || !new_model) {
      return res.status(400).json({ error: 'agent_id 和 new_model 是必填字段' });
    }
    const [result] = await dbPool.execute(
      `INSERT INTO model_updates (agent_id, old_model, new_model, switch_reason, triggered_by, session_key, switch_time)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [agent_id, old_model || null, new_model, switch_reason || null, triggered_by || null, session_key || null]
    );
    res.json({ id: result.insertId, message: '模型切换记录已保存' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 网络拓扑 API（增强：从数据库读取连接状态） ====================

// GET /api/topology/nodes - 获取拓扑节点及实时连接状态（从数据库）
app.get('/api/topology/nodes', async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: '数据库未连接' });
  try {
    // 从 agent_events 表读取最近活跃状态
    const [events] = await dbPool.execute(`
      SELECT agent_id, event_type, MAX(created_at) AS last_seen
      FROM agent_events
      GROUP BY agent_id, event_type
    `);

    // 从 token_usage 读取每个 agent 最新活跃时间
    const [tokens] = await dbPool.execute(`
      SELECT agent_id, MAX(created_at) AS last_active, SUM(total_tokens) AS total_tokens
      FROM token_usage
      GROUP BY agent_id
    `);

    const tokenMap = {};
    for (const t of tokens) {
      tokenMap[t.agent_id] = { lastActive: t.last_active, totalTokens: Number(t.total_tokens) || 0 };
    }

    const eventMap = {};
    for (const e of events) {
      if (!eventMap[e.agent_id]) eventMap[e.agent_id] = {};
      eventMap[e.agent_id][e.event_type] = e.last_seen;
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const nodes = Object.entries(agentConfigs).map(([id, config]) => {
      const lastActive = tokenMap[id]?.lastActive ? new Date(tokenMap[id].lastActive) : null;
      let status = 'offline';
      if (lastActive) {
        status = lastActive > fiveMinutesAgo ? 'online' : 'idle';
      }
      return {
        id,
        name: config.name,
        emoji: config.emoji,
        role: config.role,
        status,
        totalTokens: tokenMap[id]?.totalTokens || 0,
        lastSeen: lastActive ? lastActive.toISOString() : null,
        lastSeenAgo: formatTimeAgo(lastActive ? lastActive.getTime() : null)
      };
    });

    res.json({ nodes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/topology/connections - 获取 Agent 间连接关系（从数据库）
app.get('/api/topology/connections', async (req, res) => {
  if (!dbPool) return res.status(503).json({ error: '数据库未连接' });
  try {
    const { agentId } = req.query;

    // 从 token_usage 中根据 parent_session 推断父子关系
    let query = `SELECT DISTINCT agent_id, parent_session FROM token_usage
                 WHERE parent_session IS NOT NULL AND parent_session != ''`;
    const params = [];
    if (agentId) { query += ' AND agent_id = ?'; params.push(agentId); }

    const [rows] = await dbPool.execute(query, params);

    // 构建连接列表
    const connections = [];
    const seen = new Set();

    for (const row of rows) {
      const key = `${row.parent_session}|${row.agent_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        connections.push({
          source: row.parent_session.split(':')[1] || 'main', // 提取 parent session 中的 agentId
          target: row.agent_id,
          type: 'session_spawn',
          parentSession: row.parent_session,
          direction: 'parent-to-child'
        });
      }
    }

    // 补充静态的协调关系（main -> 其他所有 agent）
    for (const [id, config] of Object.entries(agentConfigs)) {
      if (id !== 'main') {
        connections.push({
          source: 'main',
          target: id,
          type: 'coordination',
          direction: 'parent-to-child'
        });
      }
    }

    res.json({ connections, count: connections.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
