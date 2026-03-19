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
              <div key={agent.id} className="agent-card">
                <div className="agent-header">
                  <div className="agent-emoji">{agent.emoji}</div>
                  <div className="agent-info">
                    <h3>{agent.name}</h3>
                    <p>{agent.role}</p>
                  </div>
                  <span className={`agent-status status-${agent.status}`}>
                    <span className="status-dot"></span>
                    {agent.status === 'online' ? '在线' : agent.status === 'idle' ? '空闲' : '离线'}
                  </span>
                </div>
                <div className="agent-task">
                  📝 {agent.currentTask}
                </div>
                <div className="agent-metrics">
                  <div className="metric">
                    💾 内存
                    <div className="metric-bar">
                      <div className="metric-fill memory" style={{ width: `${agent.memory}%` }}></div>
                    </div>
                    {agent.memory}%
                  </div>
                  <div className="metric">
                    ⚡ CPU
                    <div className="metric-bar">
                      <div className="metric-fill cpu" style={{ width: `${agent.cpu * 10}%` }}></div>
                    </div>
                    {agent.cpu}%
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                  🕐 最后活跃: {formatTime(agent.lastActive)}
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
