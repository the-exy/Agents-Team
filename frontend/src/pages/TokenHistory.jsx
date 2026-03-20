import { useState, useEffect, useCallback } from 'react'
import { tokenAPI, agentAPI } from '../api'

// Agent colors for chart bars
const AGENT_COLORS = [
  '#818cf8', '#f472b6', '#34d399', '#fbbf24', '#f87171',
  '#60a5fa', '#a78bfa', '#fb923c', '#2dd4bf', '#e879f9'
]

function TokenHistory() {
  const [viewMode, setViewMode] = useState('daily') // 'daily' | 'detail'
  const [loading, setLoading] = useState(false)
  const [agents, setAgents] = useState([])

  // Filter state
  const today = new Date()
  const formatDate = (d) => d.toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)))
  const [endDate, setEndDate] = useState(formatDate(today))
  const [selectedAgent, setSelectedAgent] = useState('all')

  // Data state
  const [dailyData, setDailyData] = useState([])
  const [detailData, setDetailData] = useState([])
  const [chartData, setChartData] = useState([])

  // 加载 Agent 列表
  useEffect(() => {
    agentAPI.getAgents().then(r => setAgents(r.data || [])).catch(() => setAgents([]))
  }, [])

  // 查询数据
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        startDate,
        endDate,
        ...(selectedAgent !== 'all' ? { agentId: selectedAgent } : {})
      }

      if (viewMode === 'daily') {
        const res = await tokenAPI.queryDailySummary(params)
        setDailyData(res.data || [])
        // 处理图表数据：按天聚合
        buildChartData(res.data || [])
      } else {
        const res = await tokenAPI.queryDetails({ ...params, limit: 100 })
        setDetailData(res.data || [])
      }
    } catch (error) {
      console.error('加载 Token 数据失败:', error)
      setDailyData([])
      setDetailData([])
    }
    setLoading(false)
  }, [startDate, endDate, selectedAgent, viewMode])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 构建图表数据：每日总量趋势（按 Agent 分色）
  const buildChartData = (data) => {
    // 按日期分组
    const byDate = {}
    data.forEach(item => {
      const date = item.date
      if (!byDate[date]) byDate[date] = {}
      byDate[date][item.agentId] = (byDate[date][item.agentId] || 0) + item.totalTokens
    })
    const dates = Object.keys(byDate).sort()
    // 取最后7天
    const recentDates = dates.slice(-7)
    setChartData({ byDate, dates: recentDates })
  }

  // 计算总计
  const totalTokens = dailyData.reduce((sum, d) => sum + (d.totalTokens || 0), 0)
  const totalInput = dailyData.reduce((sum, d) => sum + (d.inputTokens || 0), 0)
  const totalOutput = dailyData.reduce((sum, d) => sum + (d.outputTokens || 0), 0)

  // 格式化数字
  const fmt = (n) => {
    if (!n) return '0'
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n.toString()
  }

  // 渲染柱状图
  const renderChart = () => {
    if (!chartData.dates || chartData.dates.length === 0) return null

    // 计算每个 Agent 的颜色
    const agentIds = [...new Set(dailyData.map(d => d.agentId))]
    const agentColorMap = {}
    agentIds.forEach((id, i) => { agentColorMap[id] = AGENT_COLORS[i % AGENT_COLORS.length] })

    // 计算每日总量（用于确定高度比例）
    const dailyTotals = {}
    chartData.dates.forEach(date => {
      dailyTotals[date] = Object.values(chartData.byDate[date] || {}).reduce((a, b) => a + b, 0)
    })
    const maxTotal = Math.max(...Object.values(dailyTotals), 1)

    return (
      <div className="token-chart">
        <div className="chart-title">📊 最近 7 天 Token 消耗趋势</div>
        <div className="chart-area">
          {chartData.dates.map(date => {
            const agentsInDay = chartData.byDate[date] || {}
            const total = dailyTotals[date] || 0
            return (
              <div key={date} className="chart-bar-group">
                <div className="chart-bar-stack">
                  {Object.entries(agentsInDay).map(([agentId, tokens]) => {
                    const heightPct = (tokens / maxTotal) * 100
                    const agent = agents.find(a => a.id === agentId)
                    const color = agentColorMap[agentId]
                    return (
                      <div
                        key={agentId}
                        className="chart-bar-segment"
                        style={{
                          height: `${heightPct}%`,
                          background: color,
                        }}
                        title={`${agent?.name || agentId}: ${fmt(tokens)} tokens`}
                      />
                    )
                  })}
                </div>
                <div className="chart-bar-label">{date.slice(5)}</div>
                <div className="chart-bar-total">{fmt(total)}</div>
              </div>
            )
          })}
        </div>
        {/* 图例 */}
        <div className="chart-legend">
          {agentIds.map((id, i) => {
            const agent = agents.find(a => a.id === id)
            return (
              <div key={id} className="legend-item">
                <div className="legend-dot" style={{ background: agentColorMap[id] }} />
                <span>{agent?.emoji} {agent?.name || id}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // 渲染日汇总表格
  const renderDailyTable = () => (
    <div className="token-table">
      {/* 表头 */}
      <div className="table-header">
        <div className="th th-date">日期</div>
        <div className="th th-agent">Agent</div>
        <div className="th th-num">输入 Token</div>
        <div className="th th-num">输出 Token</div>
        <div className="th th-num">总 Token</div>
      </div>

      {/* 数据行 */}
      {dailyData.length === 0 ? (
        <div className="empty">暂无数据</div>
      ) : (
        dailyData.map((row, idx) => {
          const agent = agents.find(a => a.id === row.agentId)
          return (
            <div key={idx} className="table-row fade-in" style={{ animationDelay: `${idx * 0.03}s` }}>
              <div className="td td-date">{row.date}</div>
              <div className="td td-agent">
                <span className="agent-emoji-small">{agent?.emoji || '🤖'}</span>
                <span className="agent-name-small">{agent?.name || row.agentId}</span>
              </div>
              <div className="td td-num">{fmt(row.inputTokens)}</div>
              <div className="td td-num">{fmt(row.outputTokens)}</div>
              <div className="td td-num td-total">{fmt(row.totalTokens)}</div>
            </div>
          )
        })
      )}

      {/* 总计行 */}
      {dailyData.length > 0 && (
        <div className="table-footer">
          <div className="td td-date">合计</div>
          <div className="td td-agent">—</div>
          <div className="td td-num">{fmt(totalInput)}</div>
          <div className="td td-num">{fmt(totalOutput)}</div>
          <div className="td td-num td-total">{fmt(totalTokens)}</div>
        </div>
      )}
    </div>
  )

  // 渲染明细表格
  const renderDetailTable = () => (
    <div className="token-table">
      <div className="table-header">
        <div className="th th-session">Session</div>
        <div className="th th-channel">渠道</div>
        <div className="th th-model">模型</div>
        <div className="th th-date2">创建时间</div>
        <div className="th th-num">输入</div>
        <div className="th th-num">输出</div>
        <div className="th th-num">总量</div>
      </div>
      {detailData.length === 0 ? (
        <div className="empty">暂无数据</div>
      ) : (
        detailData.map((row, idx) => (
          <div key={idx} className="table-row fade-in" style={{ animationDelay: `${idx * 0.02}s` }}>
            <div className="td td-session" title={row.sessionKey}>{row.sessionKey?.slice(0, 12)}...</div>
            <div className="td td-channel">{row.channel || '—'}</div>
            <div className="td td-model">{row.model || '—'}</div>
            <div className="td td-date2">{row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '—'}</div>
            <div className="td td-num">{fmt(row.inputTokens)}</div>
            <div className="td td-num">{fmt(row.outputTokens)}</div>
            <div className="td td-num td-total">{fmt((row.inputTokens || 0) + (row.outputTokens || 0))}</div>
          </div>
        ))
      )}
    </div>
  )

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header">
        <h1 className="gradient-text">📈 Token 历史</h1>
        <p className="page-subtitle">追踪 Agent Token 消耗历史记录</p>
      </div>

      {/* 筛选栏 */}
      <div className="card filter-bar">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">开始日期</label>
            <input
              type="date"
              className="filter-date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">结束日期</label>
            <input
              type="date"
              className="filter-date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Agent</label>
            <select
              className="filter-select"
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
            >
              <option value="all">全部 Agent</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
              ))}
            </select>
          </div>
          <button className="refresh-btn" onClick={loadData} disabled={loading}>
            <span className="refresh-icon">🔍</span> {loading ? '查询中...' : '查询'}
          </button>
        </div>

        {/* 视图切换 */}
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'daily' ? 'active' : ''}`}
            onClick={() => setViewMode('daily')}
          >
            📅 日汇总
          </button>
          <button
            className={`toggle-btn ${viewMode === 'detail' ? 'active' : ''}`}
            onClick={() => setViewMode('detail')}
          >
            📋 明细
          </button>
        </div>
      </div>

      {/* 图表 */}
      {viewMode === 'daily' && renderChart()}

      {/* 数据表格 */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title">
            {viewMode === 'daily' ? '📅 日消耗汇总' : '📋 会话明细'}
          </h3>
          <div className="summary-badges">
            <span className="summary-badge">总输入: {fmt(totalInput)}</span>
            <span className="summary-badge">总输出: {fmt(totalOutput)}</span>
            <span className="summary-badge summary-badge-highlight">总计: {fmt(totalTokens)}</span>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {viewMode === 'daily' ? renderDailyTable() : renderDetailTable()}
        </div>
      </div>

      {/* 页面专属样式 */}
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
        .filter-bar {
          padding: 1rem 1.25rem;
        }
        .filter-row {
          display: flex;
          gap: 1rem;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .filter-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .filter-date {
          background: var(--bg-hover);
          border: 1px solid var(--border);
          border-radius: 0.375rem;
          padding: 0.375rem 0.625rem;
          color: var(--text-primary);
          font-size: 0.85rem;
          cursor: pointer;
        }
        .filter-date::-webkit-calendar-picker-indicator {
          filter: invert(0.7);
          cursor: pointer;
        }
        .filter-select {
          background: var(--bg-hover);
          border: 1px solid var(--border);
          border-radius: 0.375rem;
          padding: 0.375rem 0.625rem;
          color: var(--text-primary);
          font-size: 0.85rem;
          cursor: pointer;
          min-width: 160px;
        }
        .filter-select option {
          background: var(--bg-card);
          color: var(--text-primary);
        }
        .view-toggle {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        .toggle-btn {
          padding: 0.375rem 0.875rem;
          border-radius: 0.375rem;
          border: 1px solid var(--border);
          background: var(--bg-hover);
          color: var(--text-secondary);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .toggle-btn:hover {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }
        .toggle-btn.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }
        /* Chart */
        .token-chart {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          padding: 1rem 1.25rem;
          margin-bottom: 1rem;
        }
        .chart-title {
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: var(--text-primary);
        }
        .chart-area {
          display: flex;
          gap: 0.5rem;
          align-items: flex-end;
          height: 120px;
        }
        .chart-bar-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          gap: 0.25rem;
        }
        .chart-bar-stack {
          flex: 1;
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          gap: 1px;
        }
        .chart-bar-segment {
          width: 100%;
          min-height: 2px;
          border-radius: 2px 2px 0 0;
          opacity: 0.85;
          transition: opacity 0.2s;
        }
        .chart-bar-segment:hover {
          opacity: 1;
        }
        .chart-bar-label {
          font-size: 0.65rem;
          color: var(--text-secondary);
          white-space: nowrap;
        }
        .chart-bar-total {
          font-size: 0.6rem;
          color: var(--primary-light);
          font-weight: 600;
        }
        .chart-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.875rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border);
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }
        /* Table */
        .token-table {
          width: 100%;
        }
        .table-header {
          display: flex;
          padding: 0.625rem 1rem;
          background: var(--bg-hover);
          border-bottom: 1px solid var(--border);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .table-row {
          display: flex;
          padding: 0.625rem 1rem;
          border-bottom: 1px solid var(--border);
          font-size: 0.8rem;
          align-items: center;
          transition: background 0.15s;
        }
        .table-row:hover {
          background: rgba(79, 70, 229, 0.08);
        }
        .table-footer {
          display: flex;
          padding: 0.75rem 1rem;
          background: rgba(79, 70, 229, 0.1);
          border-top: 2px solid var(--primary);
          font-size: 0.85rem;
          font-weight: 600;
        }
        .th { color: var(--text-secondary); font-size: 0.75rem; }
        .th-date { flex: 1; }
        .th-agent { flex: 1.5; }
        .th-num { flex: 1; text-align: right; }
        .th-session { flex: 2; }
        .th-channel { flex: 1; }
        .th-model { flex: 1.5; }
        .th-date2 { flex: 1.5; }
        .td { padding: 0.25rem 0; }
        .td-date { flex: 1; color: var(--text-secondary); font-size: 0.75rem; }
        .td-agent { flex: 1.5; display: flex; align-items: center; gap: 0.5rem; }
        .td-num { flex: 1; text-align: right; color: var(--text-primary); font-family: 'Fira Code', monospace; font-size: 0.8rem; }
        .td-total { color: var(--primary-light) !important; font-weight: 600 !important; }
        .td-session { flex: 2; font-family: 'Fira Code', monospace; font-size: 0.7rem; color: var(--text-secondary); }
        .td-channel { flex: 1; font-size: 0.75rem; }
        .td-model { flex: 1.5; font-size: 0.75rem; color: var(--text-secondary); }
        .td-date2 { flex: 1.5; font-size: 0.75rem; color: var(--text-secondary); }
        .agent-emoji-small { font-size: 1rem; }
        .agent-name-small { font-size: 0.8rem; }
        .summary-badges {
          display: flex;
          gap: 0.5rem;
        }
        .summary-badge {
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          background: var(--bg-hover);
          color: var(--text-secondary);
          font-family: 'Fira Code', monospace;
        }
        .summary-badge-highlight {
          background: rgba(79, 70, 229, 0.15);
          color: var(--primary-light);
          font-weight: 600;
        }
        /* Fade in animation */
        .fade-in {
          animation: fadeInUp 0.4s ease-out both;
        }
      `}</style>
    </div>
  )
}

export default TokenHistory
