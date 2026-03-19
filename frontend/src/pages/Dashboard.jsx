import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { statsAPI, agentAPI, rankingsAPI } from '../api'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [agents, setAgents] = useState([])
  const [rankings, setRankings] = useState({ tokenRanking: [], activityRanking: [] })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statsRes, agentsRes, rankingsRes] = await Promise.all([
        statsAPI.getStats(),
        agentAPI.getAgents(),
        rankingsAPI.getRankings().catch(() => ({ data: { tokenRanking: [], activityRanking: [] } }))
      ])
      setStats(statsRes.data)
      setAgents(agentsRes.data)
      if (rankingsRes.data) {
        setRankings(rankingsRes.data)
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    }
    setLoading(false)
  }

  // 计算心跳状态
  const getHeartbeatStatus = (lastActive) => {
    if (!lastActive) return { status: 'offline', label: '🔴 离线', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
    const diff = Date.now() - new Date(lastActive).getTime()
    if (diff < 5 * 60 * 1000) return { status: 'active', label: '🟢 活跃', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
    if (diff < 60 * 60 * 1000) return { status: 'idle', label: '🟡 空闲', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    return { status: 'offline', label: '🔴 离线', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
  }

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getMedalColor = (rank) => {
    if (rank === 1) return '#fbbf24'
    if (rank === 2) return '#94a3b8'
    if (rank === 3) return '#cd7f32'
    return '#64748b'
  }

  const formatTokenCount = (tokens) => {
    if (!tokens) return '0'
    if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M'
    if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'K'
    return tokens.toString()
  }

  if (loading) {
    return <div className="empty">加载中...</div>
  }

  return (
    <div>
      {/* 统计卡片 */}
      <div className="stats-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-card-bg"></div>
          <div className="stat-label">总Agent数</div>
          <div className="stat-value primary">{stats?.totalAgents || agents.length}</div>
          <div className="stat-glow"></div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-card-bg"></div>
          <div className="stat-label">在线</div>
          <div className="stat-value success">{stats?.onlineCount || 0}</div>
          <div className="stat-glow"></div>
        </div>
        <div className="stat-card stat-card-warning">
          <div className="stat-card-bg"></div>
          <div className="stat-label">空闲</div>
          <div className="stat-value warning">{stats?.idleCount || 0}</div>
          <div className="stat-glow"></div>
        </div>
        <div className="stat-card stat-card-active">
          <div className="stat-card-bg"></div>
          <div className="stat-label">活跃任务</div>
          <div className="stat-value">{stats?.activeTasks || 0}</div>
          <div className="stat-glow"></div>
          <div className="active-indicator">
            <span className="pulse-dot"></span>
          </div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-card-bg"></div>
          <div className="stat-label">已完成</div>
          <div className="stat-value success">{stats?.completedTasks || 0}</div>
          <div className="stat-glow"></div>
        </div>
        <div className="stat-card stat-card-gradient">
          <div className="stat-card-bg"></div>
          <div className="stat-label">Token总量</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>
            {agents.reduce((sum, a) => sum + (a.tokenUsage || 0), 0) >= 1000000
              ? (agents.reduce((sum, a) => sum + (a.tokenUsage || 0), 0) / 1000000).toFixed(1) + 'M'
              : (agents.reduce((sum, a) => sum + (a.tokenUsage || 0), 0) / 1000).toFixed(1) + 'K'}
          </div>
          <div className="stat-glow"></div>
        </div>
      </div>

      {/* Agent列表 + 排行榜 */}
      <div className="content-grid">
        {/* 左侧：Agent列表 */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title gradient-text">🤖 Agent 状态</h2>
            <button className="refresh-btn" onClick={loadData}>
              <span className="refresh-icon">🔄</span> 刷新
            </button>
          </div>
          <div className="card-body">
            <div className="agents-grid">
              {agents.map((agent, idx) => {
                const hb = getHeartbeatStatus(agent.lastActive)
                return (
                  <div
                    key={agent.id}
                    className={`agent-card ${agent.status === 'active' ? 'agent-active' : ''}`}
                    onClick={() => navigate(`/agent/${agent.id}`)}
                    style={{
                      cursor: 'pointer',
                      borderLeft: `3px solid ${hb.color}`,
                      '--delay': `${idx * 0.05}s`
                    }}
                  >
                    {/* 心跳徽章 */}
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.25rem 0.625rem',
                        borderRadius: '9999px',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        background: hb.bg,
                        color: hb.color
                      }}>
                        {hb.label}
                      </span>
                    </div>

                    <div className="agent-header">
                      <div className="agent-emoji-wrapper">
                        <div className="agent-emoji">{agent.emoji}</div>
                        {agent.status === 'active' && <span className="active-ring"></span>}
                      </div>
                      <div className="agent-info">
                        <h3>{agent.name}</h3>
                        <p>{agent.role}</p>
                      </div>
                    </div>

                    <div className="agent-metrics">
                      <div className="metric">
                        <span className="metric-label">🎯 Token</span>
                        <span className="metric-value">{agent.tokenUsageFormatted || '0'}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">💬 会话</span>
                        <span className="metric-value">{agent.sessionCount || 0}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">🤖 模型</span>
                        <span className="metric-value" style={{ fontSize: '0.65rem' }}>{agent.model || '未知'}</span>
                      </div>
                    </div>

                    <div className="agent-details">
                      <div className="detail-item">
                        <span className="detail-label">📡 渠道</span>
                        <span className="detail-value">{agent.channel || '无'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">⏱️ 最后活跃</span>
                        <span className="detail-value">{agent.lastActiveAgo || '从未'}</span>
                      </div>
                    </div>

                    {agent.tasks && agent.tasks.length > 0 && (
                      <div className="agent-tasks-preview">
                        <span>📋 任务: {agent.tasks.filter(t => t.status === 'in_progress').length} 进行中</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 右侧：排行榜 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Token 排行榜 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title gradient-text">🏆 Token 消耗榜</h3>
            </div>
            <div className="card-body" style={{ padding: '0.5rem 0' }}>
              {rankings.tokenRanking && rankings.tokenRanking.length > 0 ? (
                rankings.tokenRanking.map((item, idx) => (
                  <div key={item.agentId} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 1rem',
                    borderBottom: idx < rankings.tokenRanking.length - 1 ? '1px solid #1e293b' : 'none',
                    background: idx === 0 ? 'rgba(251,191,36,0.05)' : 'transparent'
                  }}>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      width: '24px',
                      textAlign: 'center',
                      color: getMedalColor(item.rank)
                    }}>
                      {getMedalEmoji(item.rank)}
                    </span>
                    <span style={{ fontSize: '1rem' }}>{item.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.agentName}
                      </div>
                      {/* Token 进度条 */}
                      <div className="metric-bar" style={{ marginTop: '0.25rem' }}>
                        <div className="metric-fill memory" style={{
                          width: `${Math.min((item.tokenUsage / (rankings.tokenRanking[0]?.tokenUsage || 1)) * 100, 100)}%`
                        }} />
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {item.formatted}
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty" style={{ padding: '1.5rem' }}>暂无数据</div>
              )}
            </div>
          </div>

          {/* 活跃度排行榜 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title gradient-text">📊 活跃度榜</h3>
            </div>
            <div className="card-body" style={{ padding: '0.5rem 0' }}>
              {rankings.activityRanking && rankings.activityRanking.length > 0 ? (
                rankings.activityRanking.map((item, idx) => (
                  <div key={item.agentId} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 1rem',
                    borderBottom: idx < rankings.activityRanking.length - 1 ? '1px solid #1e293b' : 'none',
                    background: idx === 0 ? 'rgba(251,191,36,0.05)' : 'transparent'
                  }}>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      width: '24px',
                      textAlign: 'center',
                      color: getMedalColor(item.rank)
                    }}>
                      {getMedalEmoji(item.rank)}
                    </span>
                    <span style={{ fontSize: '1rem' }}>{item.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{item.agentName}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.lastActive}</div>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                      {item.sessionCount} 会话
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty" style={{ padding: '1.5rem' }}>暂无数据</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
