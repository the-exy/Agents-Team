# Agent Network Monitor - 项目文档

> 当前版本：1.0.0  
> 最后更新：2026-03-19

---

## 1. 项目概述

### 1.1 项目简介

**Agent Network Monitor** 是一个实时监控多 Agent 协作状态的 Web 全栈应用。通过可视化界面展示各 Agent 的工作状态、任务进度、网络拓扑关系及活动日志，帮助管理员和团队负责人全面掌控 Agent 团队的运行状况。

### 1.2 核心功能

| 功能模块 | 说明 |
|---------|------|
| Agent 状态监测 | 实时显示 7 个 Agent 的在线/离线状态、当前工作内容、资源使用情况 |
| 任务追踪 | 展示活跃任务列表，支持按状态筛选（进行中/已完成/等待中） |
| 实时日志 | 显示最近活动记录，支持按 Agent 筛选 |
| 拓扑可视化 | 展示 Agent 网络拓扑图及关系（协调/依赖/测试/支持） |

### 1.3 技术栈

- **后端**：Node.js + Express
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
| `/topology` | Topology | 网络拓扑图 |
| `/tasks` | Tasks | 任务看板 |
| `/logs` | Logs | 活动日志 |

---

## 3. API 接口详解

### 3.1 Agent 相关

#### GET /api/agents

获取所有 Agent 状态列表。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| id | string | Agent 唯一标识 | 静态配置 |
| name | string | Agent 名称 | 静态配置 |
| emoji | string | Agent 图标 | 静态配置 |
| role | string | Agent 角色 | 静态配置 |
| status | string | 状态（online/idle） | 静态配置 |
| workspace | string | 工作空间名称 | 静态配置 |
| currentTask | string | 当前工作内容 | 静态配置 |
| sessions | number | 会话数量 | 静态配置 |
| memory | number | 内存使用率(%) | 静态配置 + 动态波动 |
| cpu | number | CPU使用率(%) | 静态配置 + 动态波动 |
| lastActive | ISO时间 | 最后活跃时间 | 静态配置 + 动态更新 |

**数据示例：**
```json
{
  "id": "backend",
  "name": "后端开发",
  "emoji": "⚙️",
  "role": "后端开发",
  "status": "online",
  "workspace": "workspace-backend",
  "currentTask": "开发考研论坛API接口",
  "sessions": 1,
  "memory": 38,
  "cpu": 8,
  "lastActive": "2026-03-19T08:30:00.000Z"
}
```

#### GET /api/agents/:id

获取单个 Agent 详情。

**路径参数：**
- `id`：Agent ID

---

### 3.2 任务相关

#### GET /api/tasks

获取任务列表。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| id | number | 任务唯一ID | 静态配置 |
| title | string | 任务标题 | 静态配置 |
| status | string | 状态（in_progress/completed/waiting） | 静态配置 |
| priority | string | 优先级（high/medium/low） | 静态配置 |
| assignees | string[] | 负责的 Agent ID 列表 | 静态配置 |
| progress | number | 进度百分比(0-100) | 静态配置 |
| createdAt | ISO时间 | 创建时间 | 静态配置 |

---

### 3.3 日志相关

#### GET /api/logs

获取活动日志列表（最多20条）。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| id | number | 日志唯一ID | 静态配置 |
| agent | string | Agent ID | 静态配置 |
| action | string | 活动描述 | 静态配置 |
| time | ISO时间 | 发生时间 | 静态配置 |

#### POST /api/logs

添加新日志。

**请求体：**
```json
{
  "agent": "main",
  "action": "创建项目"
}
```

---

### 3.4 拓扑相关

#### GET /api/topology

获取 Agent 网络拓扑数据。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| nodes | array | 节点列表 | 从 agents 映射 |
| links | array | 关系连线 | 静态配置 |

**节点字段（nodes）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | Agent ID |
| name | string | Agent 名称 |
| emoji | string | Agent 图标 |
| role | string | Agent 角色 |
| status | string | 状态 |

**连线字段（links）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| source | string | 源节点 ID |
| target | string | 目标节点 ID |
| type | string | 关系类型（coordination/dependency/testing/support） |

---

### 3.5 统计相关

#### GET /api/stats

获取统计概览数据。

