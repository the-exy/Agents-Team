# Agent Network Monitor - 项目文档

> 当前版本：4.0.0  
> 最后更新：2026-03-20

---

## 1. 项目概述

### 1.1 项目简介

**Agent Network Monitor** 是一个实时监控 OpenClaw 多 Agent 系统的 Web 全栈应用。通过可视化界面展示所有 Agent 的运行状态、会话信息、技能列表、文件资源、任务状态，以及 Agent 之间的网络拓扑关系，帮助管理员全面掌控多 Agent 系统的运行状态。

### 1.2 核心功能

| 功能模块 | 说明 |
|---------|------|
| 多 Agent 监控 | 同时监控 main、backend、frontend、pm、db、test、ops 等所有 Agent |
| Agent 详情页 | 点击 Agent 卡片查看详细：会话、技能、文件、任务 |
| 动态仪表盘 | 实时动画统计卡片，展示系统关键指标 |
| 网络拓扑图 | 可视化展示所有 Agent 及其动态连接关系 |
| 任务管理 | 统一查看和管理所有 Agent 关联的任务 |
| 活动日志 | 实时记录和展示 Agent 活动 |

### 1.3 技术栈

- **后端**：Node.js + Express（原生 os 模块 + sessions.json 文件读取）
- **前端**：React + Vite + React Router
- **样式**：TailwindCSS
- **实时更新**：轮询（5 秒间隔）
- **HTTP 客户端**：Axios

---

## 2. 页面结构

### 2.1 路由配置

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Dashboard | 仪表盘，总览所有 Agent 状态 |
| `/topology` | Topology | 网络拓扑图，展示 Agent 关系 |
| `/agents/:id` | Agent Detail | Agent 详情页（Tab：概览/会话/技能/文件/任务） |
| `/tasks` | Tasks | 任务看板 |
| `/logs` | Logs | 活动日志 |
| `/token-stats` | TokenStats | Token 使用统计（支持日期查询） |
| `/concepts` | Concepts | Multi-Agent vs SubAgent 概念说明 |

---

## 3. Agent 状态定义

### 3.1 状态类型

| 状态 | 定义 | 颜色标识 |
|------|------|---------|
| **active** | 有会话记录，且最近 5 分钟内有活动 | 绿色（渐变动画） |
| **idle** | 有会话记录，但最近 5 分钟无活动 | 灰色 |
| **offline** | 没有任何会话记录 | 深灰色 |

### 3.2 状态计算逻辑

```
lastActivityAge = now - lastSessionTime

if (sessionCount === 0) → offline
else if (lastActivityAge < 5min) → active
else → idle
```

### 3.3 监控的 Agent 列表

| ID | 名称 | 角色 | 工作空间 |
|----|------|------|---------|
| main | 主代理 | 主协调者 | `~/.openclaw/workspace` |
| backend | 后端代理 | 后端开发 | `~/.openclaw/workspace/backend-dev` |
| frontend | 前端代理 | 前端开发 | `~/.openclaw/workspace/frontend-dev` |
| pm | 项目管理代理 | 项目管理 | `~/.openclaw/workspace/pm-agent` |
| db | 数据库代理 | 数据库管理 | `~/.openclaw/workspace/db-agent` |
| test | 测试代理 | 测试工程师 | `~/.openclaw/workspace/test-agent` |
| ops | 运维代理 | 运维管理 | `~/.openclaw/workspace/ops-agent` |

---

## 4. API 接口详解

### 4.1 系统指标（核心 API）

#### GET /api/metrics

