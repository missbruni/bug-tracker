import React from 'react'
import { supabase } from '../../supabaseClient'
import { slugifyTeamName } from '../../lib/teamScope'
import type { Product, ProductInput, TeamStats } from './model'

interface TeamMutationResult {
  error: string | null
}

export function useTeamOverview(teamIds: string[], refreshVersion = 0) {
  const [teamStats, setTeamStats] = React.useState<Record<string, TeamStats>>({})
  const [products, setProducts] = React.useState<Product[]>([])

  React.useEffect(() => {
    const loadTeamOverview = async () => {
      if (!supabase || !teamIds.length) {
        setTeamStats({})
        setProducts([])
        return
      }

      const [testersRes, sessionsRes, bugsRes, productsRes, membersRes] = await Promise.all([
        supabase.from('testers').select('team_id, active').in('team_id', teamIds),
        supabase.from('sessions').select('team_id').in('team_id', teamIds),
        supabase.from('bugs').select('team_id, reviewed').in('team_id', teamIds),
        supabase.from('products').select('id, team_id, name, slug, description, link, links').in('team_id', teamIds),
        supabase.from('team_members').select('team_id').eq('status', 'active').in('team_id', teamIds),
      ])

      const nextStats: Record<string, TeamStats> = {}
      const ensureStats = (teamId: string) => {
        if (!nextStats[teamId]) nextStats[teamId] = { testers: 0, activeTesters: 0, sessions: 0, activeBugs: 0, members: 0 }
      }

      for (const row of (testersRes.data || []) as Array<{ team_id: string; active: boolean }>) {
        ensureStats(row.team_id)
        nextStats[row.team_id].testers += 1
        if (row.active) nextStats[row.team_id].activeTesters += 1
      }
      for (const row of (sessionsRes.data || []) as Array<{ team_id: string }>) {
        ensureStats(row.team_id)
        nextStats[row.team_id].sessions += 1
      }
      for (const row of (bugsRes.data || []) as Array<{ team_id: string; reviewed: boolean }>) {
        ensureStats(row.team_id)
        if (!row.reviewed) nextStats[row.team_id].activeBugs += 1
      }
      for (const row of (membersRes.data || []) as Array<{ team_id: string }>) {
        ensureStats(row.team_id)
        nextStats[row.team_id].members += 1
      }

      setTeamStats(nextStats)
      setProducts((productsRes.data || []) as Product[])
    }

    void loadTeamOverview()
  }, [teamIds, refreshVersion])

  const addProduct = async (teamId: string, product: ProductInput): Promise<TeamMutationResult> => {
    if (!supabase) return { error: 'Database is not connected.' }
    const slug = slugifyTeamName(product.name)
    const links = product.links?.length ? product.links : []
    const { data, error } = await supabase
      .from('products')
      .insert({ team_id: teamId, name: product.name, slug, description: product.description || null, link: links[0]?.url || null, links })
      .select('id, team_id, name, slug, description, link, links')
      .single()

    if (error) return { error: error.message }
    if (data) setProducts((prev) => [...prev, data as Product])
    return { error: null }
  }

  const updateProduct = async (productId: string, product: ProductInput): Promise<TeamMutationResult> => {
    if (!supabase) return { error: 'Database is not connected.' }
    const slug = slugifyTeamName(product.name)
    const links = product.links?.length ? product.links : []
    const updates = { name: product.name, slug, description: product.description || null, link: links[0]?.url || null, links }
    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)

    if (error) return { error: error.message }
    setProducts((prev) => prev.map((existingProduct) => existingProduct.id === productId ? { ...existingProduct, ...updates } : existingProduct))
    return { error: null }
  }

  const deleteProduct = async (productId: string): Promise<TeamMutationResult> => {
    if (!supabase) return { error: 'Database is not connected.' }
    const { error } = await supabase.from('products').delete().eq('id', productId)
    if (error) return { error: error.message }
    setProducts((prev) => prev.filter((product) => product.id !== productId))
    return { error: null }
  }

  return { teamStats, products, addProduct, updateProduct, deleteProduct }
}
