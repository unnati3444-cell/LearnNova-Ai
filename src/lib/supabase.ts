import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database tables
export type Project = {
  id: string
  name: string
  icon: string
  created_at: string
  updated_at: string
}

export type Source = {
  id: string
  project_id: string
  type: 'pdf' | 'youtube' | 'website' | 'document'
  name: string
  url: string | null
  content: string | null
  created_at: string
}

// One mind map per project. layout_type controls which arrangement
// (mindmap / tree / horizontal / vertical / radial) the canvas uses.
// nodes/edges store React Flow's node and edge arrays directly,
// including position, color, shape, and font-size customizations
// saved on each node's `data` field.
export type MindmapLayout = 'mindmap' | 'tree' | 'horizontal' | 'vertical' | 'radial'

export type MindmapNodeData = {
  label: string
  color?: string
  shape?: 'rectangle' | 'pill' | 'circle'
  fontSize?: number
}

export type MindmapRow = {
  id: string
  project_id: string
  layout_type: MindmapLayout
  nodes: any[] // React Flow Node[] (typed loosely here, refined in mindmap components)
  edges: any[] // React Flow Edge[]
  created_at: string
  updated_at: string
}