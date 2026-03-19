import { useState, useEffect } from 'react'
import { logAPI, agentAPI } from '../api'

function Logs() {
  const [logs, setLogs] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [logsRes, agentsRes] = await Promise.all([
        logAPI.getLogs(),
        agentAPI.getAgents()
      ])
      setLogs(logsRes.data)
      setAgents(agentsRes.data)
    } catch (error) {
      console.error('加载数据失败:', error)
    }
    setLoading(false)
  }

  const getAgentInfo = (agentId) => {
    const agent = agents.find(a => a.id === agentId)
    return agent ? { name: agent.name, emoji: agent.emoji } : { name: agentId, emoji: '🤖' }
  }

  const formatTime = (isoString) => {
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  if (loading) {
    return <div className="empty">加载中...</div>
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📝 活动日志</h2>
          <button className="refresh-btn" onClick={loadData}>🔄 刷新</button>
        </div>
        <div className="card-body">
          {logs.length === 0 ? (
            <div className="empty">暂无日志</div>
          ) : (
            <div className="log-list">
              {logs.map(log => {
                const agentInfo = getAgentInfo(log.agent)
                return (
                  <div key={log.id} className="log-item">
                    <span className="log-time">{formatTime(log.time)}</span>
                    <span className="log-agent">{agentInfo.emoji} {agentInfo.name}</span>
                    <span className="log-action">{log.action}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Logs
