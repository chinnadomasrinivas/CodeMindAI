import { useEffect, useRef, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BookOpenCheck, Braces,
  BrainCircuit, Check, ChevronDown, CircleHelp, Clock3, Code2, FileClock,
  GitPullRequest, Layers3, LockKeyhole, Plus, RotateCw, Search, ShieldAlert,
  ShieldCheck, SlidersHorizontal, Sparkles, Terminal, TriangleAlert, X, Zap,
} from 'lucide-react'
import {
  BrandMark, CodeEditor, Header, LoadingAnalysis, MemoryCard, MemoryMatch,
  LiveFindings, Modal, PageHeading, ReviewIssue, ReviewTable, RuleCard, Sidebar, StatCard,
  StatusBadge, Toast,
} from './components'
import { activitySteps, defaultCode, initialData } from './data'
import type { AppData, MemoryItem, MemoryType, ReviewRecord, TeamRule } from './types'
import { analyzeCode } from './services/reviewAgent'

type RouteState = { path: string; reviewId?: number }
type ModalState = { kind: 'memory' } | { kind: 'rule'; id?: number } | null
const settingsDefaults = { team: 'Platform Engineering', repository: 'acme/backend-services', defaultLanguage: 'Python', blockCritical: true, inlineSuggestions: true, strictMode: false, autoSave: true, useMemory: true, memoryNotifications: true, reviewNotifications: true }
interface SettingsData {
  team: string
  repository: string
  defaultLanguage: string
  blockCritical: boolean
  inlineSuggestions: boolean
  strictMode: boolean
  autoSave: boolean
  useMemory: boolean
  memoryNotifications: boolean
  reviewNotifications: boolean
}
interface GeminiHealth {
  configured: boolean
  provider: string
  model: string
}
interface GeminiReviewResponse {
  provider: 'Gemini' | 'Local'
  model: string
  status: string
  criticalCount: number
  summary: string
  issues: ReviewRecord['issues']
  fixedCode: string
  lesson: NonNullable<ReviewRecord['lesson']>
}

function currentRoute(): RouteState {
  const path = window.location.pathname.replace(/\/$/, '') || '/dashboard'
  const match = path.match(/^\/review\/(\d+)$/)
  return match ? { path: '/review/:id', reviewId: Number(match[1]) } : { path }
}

function loadData(): AppData {
  try {
    const saved = localStorage.getItem('codemind-prototype-v1')
    if (saved) {
      const parsed = JSON.parse(saved) as AppData
      if (Array.isArray(parsed.reviews) && Array.isArray(parsed.memories) && Array.isArray(parsed.rules)) return parsed
    }
  } catch { /* Use the demo seed if stored prototype data is unavailable. */ }
  return structuredClone(initialData)
}

function formatToday() {
  return new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date())
}

