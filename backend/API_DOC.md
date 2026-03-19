# Agent Monitor API 文档

本文档说明 agent-monitor 后端 API 的每个字段的数据来源。

## 基础信息

- **服务地址**: http://localhost:3001
- **所有API均返回JSON格式数据**

---

## API 端点

### 1. GET /api/metrics

获取所有系统指标的汇总数据。

**响应字段说明:**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| cpu.usage | number | os.cpus() | CPU使用率百分比 |
| cpu.cores | number | os.cpus() | CPU核心数 |
| cpu.model | string | os.cpus()[0].model | CPU型号 |
| cpu.speed | number | os.cpus()[0].speed | CPU频率(MHz) |
| memory.total | number | os.totalmem() | 总内存(字节) |
| memory.used | number | os.totalmem() - os.freemem() | 已用内存(字节) |
| memory.free | number | os.freemem() | 可用内存(字节) |
| memory.usage | number | (used/total)*100 | 内存使用率百分比 |
| uptime.seconds | number | os.uptime() | 系统运行时间(秒) |
| uptime.formatted | string | 格式化计算 | 人类可读的运行时间 |
| timestamp | string | new Date() | 数据采集时间 |

---

### 2. GET /api/cpu

获取CPU使用率详情。

**响应字段说明:**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| usage | number | os.cpus() 计算 | CPU总体使用率百分比 |
| cores | number | os.cpus().length | CPU核心数 |
| model | string | os.cpus()[0].model | CPU型号名称 |
| speed | number | os.cpus()[0].speed | CPU频率 |

---

### 3. GET /api/memory

获取内存使用情况。

**响应字段说明:**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| total | number | os.totalmem() | 系统总内存(字节) |
| used | number | os.totalmem() - os.freemem() | 已使用内存(字节) |
| free | number | os.freemem() | 可用内存(字节) |
| usage | number | (used/total)*100 | 内存使用百分比 |

---

### 4. GET /api/processes

获取当前运行的进程列表（按内存使用排序）。

**数据来源**: Windows `tasklist /FO CSV /NH` 命令

**响应字段说明:**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| name | string | tasklist输出 | 进程名称 |
| pid | number | tasklist输出 | 进程ID |
| memory | string | tasklist输出 | 内存使用量 |

**说明**: 
- 返回前20个内存使用最高的进程
- 数据有5秒缓存，避免频繁调用系统命令

---

### 5. GET /api/network

获取网络接口信息。

**响应字段说明:**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| name | string | os.networkInterfaces() | 网络接口名称 |
| address | string | os.networkInterfaces() | IPv4地址 |
| netmask | string | os.networkInterfaces() | 子网掩码 |
| mac | string | os.networkInterfaces() | MAC地址 |
| internal | boolean | os.networkInterfaces() | 是否内部网络 |

---

### 6. GET /api/system

获取系统基本信息和平台详情。

**响应字段说明:**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| hostname | string | os.hostname() | 计算机名称 |
| platform | string | os.platform() | 平台类型(win32/linux) |
| release | string | os.release() | 系统版本号 |
| type | string | os.type() | 操作系统名称 |
| arch | string | os.arch() | 系统架构 |
| homedir | string | os.homedir() | 用户主目录 |
| tmpdir | string | os.tmpdir() | 临时文件目录 |
| cpuCount | number | os.cpus().length | CPU核心数 |
| totalMemory | number | os.totalmem() | 总内存(字节) |
| eol | string | os.EOL | 换行符 |

---

### 7. GET /api/agents

获取所有Agent的实时状态（系统监控视角）。

**响应字段说明:**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| id | string | 固定配置 | Agent唯一标识 |
| name | string | 固定配置 | Agent名称 |
| emoji | string | 固定配置 | Agent图标 |
| role | string | 固定配置 | Agent角色 |
| status | string | 实时判断 | 在线状态 |
| workspace | string | os.hostname() | 当前工作空间 |
| currentTask | string | 动态生成 | 当前任务描述 |
| sessions | number | 动态统计 | 会话数 |
| memory | number | os.freemem()计算 | 内存使用率 |
| cpu | number | os.cpus()计算 | CPU使用率 |
| lastActive | string | new Date() | 最后活跃时间 |

