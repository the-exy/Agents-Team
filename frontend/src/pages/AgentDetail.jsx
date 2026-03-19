import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { agentAPI } from '../api'

function AgentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState(null)
  const [sessions, setSessions] = useState([])
  const [skills, setSkills] = useState([])
  const [workspaceFiles, setWorkspaceFiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAgentDetail()
  }, [id])

  const loadAgentDetail = async () => {
    try {
      const [agentRes, skillsRes, filesRes] = await Promise.all([
        agentAPI.getAgent(id),
        agentAPI.getAgentSkills(id),
        agentAPI.getAgentFiles(id)
      ])
      const agentData = agentRes.data
      setAgent(agentData)
      // Sessions
      setSessions((agentData.sessions || []).map(s => ({
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
      // Skills
      setSkills(skillsRes.data.skills || [])
      // Workspace files
      setWorkspaceFiles(filesRes.data.files || [])
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

  const getTaskStatusIcon = (status) => {
    switch (status) {
      case 'in_progress': return '🔄'
      case 'completed': return '✅'
      case 'pending': return '⏳'
      default: return '📋'
    }
  }

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

  const agentTasks = agent.tasks || []

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
          {skills.length === 0 ? (
            <div className="empty" style={{ padding: '1.5rem' }}>暂无技能数据</div>
          ) : (
            <div className="skills-grid">
              {skills.map((skill, idx) => (
                <div key={idx} className="skill-tag" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <span className="skill-icon">✨</span>
                  {typeof skill === 'string' ? skill : skill.name || skill.skill || JSON.stringify(skill)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workspace MD Files Section */}
      <div className="card detail-section" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title gradient-text">📁 工作空间文件</h3>
        </div>
        <div className="card-body">
          {workspaceFiles.length === 0 ? (
            <div className="empty" style={{ padding: '1.5rem' }}>暂无工作空间文件</div>
          ) : (
            <div className="files-list">
              {workspaceFiles.map((file, idx) => {
                const fileName = typeof file === 'string' ? file : file.name || file.path || JSON.stringify(file)
                const fileExists = typeof file === 'object' ? (file.exists !== false) : true
                const lastModified = typeof file === 'object' ? file.lastModified || file.modified : null
                return (
                  <div key={idx} className="file-item">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{fileName}</span>
                    {lastModified && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {formatTime(lastModified)}
                      </span>
                    )}
                    <span className={`file-badge ${fileExists ? '' : 'file-badge-missing'}`}>
                      {fileExists ? '存在' : '不存在'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tasks Section */}
      <div className="card detail-section" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title gradient-text">📋 当前任务</h3>
        </div>
        <div className="card-body">
          {agentTasks.length === 0 ? (
            <div className="empty" style={{ padding: '1.5rem' }}>暂无任务数据</div>
          ) : (
            <div className="task-list-enhanced">
              {agentTasks.map((task, idx) => (
                <div key={task.id || idx} className="task-item-enhanced" style={{ animationDelay: `${idx * 0.08}s` }}>
                  <div className="task-status-icon">{getTaskStatusIcon(task.status)}</div>
                  <div className="task-content">
                    <div className="task-title">{task.title || task.summary || JSON.stringify(task)}</div>
                    {task.priority && (
                      <div className="task-meta-row">
                        <span className="task-priority-tag" style={{
                          color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981'
                        }}>
                          ● {task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`task-status-badge task-status-${task.status}`}>
                    {task.status === 'in_progress' ? '进行中' : task.status === 'completed' ? '已完成' : '待处理'}
                  </div>
                </div>
              ))}
            </div>
          )}
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
