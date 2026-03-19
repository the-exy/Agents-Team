import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { agentAPI } from '../api'

function AgentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')

  useEffect(() => {
    loadAgentDetail()
  }, [id])

  const loadAgentDetail = async () => {
    try {
      const [agentRes, historyRes] = await Promise.all([
        agentAPI.getAgent(id),
        agentAPI.getAgentHistory(id)
      ])
      setAgent(agentRes.data)
      setHistory(historyRes.data || [])
    } catch (error) {
      console.error('加载 Agent 详情失败:', error)
    }
    setLoading(false)
  }

  const formatTime = (isoString) => {
    if (!isoString) return '-'
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '-'
    if (seconds < 60) return `${seconds}秒`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
    return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'online': return '在线'
      case 'idle': return '空闲'
      case 'offline': return '离线'
      default: return status
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'online': return 'success'
      case 'idle': return 'warning'
      default: return ''
    }
  }

  const getTaskStatusLabel = (status) => {
    switch (status) {
      case 'completed': return '已完成'
      case 'running': return '进行中'
      case 'pending': return '等待中'
      case 'failed': return '失败'
      default: return status
    }
  }

  const getTaskStatusClass = (status) => {
    switch (status) {
      case 'completed': return 'success'
      case 'running': return 'primary'
      case 'pending': return 'warning'
      case 'failed': return 'error'
      default: ''
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
        style={{ marginBottom: '1rem' }}
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
            background: '#1e293b', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '40px'
          }}>
            {agent.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#f1f5f9' }}>{agent.name}</h2>
              <span className={`agent-status status-${agent.status}`}>
                <span className="status-dot"></span>
                {getStatusLabel(agent.status)}
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0', color: '#94a3b8' }}>{agent.role}</p>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
              ID: {agent.id} • 最后活跃: {formatTime(agent.lastActive)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="refresh-btn" onClick={loadAgentDetail}>🔄 刷新</button>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button 
          className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          📊 详细信息
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📋 历史会话 ({history.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          📝 任务记录
        </button>
      </div>

      {/* Tab 内容 */}
      {activeTab === 'info' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📊 Agent 详细信息</h3>
          </div>
          <div className="card-body">
            {/* 实时指标 */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.75rem' }}>实时状态</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="metric-card">
                  <div className="metric-label">内存使用</div>
                  <div className="metric-value">{agent.memory}%</div>
                  <div className="metric-bar" style={{ height: '6px', background: '#334155', borderRadius: '3px', marginTop: '0.5rem' }}>
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${agent.memory}%`, 
                        background: agent.memory > 80 ? '#ef4444' : agent.memory > 60 ? '#f59e0b' : '#10b981',
                        height: '100%',
                        borderRadius: '3px'
                      }}
                    ></div>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">CPU 使用率</div>
                  <div className="metric-value">{(agent.cpu || 0)}%</div>
                  <div className="metric-bar" style={{ height: '6px', background: '#334155', borderRadius: '3px', marginTop: '0.5rem' }}>
                    <div 
                      className="metric-fill" 
                      style={{ 
                        width: `${(agent.cpu || 0) * 10}%`, 
                        background: (agent.cpu || 0) > 80 ? '#ef4444' : (agent.cpu || 0) > 60 ? '#f59e0b' : '#10b981',
                        height: '100%',
                        borderRadius: '3px'
                      }}
                    ></div>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">当前任务</div>
                  <div className="metric-value" style={{ fontSize: '0.9rem' }}>{agent.currentTask || '无'}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">运行时间</div>
                  <div className="metric-value">{formatDuration(agent.uptime)}</div>
                </div>
              </div>
            </div>

            {/* 能力列表 */}
            {agent.capabilities && agent.capabilities.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.75rem' }}>🎯 能力</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {agent.capabilities.map((cap, idx) => (
                    <span 
                      key={idx}
                      style={{ 
                        padding: '0.25rem 0.75rem', 
                        background: '#334155', 
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        color: '#e2e8f0'
                      }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 统计数据 */}
            <div>
              <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.75rem' }}>📈 统计</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#1e293b', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{agent.stats?.completedTasks || 0}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>已完成任务</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#1e293b', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{agent.stats?.activeTasks || 0}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>进行中</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#1e293b', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#818cf8' }}>{agent.stats?.totalSessions || 0}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>总会话数</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#1e293b', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e2e8f0' }}>{agent.stats?.successRate || 0}%</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>成功率</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 历史会话</h3>
          </div>
          <div className="card-body">
            {history.length === 0 ? (
              <div className="empty" style={{ padding: '2rem' }}>暂无历史会话</div>
            ) : (
              <div className="history-list">
                {history.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="history-item"
                    style={{ 
                      padding: '1rem', 
                      borderBottom: idx < history.length - 1 ? '1px solid #334155' : 'none',
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'flex-start'
                    }}
                  >
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '8px', 
                      background: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0
                    }}>
                      {item.type === 'task' ? '📝' : item.type === 'chat' ? '💬' : '🔧'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: '500', color: '#e2e8f0' }}>{item.title}</div>
                        <span className={`task-status status-${getTaskStatusClass(item.status)}`}>
                          {getTaskStatusLabel(item.status)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        {item.description}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                        🕐 {formatTime(item.startTime)} 
                        {item.duration && ` • ⏱️ ${formatDuration(item.duration)}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📝 任务记录</h3>
          </div>
          <div className="card-body">
            {history.filter(h => h.type === 'task').length === 0 ? (
              <div className="empty" style={{ padding: '2rem' }}>暂无任务记录</div>
            ) : (
              <div className="tasks-list">
                {history.filter(h => h.type === 'task').map((task, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      padding: '1rem', 
                      borderBottom: idx < history.filter(h => h.type === 'task').length - 1 ? '1px solid #334155' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`task-status status-${getTaskStatusClass(task.status)}`}>
                          {getTaskStatusLabel(task.status)}
                        </span>
                        <span style={{ fontWeight: '500', color: '#e2e8f0' }}>{task.title}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {formatDuration(task.duration)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                      {task.description}
                    </div>
                    {task.result && (
                      <div style={{ 
                        marginTop: '0.75rem', 
                        padding: '0.75rem', 
                        background: '#0f172a', 
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        color: '#94a3b8'
                      }}>
                        📤 结果: {task.result}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AgentDetail
