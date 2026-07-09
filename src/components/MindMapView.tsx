'use client'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  ReactFlow, Background, Controls,
  Node, Edge, useNodesState, useEdgesState,
  Handle, Position, NodeProps, useReactFlow, ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

type MindMapData = { root: string; branches: { label: string; children: string[] }[] }
type LayoutType = 'tree' | 'radial' | 'balanced'

const COLOR_THEMES = [
  { name: 'Warm Brown',  root: '#A8693F', branch: ['#F0DCC8','#DCE8DC','#E8DCE4','#F5E8C8','#D8E4EC','#DDD3E8'], text: '#3A2E22' },
  { name: 'Ocean',       root: '#2C6E8C', branch: ['#D8E4EC','#D0E8E4','#D8DCEC','#E8E0D8','#DCE8D4','#E4D8E8'], text: '#1C3A48' },
  { name: 'Forest',      root: '#3D6B3D', branch: ['#DCE8DC','#E8E4D0','#D8E4E8','#E8DCDC','#E0E8D0','#DCE0E8'], text: '#23381F' },
  { name: 'Sunset',      root: '#C2562F', branch: ['#FAE0D0','#F5E8C8','#F0DCC8','#FAECE0','#F5D8C0','#FAE8D8'], text: '#5C2E1A' },
  { name: 'Monochrome',  root: '#3A2E22', branch: ['#EDE3D3','#E0D8C8','#D8D0C0','#E8E0D0','#DFD2BC','#E5DCCC'], text: '#3A2E22' },
]

const LAYOUTS: { type: LayoutType; label: string; icon: string }[] = [
  { type: 'tree',     label: 'Tree',     icon: '🌳' },
  { type: 'radial',   label: 'Radial',   icon: '☀️' },
  { type: 'balanced', label: 'Balanced', icon: '⚖️' },
]

function ExpandButton({ color, expanded, onClick }: { color: string; expanded: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} style={{ width: 22, height: 22, borderRadius: '50%', border: `1px solid ${color}`, background: '#FFFEFB', color, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 }}>
      {expanded ? '−' : '+'}
    </button>
  )
}

function AllHandles() {
  return (
    <>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
    </>
  )
}

function RootNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div onClick={() => d.onExplain?.(d.label)} style={{ background: d.color, color: 'white', padding: '14px 22px', borderRadius: 14, fontSize: 14, fontWeight: 700, textAlign: 'center', minWidth: 140, boxShadow: '0 4px 14px rgba(0,0,0,0.15)', border: '2px solid rgba(255,255,255,0.3)', cursor: 'pointer' }}>
        <AllHandles />{d.label}
      </div>
      {d.hasBranches && <ExpandButton color={d.color} expanded={d.expanded} onClick={e => { e.stopPropagation(); d.onToggle?.() }} />}
    </div>
  )
}

function BranchNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div onClick={() => d.onExplain?.(d.label)} style={{ background: d.color, color: d.textColor, padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, textAlign: 'center', minWidth: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer' }}>
        <AllHandles />{d.label}
      </div>
      {d.hasChildren && <ExpandButton color={d.color} expanded={d.expanded} onClick={e => { e.stopPropagation(); d.onToggle?.(d.branchId) }} />}
    </div>
  )
}

function ChildNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div onClick={() => d.onExplain?.(d.label)} style={{ background: '#FFFEFB', color: d.textColor, padding: '7px 12px', borderRadius: 8, fontSize: 11, textAlign: 'center', minWidth: 90, border: `1px solid ${d.color}`, cursor: 'pointer' }}>
      <AllHandles />{d.label}
    </div>
  )
}

const nodeTypes = { root: RootNode, branch: BranchNode, child: ChildNode }

