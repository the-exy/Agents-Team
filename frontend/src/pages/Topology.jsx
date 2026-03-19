import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { topologyAPI } from '../api'

function Topology() {
  const [topology, setTopology] = useState({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadTopology()
  }, [])

  const loadTopology = async () => {
    try {
      const res = await topologyAPI.getTopology()
      setTopology(res.data)
    } catch (error) {
      console.error('加载拓扑失败:', error)
    }
    setLoading(false)
  }

  // 节点位置配置 - 与 SVG 坐标系一致
  const nodePositions = {
    main: { x: 400, y: 60 },
    backend: { x: 200, y: 180 },
    frontend: { x: 600, y: 180 },
    pm: { x: 100, y: 320 },
    db: { x: 300, y: 320 },
    test: { x: 500, y: 320 },
    ops: { x: 700, y: 320 }
  }

  // 节点尺寸
  const nodeWidth = 80
  const nodeHeight = 50

  // 生成连接线路径
  const getLinkPath = (link) => {
    const source = nodePositions[link.source]
    const target = nodePositions[link.target]
    if (!source || !target) return ''
    
    // 从源节点底部连接到目标节点顶部
    const startX = source.x
    const startY = source.y + nodeHeight / 2
    const endX = target.x
    const endY = target.y - nodeHeight / 2
    
    // 使用贝塞尔曲线
    const midY = (startY + endY) / 2
    return `M ${startX} ${startY} Q ${startX} ${midY}, ${(startX + endX) / 2} ${midY} T ${endX} ${endY}`
  }

  // 获取连接线颜色
  const getLinkColor = (type) => {
    switch (type) {
      case 'coordination': return '#818cf8'
      case 'dependency': return '#10b981'
      case 'testing': return '#f59e0b'
      default: return '#64748b'
    }
  }

  // 获取连接线标签
  const getLinkLabel = (type) => {
    switch (type) {
      case 'coordination': return '协调'
      case 'dependency': return '依赖'
      case 'testing': return '测试'
      default: return '支持'
    }
  }

  // 获取节点状态颜色
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#10b981'
      case 'idle': return '#f59e0b'
      default: return '#64748b'
    }
  }

  // 处理节点点击
  const handleNodeClick = (nodeId) => {
    navigate(`/agent/${nodeId}`)
  }

  if (loading) {
    return <div className="empty">加载中...</div>
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🌐 Agent 网络拓扑</h2>
          <button className="refresh-btn" onClick={loadTopology}>🔄 刷新</button>
        </div>
        <div className="card-body">
          <div className="topology-container">
            <svg 
              className="topology-canvas" 
              viewBox="0 0 800 420"
              style={{ width: '100%', height: 'auto', minHeight: '420px' }}
            >
              {/* 连接线 - 放在节点下面 */}
              <g className="links">
                {topology.links.map((link, idx) => (
                  <path
                    key={`link-${idx}`}
                    d={getLinkPath(link)}
                    fill="none"
                    stroke={getLinkColor(link.type)}
                    strokeWidth="2"
                    strokeOpacity="0.6"
                    strokeDasharray={link.type === 'dependency' ? '5,3' : 'none'}
                  />
                ))}
                
                {/* 连接线标签 */}
                {topology.links.map((link, idx) => {
                  const source = nodePositions[link.source]
                  const target = nodePositions[link.target]
                  if (!source || !target) return null
                  const midX = (source.x + target.x) / 2
                  const midY = (source.y + target.y) / 2
                  return (
                    <g key={`label-${idx}`}>
                      {/* 标签背景 */}
                      <rect
                        x={midX - 18}
                        y={midY - 8}
                        width="36"
                        height="16"
                        fill="#1e293b"
                        rx="4"
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        fill="#94a3b8"
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="system-ui, sans-serif"
                      >
                        {getLinkLabel(link.type)}
                      </text>
                    </g>
                  )
                })}
              </g>

              {/* 节点 - 统一在 SVG 中渲染 */}
              <g className="nodes">
                {topology.nodes.map(node => {
                  const pos = nodePositions[node.id]
                  if (!pos) return null
                  return (
                    <g 
                      key={node.id} 
                      className="topo-node"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleNodeClick(node.id)}
                    >
                      {/* 节点背景 */}
                      <rect
                        x={pos.x - nodeWidth / 2}
                        y={pos.y - nodeHeight / 2}
                        width={nodeWidth}
                        height={nodeHeight}
                        fill="#1e293b"
                        rx="8"
                        stroke={getStatusColor(node.status)}
                        strokeWidth="2"
                      />
                      {/* 状态指示灯 */}
                      <circle
                        cx={pos.x + nodeWidth / 2 - 12}
                        cy={pos.y - nodeHeight / 2 + 10}
                        r="4"
                        fill={getStatusColor(node.status)}
                      >
                        <animate
                          attributeName="opacity"
                          values="1;0.5;1"
                          dur="2s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      {/* Emoji 图标 */}
                      <text
                        x={pos.x - nodeWidth / 2 + 12}
                        y={pos.y + 5}
                        fontSize="20"
                        fontFamily="system-ui, sans-serif"
                      >
                        {node.emoji}
                      </text>
                      {/* 节点名称 */}
                      <text
                        x={pos.x + 5}
                        y={pos.y + 4}
                        fill="#e2e8f0"
                        fontSize="11"
                        fontWeight="500"
                        fontFamily="system-ui, sans-serif"
                      >
                        {node.name.length > 8 ? node.name.slice(0, 8) + '...' : node.name}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>

          {/* 图例 */}
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span style={{ width: '12px', height: '3px', background: '#818cf8', borderRadius: '2px' }}></span>
              协调关系
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span style={{ width: '12px', height: '3px', background: '#10b981', borderRadius: '2px' }}></span>
              依赖关系
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span style={{ width: '12px', height: '3px', background: '#f59e0b', borderRadius: '2px' }}></span>
              测试关系
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span style={{ width: '12px', height: '3px', background: '#64748b', borderRadius: '2px' }}></span>
              支持关系
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8', marginLeft: '1rem' }}>
              <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span>
              在线
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '50%' }}></span>
              空闲
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span style={{ width: '8px', height: '8px', background: '#64748b', borderRadius: '50%' }}></span>
              离线
            </div>
          </div>
          
          <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
            💡 点击节点可查看 Agent 详情
          </p>
        </div>
      </div>
    </div>
  )
}

export default Topology
