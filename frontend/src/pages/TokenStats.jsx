import { useState, useEffect, useCallback } from 'react'
import { tokenStatsAPI } from '../api'

function TokenStats() {
  const [data, setData] = useState({ daily: [], summary: {} })
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  // 日期范围：默认最近7天
  const getDefaultDates = () => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 6)
    return {
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0]
    }
  }

  const [dates, setDates] = useState(getDefaultDates)

  const fetchData = useCallback(async () => {
    try {
      const res = await tokenStatsAPI.getTokenStats(dates)
      setData(res.data)
      setDbError(false)
      setLastUpdated(new Date())
    } catch (error) {
      if (error.response?.status === 503) {
        setDbError(true)
      }
      console.error('加载 Token 统计失败:', error)
    }
    setLoading(false)
  }, [dates])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleDateChange = (field, value) => {
    setDates(prev => ({ ...prev, [field]: value }))
    setLoading(true)
  }

  const handleSearch = () => {
    setLoading(true)
    fetchData()
  }

  // 格式化数字
  const formatNumber = (num) => {
    if (!num && num !== 0) return '0'
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  // 计算最近14天的趋势数据（用于柱状图）
  const getTrendData = () => {
    const days = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const dayData = data.daily?.find(d => d.date === dateStr)
      days.push({
        date: dateStr,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        tokens: dayData?.total_tokens || 0
      })
    }
    return days
  }

  const trendData = getTrendData()
  const maxTokens = Math.max(...trendData.map(d => d.tokens), 1)

  if (loading && !data.daily?.length) {
    return <div className="empty">加载中...</div>
  }

  // 数据库未连接
  if (dbError) {
    return (
      <div>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title gradient-text">📊 Token 统计</h2>
          </div>
          <div className="card-body">
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              margin: '2rem 0'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗄️</div>
              <h3 style={{ color: '#f59e0b', marginBottom: '0.5rem', fontSize: '1.1rem' }}>数据库未连接</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                请确保 MySQL 服务运行中，并已执行数据库初始化脚本
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 顶部：日期选择器 */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ color: '#94a3b8', fontSize: '0.85rem' }}>开始日期:</label>
            <input
              type="date"
              value={dates.start_date}
              onChange={(e) => handleDateChange('start_date', e.target.value)}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
                padding: '0.375rem 0.75rem',
                fontSize: '0.85rem'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ color: '#94a3b8', fontSize: '0.85rem' }}>结束日期:</label>
            <input
              type="date"
              value={dates.end_date}
              onChange={(e) => handleDateChange('end_date', e.target.value)}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
                padding: '0.375rem 0.75rem',
                fontSize: '0.85rem'
              }}
            />
          </div>
          <button className="refresh-btn" onClick={handleSearch}>
            🔍 查询
          </button>
          <button className="refresh-btn" onClick={fetchData}>
            🔄 刷新
          </button>
          {lastUpdated && (
            <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: 'auto' }}>
              最后更新: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* 总览卡片 */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1rem' }}>
        <div className="stat-card stat-card-primary">
          <div className="stat-card-bg"></div>
          <div className="stat-label">💰 总 Token</div>
          <div className="stat-value primary">{formatNumber(data.summary?.total_tokens)}</div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-card-bg"></div>
          <div className="stat-label">📥 总输入</div>
          <div className="stat-value success">{formatNumber(data.summary?.total_input_tokens)}</div>
        </div>
        <div className="stat-card stat-card-warning">
          <div className="stat-card-bg"></div>
          <div className="stat-label">📤 总输出</div>
          <div className="stat-value warning">{formatNumber(data.summary?.total_output_tokens)}</div>
        </div>
        <div className="stat-card stat-card-active">
          <div className="stat-card-bg"></div>
          <div className="stat-label">💬 总会话数</div>
          <div className="stat-value">{formatNumber(data.summary?.total_sessions)}</div>
        </div>
      </div>

      {/* 趋势图表：最近14天 */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title gradient-text">📈 最近14天 Token 使用趋势</h3>
        </div>
        <div className="card-body">
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '4px',
            height: '160px',
            padding: '1rem 0.5rem'
          }}>
            {trendData.map((day, idx) => {
              const heightPct = (day.tokens / maxTokens) * 100
              return (
                <div key={day.date} style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <div
                    title={`${day.label}: ${formatNumber(day.tokens)} tokens`}
                    style={{
                      width: '100%',
                      height: `${Math.max(heightPct, 2)}%`,
                      background: idx === trendData.length - 1 ? '#818cf8' : '#3b82f6',
                      borderRadius: '4px 4px 0 0',
                      opacity: idx === trendData.length - 1 ? 1 : 0.6,
                      transition: 'all 0.3s'
                    }}
                  />
                  <span style={{
                    fontSize: '0.6rem',
                    color: idx === trendData.length - 1 ? '#e2e8f0' : '#64748b'
                  }}>
                    {day.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 每日明细表格 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title gradient-text">📋 每日明细</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {data.daily && data.daily.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1e293b', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>日期</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>Agent</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>输入 Token</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>输出 Token</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>总 Token</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>会话数</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map((row, idx) => (
                  <tr key={`${row.date}-${row.agent_id || idx}`} style={{
                    borderBottom: idx < data.daily.length - 1 ? '1px solid #1e293b' : 'none'
                  }}>
                    <td style={{ padding: '0.625rem 1rem', color: '#e2e8f0', fontSize: '0.85rem' }}>{row.date}</td>
                    <td style={{ padding: '0.625rem 1rem', color: '#e2e8f0', fontSize: '0.85rem', textAlign: 'right' }}>
                      {row.agent_name || row.agent_id || '未知'}
                    </td>
                    <td style={{ padding: '0.625rem 1rem', color: '#10b981', fontSize: '0.85rem', textAlign: 'right' }}>
                      {formatNumber(row.input_tokens)}
                    </td>
                    <td style={{ padding: '0.625rem 1rem', color: '#818cf8', fontSize: '0.85rem', textAlign: 'right' }}>
                      {formatNumber(row.output_tokens)}
                    </td>
                    <td style={{ padding: '0.625rem 1rem', color: '#f59e0b', fontSize: '0.85rem', textAlign: 'right', fontWeight: 600 }}>
                      {formatNumber(row.total_tokens)}
                    </td>
                    <td style={{ padding: '0.625rem 1rem', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'right' }}>
                      {row.session_count || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty" style={{ padding: '2rem' }}>暂无数据</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TokenStats
