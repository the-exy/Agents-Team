# Agent Network Monitor - 项目文档

> 当前版本：2.0.0  
> 最后更新：2026-03-19

---

## 1. 项目概述

### 1.1 项目简介

**Agent Network Monitor** 是一个实时监控系统资源的 Web 全栈应用。通过可视化界面展示服务器的系统状态、CPU/内存使用情况、进程列表、网络接口信息及系统运行状况，帮助管理员全面掌控服务器运行状态。

### 1.2 核心功能

| 功能模块 | 说明 |
|---------|------|
| 系统指标监控 | 实时显示 CPU 使用率、内存使用率、系统运行时间 |
| CPU 监控 | 显示 CPU 核心数、型号、频率及实时使用率 |
| 内存监控 | 显示总内存、已用内存、可用内存及使用百分比 |
| 进程管理 | 展示当前运行的进程列表，按内存使用排序 |
| 网络监控 | 显示所有网络接口的 IP 地址、MAC 地址等信息 |
| 系统信息 | 显示主机名、平台、架构等基本信息 |

### 1.3 技术栈

- **后端**：Node.js + Express + os 模块（原生系统调用）
- **前端**：React + Vite + React Router
- **样式**：TailwindCSS
- **实时更新**：轮询（5 秒间隔）
- **HTTP 客户端**：Axios

---

## 2. 页面结构

### 2.1 路由配置

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Dashboard | 仪表盘，总览系统所有指标 |
| `/topology` | Topology | 网络拓扑图 |
| `/tasks` | Tasks | 任务看板 |
| `/logs` | Logs | 活动日志 |

---

## 3. API 接口详解

### 3.1 系统指标（核心 API）

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

**数据示例：**
```json
{
  "total": 17179869184,
  "used": 8589934592,
  "free": 8589934592,
  "usage": 50
}
```

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

**数据示例：**
```json
[
  { "name": "chrome.exe", "pid": 1234, "memory": "150,320 K" },
  { "name": "node.exe", "pid": 5678, "memory": "98,500 K" }
]
```

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

**数据示例：**
```json
[
  {
    "name": "Ethernet",
    "address": "192.168.1.100",
    "netmask": "255.255.255.0",
    "mac": "00:1a:2b:3c:4d:5e",
    "internal": false
  }
]
```

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

### 3.2 Agent 相关（系统监控视角）

#### GET /api/agents

获取系统监控视角的 Agent 列表。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| id | string | Agent ID | 静态配置 |
| name | string | Agent 名称 | 静态配置 |
| emoji | string | Agent 图标 | 静态配置 |
| role | string | Agent 角色 | 静态配置 |
| status | string | 状态（固定 online） | 静态配置 |
| workspace | string | 工作空间 | 静态配置/`os.hostname()` |
| currentTask | string | 当前任务描述 | 动态生成 |
| sessions | number | 会话数量 | 动态计算 |
| memory | number | 内存使用率(%) | `os` 模块真实数据 |
| cpu | number | CPU 使用率(%) | `os` 模块真实数据 |
| lastActive | ISO 时间 | 最后活跃时间 | 当前时间 |

**Agent 列表：**

| ID | 名称 | 角色 | 说明 |
|----|------|------|------|
| system | 系统资源 | 系统监控 | 监控 CPU、内存整体状况 |
| node | Node.js 进程 | 运行时 | 监控当前 Node.js 进程 |
| memory | 内存管理 | 内存监控 | 监控内存使用情况 |
| network | 网络状态 | 网络监控 | 监控网络接口 |

---

#### GET /api/agents/:id

获取单个 Agent 的详细信息。

**路径参数：**
- `id`：Agent ID（system/node/memory/network）

**响应：**
- 包含基本信息和特定于该 Agent 的详细数据
- 详情数据来自 `os` 模块或 `process` 对象

---

### 3.3 任务相关

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

