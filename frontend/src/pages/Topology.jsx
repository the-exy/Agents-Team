import { useState, useEffect } from 'react'
import { topologyAPI } from '../api'

function Topology() {
  const [topology, setTopology] = useState({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)

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

  // 节点位置配置
  const nodePositions = {
    main: { x: 400, y: 50 },
    backend: { x: 200, y: 180 },
    frontend: { x: 600, y: 180 },
    pm: { x: 100, y: 300 },
    db: { x: 300, y: 300 },
    test: { x: 500, y: 300 },
    ops: { x: 700, y: 300 }
  }

  const getLinkPath = (link) => {
    const source = nodePositions[link.source]
    const target = nodePositions[link.target]
    if (!source || !target) return ''
    
    const midX = (source.x + target.x) / 2
    const midY = (source.y + target.y) / 2
    return `M ${source.x} ${source.y + 30} Q ${midX} ${midY} ${target.x} ${target.y - 30}`
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
            <svg className="topology-canvas" viewBox="0 0 800 400">
              {/* 连接线 */}
              {topology.links.map((link, idx) => (
                <path
                  key={idx}
                  d={getLinkPath(link)}
                  fill="none"
                  stroke={link.type === 'coordination' ? '#818cf8' : link.type === 'dependency' ? '#10b981' : link.type === 'testing' ? '#f59e0b' : '#64748b'}
                  strokeWidth="2"
                  strokeOpacity="0.6"
                />
              ))}
              
              {/* 连接线标签 */}
              {topology.links.map((link, idx) => {
                const source = nodePositions[link.source]
                const target = nodePositions[link.target]
                if (!source || !target) return null
                const midX = (source.x + target.x) / 2
                const midY = (source.y + target.y) / 2 + 30
                return (
                  <text
                    key={`label-${idx}`}
                    x={midX}
                    y={midY}
                    fill="#64748b"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {link.type === 'coordination' ? '协调' : link.type === 'dependency' ? '依赖' : link.type === 'testing' ? '测试' : '支持'}
                  </text>
                )
              })}
            </svg>

            {/* 节点 */}
            {topology.nodes.map(node => {
              const pos = nodePositions[node.id]
              if (!pos) return null
              return (
                <div
                  key={node.id}
                  className={`topo-node ${node.status}`}
                  style={{ left: pos.x - 40, top: pos.y - 30 }}
                >
                  <div className="topo-emoji">{node.emoji}</div>
                  <span className="topo-name">{node.name}</span>
                </div>
              )
            })}
          </div>

          {/* 图例 */}
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ width: '12px', height: '3px', background: '#818cf8', borderRadius: '2px' }}></span>
              协调关系
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ width: '12px', height: '3px', background: '#10b981', borderRadius: '2px' }}></span>
              依赖关系
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ width: '12px', height: '3px', background: '#f59e0b', borderRadius: '2px' }}></span>
              测试关系
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ width: '12px', height: '3px', background: '#64748b', borderRadius: '2px' }}></span>
              支持关系
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Topology