**Agent列表:**

1. **system** - 系统资源监控
2. **node** - Node.js运行时监控
3. **memory** - 内存管理监控
4. **network** - 网络状态监控

---

### 8. GET /api/agents/:id

获取单个Agent的详细信息和详情数据。

**参数:** 
- `id`: Agent ID (system/node/memory/network)

**响应字段说明:**

基础字段同 /api/agents，额外包含:

| Agent ID | 详情字段 | 来源 |
|----------|----------|------|
| system | hostname, platform, uptime, cpuCores, cpuModel | os模块 |
| node | pid, nodeVersion, uptime, heapUsed, heapTotal, external, rss | process对象 |
| memory | total, used, free, usagePercent | os.totalmem()/freemem() |
| network | interfaces | os.networkInterfaces() |

---

### 9. GET /api/tasks

获取任务列表。

**说明**: 当前版本的任务为静态配置，代表监控功能模块。

---

### 10. GET /api/logs

获取活动日志。

**说明**: 当前返回系统监控相关的日志记录。

---

### 11. GET /api/topology

获取网络拓扑和系统关联数据。

**响应字段说明:**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| nodes | array | 固定配置 | 系统节点列表 |
| links | array | 固定配置 | 节点关系 |
| stats.cpu | number | os.cpus() | CPU使用率 |
| stats.memory | number | os.freemem()计算 | 内存使用率 |
| stats.networkInterfaces | number | os.networkInterfaces() | 网络接口数 |
| stats.hostname | string | os.hostname() | 主机名 |

---

### 12. GET /api/stats

获取系统统计概览。

**响应字段说明:**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| totalAgents | number | 固定值(4) | Agent总数 |
| onlineCount | number | 实时统计 | 在线数 |
| idleCount | number | 实时统计 | 空闲数 |
| totalTasks | number | 任务配置 | 任务总数 |
| activeTasks | number | 任务状态 | 进行中任务 |
| completedTasks | number | 任务状态 | 已完成任务 |
| waitingTasks | number | 任务状态 | 等待中任务 |
| system.cpuUsage | number | os.cpus() | CPU使用率 |
| system.cpuCores | number | os.cpus() | CPU核心数 |
| system.memoryUsage | number | os.freemem()计算 | 内存使用率 |
| system.totalMemoryGB | number | os.totalmem() | 总内存(GB) |
| system.uptime | string | os.uptime() | 运行时间 |
| system.hostname | string | os.hostname() | 主机名 |
| system.platform | string | os.type() | 操作系统 |
| system.processCount | number | tasklist | 进程数 |
| system.networkInterfaces | number | os.networkInterfaces() | 网络接口数 |

---

### 13. POST /api/logs

添加新的日志记录。

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| agent | string | 否 | Agent标识 |
| action | string | 否 | 操作描述 |

**响应**: 返回新创建的日志对象

---

### 14. GET /api/health

健康检查接口。

**响应字段说明:**

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| status | string | 固定值 | 服务状态 |
| time | string | new Date() | 检查时间 |
| process.uptime | number | process.uptime() | 进程运行时间 |
| process.memory | string | process.memoryUsage() | 进程内存使用 |
| process.pid | number | process.pid | 进程ID |

---

## 数据来源总结

### Node.js 原生模块

| 模块 | 用途 |
|------|------|
| `os` | 系统信息、CPU、内存、网络接口 |
| `process` | Node.js进程信息 |
| `child_process` | 执行系统命令获取进程列表 |

### 无外部依赖

所有数据均通过 Node.js 原生模块获取，无需安装额外的 npm 包。

### 缓存策略

- **进程列表**: 5秒缓存，避免频繁调用系统命令
- **其他API**: 实时获取，确保数据准确性