获取所有系统指标的汇总数据。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| cpu | object | CPU 信息对象 | `os.cpus()` |
| cpu.usage | number | CPU 使用率(%) | 计算 |
| cpu.cores | number | CPU 核心数 | `os.cpus().length` |
| cpu.model | string | CPU 型号 | `os.cpus()[0].model` |
| cpu.speed | number | CPU 频率(MHz) | `os.cpus()[0].speed` |
| memory | object | 内存信息对象 | `os.totalmem()` / `os.freemem()` |
| memory.total | number | 总内存(字节) | `os.totalmem()` |
| memory.used | number | 已用内存(字节) | `os.totalmem() - os.freemem()` |
| memory.free | number | 可用内存(字节) | `os.freemem()` |
| memory.usage | number | 内存使用率(%) | 计算 |
| uptime | object | 运行时间对象 | `os.uptime()` |
| uptime.seconds | number | 运行秒数 | `os.uptime()` |
| uptime.formatted | string | 格式化时间字符串 | 转换计算 |
| timestamp | ISO 时间 | 数据采集时间 | `new Date().toISOString()` |

---

#### GET /api/cpu

获取 CPU 使用率的详细数据。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| usage | number | CPU 使用率(%) | 通过 `os.cpus()` 计算 |
| cores | number | CPU 核心数 | `os.cpus().length` |
| model | string | CPU 型号 | `os.cpus()[0].model` |
| speed | number | CPU 频率(MHz) | `os.cpus()[0].speed` |

**数据示例：**
```json
{
  "usage": 25.5,
  "cores": 8,
  "model": "Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz",
  "speed": 3600
}
```

---

#### GET /api/memory

获取内存使用情况的详细数据。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| total | number | 总内存(字节) | `os.totalmem()` |
| used | number | 已用内存(字节) | `os.totalmem() - os.freemem()` |
| free | number | 可用内存(字节) | `os.freemem()` |
| usage | number | 内存使用率(%) | `(used / total) * 100` |

---

#### GET /api/processes

获取当前运行的进程列表（Windows 系统）。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| name | string | 进程名称 | `tasklist` 命令 |
| pid | number | 进程 ID | `tasklist` 命令 |
| memory | string | 内存使用量 | `tasklist` 命令 |

**说明：**
- 最多返回 20 个进程（按内存使用量降序排序）
- 数据来自 Windows `tasklist /FO CSV /NH` 命令
- 有 5 秒缓存机制，避免频繁调用系统命令

---

#### GET /api/network

获取网络接口信息。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| name | string | 接口名称 | `os.networkInterfaces()` |
| address | string | IPv4 地址 | `os.networkInterfaces()` |
| netmask | string | 子网掩码 | `os.networkInterfaces()` |
| mac | string | MAC 地址 | `os.networkInterfaces()` |
| internal | boolean | 是否内部接口 | `os.networkInterfaces()` |

**说明：**
- 仅返回 IPv4 地址的接口

---

#### GET /api/system

获取系统基本信息。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| hostname | string | 主机名 | `os.hostname()` |
| platform | string | 平台 | `os.platform()` |
| release | string | 系统版本 | `os.release()` |
| type | string | 系统类型 | `os.type()` |
| arch | string | 架构 | `os.arch()` |
| homedir | string | 主目录 | `os.homedir()` |
| tmpdir | string | 临时目录 | `os.tmpdir()` |
| cpuCount | number | CPU 核心数 | `os.cpus().length` |
| totalMemory | number | 总内存 | `os.totalmem()` |
| eol | string | 换行符 | `os.EOL` |

---

### 4.2 多 Agent 相关 API

#### GET /api/agents

获取所有 Agent 的列表（多 Agent 支持）。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| id | string | Agent ID | 目录名 |
| name | string | Agent 显示名称 | 配置文件/SOUL.md |
| emoji | string | Agent 图标 | 配置文件/IDENTITY.md |
| role | string | Agent 角色 | 配置文件/IDENTITY.md |
| status | string | 状态 | active/idle/offline |
| workspace | string | 工作空间路径 | Agent 目录 |
| currentTask | string | 当前任务描述 | sessions.json 最近会话 |
| sessions | number | 会话数量 | sessions.json 长度 |
| memory | number | 内存使用率(%) | `os` 模块真实数据 |
| cpu | number | CPU 使用率(%) | `os` 模块真实数据 |
| lastActive | ISO 时间 | 最后活跃时间 | sessions.json 最新记录 |
| lastActivityAge | number | 距离最后活跃的秒数 | 计算 |
| sessionCount | number | 会话记录总数 | sessions.json 长度 |