function App() {
  const [data, setData] = useState<AppData>(loadData)
  const [route, setRoute] = useState<RouteState>(currentRoute)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [code, setCode] = useState(defaultCode)
  const [language, setLanguage] = useState('Python')
  const [reviewStage, setReviewStage] = useState(-1)
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState('')
  const [memoryTab, setMemoryTab] = useState('All Memory')
  const [historyQuery, setHistoryQuery] = useState('')
  const [reviewFilter, setReviewFilter] = useState('All reviews')
  const [settings, setSettings] = useState<SettingsData>(() => {
    try { return { ...settingsDefaults, ...JSON.parse(localStorage.getItem('codemind-settings-v1') || '{}') } }
    catch { return settingsDefaults }
  })
  const [geminiHealth, setGeminiHealth] = useState<GeminiHealth>({ configured: false, provider: 'Local checks', model: 'gemini-3.8-flash' })
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { localStorage.setItem('codemind-prototype-v1', JSON.stringify(data)) }, [data])
  useEffect(() => { localStorage.setItem('codemind-settings-v1', JSON.stringify(settings)) }, [settings])
  useEffect(() => {
    let active = true
    const checkGemini = () => fetch('/api/health').then(response => response.json()).then(status => {
      if (active) setGeminiHealth({ configured: status.configured === true, provider: status.provider ?? 'Local checks', model: status.model ?? 'gemini-3.8-flash' })
    }).catch(() => {
      if (active) setGeminiHealth({ configured: false, provider: 'Local checks', model: 'gemini-3.8-flash' })
    })
    void checkGemini()
    const healthTimer = setInterval(checkGemini, 5000)
    return () => { active = false; clearInterval(healthTimer) }
  }, [])
  useEffect(() => {
    const onPopState = () => setRoute(currentRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => () => {
    if (stageTimer.current) clearInterval(stageTimer.current)
    if (reviewTimer.current) clearTimeout(reviewTimer.current)
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('.search-wrap input')?.focus()
      }
      if (event.key === 'Escape') { setModal(null); setMobileOpen(false) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function navigate(path: string) {
    window.history.pushState({}, '', path)
    setRoute(currentRoute())
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function notify(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) { notify('Your clipboard does not contain code.'); return }
      setCode(text)
      notify('Code pasted into the editor.')
    } catch {
      notify('Clipboard access was blocked. Paste into the editor with Ctrl+V instead.')
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      notify('Code copied to the clipboard.')
    } catch {
      notify('Clipboard access was blocked by the browser.')
    }
  }

  async function createReview() {
    if (!code.trim()) { notify('Add code to the editor before starting a review.'); return }
    setReviewStage(0)
    if (stageTimer.current) clearInterval(stageTimer.current)
    if (reviewTimer.current) clearTimeout(reviewTimer.current)
    stageTimer.current = setInterval(() => setReviewStage(stage => Math.min(stage + 1, activitySteps.length - 1)), 600)
    const localAnalysis = analyzeCode({ code, language, rules: data.rules, memories: data.memories, memoryEnabled: settings.useMemory })
    const localCritical = localAnalysis.issues.some(issue => issue.severity === 'CRITICAL')
    const localResult: GeminiReviewResponse = {
      provider: 'Local', model: 'local-pattern-checks',
      status: localCritical && settings.blockCritical ? 'Needs Changes' : localAnalysis.issues.length ? 'Approved with Suggestions' : 'Approved',
      criticalCount: localAnalysis.issues.filter(issue => issue.severity === 'CRITICAL').length,
      summary: localAnalysis.summary, issues: localAnalysis.issues, fixedCode: localAnalysis.fixedCode ?? '',
      lesson: { type: 'Previous Review', title: localAnalysis.issues[0]?.title ?? 'Review decision recorded', description: localAnalysis.issues[0]?.fix ?? localAnalysis.summary },
    }
    let geminiConfigured = geminiHealth.configured
    try {
      const healthResponse = await fetch('/api/health', { cache: 'no-store' })
      if (healthResponse.ok) {
        const currentHealth = await healthResponse.json() as GeminiHealth
        geminiConfigured = currentHealth.configured === true
        setGeminiHealth(currentHealth)
      }
    } catch {
      geminiConfigured = false
    }
    let usedLocalFallback = false
    const analysisRequest = geminiConfigured
      ? fetch('/api/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, rules: data.rules, memories: data.memories, memoryEnabled: settings.useMemory, blockCritical: settings.blockCritical }),
      }).then(async response => {
        const payload = await response.json()
        if (response.status === 429) {
          usedLocalFallback = true
          return localResult
        }
        if (!response.ok) throw new Error(payload.error ?? 'Gemini review failed. Check the server configuration.')
        return payload as GeminiReviewResponse
      })
      : Promise.resolve(localResult)
    try {
      const [analysis] = await Promise.all([analysisRequest, new Promise(resolve => { reviewTimer.current = setTimeout(resolve, 3300) })])
      if (stageTimer.current) clearInterval(stageTimer.current)
      const nextId = Math.max(...data.reviews.map(item => item.id), 42) + 1
      const issues = analysis.issues
      const critical = analysis.criticalCount
      const matchedIds = [...new Set(issues.flatMap(issue => [...(issue.memoryIds ?? []), ...(issue.memoryId === undefined ? [] : [issue.memoryId])]))]
      const matchedMemory = data.memories.find(item => matchedIds.includes(item.id))
      const result: ReviewRecord = {
        id: nextId, repository: 'Submitted code', language, issueCount: issues.length,
        status: analysis.status,
        date: 'Today', critical,
        summary: analysis.summary,
        issues,
        fixedCode: analysis.fixedCode || localAnalysis.fixedCode || undefined,
        provider: analysis.provider,
        lesson: analysis.lesson ?? {
          type: matchedMemory?.type ?? 'Common Mistake',
          title: matchedMemory?.title ?? issues[0]?.title ?? 'Review decision recorded',
          description: matchedMemory?.description ?? issues[0]?.fix ?? analysis.summary,
        },
      }
      setData(current => ({
        ...current,
        reviews: [result, ...current.reviews],
        memories: current.memories.map(memory => matchedIds.includes(memory.id) ? { ...memory, usage: memory.usage + 1 } : memory),
      }))
      setReviewStage(-1)
      navigate(`/review/${nextId}`)
      if (usedLocalFallback) notify('Gemini quota reached. Review completed with local checks instead.')
    } catch (error) {
      if (stageTimer.current) clearInterval(stageTimer.current)
      setReviewStage(-1)
      notify(error instanceof Error ? error.message : 'Gemini review failed. Try again.')
    }
  }

  function saveDecision(review: ReviewRecord) {
    if (review.saved) { notify('This review decision is already in Agent Memory.'); return }
    const lesson = review.lesson ?? {
      type: 'Previous Review' as MemoryType,
      title: review.issues[0]?.title ?? 'Review decision recorded',
      description: review.issues[0]?.fix ?? 'Decision captured from a completed review.',
    }
    const item: MemoryItem = {
      id: Date.now(), type: lesson.type, title: lesson.title, description: lesson.description,
      source: `PR #${review.id}`, date: formatToday(), usage: 1,
    }
    setData(current => ({
      ...current,
      memories: [item, ...current.memories],
      reviews: current.reviews.map(entry => entry.id === review.id ? { ...entry, saved: true } : entry),
    }))
    notify('Decision saved. CodeMind will use it in future reviews.')
  }

  function applyFix(review: ReviewRecord) {
    if (!review.fixedCode) { notify('There is no automatic fix available for this review.'); return }
    setCode(review.fixedCode)
    setLanguage(review.language)
    navigate('/review')
    notify('Suggested fix loaded into the editor. Review it before using.')
  }

  const filteredReviews = data.reviews.filter(review => {
    const matchesQuery = `${review.id} ${review.repository} ${review.language} ${review.status}`.toLowerCase().includes(historyQuery.toLowerCase())
    const matchesFilter = reviewFilter === 'All reviews' || (reviewFilter === 'Needs changes' ? review.status === 'Needs Changes' : review.status !== 'Needs Changes')
    return matchesQuery && matchesFilter
  })

  return <div className="app-shell min-h-screen text-slate-100">
    <Sidebar path={route.path} navigate={navigate} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} geminiConfigured={geminiHealth.configured} model={geminiHealth.model} />
    <div className="main-column">
      <Header path={route.path} navigate={path => { if (search.trim()) setHistoryQuery(search); navigate(path) }} search={search} setSearch={setSearch} onMenu={() => setMobileOpen(true)} />
      <main className="main-content">
        {route.path === '/dashboard' && <Dashboard data={data} navigate={navigate} />}
        {route.path === '/review' && <ReviewWorkspace code={code} setCode={setCode} language={language} setLanguage={setLanguage} data={data} reviewStage={reviewStage} onRun={createReview} onClear={() => setCode('')} onPaste={pasteFromClipboard} onCopy={() => copyToClipboard(code)} navigate={navigate} memoryEnabled={settings.useMemory} geminiConfigured={geminiHealth.configured} model={geminiHealth.model} />}
        {route.path === '/review/:id' && <ReviewResults review={data.reviews.find(item => item.id === route.reviewId)} memories={data.memories} onBack={() => navigate('/review')} onApply={applyFix} onSave={saveDecision} onDismiss={notify} />}
        {route.path === '/memory' && <MemoryPage memories={data.memories} activeTab={memoryTab} setActiveTab={setMemoryTab} openAdd={() => setModal({ kind: 'memory' })} />}
        {route.path === '/rules' && <RulesPage rules={data.rules} openAdd={() => setModal({ kind: 'rule' })} onToggle={id => setData(current => ({ ...current, rules: current.rules.map(rule => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule) }))} onEdit={id => setModal({ kind: 'rule', id })} onDelete={id => { setData(current => ({ ...current, rules: current.rules.filter(rule => rule.id !== id) })); notify('Team rule removed.') }} />}
        {route.path === '/history' && <HistoryPage reviews={filteredReviews} query={historyQuery} setQuery={setHistoryQuery} filter={reviewFilter} setFilter={setReviewFilter} navigate={navigate} />}
        {route.path === '/settings' && <SettingsPage settings={settings} setSettings={setSettings} notify={notify} geminiHealth={geminiHealth} />}
        {!['/dashboard', '/review', '/review/:id', '/memory', '/rules', '/history', '/settings'].includes(route.path) && <NotFound navigate={navigate} />}
      </main>
      <footer className="app-footer"><BrandMark compact /><span>Team-aware code review, shaped by your decisions.</span><a href="https://github.com" onClick={event => event.preventDefault()}>Prototype environment</a></footer>
    </div>
    {modal && <AppModal modal={modal} data={data} setData={setData} onClose={() => setModal(null)} notify={notify} />}
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </div>
}

