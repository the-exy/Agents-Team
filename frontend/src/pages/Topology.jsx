import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { topologyAPI } from '../api'

function Topology() {
  const [topology, setTopology] = useState({ nodes: [], links: [], stats: {} })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadTopology()
    const interval = setInterval(loadTopology, 10000)
    return () => clearInterval(interval)
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

  // 计算节点位置 - 放射状布局
  const getNodePosition = (nodeId, index, total) => {
    const centerX = 400
    const centerY = 200
    const mainRadius = 120
    const subRadius = 200
    
    if (nodeId === 'main') {
      return { x: centerX, y: 80 }
    }
    
    if (nodeId === 'system') {
      return { x: 700, y: 80 }
    }
    
    if (nodeId === 'network') {
      return { x: 700, y: 160 }
    }
    
    // Agent 子节点
    const agentNodes = topology.nodes.filter(n => 
      !['main', 'system', 'network'].includes(n.id)
    )
    const agentIndex = agentNodes.findIndex(n => n.id === nodeId)
    
    if (agentIndex === -1) {
      return { x: centerX, y: centerY }
    }
    
    // 围绕主节点分布
    const angle = (agentIndex / Math.max(agentNodes.length, 1)) * 2 * Math.PI - Math.PI / 2
    return {
      x: centerX + subRadius * Math.cos(angle),
      y: centerY + subRadius * Math.sin(angle) + 40
    }
  }

  const nodeWidth = 100
  const nodeHeight = 60

  const getLinkPath = (link) => {
    const sourceIdx = topology.nodes.findIndex(n => n.id === link.source)
    const targetIdx = topology.nodes.findIndex(n => n.id === link.target)
    if (sourceIdx === -1 || targetIdx === -1) return ''
    
    const source = topology.nodes[sourceIdx]
    const target = topology.nodes[targetIdx]
    const sourcePos = getNodePosition(source.id, sourceIdx, topology.nodes.length)
    const targetPos = getNodePosition(target.id, targetIdx, topology.nodes.length)
    
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

  const handleNodeClick = (nodeId) => {
    if (['system', 'network'].includes(nodeId)) return
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
          {/* 拓扑统计 */}
          <div className="topology-stats">
            <span>🤖 Agent: {topology.stats?.totalAgents || 0}</span>
            <span>✅ 活跃: {topology.stats?.activeAgents || 0}</span>
            <span>🌐 接口: {topology.stats?.networkInterfaces || 0}</span>
            <span>💻 {topology.stats?.hostname || 'Unknown'}</span>
          </div>
          
          <div className="topology-container">
            <svg 
              className="topology-canvas" 
              viewBox="0 0 800 400"
              style={{ width: '100%', height: 'auto', minHeight: '400px' }}
            >
              {/* 连接线 */}
              <g className="links">
                {topology.links.map((link, idx) => (
                  <path
                    key={`link-${idx}`}
                    d={getLinkPath(link)}
                    fill="none"
                    stroke={getLinkColor(link.type)}
                    strokeWidth="2"
                    strokeOpacity="0.6"
                  />
                ))}
                
                {/* 连接线标签 */}
                {topology.links.map((link, idx) => {
                  const sourceIdx = topology.nodes.findIndex(n => n.id === link.source)
                  const targetIdx = topology.nodes.findIndex(n => n.id === link.target)
                  if (sourceIdx === -1 || targetIdx === -1) return null
                  
                  const source = topology.nodes[sourceIdx]
                  const target = topology.nodes[targetIdx]
                  const sourcePos = getNodePosition(source.id, sourceIdx, topology.nodes.length)
                  const targetPos = getNodePosition(target.id, targetIdx, topology.nodes.length)
                  
                  const midX = (sourcePos.x + targetPos.x) / 2
                  const midY = (sourcePos.y + targetPos.y) / 2
                  
                  return (
                    <g key={`label-${idx}`}>
                      <rect x={midX - 18} y={midY - 8} width="36" height="16" fill="#1e293b" rx="4" />
                      <text x={midX} y={midY + 3} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="system-ui, sans-serif">
                        {getLinkLabel(link.type)}
                      </text>
                    </g>
                  )
                })}
              </g>

              {/* 节点 */}
              <g className="nodes">
                {topology.nodes.map((node, idx) => {
                  const pos = getNodePosition(node.id, idx, topology.nodes.length)
                  const isClickable = !['system', 'network'].includes(node.id)
                  
                  return (
                    <g 
                      key={node.id} 
                      style={{ cursor: isClickable ? 'pointer' : 'default' }}
                      onClick={() => handleNodeClick(node.id)}
                    >
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
                      
                      <circle
                        cx={pos.x + nodeWidth / 2 - 12}
                        cy={pos.y - nodeHeight / 2 + 10}
                        r="4"
                        fill={getStatusColor(node.status)}
                      >
                        {node.status === 'online' && (
                          <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                        )}
                      </circle>
                      
                      <text x={pos.x - nodeWidth / 2 + 12} y={pos.y + 5} fontSize="20" fontFamily="system-ui, sans-serif">
                        {node.emoji}
                      </text>
                      
                      <text x={pos.x + 5} y={pos.y + 4} fill="#e2e8f0" fontSize="11" fontWeight="500" fontFamily="system-ui, sans-serif">
                        {node.name.length > 10 ? node.name.slice(0, 10) + '...' : node.name}
                      </text>
                      
                      <text x={pos.x} y={pos.y + 18} fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="system-ui, sans-serif">
                        {node.role}
                      </text>
                      
                      {node.tokens > 0 && (
                        <text x={pos.x} y={pos.y + 30} fill="#818cf8" fontSize="7" textAnchor="middle" fontFamily="system-ui, sans-serif">
                          {node.tokens >= 1000 ? (node.tokens / 1000).toFixed(0) + 'K' : node.tokens} tokens
                        </text>
                      )}
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
              <span style={{ width: '12px', height: '3px', background: '#f59e0b', borderRadius: '2px' }}></span>
              宿主关系
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span style={{ width: '12px', height: '3px', background: '#06b6d4', borderRadius: '2px' }}></span>
              监控关系
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
            💡 点击 Agent 节点查看详情（系统节点除外）
          </p>
        </div>
      </div>
    </div>
  )
}

export default Topology
