export type MemoryType = 'Team Rule' | 'Previous Review' | 'Architecture Decision' | 'Common Mistake'
export type Severity = 'CRITICAL' | 'WARNING' | 'SUGGESTION'

export interface TeamRule {
  id: number
  title: string
  enabled: boolean
}

export interface MemoryItem {
  id: number
  type: MemoryType
  title: string
  description: string
  source: string
  date: string
  usage: number
}

export interface ReviewIssue {
  severity: Severity
  title: string
  file: string
  line: number
  snippet: string
  why: string
  fix: string
  memoryId?: number
  memoryIds?: number[]
}

export interface ReviewRecord {
  id: number
  repository: string
  language: string
  issueCount: number
  status: string
  date: string
  critical: number
  summary: string
  issues: ReviewIssue[]
  originalCode?: string
  fixedCode?: string
  saved?: boolean
  provider?: 'Groq' | 'Local'
  lesson?: { type: MemoryType; title: string; description: string }
}

export interface AppData {
  reviews: ReviewRecord[]
  memories: MemoryItem[]
  rules: TeamRule[]
}