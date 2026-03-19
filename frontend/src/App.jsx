import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Topology from './pages/Topology'
import Tasks from './pages/Tasks'
import Logs from './pages/Logs'

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
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
