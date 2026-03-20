import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { topologyAPI } from '../api'

function Topology() {
  const [topology, setTopology] = useState({ nodes: [], links: [], stats: {} })
  const [loading, setLoading] = useState(true)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadTopology()
    const interval = setInterval(loadTopology, 8000)
    return () => clearInterval(interval)
  }, [])

  const loadTopology = useCallback(async () => {
    try {
      const res = await topologyAPI.getTopology()
      setTopology(res.data || { nodes: [], links: [], stats: {} })
      setLastRefresh(new Date())
    } catch (error) {
      console.error('加载拓扑失败:', error)
    }
    setLoading(false)
  }, [])

  // 计算节点位置 - 基于 backend 返回的 position 或自动布局
  const getNodePosition = (nodeId, index, total, nodes) => {
    // 优先用 backend 返回的 position
    const node = nodes.find(n => n.id === nodeId)
    if (node?.position && typeof node.position.x === 'number') {
      return node.position
    }

    const viewBoxWidth = 1000
    const viewBoxHeight = 520
    const centerX = 420
    const centerY = 240
    const mainRadius = 310

    if (nodeId === 'main') return { x: 110, y: 180 }

    const agentNodes = nodes.filter(n => n.id !== 'main')
    const agentIndex = agentNodes.findIndex(n => n.id === nodeId)
    if (agentIndex === -1) return { x: centerX, y: centerY }

    const angleStep = agentNodes.length > 0 ? (2 * Math.PI * 0.62) / agentNodes.length : 0
    const startAngle = -Math.PI * 0.38
    const angle = startAngle + agentIndex * angleStep
    return {
      x: Math.round(centerX + mainRadius * Math.cos(angle)),
      y: Math.round(centerY + mainRadius * Math.sin(angle))
    }
  }

  const nodeWidth = 130
  const nodeHeight = 76

  const getLinkPath = (link, nodes) => {
    const source = nodes.find(n => n.id === link.source)
    const target = nodes.find(n => n.id === link.target)
    if (!source || !target) return ''

    const sourcePos = getNodePosition(source.id, 0, nodes.length, nodes)
    const targetPos = getNodePosition(target.id, 0, nodes.length, nodes)

    const startX = sourcePos.x
    const startY = sourcePos.y + nodeHeight / 2
    const endX = targetPos.x
    const endY = targetPos.y - nodeHeight / 2
    const midY = (startY + endY) / 2

    return `M ${startX} ${startY} Q ${startX} ${midY}, ${(startX + endX) / 2} ${midY} T ${endX} ${endY}`
  }

  const getLinkColor = (type) => {
    switch (type) {
      case 'coordination': return '#818cf8'
      case 'dependency': return '#10b981'
      case 'host': return '#f59e0b'
      case 'monitor': return '#06b6d4'
      default: return '#64748b'
    }
  }

  const getLinkLabel = (type) => {
    switch (type) {
      case 'coordination': return '协调'
      case 'dependency': return '依赖'
      case 'host': return '宿主'
      case 'monitor': return '监控'
      default: return '连接'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#10b981'
      case 'idle': return '#f59e0b'
      default: return '#64748b'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'online': return '在线'
      case 'idle': return '空闲'
      case 'offline': return '离线'
      default: return '未知'
    }
  }

  const handleNodeClick = (nodeId) => {
    if (['system', 'network'].includes(nodeId)) return
    navigate(`/agent/${nodeId}`)
  }

  // 格式化 token
  const fmtTokens = (tokens) => {
    if (!tokens && tokens !== 0) return ''
    if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M'
    if (tokens >= 1000) return (tokens / 1000).toFixed(0) + 'K'
    return tokens.toString()
  }

  if (loading) {
    return <div className="empty">加载中...</div>
  }

  const { nodes, links, stats } = topology
  // Filter out links referencing removed virtual nodes (system/network)
  const filteredLinks = links.filter(l => !['system', 'network'].includes(l.source) && !['system', 'network'].includes(l.target))
  const viewBoxW = topology.viewBox?.width || 1000
  const viewBoxH = topology.viewBox?.height || 520

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 className="card-title gradient-text">🌐 Agent 网络拓扑</h2>
            <span style={{
              fontSize: '0.7rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              background: 'rgba(16,185,129,0.15)',
              color: '#10b981',
              border: '1px solid rgba(16,185,129,0.3)'
            }}>
              🟢 {stats?.activeAgents || 0} 活跃
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {lastRefresh && (
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                🔄 {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button className="refresh-btn" onClick={loadTopology}>
              <span className="refresh-icon">🔄</span> 刷新
            </button>
          </div>
        </div>
        <div className="card-body">
          {/* 拓扑统计条 */}
          <div className="topology-stats" style={{
            display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
            padding: '0.625rem 1rem',
            background: 'rgba(30,41,59,0.8)',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: '#94a3b8' }}>🤖 <strong style={{ color: '#e2e8f0' }}>{stats?.totalAgents || 0}</strong> Agent</span>
            <span style={{ color: '#94a3b8' }}>✅ <strong style={{ color: '#10b981' }}>{stats?.activeAgents || 0}</strong> 活跃</span>
            <span style={{ color: '#94a3b8' }}>🌐 <strong style={{ color: '#e2e8f0' }}>{stats?.networkInterfaces || 0}</strong> 网卡</span>
            <span style={{ color: '#94a3b8' }}>💻 <strong style={{ color: '#e2e8f0' }}>{stats?.hostname || 'Unknown'}</strong></span>
            <span style={{ color: '#94a3b8' }}>📊 CPU <strong style={{ color: '#818cf8' }}>{stats?.cpu?.toFixed?.(1) || 0}%</strong></span>
            <span style={{ color: '#94a3b8' }}>🧠 内存 <strong style={{ color: '#f59e0b' }}>{stats?.memory?.toFixed?.(1) || 0}%</strong></span>
          </div>

          {/* 拓扑 SVG */}
          <div className="topology-container" style={{ position: 'relative' }}>
            {/* Grid background */}
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <pattern id="topo-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                </pattern>
                <radialGradient id="topo-glow-green" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="topo-glow-blue" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </radialGradient>
                <filter id="glow-filter">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#64748b" opacity="0.6" />
                </marker>
              </defs>
              <rect width="100%" height="100%" fill="url(#topo-grid)" />
            </svg>

            {/* Main topology SVG */}
            <svg
              className="topology-canvas"
              viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
              style={{ width: '100%', height: 'auto', minHeight: '520px', display: 'block' }}
            >
              {/* Connection lines */}
              <g className="links">
                {filteredLinks.map((link, idx) => {
                  const color = getLinkColor(link.type)
                  const pathD = getLinkPath(link, nodes)
                  if (!pathD) return null

                  return (
                    <g key={`link-${idx}`}>
                      {/* Glow */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeOpacity="0.12"
                        strokeLinecap="round"
                      />
                      {/* Main line */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
                        strokeOpacity="0.5"
                        strokeLinecap="round"
                        strokeDasharray="7 4"
                      />
                      {/* Arrow */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
                        strokeOpacity="0.4"
                        strokeLinecap="round"
                        markerEnd="url(#arrowhead)"
                      />
                      {/* Animated particle */}
                      <circle r="3.5" fill="#fff" opacity="0.9" filter="url(#glow-filter)">
                        <animateMotion
                          dur={`${2.2 + idx * 0.35}s`}
                          repeatCount="indefinite"
                          path={pathD}
                        />
                      </circle>
                    </g>
                  )
                })}

                {/* Link labels */}
                {filteredLinks.map((link, idx) => {
                  const sourceNode = nodes.find(n => n.id === link.source)
                  const targetNode = nodes.find(n => n.id === link.target)
                  if (!sourceNode || !targetNode) return null

                  const sourcePos = getNodePosition(sourceNode.id, 0, nodes.length, nodes)
                  const targetPos = getNodePosition(targetNode.id, 0, nodes.length, nodes)
                  const midX = (sourcePos.x + targetPos.x) / 2
                  const midY = (sourcePos.y + targetPos.y) / 2
                  const color = getLinkColor(link.type)

                  return (
                    <g key={`label-${idx}`}>
                      <rect
                        x={midX - 18}
                        y={midY - 9}
                        width="36"
                        height="18"
                        fill="#1e293b"
                        rx="4"
                        stroke={color}
                        strokeWidth="0.5"
                        strokeOpacity="0.4"
                      />
                      <text
                        x={midX}
                        y={midY + 4}
                        fill={color}
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="system-ui, sans-serif"
                        fontWeight="600"
                      >
                        {getLinkLabel(link.type)}
                      </text>
                    </g>
                  )
                })}
              </g>

              {/* Nodes */}
              <g className="nodes">
                {nodes.map((node, idx) => {
                  const pos = getNodePosition(node.id, idx, nodes.length, nodes)
                  const isClickable = !['system', 'network'].includes(node.id)
                  const isOnline = node.status === 'online'
                  const isIdle = node.status === 'idle'
                  const statusColor = getStatusColor(node.status)
                  const isHovered = hoveredNode === node.id

                  return (
                    <g
                      key={node.id}
                      style={{ cursor: isClickable ? 'pointer' : 'default' }}
                      onClick={() => handleNodeClick(node.id)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className={`topo-node-group ${isOnline ? 'online' : ''}`}
                    >
                      {/* Glow effect */}
                      {isOnline && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r="60"
                          fill="url(#topo-glow-green)"
                          className="node-glow-anim"
                        />
                      )}
                      {isIdle && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r="50"
                          fill="url(#topo-glow-blue)"
                          opacity="0.3"
                        />
                      )}

                      {/* Node card background */}
                      <rect
                        x={pos.x - nodeWidth / 2}
                        y={pos.y - nodeHeight / 2}
                        width={nodeWidth}
                        height={nodeHeight}
                        fill="#1e293b"
                        rx="10"
                        ry="10"
                        stroke={isHovered ? '#818cf8' : statusColor}
                        strokeWidth={isOnline ? "2.5" : isHovered ? "2" : "1.5"}
                        strokeOpacity={isOnline ? 0.9 : 0.6}
                        filter={isHovered ? 'url(#glow-filter)' : undefined}
                      />

                      {/* Status indicator */}
                      <circle
                        cx={pos.x + nodeWidth / 2 - 14}
                        cy={pos.y - nodeHeight / 2 + 13}
                        r={isOnline ? "7" : "5"}
                        fill={statusColor}
                        stroke="#1e293b"
                        strokeWidth="1.5"
                      >
                        {isOnline && (
                          <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
                        )}
                      </circle>

                      {/* Pulse ring for online */}
                      {isOnline && (
                        <circle
                          cx={pos.x + nodeWidth / 2 - 14}
                          cy={pos.y - nodeHeight / 2 + 13}
                          r="13"
                          fill="none"
                          stroke={statusColor}
                          strokeWidth="1.5"
                          opacity="0.4"
                        >
                          <animate attributeName="r" values="9;16;9" dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                        </circle>
                      )}

                      {/* Emoji */}
                      <text x={pos.x - nodeWidth / 2 + 14} y={pos.y + 5} fontSize="22" fontFamily="system-ui, sans-serif">
                        {node.emoji}
                      </text>

                      {/* Agent name */}
                      <text
                        x={pos.x + 6}
                        y={pos.y + 4}
                        fill="#e2e8f0"
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="system-ui, sans-serif"
                      >
                        {node.name?.length > 14 ? node.name.slice(0, 14) + '…' : node.name}
                      </text>

                      {/* Role */}
                      <text
                        x={pos.x}
                        y={pos.y + 20}
                        fill="#64748b"
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="system-ui, sans-serif"
                      >
                        {node.role}
                      </text>

                      {/* Token usage (if available) */}
                      {node.tokens > 0 && (
                        <text
                          x={pos.x}
                          y={pos.y + 34}
                          fill="#818cf8"
                          fontSize="8"
                          textAnchor="middle"
                          fontFamily="Fira Code, monospace"
                        >
                          🎯 {fmtTokens(node.tokens)} tokens
                        </text>
                      )}

                      {/* Model info (if available) */}
                      {node.model && (
                        <text
                          x={pos.x}
                          y={node.tokens > 0 ? pos.y + 46 : pos.y + 34}
                          fill="#06b6d4"
                          fontSize="7"
                          textAnchor="middle"
                          fontFamily="Fira Code, monospace"
                        >
                          ⚙️ {node.model}
                        </text>
                      )}

                      {/* Hover tooltip */}
                      {isHovered && (
                        <g>
                          <rect
                            x={pos.x - nodeWidth / 2 - 4}
                            y={pos.y + nodeHeight / 2 + 4}
                            width={nodeWidth + 8}
                            height={40}
                            fill="#0f172a"
                            rx="6"
                            stroke="#334155"
                            strokeWidth="1"
                          />
                          <text
                            x={pos.x}
                            y={pos.y + nodeHeight / 2 + 20}
                            fill="#e2e8f0"
                            fontSize="9"
                            textAnchor="middle"
                            fontFamily="system-ui, sans-serif"
                            fontWeight="600"
                          >
                            {getStatusLabel(node.status)} · ID: {node.id}
                          </text>
                          {node.tokens > 0 && (
                            <text
                              x={pos.x}
                              y={pos.y + nodeHeight / 2 + 34}
                              fill="#818cf8"
                              fontSize="8"
                              textAnchor="middle"
                              fontFamily="system-ui, sans-serif"
                            >
                              累计 {fmtTokens(node.tokens)} tokens
                            </text>
                          )}
                          {isClickable && (
                            <text
                              x={pos.x}
                              y={pos.y + nodeHeight / 2 + 42}
                              fill="#64748b"
                              fontSize="7"
                              textAnchor="middle"
                              fontFamily="system-ui, sans-serif"
                            >
                              点击查看详情 →
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', gap: '1.5rem', justifyContent: 'center',
            marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155',
            flexWrap: 'wrap', fontSize: '0.78rem'
          }}>
            {[
              { label: '协调关系', color: '#818cf8' },
              { label: '依赖关系', color: '#10b981' },
              { label: '宿主关系', color: '#f59e0b' },
              { label: '监控关系', color: '#06b6d4' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8' }}>
                <span style={{
                  width: '24px', height: '2px', background: item.color,
                  borderRadius: '2px', display: 'inline-block', position: 'relative'
                }}>
                  <span style={{
                    position: 'absolute', right: '-1px', top: '-2px',
                    width: 0, height: 0,
                    borderLeft: `5px solid ${item.color}`,
                    borderTop: '3px solid transparent',
                    borderBottom: '3px solid transparent'
                  }} />
                </span>
                {item.label}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '1rem', marginLeft: '0.5rem' }}>
              {[
                { label: '在线', color: '#10b981', pulse: true },
                { label: '空闲', color: '#f59e0b', pulse: false },
                { label: '离线', color: '#64748b', pulse: false }
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8' }}>
                  <span style={{
                    width: '10px', height: '10px', background: item.color,
                    borderRadius: '50%', display: 'inline-block',
                    boxShadow: item.pulse ? `0 0 6px ${item.color}` : 'none'
                  }} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: '#475569' }}>
            💡 点击 Agent 节点查看详情（系统/网络节点除外）· 自动刷新间隔 8 秒
          </p>
        </div>
      </div>

      <style>{`
        .topology-stats span {
          transition: color 0.2s;
        }
        .topology-container {
          position: relative;
          border-radius: 0.5rem;
          overflow: hidden;
          background: #0f172a;
        }
        .topo-node-group {
          transition: all 0.2s;
        }
        .topo-node-group:hover rect:first-of-type {
          filter: brightness(1.1);
        }
        .node-glow-anim {
          animation: topoGlow 3s ease-in-out infinite;
        }
        @keyframes topoGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default Topology
