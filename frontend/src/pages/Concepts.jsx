import { useState, useEffect } from 'react'
import { subagentAPI } from '../api'

function Concepts() {
  const [subagents, setSubagents] = useState([])

  useEffect(() => {
    loadSubagents()
  }, [])

  const loadSubagents = async () => {
    try {
      const res = await subagentAPI.getSubagents()
      setSubagents(res.data || [])
    } catch (e) {
      // ignore
    }
  }

  return (
    <div>
      {/* 页面标题 */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h2 className="card-title gradient-text">📖 OpenClaw Agent 工作模式说明</h2>
        </div>
        <div className="card-body">
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            了解 OpenClaw 中两种不同的 Agent 工作模式，以及 agent-monitor 平台如何监控它们。
          </p>
        </div>
      </div>

      {/* 两种模式对比 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Multi-Agent 模式 */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title gradient-text">🔄 Multi-Agent（多 Agent）</h3>
            <span style={{
              fontSize: '0.7rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981'
            }}>
              独立进程
            </span>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>定义</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>
                多个独立运行的 Agent 进程，各自在 <code>openclaw.json</code> 的 <code>agents.list</code> 中配置，拥有独立的工作空间和身份。
              </p>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>核心特点</h4>
              <ul style={{ fontSize: '0.8rem', color: 'var(--text-primary)', paddingLeft: '1.2rem', margin: 0 }}>
                <li>每个 Agent 是独立进程</li>
                <li>各自有独立的 sessions.json</li>
                <li>各自有独立的工作空间 workspace</li>
                <li>可有独立的飞书账号/机器人</li>
                <li>通过飞书消息或 sessions_send 通信</li>
                <li>主 Agent（main）负责协调</li>
              </ul>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>现有 Agent</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {[
                  { emoji: '🤖', name: 'main', role: '协调者' },
                  { emoji: '⚙️', name: 'backend', role: '后端开发' },
                  { emoji: '🎨', name: 'frontend', role: '前端开发' },
                  { emoji: '📋', name: 'pm', role: '产品经理' },
                  { emoji: '🗄️', name: 'db', role: '数据库' },
                  { emoji: '🧪', name: 'test', role: '测试' },
                  { emoji: '🔧', name: 'ops', role: '运维' },
                  { emoji: '💻', name: 'codex', role: '编程助手' }
                ].map(agent => (
                  <div key={agent.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.3rem 0.6rem',
                    background: 'var(--bg-hover)',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem'
                  }}>
                    <span>{agent.emoji}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{agent.name}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{agent.role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>通信方式</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', background: 'var(--bg-hover)', padding: '0.75rem', borderRadius: '0.5rem', fontFamily: 'monospace' }}>
                main → backend：sessions_send() 或飞书消息<br/>
                main → pm：sessions_send() 或飞书消息<br/>
                backend ↔ frontend：通过 main 协调
              </div>
            </div>
          </div>
        </div>

        {/* SubAgent 模式 */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title gradient-text">⚡ SubAgent（子 Agent）</h3>
            <span style={{
              fontSize: '0.7rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              background: 'rgba(251, 191, 36, 0.15)',
              color: '#fbbf24'
            }}>
              临时会话
            </span>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>定义</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>
                通过 <code>sessions_spawn()</code> 在主 Agent 会话内派生的临时子会话，用于并行处理复杂任务。
              </p>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>核心特点</h4>
              <ul style={{ fontSize: '0.8rem', color: 'var(--text-primary)', paddingLeft: '1.2rem', margin: 0 }}>
                <li>不是独立进程，是主会话的子任务</li>
                <li>共享主 Agent 的工作空间</li>
                <li>用于并行处理复杂任务</li>
                <li>任务完成后自动结束</li>
                <li>结果汇总到主会话返回</li>
                <li>类似 fork() 进程模式</li>
              </ul>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>调用方式</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', background: 'var(--bg-hover)', padding: '0.75rem', borderRadius: '0.5rem', fontFamily: 'monospace' }}>
                /subagents spawn [任务描述]<br/>
                sessions_spawn(&#123; task: "...", mode: "run" &#125;)
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>工作示例</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', background: 'var(--bg-hover)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                <div style={{ marginBottom: '0.3rem' }}>用户："做一个博客系统"</div>
                <div style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>
                  → spawn subagent "后端开发" 处理 API<br/>
                  → spawn subagent "前端开发" 处理页面<br/>
                  → main 汇总结果返回
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 对比表格 */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title gradient-text">📊 模式对比</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>对比项</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#10b981', fontWeight: 600 }}>Multi-Agent</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#fbbf24', fontWeight: 600 }}>SubAgent</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['进程类型', '独立进程', '主会话的子任务'],
                ['生命周期', '常驻运行', '任务级临时'],
                ['工作空间', '各自独立', '共享主 Agent'],
                ['通信方式', 'sessions_send / 飞书', '直接函数调用'],
                ['适用场景', '长期专业分工', '短期并行任务'],
                ['状态持久化', 'sessions.json 独立', '随主会话结束'],
                ['监控可见性', '✅ agent-monitor 完全支持', '⚠️ 通过主会话间接反映']
              ].map(([item, multi, sub], idx) => (
                <tr key={item} style={{ borderBottom: idx < 6 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{item}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>{multi}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>{sub}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* agent-monitor 平台能力 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title gradient-text">🖥️ agent-monitor 平台能力</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {[
              { emoji: '✅', title: 'Multi-Agent 完全支持', desc: '实时监控所有独立 Agent 的状态、Token、会话、拓扑关系' },
              { emoji: '✅', title: 'Token 持久化', desc: 'MySQL 记录每日 Token 消耗，支持按日期查询明细和趋势' },
              { emoji: '✅', title: '网络拓扑可视化', desc: '动态展示 Agent 间通信关系和依赖' },
              { emoji: '⚠️', title: 'SubAgent 追踪（规划中）', desc: '通过主会话记录间接反映，暂不支持独立监控' },
              { emoji: '✅', title: '会话历史', desc: '查看所有 Agent 的历史会话记录' },
              { emoji: '✅', title: '任务管理', desc: '统一查看和管理多 Agent 关联的任务' }
            ].map(item => (
              <div key={item.title} style={{
                padding: '1rem',
                background: 'var(--bg-hover)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>{item.emoji}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Concepts
