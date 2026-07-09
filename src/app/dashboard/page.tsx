'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const DEMO_PROJECTS = [
  { id: 'demo-1', name: '2008 Financial Crisis', icon: '📈', sourceCount: 2 },
  { id: 'demo-2', name: 'Satyam Scam — Case Study', icon: '⚖️', sourceCount: 2 },
  { id: 'demo-3', name: 'World War II Timeline', icon: '🌍', sourceCount: 2 },
]

type DBProject = {
  id: string
  name: string
  icon: string
  created_at: string
  updated_at: string
  starred: boolean
  deleted_at: string | null
  sourceCount?: number
}

type SidebarView = 'dashboard' | 'recent' | 'starred' | 'all' | 'trash'

// ── Greeting ──────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning 🌅'
  if (hour < 17) return 'Good afternoon ☀️'
  if (hour < 21) return 'Good evening 🌙'
  return 'Good night 🌙'
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: '#FFFEFB', border: '1px solid #DFD2BC',
      borderRadius: 12, padding: 18,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EDE3D3', marginBottom: 14, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 14, borderRadius: 6, background: '#EDE3D3', marginBottom: 8, width: '70%', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 11, borderRadius: 6, background: '#EDE3D3', marginBottom: 16, width: '40%', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 1, background: '#DFD2BC', marginBottom: 12 }} />
      <div style={{ height: 11, borderRadius: 6, background: '#EDE3D3', width: '50%', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default function DashboardPage() {
  const [search, setSearch]             = useState('')
  const [projects, setProjects]         = useState<DBProject[]>([])
  const [loading, setLoading]           = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newName, setNewName]           = useState('')
  const [renamingId, setRenamingId]     = useState<string | null>(null)
  const [renameValue, setRenameValue]   = useState('')
  const [menuOpenId, setMenuOpenId]     = useState<string | null>(null)
  const [activeView, setActiveView]     = useState<SidebarView>('dashboard')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => { loadProjects() }, [])

  useEffect(() => {
    if (!menuOpenId) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-project-menu]')) setMenuOpenId(null)
    }
    const timer = setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClickOutside) }
  }, [menuOpenId])

  async function loadProjects() {
    setLoading(true)
    const { data: projectsData, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) { console.error('Error loading projects:', error); setLoading(false); return }

    const projectsWithCounts = await Promise.all(
      (projectsData || []).map(async (p) => {
        const { count } = await supabase
          .from('sources')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', p.id)
        return { ...p, sourceCount: count || 0 }
      })
    )
    setProjects(projectsWithCounts)
    setLoading(false)
  }

  // ── Filtered views ────────────────────────────────────────────────────────────
  const activeProjects  = projects.filter(p => !p.deleted_at)
  const trashedProjects = projects.filter(p => !!p.deleted_at)

  function getViewProjects(): DBProject[] {
    let list: DBProject[] = []
    if (activeView === 'trash') {
      list = trashedProjects
    } else if (activeView === 'starred') {
      list = activeProjects.filter(p => p.starred)
    } else if (activeView === 'recent') {
      list = [...activeProjects]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 6)
    } else {
      list = activeProjects
    }
    if (!search.trim()) return list
    return list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  }

  const viewProjects  = getViewProjects()
  const totalSources  = activeProjects.reduce((sum, p) => sum + (p.sourceCount || 0), 0)

  // ── View labels ───────────────────────────────────────────────────────────────
  const viewConfig: Record<SidebarView, { title: string; empty: string }> = {
    dashboard: { title: 'Your Projects',    empty: 'No projects yet.' },
    recent:    { title: 'Recently Updated', empty: 'No recent projects.' },
    starred:   { title: 'Starred Projects', empty: 'No starred projects yet. Star a project to pin it here.' },
    all:       { title: 'All Projects',     empty: 'No projects yet.' },
    trash:     { title: 'Trash',            empty: 'Trash is empty.' },
  }

  // ── Actions ───────────────────────────────────────────────────────────────────
  async function createProject() {
    if (!newName.trim()) return
    const { error } = await supabase
      .from('projects')
      .insert({ name: newName.trim(), icon: '📁', starred: false, deleted_at: null })
      .select().single()
    if (error) { alert('Error creating project: ' + error.message); return }
    setNewName(''); setShowNewModal(false); loadProjects()
  }

  async function renameProject(projectId: string) {
    if (!renameValue.trim()) return
    await supabase.from('projects').update({ name: renameValue.trim() }).eq('id', projectId)
    setRenamingId(null); setRenameValue(''); loadProjects()
  }

  async function toggleStar(projectId: string, current: boolean) {
    await supabase.from('projects').update({ starred: !current }).eq('id', projectId)
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, starred: !current } : p))
  }

  async function softDelete(projectId: string) {
    await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', projectId)
    setMenuOpenId(null); loadProjects()
  }

  async function restoreProject(projectId: string) {
    await supabase.from('projects').update({ deleted_at: null }).eq('id', projectId)
    loadProjects()
  }

  async function permanentDelete(projectId: string) {
    await supabase.from('projects').delete().eq('id', projectId)
    setDeleteConfirmId(null); loadProjects()
  }

  function timeAgo(dateStr: string) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  // ── Sidebar item ──────────────────────────────────────────────────────────────
  function SidebarItem({ view, icon, label, count }: {
    view: SidebarView; icon: string; label: string; count?: number
  }) {
    const active = activeView === view
    return (
      <div
        onClick={() => setActiveView(view)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 10px', borderRadius: 7, fontSize: 13, cursor: 'pointer', marginBottom: 1,
          background: active ? '#F0DCC8' : 'transparent',
          color: active ? '#A8693F' : '#7A6B57',
          fontWeight: active ? 600 : 400,
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#E8DDD0' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {icon} {label}
        </span>
        {count !== undefined && count > 0 && (
          <span style={{ fontSize: 10, background: active ? '#A8693F' : '#C9B896', color: 'white', borderRadius: 99, padding: '1px 6px', fontWeight: 700 }}>
            {count}
          </span>
        )}
      </div>
    )
  }

  // ── Project card ──────────────────────────────────────────────────────────────
  function ProjectCard({ id, name, icon, sourceCount, updatedLabel, isDemo, starred, isTrashed }: {
    id: string; name: string; icon: string; sourceCount: number
    updatedLabel: string; isDemo?: boolean; starred?: boolean; isTrashed?: boolean
  }) {
    const isRenaming = renamingId === id
    const isMenuOpen = menuOpenId === id

    return (
      <div
        style={{
          background: '#FFFEFB',
          border: isDemo ? '1px dashed #C9B896' : '1px solid #DFD2BC',
          borderRadius: 12, padding: 18,
          cursor: isRenaming ? 'default' : 'pointer',
          transition: 'all 0.15s', position: 'relative',
        }}
        onMouseEnter={e => { if (!isRenaming) { e.currentTarget.style.borderColor = '#C9B896'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(58,46,34,0.06)' } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = isDemo ? '#C9B896' : '#DFD2BC'; e.currentTarget.style.boxShadow = 'none' }}
      >
        {/* Demo badge */}
        {isDemo && (
          <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 9, background: '#DDBA92', color: '#A8693F', padding: '2px 8px', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Demo
          </span>
        )}

        {/* Star button */}
        {!isDemo && !isTrashed && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); toggleStar(id, starred || false) }}
            title={starred ? 'Unstar' : 'Star this project'}
            style={{
              position: 'absolute', top: 12, right: isTrashed ? 12 : 36,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 15, color: starred ? '#E8A060' : '#C9B896',
              padding: 4, lineHeight: 1, transition: 'color 0.15s',
            }}
          >
            {starred ? '★' : '☆'}
          </button>
        )}

        {/* ⋯ menu — normal projects */}
        {!isDemo && !isTrashed && (
          <div data-project-menu style={{ position: 'absolute', top: 12, right: 12 }} onClick={e => e.preventDefault()}>
            <button
              onClick={e => { e.stopPropagation(); e.preventDefault(); setMenuOpenId(isMenuOpen ? null : id) }}
              style={{ background: 'transparent', border: 'none', color: '#A8997E', cursor: 'pointer', fontSize: 14, padding: 4 }}
            >
              ⋯
            </button>
            {isMenuOpen && (
              <div style={{ position: 'absolute', top: 24, right: 0, background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 8, boxShadow: '0 4px 12px rgba(58,46,34,0.12)', zIndex: 10, minWidth: 130, overflow: 'hidden' }}>
                <div
                  onClick={e => { e.stopPropagation(); e.preventDefault(); setRenamingId(id); setRenameValue(name); setMenuOpenId(null) }}
                  style={{ padding: '8px 12px', fontSize: 12, color: '#3A2E22', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EDE3D3'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >✏️ Rename</div>
                <div
                  onClick={e => { e.stopPropagation(); e.preventDefault(); toggleStar(id, starred || false) }}
                  style={{ padding: '8px 12px', fontSize: 12, color: '#3A2E22', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EDE3D3'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{starred ? '★ Unstar' : '☆ Star'}</div>
                <div
                  onClick={e => { e.stopPropagation(); e.preventDefault(); softDelete(id) }}
                  style={{ padding: '8px 12px', fontSize: 12, color: '#A8453F', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EDE3D3'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >🗑️ Move to Trash</div>
              </div>
            )}
          </div>
        )}

        {/* Trash actions */}
        {isTrashed && (
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); restoreProject(id) }}
              title="Restore"
              style={{ background: '#DFFFD8', border: '1px solid #90D8A0', borderRadius: 6, fontSize: 11, color: '#27AE60', cursor: 'pointer', padding: '3px 8px', fontWeight: 600 }}
            >↩ Restore</button>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setDeleteConfirmId(id) }}
              title="Delete permanently"
              style={{ background: '#FFD6D6', border: '1px solid #E8A0A0', borderRadius: 6, fontSize: 11, color: '#A8453F', cursor: 'pointer', padding: '3px 8px', fontWeight: 600 }}
            >✕ Delete</button>
          </div>
        )}

        {/* Icon */}
        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F0DCC8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 14 }}>
          {icon}
        </div>

        {/* Name / rename input */}
        {isRenaming ? (
          <div onClick={e => e.preventDefault()} style={{ marginBottom: 5 }}>
            <input
              autoFocus value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') renameProject(id); if (e.key === 'Escape') setRenamingId(null) }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', fontSize: 14, fontWeight: 600, color: '#3A2E22', border: '1px solid #A8693F', borderRadius: 6, padding: '4px 8px', outline: 'none', background: '#FFFEFB' }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={e => { e.stopPropagation(); renameProject(id) }} style={{ fontSize: 11, background: '#A8693F', color: 'white', border: 'none', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>Save</button>
              <button onClick={e => { e.stopPropagation(); setRenamingId(null) }} style={{ fontSize: 11, background: 'transparent', color: '#7A6B57', border: '1px solid #C9B896', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <Link href={isTrashed ? '#' : `/project/${id}`} style={{ textDecoration: 'none' }} onClick={e => isTrashed && e.preventDefault()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: isTrashed ? '#A8997E' : '#3A2E22', marginBottom: 5, paddingRight: isDemo ? 0 : 44 }}>
              {name}
            </div>
          </Link>
        )}

        <div style={{ fontSize: 11, color: '#A8997E', marginBottom: 16 }}>{updatedLabel}</div>

        <Link href={isTrashed ? '#' : `/project/${id}`} style={{ textDecoration: 'none' }} onClick={e => isTrashed && e.preventDefault()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #DFD2BC' }}>
            <span style={{ fontSize: 11, color: '#7A6B57' }}>📎 {sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>
            {!isTrashed && <span style={{ fontSize: 11, color: '#A8693F', fontWeight: 600 }}>Open →</span>}
            {isTrashed && <span style={{ fontSize: 11, color: '#A8997E' }}>In Trash</span>}
          </div>
        </Link>
      </div>
    )
  }

  // ── Empty states ──────────────────────────────────────────────────────────────
  function EmptyState() {
    if (activeView === 'trash') return (
      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#7A6B57', marginBottom: 6 }}>Trash is empty</div>
        <div style={{ fontSize: 12, color: '#A8997E' }}>Deleted projects will appear here for recovery.</div>
      </div>
    )

    if (activeView === 'starred') return (
      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>☆</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#7A6B57', marginBottom: 6 }}>No starred projects</div>
        <div style={{ fontSize: 12, color: '#A8997E' }}>Click the ☆ on any project card to star it.</div>
      </div>
    )

    if (activeProjects.length === 0) return (
      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>📚</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#3A2E22', marginBottom: 8 }}>Create your first project</div>
        <div style={{ fontSize: 13, color: '#A8997E', maxWidth: 320, margin: '0 auto 20px' }}>
          Upload PDFs, YouTube videos, or websites and let AI generate notes, flashcards, mind maps and more.
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          style={{ background: '#A8693F', color: 'white', border: 'none', borderRadius: 9, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          + Create First Project
        </button>
      </div>
    )

    return (
      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: '#A8997E', fontSize: 13 }}>
        No projects match your search.
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5EFE6', display: 'flex', fontFamily: 'inherit' }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside style={{ width: 240, background: '#EDE3D3', borderRight: '1px solid #DFD2BC', padding: '20px 0', flexShrink: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* Logo */}
        <div style={{ padding: '0 20px 18px', fontSize: 17, fontWeight: 700, color: '#3A2E22', letterSpacing: '-0.02em' }}>
          LearnNova<span style={{ color: '#A8693F' }}>.</span>AI
        </div>

        {/* User card */}
        <div style={{ margin: '0 14px 18px', background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: '#A8693F', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>U</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#3A2E22' }}>My Workspace</div>
            <div style={{ fontSize: 10, color: '#A8997E' }}>Free Plan</div>
          </div>
        </div>

        {/* Workspace nav */}
        <div style={{ padding: '4px 10px 14px' }}>
          <div style={{ fontSize: 10, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px', marginBottom: 6 }}>Workspace</div>
          <SidebarItem view="dashboard" icon="⊞" label="Dashboard" />
          <SidebarItem view="recent"    icon="◷" label="Recent"    count={activeProjects.slice(0, 6).length} />
          <SidebarItem view="starred"   icon="☆" label="Starred"   count={activeProjects.filter(p => p.starred).length} />
        </div>

        {/* Projects nav */}
        <div style={{ padding: '4px 10px 14px' }}>
          <div style={{ fontSize: 10, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px', marginBottom: 6 }}>Projects</div>
          <SidebarItem view="all"   icon="📂" label="All Projects" count={activeProjects.length} />
          <SidebarItem view="trash" icon="🗑️" label="Trash"        count={trashedProjects.length} />
        </div>

        {/* Stats at bottom */}
        <div style={{ marginTop: 'auto', padding: '14px 20px', borderTop: '1px solid #C9B896' }}>
          <div style={{ fontSize: 11, color: '#A8997E', marginBottom: 4 }}>
            {activeProjects.length} project{activeProjects.length !== 1 ? 's' : ''} · {totalSources} source{totalSources !== 1 ? 's' : ''}
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '22px 32px 0' }}>

          {/* Greeting */}
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3A2E22', letterSpacing: '-0.01em', marginBottom: 4 }}>
            {getGreeting()}
          </div>

          {/* Subtitle — only show when there are projects */}
          {activeProjects.length > 0 && (
            <div style={{ fontSize: 13, color: '#7A6B57', marginBottom: 22 }}>
              You have {activeProjects.length} active project{activeProjects.length !== 1 ? 's' : ''} · {totalSources} source{totalSources !== 1 ? 's' : ''} total
            </div>
          )}
          {activeProjects.length === 0 && (
            <div style={{ fontSize: 13, color: '#A8997E', marginBottom: 22 }}>
              Welcome to LearnNova AI — your AI-powered study workspace.
            </div>
          )}

          {/* Search + New */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
            <div style={{ flex: 1, background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 9, padding: '0 14px', height: 38, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#A8997E', fontSize: 13 }}>🔍</span>
              <input
                placeholder="Search projects..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#3A2E22', width: '100%' }}
              />
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              style={{ background: '#A8693F', color: 'white', border: 'none', borderRadius: 9, padding: '0 18px', height: 38, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + New Project
            </button>
          </div>
        </div>

        <div style={{ padding: '0 32px 32px' }}>

          {/* View title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {viewConfig[activeView].title}
              {viewProjects.length > 0 && <span style={{ marginLeft: 8, background: '#DFD2BC', borderRadius: 99, padding: '1px 7px', fontSize: 10 }}>{viewProjects.length}</span>}
            </div>
            {activeView === 'trash' && trashedProjects.length > 0 && (
              <button
                onClick={() => { if (confirm('Permanently delete ALL trashed projects? This cannot be undone.')) trashedProjects.forEach(p => permanentDelete(p.id)) }}
                style={{ fontSize: 11, color: '#A8453F', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Empty Trash
              </button>
            )}
          </div>

          {/* Project grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 32 }}>
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 32 }}>
              {viewProjects.length === 0 ? (
                <EmptyState />
              ) : (
                viewProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    icon={project.icon}
                    sourceCount={project.sourceCount || 0}
                    updatedLabel={`Updated ${timeAgo(project.updated_at)}`}
                    starred={project.starred}
                    isTrashed={!!project.deleted_at}
                  />
                ))
              )}
            </div>
          )}

          {/* Demo projects — only show on dashboard + all views */}
          {(activeView === 'dashboard' || activeView === 'all') && !search && (
            <>
              <div style={{ fontSize: 11, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Demo Projects — Try the Workflow
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                {DEMO_PROJECTS.map(project => (
                  <ProjectCard
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    icon={project.icon}
                    sourceCount={project.sourceCount}
                    updatedLabel="Sample project"
                    isDemo
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── NEW PROJECT MODAL ────────────────────────────────────────────────── */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(58,46,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowNewModal(false)}>
          <div style={{ background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 14, padding: 28, width: 400, maxWidth: 'calc(100vw - 32px)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#3A2E22', marginBottom: 6 }}>New Project</div>
            <div style={{ fontSize: 13, color: '#7A6B57', marginBottom: 20 }}>Give your project a name to get started.</div>
            <input
              placeholder="e.g. UPSC Polity Notes"
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              autoFocus
              style={{ width: '100%', background: '#EDE3D3', border: '1px solid #DFD2BC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#3A2E22', outline: 'none', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'transparent', border: '1px solid #C9B896', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#7A6B57', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createProject} style={{ background: '#A8693F', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer' }}>Create Project</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PERMANENT DELETE CONFIRM MODAL ───────────────────────────────────── */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(58,46,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setDeleteConfirmId(null)}>
          <div style={{ background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 14, padding: 24, width: 340, maxWidth: 'calc(100vw - 32px)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#3A2E22', marginBottom: 6 }}>Delete permanently?</div>
            <div style={{ fontSize: 13, color: '#7A6B57', marginBottom: 20 }}>
              This project and all its sources, notes, and flashcards will be deleted forever. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ background: 'transparent', border: '1px solid #C9B896', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#7A6B57', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => permanentDelete(deleteConfirmId)} style={{ background: '#A8453F', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer' }}>Delete Forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}