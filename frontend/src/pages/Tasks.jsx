import { useState, useEffect } from 'react'
import { projectAPI } from '../api'

function Tasks() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [projectTasks, setProjectTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const res = await projectAPI.getProjects()
      setProjects(res.data)
    } catch (error) {
      console.error('加载项目失败:', error)
    }
    setLoading(false)
  }

  const loadProjectTasks = async (projectId) => {
    try {
      const res = await projectAPI.getProjectTasks(projectId)
      setProjectTasks(res.data)
    } catch (error) {
      console.error('加载任务失败:', error)
      setProjectTasks([])
    }
  }

  const handleProjectClick = async (project) => {
    if (selectedProject?.id === project.id) {
      setSelectedProject(null)
      setProjectTasks([])
    } else {
      setSelectedProject(project)
      await loadProjectTasks(project.id)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981'
      case 'planning': return '#f59e0b'
      case 'completed': return '#6366f1'
      default: return '#64748b'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return '进行中'
      case 'planning': return '规划中'
      case 'completed': return '已完成'
      default: return '未知'
    }
  }

  const formatDate = (isoString) => {
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return <div className="empty">加载中...</div>
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 项目管理</h2>
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
                      {getStatusText(project.status)}
                    </span>
                  </div>
                  <p className="project-description">{project.description}</p>
                  <div className="project-meta">
                    <span>📊 任务数: {project.taskCount}</span>
                    <span>👥 负责: {project.agents?.join(', ') || '待分配'}</span>
                    <span>📅 {formatDate(project.createdAt)}</span>
                  </div>
                  <div className="project-progress">
                    <div 
                      className="project-progress-fill"
                      style={{ 
                        width: `${project.progress}%`,
                        backgroundColor: getStatusColor(project.status)
                      }}
                    ></div>
                  </div>
                  <div className="project-progress-text">
                    进度: {project.progress}%
                  </div>
                  
                  {/* 展开的任务明细 */}
                  {selectedProject?.id === project.id && (
                    <div className="project-tasks">
                      <h4>📝 任务明细</h4>
                      {projectTasks.length === 0 ? (
                        <div className="empty" style={{ padding: '1rem' }}>暂无任务明细</div>
                      ) : (
                        <div className="task-list">
                          {projectTasks.map(task => (
                            <div key={task.id} className="task-item">
                              <div className="task-header">
                                <h3 className="task-title">{task.title}</h3>
                              </div>
                              <div className="task-meta">
                                <span className="task-type">类型: {task.type}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
