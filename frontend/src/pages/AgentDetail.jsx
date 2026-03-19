import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { agentAPI } from '../api'

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
      setSessions(res.data.sessions || [])
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

  if (loading) {
    return <div className="empty">加载中...</div>
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
    <div>
      {/* 返回按钮 */}
      <button 
        className="back-btn"
        onClick={() => navigate(-1)}
        style={{ marginBottom: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer' }}
      >
        ← 返回
      </button>

      {/* Agent 头部信息 */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.25rem' }}>
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

      {/* 详细信息卡片 */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title">📊 {agent.name} 详细信息</h3>
        </div>
        <div className="card-body">
          {/* 核心指标 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>核心指标</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-hover)', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-light)' }}>
                  {formatTokenCount(agent.tokenUsage)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Token 用量</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--bg-hover)', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>
                  {agent.sessionCount || 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>会话数</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--bg-hover)', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>
                  {formatTokenCount(agent.inputTokens)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>输入 Token</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--bg-hover)', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#818cf8' }}>
                  {formatTokenCount(agent.outputTokens)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>输出 Token</div>
              </div>
            </div>
          </div>

          {/* 基本信息 */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>基本信息</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>🤖 模型</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{agent.model || '未知'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>📡 渠道</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{agent.channel || '无'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>⏱️ 最后活跃</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{agent.lastActiveAgo || '从未'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>🔀 子Agent调用</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{agent.spawnCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 会话历史 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📋 相关会话 ({sessions.length})</h3>
        </div>
        <div className="card-body">
          {sessions.length === 0 ? (
            <div className="empty" style={{ padding: '2rem' }}>暂无会话记录</div>
          ) : (
            <div className="session-list">
              {sessions.map((session, idx) => (
                <div 
                  key={idx}
                  style={{ 
                    padding: '1rem', 
                    borderBottom: idx < sessions.length - 1 ? '1px solid var(--border)' : 'none'
                  }}
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