**数据来源说明：**
- 后端扫描 `~/.openclaw/workspace/` 下所有 Agent 目录
- 读取每个目录下的 `sessions.json` 获取会话数据
- 读取 `SOUL.md` / `IDENTITY.md` 获取 Agent 元信息（如存在）
- 使用 `os` 模块获取真实系统资源数据

---

#### GET /api/agents/:id

获取单个 Agent 的详细信息。

**路径参数：**
- `id`：Agent ID（如 main、backend、frontend 等）

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | Agent ID |
| name | string | Agent 名称 |
| emoji | string | Agent 图标 |
| role | string | Agent 角色 |
| status | string | 状态 |
| workspace | string | 工作空间路径 |
| description | string | Agent 描述（来自 SOUL.md） |
| identity | object | 身份信息（来自 IDENTITY.md） |
| currentTask | string | 当前任务描述 |
| sessions | array | 会话记录列表 |
| lastActive | ISO 时间 | 最后活跃时间 |
| memory | number | 内存使用率(%) |
| cpu | number | CPU 使用率(%) |

---

#### GET /api/agents/:id/skills

获取指定 Agent 的技能列表。

**路径参数：**
- `id`：Agent ID

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| agentId | string | Agent ID |
| agentName | string | Agent 名称 |
| skills | array | 技能列表 |
| skills[].name | string | 技能名称 |
| skills[].description | string | 技能描述 |
| skills[].location | string | 技能文件路径 |

**说明：**
- 扫描 Agent 工作空间下的 `skills/` 目录
- 读取每个 skill 的 `SKILL.md` 获取名称和描述

---

#### GET /api/agents/:id/files

获取指定 Agent 的文件列表。

**路径参数：**
- `id`：Agent ID

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| agentId | string | Agent ID |
| agentName | string | Agent 名称 |
| workspace | string | 工作空间路径 |
| files | array | 文件列表 |
| files[].name | string | 文件名称 |
| files[].path | string | 文件完整路径 |
| files[].type | string | 文件类型（dir/file） |
| files[].size | number | 文件大小（字节） |
| files[].modified | ISO 时间 | 最后修改时间 |

**说明：**
- 递归扫描 Agent 工作空间（深度限制 3 层）
- 排除 `node_modules/`、`.git/` 等目录

---

#### GET /api/agents/:id/tasks

获取指定 Agent 关联的任务列表。

**路径参数：**
- `id`：Agent ID

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| agentId | string | Agent ID |
| agentName | string | Agent 名称 |
| tasks | array | 任务列表 |
| tasks[].id | string | 任务 ID |
| tasks[].title | string | 任务标题 |
| tasks[].status | string | 状态 |
| tasks[].priority | string | 优先级 |
| tasks[].assignee | string | 负责人 |
| tasks[].due | ISO 时间 | 截止时间 |
| tasks[].createdAt | ISO 时间 | 创建时间 |

---

### 4.3 任务相关

#### GET /api/tasks

获取任务列表。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| id | number | 任务 ID | 静态配置 |
| title | string | 任务标题 | 静态配置 |
| type | string | 任务类型 | 静态配置 |
| status | string | 状态（固定 in_progress） | 静态配置 |
| priority | string | 优先级（固定 high） | 静态配置 |
| progress | number | 进度（固定 100） | 静态配置 |
| assignees | string[] | 负责的 Agent | 静态配置 |
| createdAt | ISO 时间 | 创建时间 | 当前时间 |

---

### 4.4 日志相关

#### GET /api/logs

获取活动日志列表。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| id | number | 日志 ID | 静态配置 |
| agent | string | Agent ID | 静态配置 |
| action | string | 活动描述 | 静态配置 |
| time | ISO 时间 | 发生时间 | 当前时间 |

#### POST /api/logs

添加新日志。

**请求体：**
```json
{
  "agent": "main",
  "action": "系统资源监控启动"
}
```

---

### 4.5 拓扑相关

#### GET /api/topology

