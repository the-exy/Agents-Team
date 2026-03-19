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

  const formatTime = (isoString) => {
    if (!isoString) return '从未'
    const date = new Date(isoString)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)
    
    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    return `${Math.floor(diff / 86400)}天前`
  }

  // 跳转到 Agent 详情页
  const handleAgentClick = (agentId) => {
    navigate(`/agent/${agentId}`)
  }

  // 获取状态颜色
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981'
      case 'idle': return '#f59e0b'
      case 'offline': return '#64748b'
      default: return '#64748b'
    }
  }

  // 获取状态文字
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
          <div className="stat-value primary">{stats?.totalAgents || 0}</div>
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
          <div className="stat-label">等待中</div>
          <div className="stat-value warning">{stats?.waitingTasks || 0}</div>
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
              <div key={agent.id} className="agent-card" onClick={() => handleAgentClick(agent.id)} style={{ cursor: 'pointer' }}>
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
                <div className="agent-task">
                  📝 {agent.lastActiveAgo || '从未活跃'}
                </div>
                <div className="agent-metrics">
                  <div className="metric" title={`累计 Token: ${agent.tokenUsage}`}>
                    🎯 Token用量
                    <div className="metric-value">{agent.tokenUsageFormatted || '0'}</div>
                  </div>
                  <div className="metric" title={`会话数: ${agent.sessionCount}`}>
                    💬 会话数
                    <div className="metric-value">{agent.sessionCount || 0}</div>
                  </div>
                </div>
                <div className="agent-details">
                  <div className="detail-item">
                    <span className="detail-label">📡 渠道</span>
                    <span className="detail-value">{agent.channelSummary || '无'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">🤖 模型</span>
                    <span className="detail-value">{agent.modelSummary || '未知'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">🔀 子Agent</span>
                    <span className="detail-value">{agent.spawnCount || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