function Dashboard({ data, navigate }: { data: AppData; navigate: (path: string) => void }) {
  const totalIssues = data.reviews.reduce((sum, review) => sum + review.issueCount, 0) + 96
  return <div className="page dashboard-page">
       <section className="dashboard-hero"><div className="hero-copy"><div className="hero-kicker"><span className="health-dot" />YOUR TEAM'S REVIEW AGENT</div><h1>Your team's AI<br /><span>code reviewer.</span></h1><p>An AI Code Review Agent that learns your team's coding standards.</p><div className="hero-actions"><button className="button-primary" onClick={() => navigate('/review')}><Plus size={16} />New code review<ArrowRight size={15} /></button><button className="button-quiet" onClick={() => navigate('/memory')}><BrainCircuit size={16} />Explore team memory</button></div><div className="hero-proof"><span><ShieldCheck size={14} />Team-aware by design</span><span><LockKeyhole size={13} />Private by default</span></div></div><div className="hero-visual"><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="visual-core"><BrandMark compact /><div className="core-pulse" /></div><div className="floating-node node-rule"><span><ShieldCheck size={13} /></span>Team rules</div><div className="floating-node node-memory"><span><BrainCircuit size={13} /></span>Past decisions</div><div className="floating-node node-code"><span><Code2 size={13} /></span>New code</div><div className="hero-visual-caption"><span className="health-dot" />Agent memory active</div></div><div className="hero-grid-lines" /></section>
    <section className="stats-grid"><StatCard label="Total reviews" value={data.reviews.length + 38} change="↑ 12 this week" icon={GitPullRequest} tone="stat-violet" /><StatCard label="Issues caught" value={totalIssues} change="Across 10 repositories" icon={ShieldAlert} tone="stat-rose" /><StatCard label="Memory items" value={data.memories.length + 136} change="↑ 8 learned this month" icon={BrainCircuit} tone="stat-blue" /><StatCard label="Team rules" value={data.rules.length} change={`${data.rules.filter(rule => rule.enabled).length} active standards`} icon={BookOpenCheck} tone="stat-teal" /></section>
    <div className="dashboard-columns"><section className="surface recent-panel"><div className="section-heading"><div><div className="eyebrow">THE LATEST</div><h2>Recent reviews</h2></div><button className="text-action" onClick={() => navigate('/history')}>View history<ArrowRight size={14} /></button></div><ReviewTable reviews={data.reviews.slice(0, 4)} onOpen={id => navigate(`/review/${id}`)} /><div className="recent-footer"><span><Clock3 size={14} />Last synced just now</span><button onClick={() => navigate('/history')}>All reviews <ArrowRight size={14} /></button></div></section><section className="surface insights-panel"><div className="section-heading"><div><div className="eyebrow">YOUR TEAM'S KNOWLEDGE</div><h2>Memory insights</h2></div><button className="square-action" aria-label="Open memory" onClick={() => navigate('/memory')}><ArrowUpRight size={16} /></button></div><div className="insight-feature"><div className="insight-ring"><span><BrainCircuit size={19} /></span></div><div><strong>{data.memories.length + 136}</strong><span>memories available to your agent</span></div></div><div className="insight-list"><div><span className="insight-dot violet-dot" /><span>Team rules</span><strong>{data.rules.length}</strong></div><div><span className="insight-dot blue-dot" /><span>Architecture decisions</span><strong>{data.memories.filter(item => item.type === 'Architecture Decision').length + 4}</strong></div><div><span className="insight-dot amber-dot" /><span>Recurring issue patterns</span><strong>8</strong></div></div><button className="insight-link" onClick={() => navigate('/memory')}>Explore Agent Memory <ArrowRight size={14} /></button></section></div>
    <section className="agent-note"><span className="note-icon"><Sparkles size={16} /></span><p><strong>Reviews with context.</strong> CodeMind compares new code against 8 previous review decisions before it recommends a change.</p><button onClick={() => navigate('/memory')}>How memory works<ArrowRight size={13} /></button></section>
  </div>
}