获取多 Agent 网络拓扑数据。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| nodes | array | Agent 节点列表 | 动态扫描所有 Agent |
| links | array | 关系连线 | 动态生成（基于会话通信） |
| stats | object | 统计信息 | `os` 模块数据 |

**节点列表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | Agent ID |
| name | string | Agent 名称 |
| emoji | string | Agent 图标 |
| role | string | Agent 角色 |
| status | string | 状态（active/idle/offline） |
| x | number | 节点 X 坐标 |
| y | number | 节点 Y 坐标 |

**连线关系类型：**

| 类型 | 说明 | 样式 |
|------|------|------|
| spawns | 主 Agent 派生的子 Agent | 实线 |
| use | 使用关系 | 虚线 |
| communicate | 会话通信 | 动画流动线 |

**说明：**
- 动态扫描所有 Agent 目录，实时更新拓扑图
- 连线基于 Agent 间的会话通信记录动态生成
- active 状态的节点有发光和脉冲动画效果

---

### 4.6 统计相关

#### GET /api/stats

获取统计概览数据。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| totalAgents | number | 总 Agent 数 | 动态扫描 |
| activeCount | number | 活跃数 | sessions.json 动态计算 |
| idleCount | number | 空闲数 | sessions.json 动态计算 |
| offlineCount | number | 离线数 | sessions.json 动态计算 |
| totalSessions | number | 会话总数 | 所有 sessions.json 总和 |
| totalTasks | number | 总任务数 | 任务配置长度 |
| activeTasks | number | 进行中任务数 | 任务配置长度 |
| completedTasks | number | 已完成任务数 | 固定值 0 |
| waitingTasks | number | 等待中任务数 | 固定值 0 |
| system | object | 系统信息 | `os` 模块数据 |

---

### 4.7 健康检查

#### GET /api/health

服务健康检查。

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 状态（固定 ok） |
| time | ISO 时间 | 当前时间 |
| process | object | 进程信息 |
| process.uptime | number | 进程运行秒数 |
| process.memory | string | 进程内存使用 |
| process.pid | number | 进程 ID |

---

### 4.8 Token 统计相关

#### GET /api/token-stats

Token 使用统计（需 MySQL 持久化支持）。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| start_date | string | 否 | 起始日期（YYYY-MM-DD），默认 30 天前 |
| end_date | string | 否 | 结束日期（YYYY-MM-DD），默认今天 |
| agent_id | string | 否 | Agent ID 过滤（如 main、backend） |

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| daily | array | 每日 Token 明细列表 |
| daily[].record_date | string | 日期（YYYY-MM-DD） |
| daily[].agent_id | string | Agent ID |
| daily[].total_tokens | number | 当日 Token 总数 |
| summary | array | 汇总数据列表 |
| summary[].agent_id | string | Agent ID |
| summary[].total_tokens | number | 累计 Token 总数 |
| summary[].session_count | number | 会话数量 |
| query | object | 查询参数快照 |
| query.start_date | string | 实际起始日期 |
| query.end_date | string | 实际结束日期 |
| query.agent_id | string | 实际过滤条件 |

---

#### GET /api/token-daily

每日 Token 趋势（最近 30 天）。

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| data | array | 每日趋势数据列表 |
| data[].record_date | string | 日期（YYYY-MM-DD） |
| data[].agent_id | string | Agent ID |
| data[].total_tokens | number | 当日 Token 总数 |
| data[].session_count | number | 当日会话数量 |
| data[].avg_tokens | number | 当日平均每会话 Token 数 |

---

## 5. 页面功能说明

### 5.1 仪表盘（Dashboard）

**入口：** `/`

**功能：**
1. **动态统计卡片** - 带动画效果的指标展示：
   - 总 Agent 数
   - 活跃/空闲/离线数（动态计算）
   - CPU 使用率（带进度条动画）
   - 内存使用率（带进度条动画）
   - 会话总数
   - 网络接口数

