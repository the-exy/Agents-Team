import { useState, useEffect } from 'react'
import { memorialsAPI, agentAPI } from '../api'

function Memorials() {
  const [memorials, setMemorials] = useState([])
  const [agents, setAgents] = useState([])
  const [filterAgent, setFilterAgent] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [memorialsRes, agentsRes] = await Promise.all([
        memorialsAPI.getMemorials(),
        agentAPI.getAgents()
      ])
      setMemorials(memorialsRes.data.memorials || [])
      setAgents(agentsRes.data || [])
    } catch (error) {
      console.error('加载奏折失败:', error)
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

  const filteredMemorials = filterAgent === 'all'
    ? memorials
    : memorials.filter(m => m.agentId === filterAgent)

  const getTypeIcon = (type) => {
    return type === 'session_ended' ? '💬' : '✅'
  }

  const getTypeColor = (type) => {
    return type === 'session_ended' ? '#818cf8' : '#10b981'
  }

  if (loading) {
    return <div className="empty">加载中...</div>
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title gradient-text">📜 奏折阁</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={filterAgent}
              onChange={e => setFilterAgent(e.target.value)}
              style={{
                background: '#334155',
                border: '1px solid #475569',
                borderRadius: '0.375rem',
                color: '#e2e8f0',
                padding: '0.375rem 0.75rem',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">全部 Agent</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.emoji} {agent.name}
                </option>
              ))}
            </select>
            <button className="refresh-btn" onClick={loadData}>🔄 刷新</button>
          </div>
        </div>
        <div className="card-body">
          {filteredMemorials.length === 0 ? (
            <div className="empty" style={{ padding: '3rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
              <div>暂无奏折记录</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                已结束的任务和会话将自动归档于此
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Timeline vertical line */}
              <div style={{
                position: 'absolute',
                left: '20px',
                top: 0,
                bottom: 0,
                width: '2px',
                background: 'linear-gradient(to bottom, #334155, #1e293b)'
              }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {filteredMemorials.map((item, idx) => (
                  <div key={item.id} style={{
                    display: 'flex',
                    gap: '1rem',
                    padding: '0.75rem 0',
                    position: 'relative'
                  }}>
                    {/* Timeline dot */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: '#1e293b',
                      border: `2px solid ${getTypeColor(item.type)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      flexShrink: 0,
                      zIndex: 1,
                      position: 'relative'
                    }}>
                      {getTypeIcon(item.type)}
                    </div>

                    {/* Content card */}
                    <div style={{
                      flex: 1,
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                      padding: '0.875rem 1rem',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.title}</span>
                        </div>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '0.125rem 0.5rem',
                          background: `${getTypeColor(item.type)}20`,
                          color: getTypeColor(item.type),
                          borderRadius: '0.25rem'
                        }}>
                          {item.type === 'session_ended' ? '会话结束' : '任务完成'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                        {item.description}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>🕐 {formatTime(item.timestamp)}</span>
                        <span>⏱️ {item.timeAgo}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Memorials