function ReviewWorkspace({ code, setCode, language, setLanguage, data, reviewStage, onRun, onClear, onPaste, onCopy, navigate, memoryEnabled, geminiConfigured, model }: { code: string; setCode: (value: string) => void; language: string; setLanguage: (value: string) => void; data: AppData; reviewStage: number; onRun: () => void; onClear: () => void; onPaste: () => void; onCopy: () => void; navigate: (path: string) => void; memoryEnabled: boolean; geminiConfigured: boolean; model: string }) {
  if (reviewStage >= 0) return <div className="page review-loading-page"><LoadingAnalysis stage={reviewStage} steps={activitySteps} /></div>
  const rules = data.rules.filter(rule => rule.enabled).slice(0, 5)
  const decisions = memoryEnabled ? data.memories.filter(item => item.type === 'Previous Review').slice(0, 3) : []
  const architecture = memoryEnabled ? data.memories.filter(item => item.type === 'Architecture Decision').slice(0, 3) : []
  const liveAnalysis = analyzeCode({ code, language, rules: data.rules, memories: data.memories, memoryEnabled })
  return <div className="page review-page"><PageHeading eyebrow="CODE REVIEW AGENT" title="Submit code for review" subtitle="Give your code a review grounded in how your team works." action={<div className={`agent-status ${geminiConfigured ? '' : 'agent-local'}`}><span className="health-dot" />{geminiConfigured ? `Gemini key loaded · ${model}` : 'Local checks only'}</div>} />
    <div className="review-workspace"><div className="editor-column"><div className="editor-caption"><div><span className="editor-caption-icon"><Terminal size={15} /></span><span><strong>Review your changes</strong><small>Paste a snippet or edit the sample below</small></span></div><button className="button-quiet small-quiet" onClick={onClear}><RotateCw size={14} />Clear</button></div><CodeEditor code={code} setCode={setCode} language={language} setLanguage={setLanguage} onReview={onRun} onPaste={onPaste} onCopy={onCopy} /><LiveFindings issues={liveAnalysis.issues} hasCode={Boolean(code.trim())} /><div className="review-submit-row"><div className="editor-hint"><span>⌘</span><span>Enter</span><span>to review</span></div><button className="button-primary" onClick={onRun}><Sparkles size={16} />{geminiConfigured ? 'Review with Gemini' : 'Review code'}<ArrowRight size={15} /></button></div><div className="privacy-note"><LockKeyhole size={13} />{geminiConfigured ? `Submitting sends code and enabled team context to Google Gemini (${model}).` : 'Gemini is not configured; this review uses local checks only.'}</div></div>
      <aside className="context-panel"><div className="context-heading"><div className="context-icon"><BrainCircuit size={17} /></div><div><h2>Review context</h2><span>What your agent already knows</span></div><span className={`context-live ${memoryEnabled ? '' : 'context-paused'}`}><i />{memoryEnabled ? 'LIVE' : 'PAUSED'}</span></div><div className="context-block"><div className="context-label"><span className="context-label-dot violet-dot" />TEAM RULES<span>{rules.length}</span></div>{rules.map(rule => <div className="context-item" key={rule.id}><Check size={12} />{rule.title}</div>)}<button className="context-more" onClick={() => navigate('/rules')}>View all team rules<ArrowRight size={12} /></button></div><div className="context-block"><div className="context-label"><span className="context-label-dot blue-dot" />PREVIOUS REVIEWS<span>{decisions.length}</span></div>{decisions.map(item => <div className="context-memory" key={item.id}><strong>{item.source}</strong><span>{item.title}</span></div>)}</div><div className="context-block context-last"><div className="context-label"><span className="context-label-dot teal-dot" />ARCHITECTURE DECISIONS<span>{architecture.length}</span></div>{architecture.map(item => <div className="context-memory" key={item.id}><strong>{item.title}</strong><span>{item.source} · used {item.usage} times</span></div>)}</div><div className="context-bottom"><span className="context-avatar"><BrainCircuit size={15} /></span><span>{memoryEnabled ? <>Context is retrieved from <strong>{data.memories.length} memory items</strong></> : 'Team memory is paused in settings'}</span></div></aside></div>
  </div>
}

