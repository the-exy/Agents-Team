import { useState, useEffect } from 'react'
import { sessionsAPI } from '../api'

function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
    const interval = setInterval(loadSessions, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadSessions = async () => {
    try {
      const res = await sessionsAPI.getSessions()
      setSessions(res.data.sessions || [])
    } catch (error) {
      console.error('加载会话失败:', error)
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

  const getStatusBadge = (session) => {
    if (session.abortedLastRun) return { label: '已终止', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    if (!session.updatedAt) return { label: '未启动', color: '#64748b', bg: 'rgba(100,116,139,0.15)' }
    const diff = Date.now() - session.updatedAt
    if (diff < 5 * 60 * 1000) return { label: '运行中', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
    return { label: '已结束', color: '#818cf8', bg: 'rgba(129,140,248,0.15)' }
  }

  if (loading) {
    return <div className="empty">加载中...</div>
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title gradient-text">💬 会话监控</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              共 {sessions.length} 个会话 · 每10秒自动刷新
            </span>
            <button className="refresh-btn" onClick={loadSessions}>🔄 刷新</button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {sessions.length === 0 ? (
            <div className="empty" style={{ padding: '3rem' }}>暂无会话记录</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(30,41,59,0.8)', borderBottom: '1px solid #334155' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>Agent</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>会话标识</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>渠道</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>模型</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8', fontWeight: 500 }}>Tokens</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>最后活跃</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, idx) => {
                    const status = getStatusBadge(session)
                    return (
                      <tr key={session.key || idx} style={{ borderBottom: '1px solid #1e293b', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '0.625rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{session.agentEmoji || '🤖'}</span>
                            <span style={{ fontWeight: 500 }}>{session.agentName || session.agentId || '-'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.625rem 1rem', color: '#94a3b8', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {session.key ? session.key.split(':').slice(-2).join(':') : '-'}
                        </td>
                        <td style={{ padding: '0.625rem 1rem' }}>
                          <span style={{ 
                            padding: '0.125rem 0.5rem', 
                            background: 'rgba(129,140,248,0.1)', 
                            color: '#818cf8', 
                            borderRadius: '0.25rem',
                            fontSize: '0.7rem'
                          }}>
                            {session.channel || session.lastChannel || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '0.625rem 1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                          {session.model || '-'}
                        </td>
                        <td style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#818cf8', fontWeight: 500 }}>
                          {formatTokenCount(session.totalTokens || 0)}
                        </td>
                        <td style={{ padding: '0.625rem 1rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {formatTime(session.updatedAt ? new Date(session.updatedAt).toISOString() : null)}
                        </td>
                        <td style={{ padding: '0.625rem 1rem', textAlign: 'center' }}>
                          <span style={{ 
                            padding: '0.25rem 0.625rem', 
                            borderRadius: '9999px', 
                            fontSize: '0.7rem', 
                            fontWeight: 500,
                            background: status.bg,
                            color: status.color
                          }}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Sessions
