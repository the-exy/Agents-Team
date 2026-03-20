import { useState, useEffect, useCallback } from 'react'
import { modelDashboardAPI } from '../api'

// Model color palette
const MODEL_COLORS = {
  'MiniMax-M2.7': '#818cf8',
  'MiniMax-M2': '#a78bfa',
  'GPT-4': '#10b981',
  'GPT-4o': '#34d399',
  'Claude-3.5': '#f59e0b',
  'Claude-3': '#fbbf24',
  'unknown': '#64748b'
}

const getModelColor = (model) => MODEL_COLORS[model] || `#${Math.abs(model.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 0x1000000.toString(16).padStart(6, '0')}`

function ModelDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState([])
  const [currentModels, setCurrentModels] = useState([])
  const [switchHistory, setSwitchHistory] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadData = useCallback(async () => {
    try {
      const [statsRes, currentRes, historyRes] = await Promise.all([
        modelDashboardAPI.getModelStats(),
        modelDashboardAPI.getCurrentModels(),
        modelDashboardAPI.getModelHistory()
      ])

      // stats: 按 model 分组聚合
      const statsData = statsRes.data?.stats || []
      // currentModels: 各 Agent 当前模型
      const currentData = currentRes.data?.models || []
      // switchHistory: 模型切换历史
      const historyData = historyRes.data?.records || []

      setStats(statsData)
      setCurrentModels(currentData)
      setSwitchHistory(historyData)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('加载模型数据失败:', error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 8000)
    return () => clearInterval(interval)
  }, [loadData])

  // 格式化数字
  const formatNumber = (num) => {
    if (!num && num !== 0) return '0'
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  // 格式化时间
  const formatTime = (isoString) => {
    if (!isoString) return '—'
    const d = new Date(isoString)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  // 格式化时间差
  const formatTimeAgo = (isoString) => {
    if (!isoString) return '—'
    const diff = Date.now() - new Date(isoString).getTime()
    if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return `${Math.floor(diff / 86400000)}天前`
  }

  // 按 model 分组聚合 stats
  const modelGroups = stats.reduce((acc, row) => {
    const model = row.model || 'unknown'
    if (!acc[model]) {
      acc[model] = {
        model,
        totalTokens: 0,
        totalCalls: 0,
        uniqueSessions: new Set()
      }
    }
    acc[model].totalTokens += row.total_tokens || 0
    acc[model].totalCalls += row.total_calls || 0
    if (row.unique_sessions) acc[model].uniqueSessions.add(row.unique_sessions)
    return acc
  }, {})

  const modelList = Object.values(modelGroups).map(g => ({
    model: g.model,
    totalTokens: g.totalTokens,
    totalCalls: g.totalCalls,
    agentCount: g.uniqueSessions.size
  }))

  const totalTokens = modelList.reduce((sum, m) => sum + m.totalTokens, 0)
  const totalSessions = modelList.reduce((sum, m) => sum + m.totalCalls, 0)

  const pieData = modelList.map(m => ({
    model: m.model,
    tokens: m.totalTokens,
    pct: totalTokens > 0 ? ((m.totalTokens / totalTokens) * 100).toFixed(1) : 0
  }))

  if (loading) {
    return <div className="empty">加载中...</div>
  }

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header">
        <h1 className="gradient-text">🤖 模型统计仪表盘</h1>
        <p className="page-subtitle">追踪 Agent 模型使用情况、版本切换与调用量统计</p>
      </div>

      {/* 顶部统计卡片 */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
        <div className="stat-card stat-card-primary">
          <div className="stat-card-bg"></div>
          <div className="stat-label">🤖 模型种类</div>
          <div className="stat-value primary">{modelList.length}</div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-card-bg"></div>
          <div className="stat-label">📊 总 Token</div>
          <div className="stat-value success">{formatNumber(totalTokens)}</div>
        </div>
        <div className="stat-card stat-card-warning">
          <div className="stat-card-bg"></div>
          <div className="stat-label">💬 总会话数</div>
          <div className="stat-value warning">{formatNumber(totalSessions)}</div>
        </div>
        <div className="stat-card stat-card-active">
          <div className="stat-card-bg"></div>
          <div className="stat-label">🔄 在线 Agent</div>
          <div className="stat-value">{currentModels.length}</div>
          {lastUpdated && (
            <div style={{ position: 'absolute', bottom: '0.5rem', right: '0.75rem', fontSize: '0.65rem', color: '#64748b' }}>
              更新: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      <div className="content-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* 左侧：模型使用排行 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* 模型 Token 占比图 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title gradient-text">📊 模型 Token 消耗占比</h3>
              <button className="refresh-btn" onClick={loadData}>
                <span className="refresh-icon">🔄</span> 刷新
              </button>
            </div>
            <div className="card-body">
              {modelList.length === 0 ? (
                <div className="empty">暂无模型数据（表刚重建，数据可能为空）</div>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    {pieData.map((item) => (
                      <div key={item.model} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 500 }}>
                            <span style={{
                              display: 'inline-block',
                              width: '10px',
                              height: '10px',
                              borderRadius: '2px',
                              background: getModelColor(item.model),
                              marginRight: '6px'
                            }} />
                            {item.model}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            {formatNumber(item.tokens)} tokens ({item.pct}%)
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          background: '#1e293b',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${item.pct}%`,
                            height: '100%',
                            background: getModelColor(item.model),
                            borderRadius: '3px',
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 模型详细列表 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title gradient-text">📋 模型详情</h3>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {modelList.length === 0 ? (
                  <div className="empty" style={{ padding: '2rem' }}>暂无数据</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#1e293b', borderBottom: '1px solid #334155', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '0.625rem 1rem', textAlign: 'left', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>模型</th>
                        <th style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>Token</th>
                        <th style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>会话</th>
                        <th style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>Agent数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelList.map((row, idx) => (
                        <tr key={row.model} style={{
                          borderBottom: idx < modelList.length - 1 ? '1px solid #1e293b' : 'none',
                          cursor: 'pointer',
                          background: 'transparent'
                        }}>
                          <td style={{ padding: '0.625rem 1rem' }}>
                            <span style={{
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '2px',
                              background: getModelColor(row.model),
                              marginRight: '8px'
                            }} />
                            <span style={{ fontSize: '0.8rem', color: '#e2e8f0', fontFamily: 'Fira Code, monospace' }}>
                              {row.model}
                            </span>
                          </td>
                          <td style={{ padding: '0.625rem 1rem', textAlign: 'right', fontSize: '0.8rem', color: '#818cf8', fontFamily: 'Fira Code, monospace' }}>
                            {formatNumber(row.totalTokens)}
                          </td>
                          <td style={{ padding: '0.625rem 1rem', textAlign: 'right', fontSize: '0.8rem', color: '#94a3b8' }}>
                            {formatNumber(row.totalCalls)}
                          </td>
                          <td style={{ padding: '0.625rem 1rem', textAlign: 'right', fontSize: '0.8rem', color: '#10b981' }}>
                            {row.agentCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：Agent 模型映射 + 历史 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Agent 当前模型 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title gradient-text">🧭 Agent 模型映射</h3>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {currentModels.length === 0 ? (
                <div className="empty" style={{ padding: '2rem' }}>暂无 Agent 数据</div>
              ) : (
                <div>
                  {currentModels.map((agent, idx) => (
                    <div key={agent.agentId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.875rem',
                      padding: '0.75rem 1rem',
                      borderBottom: idx < currentModels.length - 1 ? '1px solid #1e293b' : 'none',
                      transition: 'background 0.15s'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '0.25rem' }}>
                          {agent.agentId}
                        </div>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.2rem 0.5rem',
                          background: `${getModelColor(agent.model || 'unknown')}20`,
                          border: `1px solid ${getModelColor(agent.model || 'unknown')}40`,
                          borderRadius: '9999px',
                          fontSize: '0.7rem',
                          color: getModelColor(agent.model || 'unknown'),
                          fontFamily: 'Fira Code, monospace'
                        }}>
                          {agent.model || 'unknown'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}>
                          {formatNumber(agent.totalTokens)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                          {agent.lastSeen ? formatTimeAgo(agent.lastSeen) : '—'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 模型切换历史 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title gradient-text">📜 模型切换历史</h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>最近活动</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {switchHistory.length === 0 ? (
                  <div className="empty" style={{ padding: '2rem' }}>暂无历史数据</div>
                ) : (
                  <div>
                    {switchHistory.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.5rem 1rem',
                        borderBottom: idx < switchHistory.length - 1 ? '1px solid #1e293b' : 'none',
                        transition: 'background 0.15s',
                        fontSize: '0.75rem'
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#e2e8f0', fontWeight: 500, marginBottom: '0.125rem' }}>
                            {item.agent_id}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.65rem' }}>
                            <span style={{
                              fontFamily: 'Fira Code, monospace',
                              color: getModelColor(item.old_model),
                              textDecoration: 'line-through',
                              opacity: 0.7
                            }}>
                              {item.old_model}
                            </span>
                            <span style={{ color: '#64748b' }}>→</span>
                            <span style={{
                              fontFamily: 'Fira Code, monospace',
                              color: getModelColor(item.new_model)
                            }}>
                              {item.new_model}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
                            {formatTime(item.switch_time)}
                          </div>
                          {item.switch_reason && (
                            <div style={{ color: '#475569', fontSize: '0.6rem', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.switch_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 模型切换时间线（全部历史） */}
      {switchHistory.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-header">
            <h3 className="card-title gradient-text">⏱️ 最近模型切换时间线</h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              共 {switchHistory.length} 条记录
            </span>
          </div>
          <div className="card-body">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '0.75rem'
            }}>
              {switchHistory.slice(0, 12).map((item, idx) => (
                <div key={`${item.id}-${idx}`} style={{
                  padding: '0.75rem',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  borderLeft: `3px solid ${getModelColor(item.new_model)}`
                }}>
                  <div style={{ fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 500, marginBottom: '0.375rem' }}>
                    {item.agent_id}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontFamily: 'Fira Code, monospace',
                      color: getModelColor(item.old_model),
                      textDecoration: 'line-through'
                    }}>
                      {item.old_model}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.65rem' }}>→</span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontFamily: 'Fira Code, monospace',
                      color: getModelColor(item.new_model)
                    }}>
                      {item.new_model}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b' }}>
                    <span>{formatTime(item.switch_time)}</span>
                    {item.switch_reason && (
                      <span style={{ color: '#818cf8', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.switch_reason}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
      `}</style>
    </div>
  )
}

export default ModelDashboard
