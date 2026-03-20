import { useState, useEffect, useCallback } from 'react'
import { subagentAPI } from '../api'

function Subagents() {
  const [loading, setLoading] = useState(false)
  const [subagents, setSubagents] = useState([])
  const [tree, setTree] = useState([])
  const [stats, setStats] = useState({ activeCount: 0, totalCount: 0, avgDuration: '0s' })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, treeRes] = await Promise.all([
        subagentAPI.getSubagents().catch(() => ({ data: [] })),
        subagentAPI.getSubagentTree().catch(() => ({ data: [] }))
      ])
      const list = listRes.data || []
      setSubagents(list)
      setTree(treeRes.data || [])

      // 计算统计
      const active = list.filter(s => s.status === 'active' || s.status === 'running')
      const total = list.length
      // 计算平均运行时长
      const durations = list.filter(s => s.durationMs || s.runningTime).map(s => s.durationMs || s.runningTime)
      const avgDur = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
      setStats({
        activeCount: active.length,
        totalCount: total,
        avgDuration: avgDur > 60000 ? `${(avgDur / 60000).toFixed(1)}m` : `${Math.round(avgDur / 1000)}s`
      })
    } catch (error) {
      console.error('加载 Subagent 数据失败:', error)
      setSubagents([])
      setTree([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 8000)
    return () => clearInterval(interval)
  }, [loadData])

  // 格式化运行时长
  const formatDuration = (ms) => {
    if (!ms) return '—'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
    return `${(ms / 3600000).toFixed(1)}h`
  }

  // 格式化时间
  const formatTime = (ts) => {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  // 状态颜色
  const getStatusStyle = (status) => {
    switch (status) {
      case 'active': case 'running':
        return { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.3)' }
      case 'idle': case 'pending':
        return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' }
      case 'completed': case 'done':
        return { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' }
      case 'failed': case 'error':
        return { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' }
      default:
        return { bg: 'rgba(100,116,139,0.15)', color: '#64748b', border: 'rgba(100,116,139,0.3)' }
    }
  }

  // 截断 session key
  const truncKey = (key) => {
    if (!key) return '—'
    return key.length > 16 ? key.slice(0, 8) + '...' + key.slice(-6) : key
  }

  // 渲染树节点
  const renderTreeNode = (node, level = 0) => {
    const statusStyle = getStatusStyle(node.status)
    const children = node.children || []

    return (
      <div key={node.sessionKey} className="tree-node" style={{ marginLeft: `${level * 1.5}rem` }}>
        <div className="tree-node-card">
          <div className="tree-connector" style={{ opacity: level === 0 ? 0 : 1 }} />
          <div className="tree-content">
            <div className="tree-header">
              {children.length > 0 && (
                <span className="tree-expand">▼ {children.length}</span>
              )}
              <span className="tree-emoji">{node.emoji || '🤖'}</span>
              <span className="tree-session" title={node.sessionKey}>{truncKey(node.sessionKey)}</span>
              <span
                className="tree-status"
                style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}
              >
                {node.status || 'unknown'}
              </span>
            </div>
            <div className="tree-meta">
              {node.tokenUsage != null && (
                <span className="tree-meta-item">🎯 {node.tokenUsage >= 1000 ? (node.tokenUsage / 1000).toFixed(1) + 'K' : node.tokenUsage}</span>
              )}
              {node.durationMs != null && (
                <span className="tree-meta-item">⏱️ {formatDuration(node.durationMs)}</span>
              )}
              {node.createdAt && (
                <span className="tree-meta-item">🕐 {formatTime(node.createdAt)}</span>
              )}
              {node.parentSession && (
                <span className="tree-meta-item" title={node.parentSession}>📍 parent: {truncKey(node.parentSession)}</span>
              )}
            </div>
          </div>
        </div>
        {children.map(child => renderTreeNode(child, level + 1))}
      </div>
    )
  }

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header">
        <h1 className="gradient-text">🔄 Subagent 监控</h1>
        <p className="page-subtitle">实时监控 Subagent 生命周期与调用树</p>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
        <div className="stat-card stat-card-active">
          <div className="stat-label">当前活跃</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{stats.activeCount}</div>
          <div className="active-indicator" style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
            <span className="pulse-dot" />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">累计 Spawn</div>
          <div className="stat-value" style={{ color: 'var(--primary-light)' }}>{stats.totalCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">平均运行时长</div>
          <div className="stat-value" style={{ color: 'var(--warning)', fontSize: '1.5rem' }}>{stats.avgDuration}</div>
        </div>
      </div>

      <div className="content-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* 左侧：树状视图 */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title gradient-text">🌳 Subagent 调用树</h3>
            <button className="refresh-btn" onClick={loadData} disabled={loading}>
              <span className="refresh-icon">🔄</span> {loading ? '刷新中...' : '刷新'}
            </button>
          </div>
          <div className="card-body tree-body">
            {tree.length === 0 ? (
              <div className="empty">
                {loading ? '加载中...' : '暂无活跃 Subagent'}
              </div>
            ) : (
              tree.map(node => renderTreeNode(node))
            )}
          </div>
        </div>

        {/* 右侧：列表 */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title gradient-text">📋 Subagent 列表</h3>
            <span className="count-badge">{subagents.length}</span>
          </div>
          <div className="card-body" style={{ padding: 0, maxHeight: '600px', overflowY: 'auto' }}>
            {/* 表头 */}
            <div className="subagent-table-header">
              <div className="th th-subagent">Subagent Session</div>
              <div className="th th-parent">Parent Session</div>
              <div className="th th-num">Token</div>
              <div className="th th-time">创建时间</div>
              <div className="th th-status">状态</div>
            </div>
            {subagents.length === 0 ? (
              <div className="empty">暂无数据</div>
            ) : (
              subagents.map((s, idx) => {
                const statusStyle = getStatusStyle(s.status)
                return (
                  <div key={s.sessionKey || idx} className="subagent-row fade-in" style={{ animationDelay: `${idx * 0.03}s` }}>
                    <div className="td td-subagent" title={s.sessionKey}>
                      <span className="subagent-emoji">{s.emoji || '🤖'}</span>
                      {truncKey(s.sessionKey)}
                    </div>
                    <div className="td td-parent" title={s.parentSession}>{truncKey(s.parentSession)}</div>
                    <div className="td td-num">
                      {s.tokenUsage != null ? (s.tokenUsage >= 1000 ? (s.tokenUsage / 1000).toFixed(1) + 'K' : s.tokenUsage) : '—'}
                    </div>
                    <div className="td td-time">{formatTime(s.createdAt)}</div>
                    <div className="td td-status">
                      <span
                        className="status-pill"
                        style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}
                      >
                        {s.status || 'unknown'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <style>{`
        .page-header {
          margin-bottom: 1.5rem;
        }
        .page-header h1 {
          font-size: 1.5rem;
          font-weight: 700;
        }
        .page-subtitle {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }
        .count-badge {
          padding: 0.2rem 0.6rem;
          background: rgba(79, 70, 229, 0.15);
          color: var(--primary-light);
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        /* Tree */
        .tree-body {
          max-height: 550px;
          overflow-y: auto;
        }
        .tree-node {
          position: relative;
        }
        .tree-node-card {
          display: flex;
          align-items: stretch;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .tree-connector {
          width: 1.5rem;
          border-left: 2px solid var(--border);
          border-bottom: 2px solid var(--border);
          border-bottom-left-radius: 8px;
          flex-shrink: 0;
        }
        .tree-content {
          flex: 1;
          background: var(--bg-hover);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 0.625rem 0.875rem;
          transition: border-color 0.2s;
        }
        .tree-content:hover {
          border-color: var(--primary);
        }
        .tree-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.375rem;
        }
        .tree-expand {
          font-size: 0.65rem;
          color: var(--text-secondary);
        }
        .tree-emoji {
          font-size: 1rem;
        }
        .tree-session {
          font-family: 'Fira Code', monospace;
          font-size: 0.75rem;
          color: var(--text-secondary);
          flex: 1;
        }
        .tree-status {
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .tree-meta {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .tree-meta-item {
          font-size: 0.7rem;
          color: var(--text-secondary);
        }
        /* Table */
        .subagent-table-header {
          display: flex;
          padding: 0.5rem 1rem;
          background: var(--bg-hover);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .th { font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; }
        .th-subagent { flex: 2; }
        .th-parent { flex: 1.5; }
        .th-num { flex: 1; text-align: right; }
        .th-time { flex: 1.2; }
        .th-status { flex: 0.8; }
        .subagent-row {
          display: flex;
          padding: 0.5rem 1rem;
          border-bottom: 1px solid var(--border);
          font-size: 0.75rem;
          align-items: center;
          transition: background 0.15s;
        }
        .subagent-row:hover {
          background: rgba(79, 70, 229, 0.06);
        }
        .td { padding: 0.125rem 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .td-subagent { flex: 2; display: flex; align-items: center; gap: 0.375rem; font-family: 'Fira Code', monospace; font-size: 0.7rem; }
        .td-parent { flex: 1.5; font-family: 'Fira Code', monospace; font-size: 0.7rem; color: var(--text-secondary); }
        .td-num { flex: 1; text-align: right; color: var(--primary-light); font-weight: 600; font-family: 'Fira Code', monospace; }
        .td-time { flex: 1.2; color: var(--text-secondary); font-size: 0.7rem; }
        .td-status { flex: 0.8; }
        .subagent-emoji { font-size: 0.9rem; }
        .status-pill {
          display: inline-block;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.65rem;
          font-weight: 600;
        }
        .fade-in {
          animation: fadeInUp 0.4s ease-out both;
        }
      `}</style>
    </div>
  )
}

export default Subagents