function ReviewResults({ review, memories, onBack, onApply, onSave, onDismiss }: { review?: ReviewRecord; memories: MemoryItem[]; onBack: () => void; onApply: (review: ReviewRecord) => void; onSave: (review: ReviewRecord) => void; onDismiss: (message: string) => void }) {
  const [dismissedReviewId, setDismissedReviewId] = useState<number | null>(null)
  if (!review) return <div className="page"><PageHeading title="Review not found" subtitle="This review may have been removed from local prototype data." action={<button className="button-primary" onClick={onBack}>Back to code review</button>} /></div>
  const matchIds = [...new Set(review.issues.flatMap(issue => [...(issue.memoryIds ?? []), ...(issue.memoryId === undefined ? [] : [issue.memoryId])]))]
  const matches = memories.filter(item => matchIds.includes(item.id))
  const passed = review.issues.length === 0
  return <div className="page results-page"><div className="results-back"><button className="back-link" onClick={onBack}><ArrowDownRight size={14} />Back to code review</button><span>Review <i>/</i> PR #{review.id}</span></div><div className="results-title-row"><div><div className="eyebrow">CODE REVIEW AGENT <span className="eyebrow-slash">/</span> COMPLETED JUST NOW</div><h1>Code Review Complete</h1><p>{review.repository} <span>·</span> {review.language} <span>·</span> {review.issueCount} findings</p></div><StatusBadge status={passed ? 'Approved' : review.status} /></div><section className={`result-summary ${passed ? 'summary-passed' : ''}`}><div className="summary-icon">{passed ? <ShieldCheck size={18} /> : <TriangleAlert size={18} />}</div><div><strong>{passed ? 'REVIEW PASSED' : review.status}</strong><p>{review.summary}</p></div><div className="summary-metrics"><span><b>{review.critical}</b> critical</span><i /><span><b>{review.issueCount}</b> total</span></div></section><AgentTrace />
    {matches.length ? matches.map(item => <MemoryMatch item={item} key={item.id} />) : <div className="no-match-banner"><span><BrainCircuit size={17} /></span><div><strong>{passed ? 'No relevant memory required.' : 'No relevant previous team decision found.'}</strong><p>CodeMind only shows a Memory Match when a stored team rule or previous decision is relevant.</p></div></div>}
    <div className="findings-heading"><div><div className="eyebrow">REVIEW FINDINGS</div><h2>{passed ? 'No critical issues' : `${review.issues.length} recommendations`}</h2></div><div className="finding-legend"><span><i className="legend-critical" />Critical</span><span><i className="legend-warning" />Warning</span><span><i className="legend-suggestion" />Suggestion</span></div></div>
    {dismissedReviewId === review.id ? <div className="dismissed-findings"><span><Check size={14} /></span><div><strong>Findings dismissed for this review.</strong><small>You can restore them at any time.</small></div><button className="text-action" onClick={() => setDismissedReviewId(null)}>Restore findings</button></div> : <div className="issues-list">{review.issues.length ? review.issues.map((issue, index) => <ReviewIssue key={`${issue.title}-${index}`} issue={issue} index={index} />) : <div className="empty-findings"><ShieldCheck size={23} /><strong>No issues found</strong><span>This review has no recorded findings.</span></div>}</div>}
    <div className="result-actions"><button className="button-primary" onClick={() => onApply(review)}><Sparkles size={15} />Apply suggested fix</button><button className="button-secondary" onClick={() => { setDismissedReviewId(review.id); onDismiss('Findings dismissed for this review.') }}><X size={15} />Dismiss findings</button><button className={`button-secondary ${review.saved ? 'button-saved' : ''}`} onClick={() => onSave(review)}><BookOpenCheck size={15} />{review.saved ? 'Decision saved' : 'Save decision'}</button><span className="action-spacer" /><button className="button-quiet" onClick={onBack}>Back to review</button></div>
    <div className="result-footnote"><BrainCircuit size={14} />{review.provider === 'Gemini' ? 'Reviewed by Gemini with the supplied team rules and memory context.' : 'Reviewed with local pattern checks. Configure Gemini for AI-powered analysis.'}</div>
  </div>
}