2. **Agent 卡片列表** - 展示所有 Agent：
   - 点击卡片 → 跳转 Agent 详情页 `/agents/:id`
   - Emoji + 名称 + 角色标签
   - 状态指示器（active=绿色脉冲，idle=灰色，offline=深灰）
   - 当前任务描述
   - 会话数量徽章
   - CPU/内存使用率进度条
   - 最后活跃时间

3. **自动刷新** - 每 5 秒自动刷新数据

### 5.2 网络拓扑（Topology）

**入口：** `/topology`

**功能：**
1. **多 Agent 拓扑图** - 使用 SVG 绘制：
   - 展示所有 Agent（main、backend、frontend、pm、db、test、ops）
   - 节点位置自动布局
   - 动态连线表示 Agent 间关系

2. **动画连线** - 三种样式：
   - 实线：派生关系（spawns）
   - 虚线：使用关系（use）
   - 流动线：通信关系（communicate）

3. **节点状态效果**：
   - active：发光效果 + 脉冲动画
   - idle：静态灰色
   - offline：暗色无动画

4. **悬停交互** - 显示 Agent 信息卡片

5. **实时更新** - 每 5 秒刷新拓扑数据

### 5.3 Agent 详情页（Agent Detail）

**入口：** `/agents/:id`

**功能：**
1. **概览 Tab（Overview）**：
   - Agent 基本信息（名称、角色、Emoji、状态）
   - 工作空间路径
   - 最后活跃时间
   - 当前任务描述
   - 系统资源使用（CPU/内存）

2. **会话 Tab（Sessions）**：
   - 列表展示所有会话记录
   - 每条记录包含：会话 ID、创建时间、最后活跃时间
   - 按时间倒序排列

3. **技能 Tab（Skills）**：
   - 展示 Agent 拥有的所有技能
   - 每项技能显示：名称、描述、安装位置

4. **文件 Tab（Files）**：
   - 树形结构展示工作空间文件
   - 支持目录层级展示
   - 显示文件大小和最后修改时间

5. **任务 Tab（Tasks）**：
   - 该 Agent 关联的所有任务
   - 支持添加新任务（飞书任务集成）

**Tab 切换动画** - 平滑过渡效果

### 5.4 任务板（Tasks）

**入口：** `/tasks`

**功能：**
1. **任务列表** - 展示所有任务：
   - 任务标题
   - 优先级标签
   - 状态标签
   - 进度条
   - 负责 Agent

2. **添加任务** - 通过飞书任务 API 创建

3. **自动刷新** - 每 5 秒自动刷新

### 5.5 活动日志（Logs）

**入口：** `/logs`

**功能：**
1. **日志列表** - 时间顺序展示：
   - 时间戳
   - Agent 图标 + 名称
   - 活动描述

2. **自动刷新** - 每 5 秒自动刷新

---

## 6. 系统架构

### 6.1 多 Agent 架构

```
~/.openclaw/workspace/
├── agent-monitor/          # 监控系统（前端 + 后端）
│   ├── backend/
│   │   └── src/index.js
│   └── frontend/
│       └── src/
│
├── main/                   # 主 Agent（主代理，端口 18789）
│   ├── sessions.json       # 主 Agent 会话记录
│   ├── SOUL.md             # 身份定义
│   ├── IDENTITY.md         # 身份配置
│   ├── workspace/          # 主 Agent 工作空间
│   └── memory/             # 主 Agent 记忆
│
├── backend-dev/            # 后端开发 Agent
│   ├── sessions.json
│   └── ...
│
├── frontend-dev/           # 前端开发 Agent
│   ├── sessions.json
│   └── ...
│
├── pm-agent/               # 项目管理 Agent
│   ├── sessions.json
│   └── ...
│
├── db-agent/               # 数据库 Agent
│   ├── sessions.json
│   └── ...
│
├── test-agent/             # 测试 Agent
│   ├── sessions.json
│   └── ...
│
└── ops-agent/              # 运维 Agent
    ├── sessions.json
    └── ...
```

### 6.2 后端架构

