import { useState, useEffect } from 'react'
import { taskAPI } from '../api'

function Tasks() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [taskGroups, setTaskGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      const res = await taskAPI.getTasks()
      setProjects(res.data)
      if (res.data.length > 0) {
        setSelectedProject(res.data[0])
        setTaskGroups(res.data[0].taskGroups || [])
      }
    } catch (error) {
      console.error('加载任务失败:', error)
    }
    setLoading(false)
  }

  const handleProjectClick = (project) => {
    if (selectedProject?.id === project.id) {
      setSelectedProject(null)
      setTaskGroups([])
    } else {
      setSelectedProject(project)
      setTaskGroups(project.taskGroups || [])
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
      case 'in_progress': return '#10b981'
      case 'planning':
      case 'pending': return '#f59e0b'
      case 'completed': return '#6366f1'
      default: return '#64748b'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
      case 'in_progress': return '进行中'
      case 'planning':
      case 'pending': return '待开始'
      case 'completed': return '已完成'
      default: return '未知'
    }
  }

  if (loading) {
    return <div className="empty">加载中...</div>
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 项目任务管理</h2>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            共 {projects.length} 个项目
          </span>
        </div>
        <div className="card-body">
          {projects.length === 0 ? (
            <div className="empty">暂无项目</div>
          ) : (
            <div className="project-list">
              {projects.map(project => (
                <div 
                  key={project.id} 
                  className={`project-item ${selectedProject?.id === project.id ? 'selected' : ''}`}
                  onClick={() => handleProjectClick(project)}
                >
                  <div className="project-header">
                    <div className="project-title">
                      <span className="project-emoji">{project.emoji}</span>
                      <h3>{project.name}</h3>
                    </div>
                    <span 
                      className="project-status"
                      style={{ color: getStatusColor(project.status), borderColor: getStatusColor(project.status) }}
                    >
                      {project.status === 'active' ? '进行中' : project.status === 'planning' ? '规划中' : project.status}
                    </span>
                  </div>
                  <p className="project-description">{project.description}</p>
                  <div className="project-meta">
                    <span>👥 负责: {project.agents?.join(', ') || '待分配'}</span>
                    <span>📊 进度: {project.progress || 0}%</span>
                  </div>
                  <div className="project-progress">
                    <div 
                      className="project-progress-fill"
                      style={{ 
                        width: `${project.progress || 0}%`,
                        backgroundColor: getStatusColor(project.status)
                      }}
                    ></div>
                  </div>
                  
                  {/* 展开的任务明细 */}
                  {selectedProject?.id === project.id && taskGroups.length > 0 && (
                    <div className="project-tasks">
                      <h4>📝 各Agent任务明细</h4>
                      {taskGroups.map(group => (
                        <div key={group.agentId} className="task-group">
                          <div className="task-group-header">
                            <span className="task-group-emoji">{group.agentEmoji}</span>
                            <span className="task-group-name">{group.agentName}</span>
                            <span className="task-group-count">
                              {group.tasks.filter(t => t.status === 'in_progress').length}/{group.tasks.length} 进行中
                            </span>
                          </div>
                          <div className="task-list">
                            {group.tasks.map(task => (
                              <div key={task.id} className="task-item">
                                <div className="task-header">
                                  <h3 className="task-title">{task.title}</h3>
                                  <span 
                                    className="task-status"
                                    style={{ color: getStatusColor(task.status) }}
                                  >
                                    {getStatusText(task.status)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedProject?.id === project.id && taskGroups.length === 0 && (
                    <div className="empty" style={{ padding: '1rem' }}>暂无任务明细</div>
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

export default Tasks