function AgentTrace() {
  return <div className="agent-trace"><div className="trace-heading"><div className="trace-icon"><Activity size={15} /></div><div><strong>Agent activity</strong><span>Review pipeline</span></div><span className="trace-complete"><Check size={12} />COMPLETE</span></div><div className="trace-steps">{activitySteps.map((step, index) => <div key={step} className="trace-step"><span><Check size={11} /></span>{step}{index < activitySteps.length - 1 && <i />}</div>)}</div></div>
}

function MemoryPage({ memories, activeTab, setActiveTab, openAdd }: { memories: MemoryItem[]; activeTab: string; setActiveTab: (tab: string) => void; openAdd: () => void }) {
  const tabs = ['All Memory', 'Team Rules', 'Previous Reviews', 'Architecture Decisions', 'Common Mistakes']
  const types: Record<string, MemoryType | undefined> = { 'Team Rules': 'Team Rule', 'Previous Reviews': 'Previous Review', 'Architecture Decisions': 'Architecture Decision', 'Common Mistakes': 'Common Mistake' }
  const visible = activeTab === 'All Memory' ? memories : memories.filter(item => item.type === types[activeTab])
  return <div className="page memory-page"><PageHeading eyebrow="LEARNED FROM YOUR TEAM" title="Agent Memory" subtitle="Knowledge CodeMind has learned from your team's reviews." action={<button className="button-primary" onClick={openAdd}><Plus size={16} />Add memory</button>} /><section className="memory-overview"><div className="memory-overview-icon"><BrainCircuit size={20} /></div><div className="memory-overview-copy"><span>TEAM KNOWLEDGE BASE</span><strong>{memories.length} memories, getting sharper every review.</strong><small>Your agent references this knowledge when it reviews new code.</small></div><div className="memory-overview-stats"><div><strong>{memories.reduce((sum, item) => sum + item.usage, 0)}</strong><span>references</span></div><i /><div><strong>{new Set(memories.map(item => item.source)).size}</strong><span>sources</span></div></div></section><div className="memory-controls"><div className="tab-list" role="tablist">{tabs.map(tab => <button key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'tab-active' : ''} onClick={() => setActiveTab(tab)}>{tab}{tab === 'All Memory' && <span>{memories.length}</span>}</button>)}</div><button className="filter-button"><Search size={14} />Filter memories<ChevronDown size={13} /></button></div><div className="memory-grid">{visible.map(item => <MemoryCard item={item} key={item.id} />)}{visible.length === 0 && <div className="empty-state">No memories in this category yet.</div>}</div><div className="memory-endnote"><BrainCircuit size={14} />Memory is stored locally in this prototype and persists in this browser.</div></div>
}

function RulesPage({ rules, openAdd, onToggle, onEdit, onDelete }: { rules: TeamRule[]; openAdd: () => void; onToggle: (id: number) => void; onEdit: (id: number) => void; onDelete: (id: number) => void }) {
  const enabled = rules.filter(rule => rule.enabled).length
  return <div className="page rules-page"><PageHeading eyebrow="SHARED ENGINEERING PRACTICE" title="Team Coding Standards" subtitle="Set the standards your Code Review Agent should enforce." action={<button className="button-primary" onClick={openAdd}><Plus size={16} />Add team rule</button>} /><div className="rules-summary"><div><span className="rules-summary-icon"><ShieldCheck size={16} /></span><span><strong>{enabled} active standards</strong><small>Applied to every new code review</small></span></div><span className="rules-summary-right">{rules.length} total rules</span></div><section className="surface rules-surface"><div className="rules-table-head"><div><span className="eyebrow">CODE REVIEW POLICY</span><h2>Your team's rules</h2></div><span>STATUS <ChevronDown size={12} /></span></div>{rules.map(rule => <RuleCard key={rule.id} rule={rule} onToggle={() => onToggle(rule.id)} onEdit={() => onEdit(rule.id)} onDelete={() => onDelete(rule.id)} />)}{rules.length === 0 && <div className="empty-state">Add a team rule to teach the agent your conventions.</div>}<button className="add-rule-row" onClick={openAdd}><Plus size={15} />Add another team rule</button></section><div className="rules-note"><CircleHelp size={14} /><span>Disabled rules stay in your workspace but are excluded from new review context.</span></div></div>
}

