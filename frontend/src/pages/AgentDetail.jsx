import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { agentAPI } from '../api'

// Hardcoded skills and workspace files per agent type
const AGENT_CONTENT = {
  'feishu': {
    skills: ['飞书消息读取', '飞书日历管理', '飞书任务管理', '飞书多维表格', '飞书云文档', '飞书用户搜索'],
    workspaceFiles: ['AGENTS.md', 'SOUL.md', 'MEMORY.md', 'USER.md', 'TOOLS.md', 'HEARTBEAT.md'],
    tasks: [
      { id: 1, title: '处理飞书消息', status: 'in_progress', priority: 'high' },
      { id: 2, title: '同步日历事件', status: 'completed', priority: 'medium' },
      { id: 3, title: '更新任务清单', status: 'pending', priority: 'low' }
    ]
  },
  'coding': {
    skills: ['代码编写', '代码审查', 'Git操作', '调试分析', '架构设计', '测试驱动开发'],
    workspaceFiles: ['AGENTS.md', 'SOUL.md', 'MEMORY.md', 'PROJECTS.md', 'CODE_REVIEW.md'],
    tasks: [
      { id: 1, title: '重构认证模块', status: 'in_progress', priority: 'high' },
      { id: 2, title: '编写单元测试', status: 'completed', priority: 'medium' },
      { id: 3, title: '优化API性能', status: 'pending', priority: 'high' }
    ]
  },
  'default': {
    skills: ['问题解决', '信息检索', '数据分析', '文档编写', '任务规划', '沟通协调'],
    workspaceFiles: ['AGENTS.md', 'SOUL.md', 'MEMORY.md', 'DAILY_NOTES.md', 'USER.md'],
    tasks: [
      { id: 1, title: '日常巡检任务', status: 'in_progress', priority: 'medium' },
      { id: 2, title: '日志分析报告', status: 'completed', priority: 'low' },
      { id: 3, title: '下周计划安排', status: 'pending', priority: 'medium' }
    ]
  }
}

function AgentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAgentDetail()
  }, [id])

  const loadAgentDetail = async () => {
    try {
      const res = await agentAPI.getAgent(id)
      setAgent(res.data)
      // Simplify sessions data
      setSessions((res.data.sessions || []).map(s => ({
        key: s.key,
        sessionId: s.sessionId,
        updatedAt: s.updatedAt,
        model: s.model,
        totalTokens: s.totalTokens,
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        channel: s.lastChannel || s.channel,
        abortedLastRun: s.abortedLastRun
      })))
    } catch (error) {
      console.error('加载 Agent 详情失败:', error)
    }
    setLoading(false)
  }

  const formatTime = (isoString) => {
    if (!isoString) return '-'
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTokenCount = (tokens) => {
    if (!tokens) return '0'
    if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M'
    if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'K'
    return tokens.toString()
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981'
      case 'idle': return '#f59e0b'
      case 'offline': return '#64748b'
      default: return '#64748b'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return '活跃'
      case 'idle': return '空闲'
      case 'offline': return '离线'
      default: return '未知'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444'
      case 'medium': return '#f59e0b'
      case 'low': return '#10b981'
      default: return '#64748b'
    }
  }

  const getTaskStatusIcon = (status) => {
    switch (status) {
      case 'in_progress': return '🔄'
      case 'completed': return '✅'
      case 'pending': return '⏳'
      default: return '📋'
    }
  }

  // Determine agent content based on role or channel
  const agentContent = agent?.role?.toLowerCase().includes('feishu') || agent?.channel?.toLowerCase().includes('feishu')
    ? AGENT_CONTENT['feishu']
    : agent?.role?.toLowerCase().includes('coding') || agent?.role?.toLowerCase().includes('dev')
    ? AGENT_CONTENT['coding']
    : AGENT_CONTENT['default']

  if (loading) {
    return <div className="empty loading-pulse">加载中...</div>
  }

  if (!agent) {
    return (
      <div className="empty">
        <p>未找到该 Agent</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          返回仪表盘
        </button>
      </div>
    )
  }

  return (
    <div className="agent-detail-container">
      {/* 返回按钮 */}
      <button 
        className="back-btn"
        onClick={() => navigate(-1)}
        style={{ marginBottom: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer' }}
      >
        ← 返回
      </button>

      {/* Agent 头部信息 */}
      <div className="agent-detail-header">
        <div className="header-glow"></div>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.25rem' }}>
            <div className="agent-avatar-container">
              <div style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '16px', 
                background: 'var(--bg-hover)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '40px'
              }}>
                {agent.emoji}
              </div>
              {agent.status === 'active' && (
                <>
                  <span className="avatar-ring"></span>
                  <span className="avatar-ring avatar-ring-delay"></span>
                </>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>{agent.name}</h2>
                <span 
                  className={`agent-status status-${agent.status}`}
                  style={{ background: `${getStatusColor(agent.status)}20`, color: getStatusColor(agent.status) }}
                >
                  <span className="status-dot" style={{ backgroundColor: getStatusColor(agent.status) }}></span>
                  {getStatusText(agent.status)}
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>{agent.role}</p>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                ID: {agent.id} • 最后活跃: {agent.lastActiveAgo || '从未'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="refresh-btn" onClick={loadAgentDetail}>🔄 刷新</button>
            </div>
          </div>
        </div>
      </div>

      {/* 详细信息卡片 */}
      <div className="card detail-section" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title gradient-text">📊 {agent.name} 详细信息</h3>
        </div>
        <div className="card-body">
          {/* 核心指标 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>核心指标</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="metric-box metric-box-primary">
                <div className="metric-box-value">
                  {formatTokenCount(agent.tokenUsage)}
                </div>
                <div className="metric-box-label">Token 用量</div>
              </div>
              <div className="metric-box metric-box-success">
                <div className="metric-box-value">
                  {agent.sessionCount || 0}
                </div>
                <div className="metric-box-label">会话数</div>
              </div>
              <div className="metric-box metric-box-warning">
                <div className="metric-box-value">
                  {formatTokenCount(agent.inputTokens)}
                </div>
                <div className="metric-box-label">输入 Token</div>
              </div>
              <div className="metric-box metric-box-purple">
                <div className="metric-box-value">
                  {formatTokenCount(agent.outputTokens)}
                </div>
                <div className="metric-box-label">输出 Token</div>
              </div>
            </div>
          </div>

          {/* 基本信息 */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>基本信息</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div className="info-row">
                <span className="info-label">🤖 模型</span>
                <span className="info-value">{agent.model || '未知'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">📡 渠道</span>
                <span className="info-value">{agent.channel || '无'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">⏱️ 最后活跃</span>
                <span className="info-value">{agent.lastActiveAgo || '从未'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">🔀 子Agent调用</span>
                <span className="info-value">{agent.spawnCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Skills Section */}
      <div className="card detail-section" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title gradient-text">🛠️ 已安装技能</h3>
        </div>
        <div className="card-body">
          <div className="skills-grid">
            {agentContent.skills.map((skill, idx) => (
              <div key={idx} className="skill-tag" style={{ animationDelay: `${idx * 0.05}s` }}>
                <span className="skill-icon">✨</span>
                {skill}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workspace MD Files Section */}
      <div className="card detail-section" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title gradient-text">📁 工作空间文件</h3>
        </div>
        <div className="card-body">
          <div className="files-list">
            {agentContent.workspaceFiles.map((file, idx) => (
              <div key={idx} className="file-item">
                <span className="file-icon">📄</span>
                <span className="file-name">{file}</span>
                <span className="file-badge">MD</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks Section */}
      <div className="card detail-section" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title gradient-text">📋 当前任务</h3>
        </div>
        <div className="card-body">
          <div className="task-list-enhanced">
            {agentContent.tasks.map((task, idx) => (
              <div key={task.id} className="task-item-enhanced" style={{ animationDelay: `${idx * 0.08}s` }}>
                <div className="task-status-icon">{getTaskStatusIcon(task.status)}</div>
                <div className="task-content">
                  <div className="task-title">{task.title}</div>
                  <div className="task-meta-row">
                    <span className="task-priority-tag" style={{ color: getPriorityColor(task.priority) }}>
                      ● {task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级'}
                    </span>
                  </div>
                </div>
                <div className={`task-status-badge task-status-${task.status}`}>
                  {task.status === 'in_progress' ? '进行中' : task.status === 'completed' ? '已完成' : '待处理'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 会话历史 */}
      <div className="card detail-section">
        <div className="card-header">
          <h3 className="card-title gradient-text">📋 相关会话 ({sessions.length})</h3>
        </div>
        <div className="card-body">
          {sessions.length === 0 ? (
            <div className="empty" style={{ padding: '2rem' }}>暂无会话记录</div>
          ) : (
            <div className="session-list">
              {sessions.map((session, idx) => (
                <div 
                  key={idx}
                  className="session-item"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                        {session.key || `会话 ${idx + 1}`}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        🕐 {formatTime(session.updatedAt)} 
                        {session.totalTokens && ` • 🎯 ${formatTokenCount(session.totalTokens)} tokens`}
                      </div>
                    </div>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '0.25rem',
                      background: session.abortedLastRun ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: session.abortedLastRun ? 'var(--warning)' : 'var(--success)'
                    }}>
                      {session.abortedLastRun ? '已终止' : '运行中'}
                    </span>
                  </div>
                  {session.model && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                      🤖 模型: {session.model}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AgentDetail