### 3.4 日志相关

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
  "agent": "system",
  "action": "系统资源监控启动"
}
```

---

### 3.5 拓扑相关

#### GET /api/topology

获取系统监控拓扑数据。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| nodes | array | 节点列表 | 静态配置 |
| links | array | 关系连线 | 静态配置 |
| stats | object | 统计信息 | `os` 模块数据 |

**节点列表：**

| ID | 名称 | Emoji | 角色 |
|----|------|-------|------|
| system | 系统资源 | 💻 | 系统监控 |
| node | Node.js | 🟢 | 运行时 |
| memory | 内存管理 | 🧠 | 内存监控 |
| network | 网络状态 | 🌐 | 网络监控 |

---

### 3.6 统计相关

#### GET /api/stats

获取统计概览数据。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| totalAgents | number | 总 Agent 数 | 固定值 4 |
| onlineCount | number | 在线数 | 固定值 4 |
| idleCount | number | 空闲数 | 固定值 0 |
| totalTasks | number | 总任务数 | 任务配置长度 |
| activeTasks | number | 进行中任务数 | 任务配置长度 |
| completedTasks | number | 已完成任务数 | 固定值 0 |
| waitingTasks | number | 等待中任务数 | 固定值 0 |
| system | object | 系统信息 | `os` 模块数据 |

---

### 3.7 健康检查

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

## 4. 页面功能说明

### 4.1 仪表盘（Dashboard）

**入口：** `/`

**功能：**
1. **统计卡片** - 显示系统关键指标：
   - 总 Agent 数
   - 在线数
   - CPU 使用率
   - 内存使用率
   - 系统运行时间
   - 网络接口数

2. **Agent 列表** - 展示所有 Agent 的详细信息卡片：
   - 头像 + 名称 + 角色
   - 在线状态指示器
   - 当前任务描述
   - 内存使用率（进度条）
   - CPU 使用率（进度条）
   - 最后活跃时间

3. **自动刷新** - 每 5 秒自动刷新数据

### 4.2 网络拓扑（Topology）

**入口：** `/topology`

**功能：**
1. **可视化拓扑图** - 使用 SVG 绘制
   - 4 个系统监控节点
   - 节点位置固定
   - 节点状态通过样式区分

2. **关系连线** - 3 种类型：
   - 紫色：监控关系（monitor）
   - 绿色：使用关系（use）
   - 蓝色：主机关系（host）

3. **系统统计** - 显示实时系统指标

### 4.3 任务板（Tasks）

**入口：** `/tasks`

**功能：**
1. **任务列表** - 展示系统监控任务：
   - 任务标题
   - 优先级标签
   - 状态标签
   - 进度条
   - 负责模块

2. **自动刷新** - 每 5 秒自动刷新

### 4.4 活动日志（Logs）

**入口：** `/logs`

**功能：**
1. **日志列表** - 时间顺序展示：
   - 时间戳
   - Agent 图标 + 名称
   - 活动描述

2. **自动刷新** - 每 5 秒自动刷新

---

## 5. 系统模块

项目预配置了 4 个系统监控模块：

| ID | 名称 | Emoji | 角色 | 数据来源 |
|----|------|-------|------|----------|
| system | 系统资源 | 💻 | 系统监控 | `os.cpus()` / `os.uptime()` |
| node | Node.js 进程 | 🟢 | 运行时 | `process` 对象 |
| memory | 内存管理 | 🧠 | 内存监控 | `os.totalmem()` / `os.freemem()` |
| network | 网络状态 | 🌐 | 网络监控 | `os.networkInterfaces()` |

---

## 6. 技术架构

### 6.1 后端架构

```
backend/src/index.js
├── Express 服务器
│   ├── 中间件
│   │   ├── cors() - 跨域资源共享
│   │   └── express.json() - JSON 解析
│   │
│   └── API 端点
│       ├── /api/metrics    - 综合指标
│       ├── /api/cpu        - CPU 信息
│       ├── /api/memory     - 内存信息
│       ├── /api/processes  - 进程列表
│       ├── /api/network    - 网络接口
│       ├── /api/system     - 系统信息
│       ├── /api/agents     - Agent 列表
│       ├── /api/agents/:id - Agent 详情
│       ├── /api/tasks      - 任务列表
│       ├── /api/logs       - 日志列表
│       ├── /api/topology   - 拓扑数据
│       ├── /api/stats      - 统计信息
│       └── /api/health     - 健康检查
│
├── 核心函数
│   ├── getCpuUsage()      - 获取 CPU 使用率
│   ├── getMemoryUsage()   - 获取内存使用情况
│   ├── getProcessList()   - 获取进程列表（tasklist）
│   ├── getNetworkInfo()   - 获取网络接口信息
│   ├── getUptime()        - 获取运行时间
│   └── getSystemInfo()   - 获取系统信息
│
└── 数据缓存
    └── processCache - 进程列表缓存（5秒TTL）