function HistoryPage({ reviews, query, setQuery, filter, setFilter, navigate }: { reviews: ReviewRecord[]; query: string; setQuery: (value: string) => void; filter: string; setFilter: (value: string) => void; navigate: (path: string) => void }) {
  return <div className="page history-page"><PageHeading eyebrow="A RECORD OF EVERY REVIEW" title="Review History" subtitle="Search completed reviews and revisit your team's decisions." action={<button className="button-primary" onClick={() => navigate('/review')}><Plus size={16} />New review</button>} /><section className="history-toolbar"><label className="history-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by PR, repository, language..." /></label><select value={filter} onChange={event => setFilter(event.target.value)}><option>All reviews</option><option>Needs changes</option><option>Approved</option></select><span className="history-count">{reviews.length} reviews</span></section><section className="surface history-surface"><ReviewTable reviews={reviews} onOpen={id => navigate(`/review/${id}`)} /></section><div className="history-footer"><span><FileClock size={14} />Showing locally stored demo history</span><span>Most recent first</span></div></div>
}

function SettingsPage({ settings, setSettings, notify, geminiHealth }: { settings: SettingsData; setSettings: (settings: SettingsData) => void; notify: (message: string) => void; geminiHealth: GeminiHealth }) {
  const update = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => setSettings({ ...settings, [key]: value })
  return <div className="page settings-page"><PageHeading eyebrow="WORKSPACE PREFERENCES" title="Settings" subtitle="Configure how CodeMind works with your team." action={<button className="button-primary" onClick={() => notify('Workspace settings saved locally.')}><Check size={15} />Save changes</button>} /><GeminiConnection configured={geminiHealth.configured} model={geminiHealth.model} /><div className="settings-layout"><div className="settings-nav"><span className="eyebrow">PREFERENCES</span><a className="settings-nav-active" href="#workspace">Workspace</a><a href="#review">Review behavior</a><a href="#memory">Agent memory</a><a href="#notifications">Notifications</a></div><div className="settings-content"><section className="settings-section" id="workspace"><div className="settings-section-heading"><span className="settings-icon"><Layers3 size={16} /></span><div><h2>Workspace</h2><p>Where your team's review context comes from.</p></div></div><label className="field-label">Team name<input className="text-input" value={settings.team} onChange={event => update('team', event.target.value)} /></label><label className="field-label">Repository<input className="text-input" value={settings.repository} onChange={event => update('repository', event.target.value)} /></label><label className="field-label">Default programming language<select className="text-input" value={settings.defaultLanguage} onChange={event => update('defaultLanguage', event.target.value)}>{['Python', 'TypeScript', 'JavaScript', 'Go', 'Java'].map(value => <option key={value}>{value}</option>)}</select></label></section><section className="settings-section" id="review"><div className="settings-section-heading"><span className="settings-icon"><SlidersHorizontal size={16} /></span><div><h2>Review preferences</h2><p>Choose what the agent prioritizes for your team.</p></div></div><SettingToggle title="Block on critical issues" description="Flag a review as needing changes when critical issues are found." enabled={settings.blockCritical} onChange={value => update('blockCritical', value)} /><SettingToggle title="Inline fix suggestions" description="Include a suggested change with each finding." enabled={settings.inlineSuggestions} onChange={value => update('inlineSuggestions', value)} /><SettingToggle title="Strict mode" description="Surface lower-confidence convention and style violations." enabled={settings.strictMode} onChange={value => update('strictMode', value)} /></section><section className="settings-section" id="memory"><div className="settings-section-heading"><span className="settings-icon"><BrainCircuit size={16} /></span><div><h2>Agent memory</h2><p>Control how team knowledge is used and retained.</p></div></div><SettingToggle title="Automatically save decisions" description="Suggest saving useful review outcomes to Agent Memory." enabled={settings.autoSave} onChange={value => update('autoSave', value)} /><SettingToggle title="Use team memory during reviews" description="Retrieve rules and previous decisions as review context." enabled={settings.useMemory} onChange={value => update('useMemory', value)} /><SettingToggle title="Notify me about Memory Matches" description="Show when a finding matches a previous team decision." enabled={settings.memoryNotifications} onChange={value => update('memoryNotifications', value)} /></section><section className="settings-section" id="notifications"><div className="settings-section-heading"><span className="settings-icon"><Zap size={16} /></span><div><h2>Notifications</h2><p>Stay informed about agent activity.</p></div></div><SettingToggle title="Review completion" description="Notify when a code review finishes analyzing." enabled={settings.reviewNotifications} onChange={value => update('reviewNotifications', value)} /></section></div></div></div>
}

