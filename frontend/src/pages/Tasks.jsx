import { useState, useEffect } from 'react'
import { taskAPI, agentAPI } from '../api'

function Tasks() {
  const [tasks, setTasks] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [tasksRes, agentsRes] = await Promise.all([
        taskAPI.getTasks(),
        agentAPI.getAgents()
      ])
      setTasks(tasksRes.data)
      setAgents(agentsRes.data)
    } catch (error) {
      console.error('加载数据失败:', error)
    }
    setLoading(false)
  }

  const getAgentName = (agentId) => {
    const agent = agents.find(a => a.id === agentId)
    return agent ? `${agent.emoji} ${agent.name}` : agentId
  }

  const formatDate = (isoString) => {
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  const statusMap = {
    in_progress: { label: '进行中', class: 'progress-in_progress' },
    completed: { label: '已完成', class: 'progress-completed' },
    waiting: { label: '等待中', class: 'progress-waiting' }
  }

  if (loading) {
    return <div className="empty">加载中...</div>
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 任务看板</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={`refresh-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
              style={{ background: filter === 'all' ? '#4f46e5' : '' }}
            >
              全部
            </button>
            <button 
              className={`refresh-btn ${filter === 'in_progress' ? 'active' : ''}`}
              onClick={() => setFilter('in_progress')}
              style={{ background: filter === 'in_progress' ? '#4f46e5' : '' }}
            >
              进行中
            </button>
            <button 
              className={`refresh-btn ${filter === 'waiting' ? 'active' : ''}`}
              onClick={() => setFilter('waiting')}
              style={{ background: filter === 'waiting' ? '#4f46e5' : '' }}
            >
              等待中
            </button>
            <button 
              className={`refresh-btn ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
              style={{ background: filter === 'completed' ? '#4f46e5' : '' }}
            >
              已完成
            </button>
          </div>
        </div>
        <div className="card-body">
          {filteredTasks.length === 0 ? (
            <div className="empty">暂无任务</div>
          ) : (
            <div className="task-list">
              {filteredTasks.map(task => (
                <div key={task.id} className="task-item">
                  <div className="task-header">
                    <h3 className="task-title">{task.title}</h3>
                    <span className={`task-priority priority-${task.priority}`}>
                      {task.priority === 'high' ? '高优先' : task.priority === 'medium' ? '中优先' : '低优先'}
                    </span>
                  </div>
                  <div className="task-meta">
                    <span className={`agent-status status-${task.status === 'completed' ? 'online' : task.status === 'in_progress' ? 'idle' : 'offline'}`}>
                      <span className="status-dot"></span>
                      {statusMap[task.status]?.label}
                    </span>
                    <span>📅 {formatDate(task.createdAt)}</span>
                  </div>
                  <div className="task-progress">
                    <div 
                      className={`task-progress-fill ${statusMap[task.status]?.class}`}
                      style={{ width: `${task.progress}%` }}
                    ></div>
                  </div>
                  <div className="task-assignees">
                    {task.assignees.map(agentId => (
                      <span key={agentId} className="assigninee">
                        {getAgentName(agentId)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Tasks
