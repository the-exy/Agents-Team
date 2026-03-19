import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { statsAPI, agentAPI } from '../api'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statsRes, agentsRes] = await Promise.all([
        statsAPI.getStats(),
        agentAPI.getAgents()
      ])
      setStats(statsRes.data)
      setAgents(agentsRes.data)
    } catch (error) {
      console.error('加载数据失败:', error)
    }
    setLoading(false)
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

  return (
    <div>
      {/* 统计卡片 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">总Agent数</div>
          <div className="stat-value primary">{stats?.totalAgents || agents.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">在线</div>
          <div className="stat-value success">{stats?.onlineCount || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">空闲</div>
          <div className="stat-value warning">{stats?.idleCount || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">活跃任务</div>
          <div className="stat-value">{stats?.activeTasks || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已完成</div>
          <div className="stat-value success">{stats?.completedTasks || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Token总量</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>
            {agents.reduce((sum, a) => sum + (a.tokenUsage || 0), 0) >= 1000000 
              ? (agents.reduce((sum, a) => sum + (a.tokenUsage || 0), 0) / 1000000).toFixed(1) + 'M'
              : (agents.reduce((sum, a) => sum + (a.tokenUsage || 0), 0) / 1000).toFixed(1) + 'K'}
          </div>
        </div>
      </div>

      {/* Agent列表 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🤖 Agent 状态</h2>
          <button className="refresh-btn" onClick={loadData}>🔄 刷新</button>
        </div>
        <div className="card-body">
          <div className="agents-grid">
            {agents.map(agent => (
              <div 
                key={agent.id} 
                className="agent-card" 
                onClick={() => navigate(`/agent/${agent.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="agent-header">
                  <div className="agent-emoji">{agent.emoji}</div>
                  <div className="agent-info">
                    <h3>{agent.name}</h3>
                    <p>{agent.role}</p>
                  </div>
                  <span className={`agent-status status-${agent.status}`}>
                    <span className="status-dot" style={{ backgroundColor: getStatusColor(agent.status) }}></span>
                    {getStatusText(agent.status)}
                  </span>
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
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