```
backend/src/index.js
├── Express 服务器
│   ├── 中间件
│   │   ├── cors() - 跨域资源共享
│   │   └── express.json() - JSON 解析
│   │
│   └── API 端点
│       ├── /api/metrics           - 综合指标
│       ├── /api/cpu               - CPU 信息
│       ├── /api/memory            - 内存信息
│       ├── /api/processes         - 进程列表
│       ├── /api/network           - 网络接口
│       ├── /api/system            - 系统信息
│       ├── /api/agents            - 多 Agent 列表
│       ├── /api/agents/:id        - Agent 详情
│       ├── /api/agents/:id/skills - Agent 技能列表
│       ├── /api/agents/:id/files  - Agent 文件列表
│       ├── /api/agents/:id/tasks  - Agent 任务列表
│       ├── /api/tasks             - 任务列表
│       ├── /api/logs              - 日志列表
│       ├── /api/topology          - 拓扑数据
│       ├── /api/stats             - 统计信息
│       └── /api/health            - 健康检查
│
├── 核心函数
│   ├── getCpuUsage()              - 获取 CPU 使用率
│   ├── getMemoryUsage()            - 获取内存使用情况
│   ├── getProcessList()            - 获取进程列表（tasklist）
│   ├── getNetworkInfo()            - 获取网络接口信息
│   ├── getUptime()                 - 获取运行时间
│   ├── getSystemInfo()             - 获取系统信息
│   ├── scanAgentDirectories()      - 扫描所有 Agent 目录
│   ├── readAgentSessions()         - 读取 sessions.json
│   ├── readAgentIdentity()          - 读取 SOUL.md / IDENTITY.md
│   ├── scanAgentSkills()           - 扫描 Agent 技能
│   ├── scanAgentFiles()            - 扫描 Agent 文件
│   └── calculateAgentStatus()       - 计算 Agent 状态
│
└── 数据缓存
    ├── processCache               - 进程列表缓存（5秒TTL）
    └── agentsCache                - Agent 列表缓存（5秒TTL）
```

### 6.3 前端架构

```
frontend/src/
├── main.jsx              - React 入口
├── App.jsx               - 路由配置
├── index.css             - 全局样式 + 动画定义
├── api/
│   └── index.js          - API 封装（Axios）
│
├── components/
│   ├── AgentCard.jsx     - Agent 卡片组件（可点击跳转详情）
│   ├── StatCard.jsx      - 动态统计卡片组件（带动画）
│   ├── TopologyNode.jsx  - 拓扑节点组件
│   ├── TopologyLink.jsx  - 拓扑连线组件（流动动画）
│   └── ...
│
└── pages/
    ├── Dashboard.jsx      - 仪表盘页面
    ├── Topology.jsx       - 拓扑图页面（动态连接线动画）
    ├── AgentDetail.jsx    - Agent 详情页（多 Tab）
    ├── Tasks.jsx          - 任务板页面
    └── Logs.jsx           - 日志页面
```

### 6.4 数据流

```
数据流
─────────────────────────────
  前端(React) 
    ↓ HTTP
  后端(Express) 
    ├──→ sessions.json 读取（文件系统）
    └──→ MySQL 写入（token_usage/daily_token_summary）

完整数据流图
─────────────────────────────────────────────────────────────────────
                         前端 (React)
  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐
  │Dashboard │  │Topology  │  │AgentDetail  │  │ Tasks    │
  └────┬─────┘  └────┬─────┘  └──────┬─────┘  └────┬─────┘
       └─────────────┴────────┬────────┴────────────┘
                              │
                        ┌─────┴─────┐
                        │   Axios    │
                        └─────┬─────┘
──────────────────────────────┼─────────────────────────────────────
                              │ HTTP 请求
                              ▼
                         后端 (Express)
  ┌──────────────────────────────────────────────────────────────┐
  │                    多 Agent 扫描引擎                          │
  │  scan ~/.openclaw/workspace/ 获取所有 Agent 目录               │
  │  ├── 读取 sessions.json → 会话数据 + 状态计算                 │
  │  ├── 读取 SOUL.md / IDENTITY.md → Agent 元信息                │
  │  ├── 扫描 skills/ 目录 → 技能列表                            │
  │  └── 递归扫描文件 → 文件列表                                 │
  │                                                               │
  │  Token 持久化引擎（MySQL）                                    │
  │  ├── 增量同步 sessions 数据 → token_usage                    │
  │  ├── 每日汇总 → daily_token_summary                          │
  │  └── 降级模式：MySQL 故障不影响 API 返回                      │
  └──────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
  sessions.json（文件系统）              MySQL（持久化存储）
  ~/.openclaw/workspace/<agent>/       127.0.0.1:3306
  └── sessions.json                      ├── token_usage
                                          ├── session_events
                                          └── daily_token_summary
─────────────────────────────────────────────────────────────────────
  ┌─────────────┬─────────────┬─────────────┬───────────────┐
  │     os     │   process   │tasklist命令 │  飞书任务 API │
  │    模块    │    对象     │ (Windows)   │  (可选集成)   │
  └─────────────┴─────────────┴─────────────┴───────────────┘
```