function MindMapInner({ data, onExplain }: { data: MindMapData; onExplain: (label: string) => void }) {
  const [themeIndex, setThemeIndex] = useState(0)
  const [layout, setLayout] = useState<LayoutType>('tree')
  const [rootExpanded, setRootExpanded] = useState(false)
  const [expandedBranches, setExpandedBranches] = useState<Set<number>>(new Set())
  const theme = COLOR_THEMES[themeIndex]
  const { fitView, getViewport, setViewport } = useReactFlow()

  // Tracks what was last toggled so we zoom to the right nodes
  const lastActionRef = useRef<{ type: 'root' } | { type: 'branch'; id: number } | null>(null)

  // Arrow-key panning
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const step = 60
      const vp = getViewport()
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setViewport({ ...vp, x: vp.x + step }) }
      if (e.key === 'ArrowRight') { e.preventDefault(); setViewport({ ...vp, x: vp.x - step }) }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setViewport({ ...vp, y: vp.y + step }) }
      if (e.key === 'ArrowDown')  { e.preventDefault(); setViewport({ ...vp, y: vp.y - step }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [getViewport, setViewport])

  const toggleRoot = useCallback(() => {
    lastActionRef.current = { type: 'root' }
    setRootExpanded(prev => !prev)
  }, [])

  const toggleBranch = useCallback((branchId: number) => {
    lastActionRef.current = { type: 'branch', id: branchId }
    setExpandedBranches(prev => {
      const next = new Set(prev)
      if (next.has(branchId)) next.delete(branchId); else next.add(branchId)
      return next
    })
  }, [])

  const { builtNodes, builtEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const isRadial = layout === 'radial'
    const isBalanced = layout === 'balanced'

    nodes.push({
      id: 'root', type: 'root', position: { x: 0, y: 0 },
      data: { label: data.root, color: theme.root, onExplain, hasBranches: data.branches.length > 0, expanded: rootExpanded, onToggle: toggleRoot },
    })

    if (rootExpanded) {
      const branchCount = data.branches.length
      const leftCount = isBalanced ? Math.ceil(branchCount / 2) : 0
      let runningY = 0, runningYLeft = 0, runningYRight = 0

      data.branches.forEach((branch, bi) => {
        const branchId = `branch-${bi}`
        const isExpanded = expandedBranches.has(bi)
        const hasChildren = branch.children.length > 0
        const color = theme.branch[bi % theme.branch.length]
        const goesLeft = isBalanced && bi < leftCount
        let bx = 300, by = 0

        if (isRadial) {
          const angle = (2 * Math.PI * bi) / branchCount - Math.PI / 2
          const radius = Math.max(260, branchCount * 50)
          bx = Math.cos(angle) * radius
          by = Math.sin(angle) * radius
        } else if (isBalanced) {
          bx = goesLeft ? -300 : 300
          by = goesLeft ? runningYLeft : runningYRight
        } else {
          bx = 300; by = runningY
        }

        nodes.push({
          id: branchId, type: 'branch', position: { x: bx, y: by },
          data: { label: branch.label, color, textColor: theme.text, hasChildren, expanded: isExpanded, branchId: bi, onToggle: toggleBranch, onExplain },
          sourcePosition: goesLeft ? Position.Left : Position.Right,
          targetPosition: goesLeft ? Position.Right : Position.Left,
        })
        edges.push({ id: `e-root-${branchId}`, source: 'root', target: branchId, style: { stroke: color, strokeWidth: 2 }, type: (isRadial || isBalanced) ? 'default' : 'smoothstep' })

        if (isExpanded && hasChildren) {
          branch.children.forEach((child, ci) => {
            const childId = `child-${bi}-${ci}`
            let cx = 620, cy = 0
            if (isRadial) {
              const angle = (2 * Math.PI * bi) / branchCount - Math.PI / 2
              const branchRadius = Math.max(260, branchCount * 50)
              const spread = Math.min(0.5, 1.4 / branchCount)
              const childAngle = angle + (ci - (branch.children.length - 1) / 2) * spread
              cx = Math.cos(childAngle) * (branchRadius + 180)
              cy = Math.sin(childAngle) * (branchRadius + 180)
            } else if (isBalanced) {
              cx = goesLeft ? bx - 320 : bx + 320
              cy = by + (ci - (branch.children.length - 1) / 2) * 42
            } else {
              cx = 620; cy = by + (ci - (branch.children.length - 1) / 2) * 42
            }
            nodes.push({ id: childId, type: 'child', position: { x: cx, y: cy }, data: { label: child, color, textColor: theme.text, onExplain }, sourcePosition: goesLeft ? Position.Left : Position.Right, targetPosition: goesLeft ? Position.Right : Position.Left })
            edges.push({ id: `e-${branchId}-${childId}`, source: branchId, target: childId, style: { stroke: color, strokeWidth: 1.5 }, type: (isRadial || isBalanced) ? 'default' : 'smoothstep' })
          })
          const span = Math.max(branch.children.length * 42, 90)
          if (isBalanced) { if (goesLeft) runningYLeft += span; else runningYRight += span } else runningY += span
        } else {
          if (isBalanced) { if (goesLeft) runningYLeft += 90; else runningYRight += 90 } else runningY += 90
        }
      })
    }
    return { builtNodes: nodes, builtEdges: edges }
  }, [data, theme, layout, rootExpanded, expandedBranches, toggleRoot, toggleBranch, onExplain])

  const [nodes, setNodes, onNodesChange] = useNodesState(builtNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(builtEdges)

  useEffect(() => {
    setNodes(builtNodes)
    setEdges(builtEdges)
    const action = lastActionRef.current
    const t = setTimeout(() => {
      if (action?.type === 'root') {
        // Zoom to all branch nodes when root is expanded
        const branchNodes = builtNodes.filter(n => n.type === 'branch').map(n => ({ id: n.id }))
        fitView(branchNodes.length > 0 ? { nodes: branchNodes, padding: 0.35, duration: 400 } : { padding: 0.25, duration: 350 })
      } else if (action?.type === 'branch') {
        // Zoom to this branch + its children only
        const relevant = builtNodes.filter(n => n.id === `branch-${action.id}` || n.id.startsWith(`child-${action.id}-`)).map(n => ({ id: n.id }))
        fitView(relevant.length > 0 ? { nodes: relevant, padding: 0.35, duration: 400 } : { padding: 0.25, duration: 350 })
      } else {
        // Layout / theme change — fit everything
        fitView({ padding: 0.25, duration: 350 })
      }
      lastActionRef.current = null
    }, 50)
    return () => clearTimeout(t)
  }, [builtNodes, builtEdges, setNodes, setEdges, fitView])

  function downloadPNG() {
    import('html-to-image').then(({ toPng }) => {
      const el = document.querySelector('.react-flow') as HTMLElement
      if (!el) return
      toPng(el, { backgroundColor: '#F5EFE6' }).then(dataUrl => {
        const a = document.createElement('a'); a.download = 'mindmap.png'; a.href = dataUrl; a.click()
      })
    })
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#F5EFE6' }}>
      {/* Top-left controls */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 10, padding: 6 }}>
          {COLOR_THEMES.map((t, i) => (
            <button key={t.name} onClick={() => setThemeIndex(i)} title={t.name} style={{ width: 24, height: 24, borderRadius: '50%', background: t.root, cursor: 'pointer', border: themeIndex === i ? '2px solid #3A2E22' : '2px solid transparent', padding: 0 }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 10, padding: 4 }}>
          {LAYOUTS.map(l => (
            <button key={l.type} onClick={() => setLayout(l.type)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: layout === l.type ? '#A8693F' : 'transparent', color: layout === l.type ? 'white' : '#7A6B57' }}>
              <span>{l.icon}</span>{l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top-right controls */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 8 }}>
        <div style={{ background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#7A6B57' }}>
          💡 Click + to expand · Click text to ask AI
        </div>
        <button onClick={downloadPNG} style={{ background: '#A8693F', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>⬇ PNG</button>
      </div>

      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes} minZoom={0.15} maxZoom={2}
        proOptions={{ hideAttribution: true }}
        panOnScroll panActivationKeyCode={null} selectionKeyCode={null} deleteKeyCode={null} tabIndex={0}
      >
        <Background color="#DFD2BC" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

export default function MindMapView(props: { data: MindMapData; onExplain: (label: string) => void }) {
  return <ReactFlowProvider><MindMapInner {...props} /></ReactFlowProvider>
}