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

  // 动态计算节点位置 - 根据节点数量和类型
  const getNodePosition = (nodeId, index, totalNodes) => {
    const centerX = 400
    const centerY = 200
    const radius = 150
    
    // 主节点在中心
    if (nodeId === 'main') {
      return { x: centerX, y: 80 }
    }
    
    // 系统节点在右上
    if (nodeId === 'system' || nodeId === 'network') {
      if (nodeId === 'system') {
        return { x: 650, y: 100 }
      } else {
        return { x: 650, y: 180 }
      }
    }
    
    // 子节点围绕中心分布
    const agentNodes = topology.nodes.filter(n => n.id !== 'main' && n.id !== 'system' && n.id !== 'network')
    const agentIndex = agentNodes.findIndex(n => n.id === nodeId)
    
    if (agentIndex === -1) {
      return { x: centerX, y: centerY }
    }
    
    // 放射状分布
    const angle = (agentIndex / Math.max(agentNodes.length, 1)) * 2 * Math.PI - Math.PI / 2
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle) + 40
    }
  }

  // 节点尺寸
  const nodeWidth = 90
  const nodeHeight = 55

  // 生成连接线路径
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
    
    // 使用贝塞尔曲线
    const midY = (startY + endY) / 2
    return `M ${startX} ${startY} Q ${startX} ${midY}, ${(startX + endX) / 2} ${midY} T ${endX} ${endY}`
  }

  // 获取连接线颜色
  const getLinkColor = (type) => {
    switch (type) {
      case 'coordination': return '#818cf8'
      case 'dependency': return '#10b981'
      case 'host': return '#f59e0b'
      case 'monitor': return '#06b6d4'
      default: return '#64748b'
    }
  }

  // 获取连接线标签
  const getLinkLabel = (type) => {
    switch (type) {
      case 'coordination': return '协调'
      case 'dependency': return '依赖'
      case 'host': return '宿主'
      case 'monitor': return '监控'
      default: return '连接'
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
    if (nodeId === 'system' || nodeId === 'network') {
      return // 系统节点不跳转
    }
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
            <span>🤖 Agent数: {topology.stats?.totalAgents || 0}</span>
            <span>✅ 活跃: {topology.stats?.activeAgents || 0}</span>
            <span>🌐 网络接口: {topology.stats?.networkInterfaces || 0}</span>
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
                    strokeDasharray={link.type === 'dependency' ? '5,3' : 'none'}
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

              {/* 节点 */}
              <g className="nodes">
                {topology.nodes.map((node, idx) => {
                  const pos = getNodePosition(node.id, idx, topology.nodes.length)
                  const isClickable = node.id !== 'system' && node.id !== 'network'
                  
                  return (
                    <g 
                      key={node.id} 
                      className={`topo-node ${isClickable ? 'clickable' : ''}`}
                      style={{ cursor: isClickable ? 'pointer' : 'default' }}
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
                        {node.status === 'online' && (
                          <animate
                            attributeName="opacity"
                            values="1;0.5;1"
                            dur="2s"
                            repeatCount="indefinite"
                          />
                        )}
                      </circle>
                      
                      {/* Emoji */}
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
                        {node.name.length > 9 ? node.name.slice(0, 9) + '...' : node.name}
                      </text>
                      
                      {/* 角色标签 */}
                      <text
                        x={pos.x}
                        y={pos.y + 18}
                        fill="#64748b"
                        fontSize="8"
                        textAnchor="middle"
                        fontFamily="system-ui, sans-serif"
                      >
                        {node.role}
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
            💡 点击 Agent 节点可查看详情
          </p>
        </div>
      </div>
    </div>
  )
}

export default Topology