---

## 7. Agent 间通信配置

### 7.1 配置文件位置

`~/.openclaw/etc/config.toml`

### 7.2 关键配置项

```toml
[tools.sessions]
visibility = "all"        # 允许访问所有 Agent 的 sessions

[tools.agentToAgent]
enabled = true            # 启用 Agent 间直接调用
```

### 7.3 sessions_send 调用方式

主 Agent（端口 18789）可通过以下方式调用子 Agent：

```javascript
sessions_send({
  session: "agent:sub:backend:...",  // 目标 Agent session ID
  message: { role: "user", content: "任务描述" }
})
```

---

## 8. 架构说明：Multi-Agent vs SubAgent

### 8.1 Multi-Agent（多 Agent 模式）

**定义：** 多个独立 Agent 进程同时运行，各自负责不同领域。

**特点：**
- 每个 Agent 是独立进程（`openclaw.json` 中的 `agents.list`）
- 各自有独立的 sessions.json、工作空间、飞书账号
- 通过飞书消息或 `sessions_send` 互相通信
- 主 Agent（main）负责协调其他 Agent

**现有 Agent：**

| ID | 名称 | 角色 | 端口 |
|----|------|------|------|
| main | 主代理 | 协调者 | 18789 |
| backend | 后端开发 | 后端开发任务 | - |
| frontend | 前端开发 | 前端开发任务 | - |
| pm | 产品经理 | 文档和项目管理 | - |
| db | 数据库 | 数据库管理 | - |
| test | 测试 | 测试工程师 | - |
| ops | 运维 | 运维管理 | - |

### 8.2 SubAgent（子 Agent 模式）

**定义：** 通过 `sessions_spawn()` 在主 Agent 内派生的临时会话。

**特点：**
- 不是独立进程，是主会话的子任务
- 用于并行处理复杂任务
- 任务完成后自动结束
- 结果汇总到主会话返回给用户

**调用方式：** `sessions_spawn()` / `subagents spawn`

**适用场景：** 需要多个专业领域同时工作的复杂任务。

### 8.3 agent-monitor 平台与两种模式的关系