**响应字段说明：**

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| totalAgents | number | 总 Agent 数 | 计算（agents.length） |
| onlineCount | number | 在线数 | 计算 |
| idleCount | number | 空闲数 | 计算 |
| totalTasks | number | 总任务数 | 计算（tasks.length） |
| activeTasks | number | 进行中任务数 | 计算 |
| completedTasks | number | 已完成任务数 | 计算 |
| waitingTasks | number | 等待中任务数 | 计算 |

---

### 3.6 健康检查

#### GET /api/health

服务健康检查。

**响应：**
```json
{
  "status": "ok",
  "time": "2026-03-19T08:45:00.000Z"
}
```

---

## 4. 页面功能说明

### 4.1 仪表盘（Dashboard）

**入口：** `/`

**功能：**
1. **统计卡片** - 显示 6 个关键指标：
   - 总 Agent 数
   - 在线数
   - 空闲数
   - 活跃任务数
   - 已完成任务数
   - 等待中任务数

2. **Agent 列表** - 展示所有 Agent 的详细信息卡片：
   - 头像 + 名称 + 角色
   - 在线状态指示器
   - 当前任务描述
   - 内存使用率（进度条）
   - CPU 使用率（进度条）
   - 最后活跃时间

3. **自动刷新** - 每 5 秒自动刷新数据，支持手动点击刷新按钮

### 4.2 网络拓扑（Topology）

**入口：** `/topology`

**功能：**
1. **可视化拓扑图** - 使用 SVG 绘制
   - 7 个 Agent 节点，带图标和名称
   - 节点位置固定
   - 节点状态通过样式区分（online/idle）

2. **关系连线** - 4 种类型：
   - 紫色：协调关系（coordination）
   - 绿色：依赖关系（dependency）
   - 橙色：测试关系（testing）
   - 灰色：支持关系（support）

3. **图例** - 底部显示关系类型说明

### 4.3 任务板（Tasks）

**入口：** `/tasks`

**功能：**
1. **任务列表** - 展示所有任务卡片：
   - 任务标题
   - 优先级标签（高/中/低）
   - 状态标签
   - 创建时间
   - 进度条
   - 负责人头像

2. **筛选功能** - 4 个筛选按钮：
   - 全部
   - 进行中
   - 等待中
   - 已完成

3. **自动刷新** - 每 5 秒自动刷新

### 4.4 活动日志（Logs）

**入口：** `/logs`

**功能：**
1. **日志列表** - 时间顺序展示：
   - 时间戳
   - Agent 图标 + 名称
   - 活动描述

2. **自动刷新** - 每 5 秒自动刷新

---

## 5. Agent 配置

项目预配置了 7 个 Agent：

| ID | 名称 | Emoji | 角色 | 初始状态 |
|----|------|-------|------|---------|
| main | 主Agent | 🤖 | 协调者 | online |
| backend | 后端开发 | ⚙️ | 后端开发 | online |
| frontend | 前端开发 | 🎨 | 前端开发 | online |
| pm | 产品经理 | 📋 | 产品经理 | online |
| db | 数据库开发 | 🗄️ | 数据库开发 | idle |
| test | 测试工程师 | 🧪 | 测试 | idle |
| ops | 运维工程师 | 🔧 | 运维 | idle |

---

## 6. 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0.0 | 2026-03-19 | 初始版本，包含：<br>- Agent 状态监测<br>- 任务追踪<br>- 活动日志<br>- 网络拓扑可视化 |

---

## 7. 项目结构

```
agent-monitor/
├── SPEC.md                 # 规格说明书
├── PROJECT_DOC.md          # 项目文档（本文件）
├── backend/
│   └── src/
│       └── index.js        # Express 后端服务
└── frontend/
    └── src/
        ├── main.jsx        # React 入口
        ├── App.jsx         # 路由配置
        ├── index.css       # 全局样式
        ├── api/
        │   └── index.js    # API 封装
        └── pages/
            ├── Dashboard.jsx   # 仪表盘
            ├── Topology.jsx   # 网络拓扑
            ├── Tasks.jsx       # 任务板
            └── Logs.jsx        # 活动日志
```

---

## 8. 注意事项

1. **数据模拟** - 当前后端数据为模拟数据，memory/cpu 会动态波动模拟实时感
2. **轮询刷新** - 前端每 5 秒轮询一次获取最新数据
3. **静态配置** - Agent、任务、日志数据目前均为后端静态配置，未连接实际数据源