```

### 6.2 前端架构

```
frontend/src/
├── main.jsx              - React 入口
├── App.jsx               - 路由配置
├── index.css             - 全局样式
├── api/
│   └── index.js          - API 封装（Axios）
│
└── pages/
    ├── Dashboard.jsx      - 仪表盘页面
    ├── Topology.jsx       - 拓扑图页面
    ├── Tasks.jsx         - 任务板页面
    └── Logs.jsx          - 日志页面
```

### 6.3 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                         │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │Dashboard│    │Topology │    │ Tasks   │    │  Logs   │ │
│  └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘ │
│       │               │               │               │       │
│       └───────────────┴───────┬───────┴───────────────┘       │
│                               │                               │
│                         ┌─────┴─────┐                         │
│                         │   Axios   │                         │
│                         └─────┬─────┘                         │
└───────────────────────────────┼───────────────────────────────┘
                                │ HTTP 请求
                                ▼
┌───────────────────────────────┼───────────────────────────────┐
│                     后端 (Express)                            │
│  ┌─────────────┬─────────────┴─────────────┬──────────────┐  │
│  │             │                           │              │  │
│  ▼             ▼                           ▼              ▼  │
│ ┌──────┐   ┌──────┐                 ┌─────────────┐  ┌────┐ │
│ │  os  │   │process│                │tasklist命令 │  │静态│ │
│ │模块  │   │对象  │                 │ (Windows)   │  │配置│ │
│ └──────┘   └──────┘                 └─────────────┘  └────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0.0 | 2026-03-19 | 初始版本，包含：<br>- Agent 状态监测<br>- 任务追踪<br>- 活动日志<br>- 网络拓扑可视化 |
| 2.0.0 | 2026-03-19 | 重大更新：<br>- 后端改用真实 Node.js os 模块获取数据<br>- 新增 /api/metrics 综合指标端点<br>- 新增 /api/cpu CPU 详细信息<br>- 新增 /api/processes 进程列表<br>- 新增 /api/system 系统信息<br>- Agent 从 7 个改为 4 个系统监控模块 |

---

## 8. 项目结构

```
agent-monitor/
├── SPEC.md                 # 规格说明书
├── PROJECT_DOC.md          # 项目文档（本文件）
├── backend/
│   ├── package.json        # 后端依赖
│   └── src/
│       └── index.js        # Express 后端服务
└── frontend/
    ├── package.json        # 前端依赖
    ├── vite.config.js      # Vite 配置
    ├── index.html          # HTML 入口
    └── src/
        ├── main.jsx        # React 入口
        ├── App.jsx         # 路由配置
        ├── index.css       # 全局样式
        ├── api/
        │   └── index.js    # API 封装
        └── pages/
            ├── Dashboard.jsx   # 仪表盘
            ├── Topology.jsx    # 网络拓扑
            ├── Tasks.jsx      # 任务板
            └── Logs.jsx       # 活动日志
```

---

## 9. 注意事项

1. **真实数据** - 后端使用 Node.js 原生 `os` 模块和 `process` 对象获取真实系统数据
2. **进程列表** - 仅支持 Windows 系统，使用 `tasklist` 命令获取进程列表
3. **轮询刷新** - 前端每 5 秒轮询一次获取最新数据
4. **进程缓存** - 进程列表有 5 秒缓存机制，避免频繁调用系统命令
5. **网络接口** - 仅返回 IPv4 地址的网络接口信息