- **监控重点：** Multi-Agent 模式（独立 Agent 的实时状态）
- **数据来源：** 读取 `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- **SubAgent：** 目前通过主 Agent 的会话记录间接反映

---

## 9. 数据持久化设计

### 9.1 持久化方案

- **数据库：** MySQL 5.7+（本地 `127.0.0.1:3306`）
- **库名：** `agent_monitor`
- **连接方式：** `mysql2/promise` 连接池

### 9.2 数据表设计

| 表名 | 说明 |
|------|------|
| `token_usage` | Token 使用明细（每条会话记录一行） |
| `session_events` | 会话事件（开始/结束/消息） |
| `daily_token_summary` | 每日汇总（方便查询） |

### 9.3 数据写入策略

- 每次 `GET /api/agents` 调用时，增量同步最新 sessions 数据到 MySQL
- 采用 `ON DUPLICATE KEY UPDATE` 实现增量更新
- MySQL 连接失败不影响 API 正常返回（降级模式）

### 9.4 查询 API

| 端点 | 说明 |
|------|------|
| `GET /api/token-stats` | 支持按日期范围、agent_id 查询明细和汇总 |
| `GET /api/token-daily` | 最近 30 天每日趋势 |

---

## 10. 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0.0 | 2026-03-19 | 初始版本，包含：<br>- Agent 状态监测<br>- 任务追踪<br>- 活动日志<br>- 网络拓扑可视化 |
| 2.0.0 | 2026-03-19 | 重大更新：<br>- 后端改用真实 Node.js os 模块获取数据<br>- 新增 /api/metrics 综合指标端点<br>- 新增 /api/cpu CPU 详细信息<br>- 新增 /api/processes 进程列表<br>- 新增 /api/system 系统信息<br>- Agent 从 7 个改为 4 个系统监控模块 |
| 3.0.0 | 2026-03-19 | 多 Agent 架构重大更新：<br>- 支持监控所有 OpenClaw Agent（main、backend、frontend、pm、db、test、ops）<br>- 后端动态扫描所有 Agent 目录，读取 sessions.json<br>- 新增 Agent 详情页（概览/会话/技能/文件/任务 Tab）<br>- Agent 卡 click → 跳转详情页<br>- 动态网络拓扑，展示所有 Agent 及连接关系<br>- 新增 API：/api/agents/:id/skills、/api/agents/:id/files、/api/agents/:id/tasks<br>- Agent 状态定义：active（活跃）/ idle（空闲）/ offline（离线）<br>- 动态统计：activeCount、idleCount、offlineCount、totalSessions<br>- 动态仪表盘：动画统计卡片<br>- 拓扑图动画：流动连接线、节点脉冲效果 |
| 4.0.0 | 2026-03-20 | 全面升级：<br>- MySQL 持久化：Token 使用明细入库<br>- 新增 TokenStats 页面，支持日期范围查询<br>- 新增 Concepts 页面，澄清 Multi-Agent vs SubAgent 架构<br>- 修复 Topology 位置计算 Bug（const→let）<br>- Dashboard 新增快捷入口 |

---

## 11. 项目结构

```
agent-monitor/
├── SPEC.md                 # 规格说明书
├── PROJECT_DOC.md          # 项目文档（本文件）
├── backend/
│   ├── package.json        # 后端依赖
│   └── src/
│       └── index.js        # Express 后端服务（多 Agent 扫描）
└── frontend/
    ├── package.json        # 前端依赖
    ├── vite.config.js      # Vite 配置
    ├── index.html          # HTML 入口
    └── src/
        ├── main.jsx        # React 入口
        ├── App.jsx         # 路由配置
        ├── index.css       # 全局样式 + 动画
        ├── api/
        │   └── index.js    # API 封装
        ├── components/
        │   ├── AgentCard.jsx    # Agent 卡片（可点击跳转）
        │   ├── StatCard.jsx      # 动态统计卡片
        │   ├── TopologyNode.jsx  # 拓扑节点
        │   └── TopologyLink.jsx  # 拓扑连线（动画）
        └── pages/
            ├── Dashboard.jsx    # 仪表盘（动态统计）
            ├── Topology.jsx     # 拓扑图（动态连接）
            ├── AgentDetail.jsx  # Agent 详情（多 Tab）
            ├── Tasks.jsx        # 任务看板
            └── Logs.jsx         # 活动日志
```

---

## 12. 注意事项

1. **sessions.json 路径** - 后端扫描 `~/.openclaw/workspace/*/sessions.json`
2. **状态计算** - 以 sessions.json 中最新会话记录的时间计算 active/idle/offline
3. **轮询刷新** - 前端每 5 秒轮询一次获取最新数据
4. **进程列表** - 仅支持 Windows 系统，使用 `tasklist` 命令
5. **网络接口** - 仅返回 IPv4 地址的网络接口信息
6. **文件扫描深度** - 限制 3 层，避免扫描过深影响性能
7. **技能扫描** - 读取 `skills/SKILL.md` 获取技能描述（如存在）
