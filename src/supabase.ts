import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const configured = Boolean(url && key)
export const supabase = createClient(url || 'http://localhost', key || 'missing')

export type Role = 'parent' | 'child'
export type BudgetKind = 'family' | 'personal' | 'kid'
export type Section = 'plan' | 'daily' | 'asset' | 'savings' | 'income' | 'expense'
export type Kind = 'income' | 'expense' | 'deposit' | 'withdrawal' | null

export interface Profile {
  id: string
  email: string
  display_name: string
  role: Role
  budget_id: string
}
export interface Budget {
  id: string
  slug: string
  name: string
  kind: BudgetKind
  sort_order: number
}
export interface Entry {
  id: string
  budget_id: string
  section: Section
  kind: Kind
  grp: string
  category: string
  description: string
  amount: number
  entry_date: string
}

const fmt = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })
export const money = (n: number) => fmt.format(n || 0)
export const today = () => new Date().toISOString().slice(0, 10)
export const thisMonth = () => today().slice(0, 7)
