import { createClient } from '@/lib/supabase/server'
import PeopleClient from './PeopleClient'

export const dynamic = 'force-dynamic'

export default async function PeoplePage() {
  const supabase = await createClient()
  const [{ data: people }, { data: allocations }] = await Promise.all([
    supabase.from('team_members').select('*').order('full_name'),
    supabase.from('allocations').select('*'),
  ])

  return <PeopleClient initialPeople={people ?? []} initialAllocations={allocations ?? []} />
}