function GeminiConnection({ configured, model }: { configured: boolean; model: string }) {
  return <section className={`gemini-connection ${configured ? 'gemini-connected' : ''}`}><span className="gemini-connection-icon"><Sparkles size={17} /></span><div className="gemini-connection-copy"><div className="eyebrow">AI REVIEW PROVIDER</div><strong>{configured ? 'Gemini API key loaded' : 'Gemini is not configured'}</strong><p>{configured ? `Key is set for ${model}; credentials and quota are verified when a review runs.` : 'Add a Gemini API key to the server environment to enable AI-powered reviews.'}</p></div><div className="gemini-connection-action">{configured ? <span><i />KEY SET</span> : <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get a Gemini key<ArrowRight size={13} /></a>}<small>{configured ? model : 'Set GEMINI_API_KEY in server environment'}</small></div></section>
}

function SettingToggle({ title, description, enabled, onChange }: { title: string; description: string; enabled: boolean; onChange: (enabled: boolean) => void }) {
  return <div className="setting-toggle-row"><div><strong>{title}</strong><span>{description}</span></div><button role="switch" aria-checked={enabled} aria-label={title} className={`switch ${enabled ? 'switch-on' : ''}`} onClick={() => onChange(!enabled)}><span /></button></div>
}

function AppModal({ modal, data, setData, onClose, notify }: { modal: Exclude<ModalState, null>; data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; onClose: () => void; notify: (message: string) => void }) {
  const existingRule = modal.kind === 'rule' && modal.id ? data.rules.find(rule => rule.id === modal.id) : undefined
  const [type, setType] = useState<MemoryType>('Team Rule')
  const [title, setTitle] = useState(existingRule?.title ?? '')
  const [description, setDescription] = useState('')
  const [source, setSource] = useState('Manual')
  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    if (modal.kind === 'rule') {
      if (existingRule) setData(current => ({ ...current, rules: current.rules.map(rule => rule.id === existingRule.id ? { ...rule, title: title.trim() } : rule) }))
      else setData(current => ({ ...current, rules: [...current.rules, { id: Date.now(), title: title.trim(), enabled: true }] }))
      notify(existingRule ? 'Team rule updated.' : 'Team rule added.')
    } else {
      const item: MemoryItem = { id: Date.now(), type, title: title.trim(), description: description.trim() || 'Added by your team for future code reviews.', source: source.trim() || 'Manual', date: formatToday(), usage: 0 }
      setData(current => ({ ...current, memories: [item, ...current.memories] }))
      notify('Memory added to the agent knowledge base.')
    }
    onClose()
  }
  return <Modal title={modal.kind === 'rule' ? existingRule ? 'Edit team rule' : 'Add team rule' : 'Add memory'} subtitle={modal.kind === 'rule' ? 'Teach the review agent a standard to follow.' : 'Save useful team knowledge for future reviews.'} onClose={onClose}><form className="modal-form" onSubmit={submit}>{modal.kind === 'memory' && <label className="field-label">Memory type<select className="text-input" value={type} onChange={event => setType(event.target.value as MemoryType)}>{['Team Rule', 'Previous Review', 'Architecture Decision', 'Common Mistake'].map(value => <option key={value}>{value}</option>)}</select></label>}<label className="field-label">Title<input autoFocus className="text-input" value={title} onChange={event => setTitle(event.target.value)} placeholder={modal.kind === 'rule' ? 'e.g. Validate user input at the API boundary' : 'A short, reusable decision'} required /></label>{modal.kind === 'memory' && <><label className="field-label">Description<textarea className="text-input text-area" value={description} onChange={event => setDescription(event.target.value)} placeholder="What should the agent remember?" rows={3} /></label><label className="field-label">Source<input className="text-input" value={source} onChange={event => setSource(event.target.value)} placeholder="PR #45 or Manual" /></label></>}<div className="modal-actions"><button type="button" className="button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button-primary"><Check size={15} />{modal.kind === 'rule' ? existingRule ? 'Save changes' : 'Add team rule' : 'Save memory'}</button></div></form></Modal>
}

function NotFound({ navigate }: { navigate: (path: string) => void }) {
  return <div className="page not-found"><div className="not-found-mark"><Braces size={24} /></div><div className="eyebrow">404 · ROUTE NOT FOUND</div><h1>This branch doesn't exist.</h1><p>Head back to your dashboard to pick up where your team left off.</p><button className="button-primary" onClick={() => navigate('/dashboard')}>Back to dashboard<ArrowRight size={15} /></button></div>
}

export default App