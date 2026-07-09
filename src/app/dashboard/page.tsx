'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const DEMO_PROJECTS = [
  { id: 'demo-1', name: '2008 Financial Crisis', icon: '📈', sourceCount: 4 },
  { id: 'demo-2', name: 'Satyam Scam — Case Study', icon: '⚖️', sourceCount: 3 },
  { id: 'demo-3', name: 'World War II Timeline', icon: '🌍', sourceCount: 5 },
]

type DBProject = {
  id: string
  name: string
  icon: string
  created_at: string
  updated_at: string
  sourceCount?: number
}

export default function DashboardPage() {
  const [search, setSearch] = useState('')
  const [projects, setProjects] = useState<DBProject[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (!menuOpenId) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-project-menu]')) {
        setMenuOpenId(null)
      }
    }
    // Delay attaching the listener so the click that opened the menu doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [menuOpenId])

  async function loadProjects() {
    setLoading(true)
    const { data: projectsData, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error loading projects:', error)
      setLoading(false)
      return
    }

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

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  async function createProject() {
    if (!newName.trim()) return
    const { error } = await supabase
      .from('projects')
      .insert({ name: newName.trim(), icon: '📁' })
      .select()
      .single()

    if (error) {
      alert('Error creating project: ' + error.message)
      return
    }

    setNewName('')
    setShowNewModal(false)
    loadProjects()
  }

  async function renameProject(projectId: string) {
    if (!renameValue.trim()) return
    const { error } = await supabase
      .from('projects')
      .update({ name: renameValue.trim() })
      .eq('id', projectId)

    if (error) {
      alert('Error renaming project: ' + error.message)
      return
    }
    setRenamingId(null)
    setRenameValue('')
    loadProjects()
  }

  async function deleteProject(projectId: string) {
    if (!confirm('Delete this project and all its sources? This cannot be undone.')) return
    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    if (error) {
      alert('Error deleting project: ' + error.message)
      return
    }
    setMenuOpenId(null)
    loadProjects()
  }

  function timeAgo(dateStr: string) {
    const date = new Date(dateStr)
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const totalSources = projects.reduce((sum, p) => sum + (p.sourceCount || 0), 0)

  function ProjectCard({ id, name, icon, sourceCount, updatedLabel, isDemo }: {
    id: string, name: string, icon: string, sourceCount: number, updatedLabel: string, isDemo?: boolean
  }) {
    const isRenaming = renamingId === id
    const isMenuOpen = menuOpenId === id

    return (
      <div
        style={{
          background: '#FFFEFB',
          border: isDemo ? '1px dashed #C9B896' : '1px solid #DFD2BC',
          borderRadius: 12, padding: 18, cursor: isRenaming ? 'default' : 'pointer', transition: 'all 0.15s',
          position: 'relative',
        }}
        onMouseEnter={e => { if (!isRenaming) { e.currentTarget.style.borderColor = '#C9B896'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(58,46,34,0.06)' } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = isDemo ? '#C9B896' : '#DFD2BC'; e.currentTarget.style.boxShadow = 'none' }}
      >
        {isDemo && (
          <span style={{
            position: 'absolute', top: 14, right: 14, fontSize: 9, background: '#DDBA92', color: '#A8693F',
            padding: '2px 8px', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>Demo</span>
        )}

        {!isDemo && (
          <div data-project-menu style={{ position: 'absolute', top: 12, right: 12 }} onClick={e => e.preventDefault()}>
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMenuOpenId(isMenuOpen ? null : id) }}
              style={{ background: 'transparent', border: 'none', color: '#A8997E', cursor: 'pointer', fontSize: 14, padding: 4 }}
            >
              ⋯
            </button>
            {isMenuOpen && (
              <div
                style={{
                  position: 'absolute', top: 24, right: 0, background: '#FFFEFB', border: '1px solid #DFD2BC',
                  borderRadius: 8, boxShadow: '0 4px 12px rgba(58,46,34,0.12)', zIndex: 10, minWidth: 110, overflow: 'hidden',
                }}
              >
                <div
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setRenamingId(id); setRenameValue(name); setMenuOpenId(null) }}
                  style={{ padding: '8px 12px', fontSize: 12, color: '#3A2E22', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EDE3D3'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  ✏️ Rename
                </div>
                <div
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); deleteProject(id) }}
                  style={{ padding: '8px 12px', fontSize: 12, color: '#A8453F', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EDE3D3'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  🗑️ Delete
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{
          width: 38, height: 38, borderRadius: 10, background: '#F0DCC8',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 14,
        }}>
          {icon}
        </div>

        {isRenaming ? (
          <div onClick={e => e.preventDefault()} style={{ marginBottom: 5 }}>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') renameProject(id); if (e.key === 'Escape') setRenamingId(null) }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', fontSize: 14, fontWeight: 600, color: '#3A2E22', border: '1px solid #A8693F',
                borderRadius: 6, padding: '4px 8px', outline: 'none', background: '#FFFEFB',
              }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={(e) => { e.stopPropagation(); renameProject(id) }} style={{ fontSize: 11, background: '#A8693F', color: 'white', border: 'none', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>Save</button>
              <button onClick={(e) => { e.stopPropagation(); setRenamingId(null) }} style={{ fontSize: 11, background: 'transparent', color: '#7A6B57', border: '1px solid #C9B896', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <Link href={`/project/${id}`} style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#3A2E22', marginBottom: 5, paddingRight: isDemo ? 0 : 20 }}>{name}</div>
          </Link>
        )}

        <div style={{ fontSize: 11, color: '#A8997E', marginBottom: 16 }}>{updatedLabel}</div>

        <Link href={`/project/${id}`} style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #DFD2BC' }}>
            <span style={{ fontSize: 11, color: '#7A6B57' }}>📎 {sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>
            <span style={{ fontSize: 11, color: '#A8693F', fontWeight: 600 }}>Open →</span>
          </div>
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5EFE6', display: 'flex', fontFamily: 'inherit' }}>

      <aside style={{
        width: 240, background: '#EDE3D3', borderRight: '1px solid #DFD2BC',
        padding: '20px 0', flexShrink: 0, minHeight: '100vh',
      }}>
        <div style={{ padding: '0 20px 18px', fontSize: 17, fontWeight: 700, color: '#3A2E22', letterSpacing: '-0.02em' }}>
          LearnNova<span style={{ color: '#A8693F' }}>.</span>AI
        </div>

        <div style={{
          margin: '0 14px 18px', background: '#FFFEFB', border: '1px solid #DFD2BC',
          borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, background: '#A8693F', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600,
          }}>U</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#3A2E22' }}>Unnati's Workspace</div>
            <div style={{ fontSize: 10, color: '#A8997E' }}>Free Plan</div>
          </div>
        </div>

        <div style={{ padding: '4px 10px 14px' }}>
          <div style={{ fontSize: 10, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px', marginBottom: 6 }}>
            Workspace
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 7,
            fontSize: 13, color: '#A8693F', fontWeight: 600, background: '#F0DCC8', marginBottom: 1, cursor: 'pointer',
          }}>⊞ Dashboard</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 7, fontSize: 13, color: '#7A6B57', cursor: 'pointer', marginBottom: 1 }}>◷ Recent</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 7, fontSize: 13, color: '#7A6B57', cursor: 'pointer' }}>☆ Starred</div>
        </div>

        <div style={{ padding: '4px 10px 14px' }}>
          <div style={{ fontSize: 10, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px', marginBottom: 6 }}>
            Projects
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 7, fontSize: 13, color: '#7A6B57', cursor: 'pointer', marginBottom: 1 }}>📂 All Projects</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 7, fontSize: 13, color: '#7A6B57', cursor: 'pointer' }}>🗑️ Trash</div>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '22px 32px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3A2E22', letterSpacing: '-0.01em', marginBottom: 4 }}>
            Good evening, Unnati 🌙
          </div>
          <div style={{ fontSize: 13, color: '#7A6B57', marginBottom: 22 }}>
            You have {projects.length} active project{projects.length !== 1 ? 's' : ''} · {totalSources} source{totalSources !== 1 ? 's' : ''} total
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
            <div style={{
              flex: 1, background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 9,
              padding: '0 14px', height: 38, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ color: '#A8997E', fontSize: 13 }}>🔍</span>
              <input
                placeholder="Search projects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#3A2E22', width: '100%' }}
              />
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              style={{
                background: '#A8693F', color: 'white', border: 'none', borderRadius: 9,
                padding: '0 18px', height: 38, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              + New Project
            </button>
          </div>
        </div>

        <div style={{ padding: '0 32px 32px' }}>
          <div style={{ fontSize: 11, color: '#A8997E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Your Projects
          </div>

          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#A8997E', fontSize: 13 }}>
              Loading projects...
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 32 }}>
              {filtered.map(project => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  name={project.name}
                  icon={project.icon}
                  sourceCount={project.sourceCount || 0}
                  updatedLabel={`Updated ${timeAgo(project.updated_at)}`}
                />
              ))}

              {filtered.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: '#A8997E', fontSize: 13 }}>
                  No projects yet. Create your first one above!
                </div>
              )}
            </div>
          )}

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
        </div>
      </main>

      {showNewModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(58,46,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            style={{ background: '#FFFEFB', border: '1px solid #DFD2BC', borderRadius: 14, padding: 28, width: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: '#3A2E22', marginBottom: 6 }}>New Project</div>
            <div style={{ fontSize: 13, color: '#7A6B57', marginBottom: 20 }}>Give your project a name to get started.</div>
            <input
              placeholder="e.g. UPSC Polity Notes"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              autoFocus
              style={{
                width: '100%', background: '#EDE3D3', border: '1px solid #DFD2BC', borderRadius: 8,
                padding: '10px 12px', fontSize: 13, color: '#3A2E22', outline: 'none', marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewModal(false)}
                style={{ background: 'transparent', border: '1px solid #C9B896', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#7A6B57', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                style={{ background: '#A8693F', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer' }}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}