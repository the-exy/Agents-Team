import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Topology from './pages/Topology'
import AgentDetail from './pages/AgentDetail'
import Tasks from './pages/Tasks'
import Sessions from './pages/Sessions'
import Memorials from './pages/Memorials'
import Logs from './pages/Logs'
import TokenHistory from './pages/TokenHistory'
import Subagents from './pages/Subagents'
import ModelDashboard from './pages/ModelDashboard'

function App() {
  const location = useLocation()
  
  const isActive = (path) => location.pathname === path

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🌐</span>
            <span className="logo-text">Agent 网络监控平台</span>
          </div>
          
          <nav className="nav">
            <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
              仪表盘
            </Link>
            <Link to="/topology" className={`nav-link ${isActive('/topology') ? 'active' : ''}`}>
              网络拓扑
            </Link>
            <Link to="/tasks" className={`nav-link ${isActive('/tasks') ? 'active' : ''}`}>
              任务板
            </Link>
            <Link to="/sessions" className={`nav-link ${isActive('/sessions') ? 'active' : ''}`}>
              会话监控
            </Link>
            <Link to="/token-history" className={`nav-link ${isActive('/token-history') ? 'active' : ''}`}>
              Token历史
            </Link>
            <Link to="/subagents" className={`nav-link ${isActive('/subagents') ? 'active' : ''}`}>
              Subagent
            </Link>
            <Link to="/memorials" className={`nav-link ${isActive('/memorials') ? 'active' : ''}`}>
              奏折阁
            </Link>
            <Link to="/models" className={`nav-link ${isActive('/models') ? 'active' : ''}`}>
              模型仪表盘
            </Link>
            <Link to="/logs" className={`nav-link ${isActive('/logs') ? 'active' : ''}`}>
              活动日志
            </Link>
          </nav>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/topology" element={<Topology />} />
          <Route path="/agent/:id" element={<AgentDetail />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/token-history" element={<TokenHistory />} />
          <Route path="/subagents" element={<Subagents />} />
          <Route path="/memorials" element={<Memorials />} />
          <Route path="/models" element={<ModelDashboard />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
