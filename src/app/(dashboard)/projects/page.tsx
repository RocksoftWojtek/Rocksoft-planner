import { createClient } from '@/lib/supabase/server'
import ProjectsClient from './ProjectsClient'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: projects } = await supabase.from('projects').select('*').order('name')

  return <ProjectsClient initialProjects={projects ?? []} />
}
