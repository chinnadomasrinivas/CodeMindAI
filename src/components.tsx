import { useRef, useState } from 'react'
import {
  Activity, Bell, BrainCircuit, Check, ChevronDown, ChevronRight, ClipboardPaste,
  Code2, Command, Copy, FileCode2, History, LayoutDashboard, Menu, Search, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, X, type LucideIcon,
} from 'lucide-react'
import type { MemoryItem, ReviewIssue, ReviewRecord, TeamRule } from './types'

export const navItems: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/review', label: 'Code Review', icon: Code2 },
  { path: '/memory', label: 'Agent Memory', icon: BrainCircuit },
  { path: '/history', label: 'Review History', icon: History },
  { path: '/rules', label: 'Team Rules', icon: ShieldCheck },
  { path: '/settings', label: 'Settings', icon: Settings2 },
]

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className="brand-lockup"><div className="brand-mark"><Code2 size={17} strokeWidth={2.2} /><span><BrainCircuit size={11} /></span></div>{!compact && <div className="brand-name">CodeMind <b>AI</b></div>}</div>
}

export function Sidebar({ path, navigate, mobileOpen, closeMobile, geminiConfigured, model }: { path: string; navigate: (path: string) => void; mobileOpen: boolean; closeMobile: () => void; geminiConfigured: boolean; model: string }) {
  return <>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={closeMobile} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <button className="sidebar-brand" onClick={() => navigate('/dashboard')}><BrandMark /></button>
      <div className="workspace-switch"><div className="workspace-glyph">P</div><div><strong>Platform team</strong><span>Acme Engineering</span></div><ChevronDown size={14} /></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{navItems.map(({ path: target, label, icon: Icon }) => {
        const active = target === '/review' ? path === target || path.startsWith('/review/') : path === target
        return <button key={target} className={`nav-link ${active ? 'nav-active' : ''}`} onClick={() => { navigate(target); closeMobile() }}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === 'Agent Memory' && <span className="nav-count">20</span>}</button>
      })}</nav>
      <div className="sidebar-bottom"><div className="agent-health"><span className="health-dot" /><div><strong>{geminiConfigured ? 'Gemini key loaded' : 'Local review mode'}</strong><span>{geminiConfigured ? `${model} · access checked on review` : 'Add server key to enable AI'}</span></div></div><button className="profile-row"><div className="avatar">SR</div><span><strong>Sam Rivera</strong><small>Engineering lead</small></span><ChevronDown size={14} /></button></div>
    </aside>
  </>
}

export function Header({ path, navigate, search, setSearch, onMenu }: { path: string; navigate: (path: string) => void; search: string; setSearch: (value: string) => void; onMenu: () => void }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const title = navItems.find(item => item.path === path)?.label ?? (path.startsWith('/review/') ? 'Review results' : 'CodeMind AI')
  return <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={onMenu}><Menu size={19} /></button><div className="breadcrumb"><span>CodeMind</span><ChevronRight size={14} /><strong>{title}</strong></div><div className="topbar-actions"><label className="search-wrap"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && search.trim()) navigate('/history') }} placeholder="Search reviews, rules, memory..." /><kbd><Command size={11} /> K</kbd></label><div className="notification-wrap"><button className={`icon-button ${notificationsOpen ? 'icon-selected' : ''}`} aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={18} /><i /></button>{notificationsOpen && <div className="notification-popover"><div className="popover-title">Notifications <span>2 new</span></div><div className="notification-item"><span className="notification-dot violet" /><div><strong>Memory match found</strong><small>PR #42 matched the SQL security rule.</small></div></div><div className="notification-item"><span className="notification-dot blue" /><div><strong>Review completed</strong><small>Payment API is ready for review.</small></div></div></div>}</div><div className="topbar-divider" /><button className="header-user" onClick={() => navigate('/settings')}><div className="avatar">SR</div><span>Sam Rivera</span><ChevronDown size={14} /></button></div></header>
}

export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>
}

export function StatCard({ label, value, change, icon: Icon, tone }: { label: string; value: string | number; change?: string; icon: LucideIcon; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={17} /></div><div className="stat-meta">{label}<span>{change}</span></div><div className="stat-value">{value}</div><div className="stat-sparkline"><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
}

export function MemoryCard({ item, onDelete }: { item: MemoryItem; onDelete?: () => void }) {
  const style = item.type === 'Team Rule' ? 'tag-rule' : item.type === 'Architecture Decision' ? 'tag-architecture' : item.type === 'Common Mistake' ? 'tag-mistake' : 'tag-review'
  return <article className="memory-card"><div className="memory-card-top"><span className={`type-tag ${style}`}>{item.type}</span>{onDelete && <button className="text-action danger-action" onClick={onDelete}>Remove</button>}</div><h3>{item.title}</h3><p>{item.description}</p><div className="memory-card-meta"><span><FileCode2 size={13} />{item.source}</span><span>{item.date}</span></div><div className="memory-usage"><span className="usage-bars"><i /><i /><i /><i /><i /></span><span>Used <strong>{item.usage} times</strong> in reviews</span></div></article>
}

export function RuleCard({ rule, onToggle, onEdit, onDelete }: { rule: TeamRule; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  return <div className={`rule-row ${!rule.enabled ? 'rule-disabled' : ''}`}><span className={`rule-check ${rule.enabled ? 'checked' : ''}`}>{rule.enabled && <Check size={13} />}</span><div className="rule-copy"><strong>{rule.title}</strong><span>{rule.enabled ? 'Applied to new code reviews' : 'Paused for new code reviews'}</span></div><div className="rule-actions"><button className="text-action" onClick={onEdit}>Edit</button><button className="text-action danger-action" onClick={onDelete}>Delete</button><button role="switch" aria-checked={rule.enabled} aria-label={`Toggle ${rule.title}`} className={`switch ${rule.enabled ? 'switch-on' : ''}`} onClick={onToggle}><span /></button></div></div>
}

export function ReviewTable({ reviews, onOpen }: { reviews: ReviewRecord[]; onOpen: (id: number) => void }) {
  return <div className="table-scroll"><table className="review-table"><thead><tr><th>REVIEW</th><th>REPOSITORY</th><th>LANGUAGE</th><th>ISSUES</th><th>STATUS</th><th>DATE</th><th /></tr></thead><tbody>{reviews.map(review => <tr key={review.id} onClick={() => onOpen(review.id)}><td><span className="review-id">PR #{review.id}</span></td><td>{review.repository}</td><td><span className="language-cell"><span className="language-dot" />{review.language}</span></td><td>{review.issueCount} issues{review.critical > 0 && <span className="critical-inline"> · {review.critical} critical</span>}</td><td><StatusBadge status={review.status} /></td><td className="date-cell">{review.date}</td><td><ChevronRight size={15} className="table-chevron" /></td></tr>)}</tbody></table>{reviews.length === 0 && <div className="empty-state">No reviews match this search.</div>}</div>
}

export function StatusBadge({ status }: { status: string }) {
  const kind = status === 'Needs Changes' ? 'status-changes' : status === 'Approved' ? 'status-approved' : 'status-suggestions'
  return <span className={`status-badge ${kind}`}><i />{status}</span>
}

function highlightCode(source: string) {
  const tokenPattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#.*$|\b(?:def|return|import|from|class|if|else|for|in|async|await|try|except|raise|with|as|pass|None|True|False)\b|\b\d+\b)/g
  return source.split('\n').map((line, lineIndex, lines) => <span className="highlight-line" key={lineIndex}>{line.split(tokenPattern).map((token, tokenIndex) => {
    if (!token) return null
    const color = token.startsWith('#') ? 'syntax-comment' : token.startsWith('"') || token.startsWith("'") ? 'syntax-string' : /^(\d+|None|True|False)$/.test(token) ? 'syntax-value' : /^(def|return|import|from|class|if|else|for|in|async|await|try|except|raise|with|as|pass)$/.test(token) ? 'syntax-keyword' : ''
    return color ? <span className={color} key={tokenIndex}>{token}</span> : token
  })}{lineIndex < lines.length - 1 ? '\n' : null}</span>)
}

export function CodeEditor({ code, setCode, language, setLanguage, onReview, onPaste, onCopy }: { code: string; setCode: (value: string) => void; language: string; setLanguage: (value: string) => void; onReview: () => void; onPaste: () => void; onCopy: () => void }) {
  const lines = code.split('\n').length
  const numbersRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)
  return <div className="editor-frame"><div className="editor-toolbar"><div className="file-tab"><FileCode2 size={14} /><span>users.py</span><i /></div><div className="editor-toolbar-actions"><button title="Paste from clipboard" onClick={onPaste}><ClipboardPaste size={13} /><span>Paste</span></button><button title="Copy editor contents" onClick={onCopy}><Copy size={13} /><span>Copy</span></button><select aria-label="Programming language" value={language} onChange={event => setLanguage(event.target.value)}>{['Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'C#'].map(value => <option key={value}>{value}</option>)}</select></div></div><div className="editor-body"><div className="line-numbers" ref={numbersRef} aria-hidden="true">{Array.from({ length: lines }, (_, index) => <span key={index}>{String(index + 1).padStart(2, '0')}</span>)}</div><div className="code-editor-input"><pre className="code-highlight" ref={highlightRef} aria-hidden="true">{highlightCode(code)}{'\n'}</pre><textarea aria-label="Code editor" spellCheck={false} value={code} onChange={event => setCode(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); onReview() } }} onScroll={event => { if (highlightRef.current) { highlightRef.current.scrollTop = event.currentTarget.scrollTop; highlightRef.current.scrollLeft = event.currentTarget.scrollLeft } if (numbersRef.current) numbersRef.current.scrollTop = event.currentTarget.scrollTop }} /></div></div><div className="editor-footer"><span><span className="health-dot" />Ready for review</span><span>{language} <i /> UTF-8 <i /> LF</span></div></div>
}

export function LiveFindings({ issues, hasCode }: { issues: ReviewIssue[]; hasCode: boolean }) {
  const critical = issues.filter(issue => issue.severity === 'CRITICAL').length
  const warnings = issues.filter(issue => issue.severity === 'WARNING').length
  return <section className="live-scan" aria-live="polite"><div className="live-scan-heading"><div><span className="live-scan-icon"><Activity size={14} /></span><span><strong>Live code check</strong><small>Updates as you paste or edit</small></span></div><span className={`live-scan-state ${issues.length ? 'live-has-findings' : ''}`}><i />{!hasCode ? 'WAITING FOR CODE' : issues.length ? `${issues.length} FINDINGS` : 'NO MATCHES'}</span></div>{!hasCode ? <p className="live-scan-empty">Paste code into the editor to see local checks here.</p> : issues.length ? <><div className="live-counts">{critical > 0 && <span className="live-count-critical">{critical} critical</span>}{warnings > 0 && <span className="live-count-warning">{warnings} warning</span>}{issues.length - critical - warnings > 0 && <span>{issues.length - critical - warnings} suggestion</span>}</div><div className="live-issues">{issues.slice(0, 4).map((issue, index) => <div className="live-issue" key={`${issue.title}-${issue.line}-${index}`}><span className={`live-severity live-severity-${issue.severity.toLowerCase()}`} /><span>{issue.title}</span><small>Line {issue.line}</small></div>)}{issues.length > 4 && <span className="live-more">+{issues.length - 4} more findings</span>}</div></> : <p className="live-scan-empty live-scan-clear"><Check size={13} />No local security or team-rule patterns found.</p>}</section>
}

export function ReviewIssue({ issue, index }: { issue: ReviewIssue; index: number }) {
  const iconColor = issue.severity === 'CRITICAL' ? 'issue-critical' : issue.severity === 'WARNING' ? 'issue-warning' : 'issue-suggestion'
  return <article className="issue-card"><div className="issue-index">{String(index + 1).padStart(2, '0')}</div><div className="issue-content"><div className="issue-title-row"><span className={`severity-tag ${iconColor}`}>{issue.severity}</span><h3>{issue.title}</h3><span className="issue-location"><FileCode2 size={13} />{issue.file} : {issue.line}</span></div><div className="issue-code"><span className="issue-line-number">{String(issue.line).padStart(2, '0')}</span><code>{issue.snippet}</code></div><p className="issue-why"><strong>Why it matters</strong>{issue.why}</p><div className="suggested-fix"><span><Sparkles size={14} />Suggested fix</span><p>{issue.fix}</p></div></div></article>
}

export function MemoryMatch({ item }: { item: MemoryItem }) {
  const sourceType = item.type === 'Team Rule' ? 'RELEVANT TEAM RULE' : item.type === 'Architecture Decision' ? 'ARCHITECTURE DECISION' : 'PREVIOUS REVIEW'
  return <section className="memory-match"><div className="match-topline"><span className="match-spark"><BrainCircuit size={17} /></span><div><div className="match-overline">MEMORY MATCH FOUND</div><h2>Your team has seen this before.</h2></div><span className="match-score">STRONG MATCH <i>96%</i></span></div><div className="match-body"><div className="match-source"><span className="mini-label">{sourceType}</span><strong>{item.source} <span className="match-separator">/</span> {item.title}</strong></div><div className="decision-quote"><span className="quote-mark">“</span><div><span className="mini-label">PREVIOUS TEAM DECISION</span><p>{item.description}</p></div></div><div className="match-footer"><span><Activity size={14} />Referenced in <strong>{item.usage} reviews</strong></span><span>Matched from Agent Memory</span></div></div></section>
}

export function LoadingAnalysis({ stage, steps }: { stage: number; steps: string[] }) {
  return <div className="loading-analysis"><div className="loader-orbit"><div className="orbit-core"><BrainCircuit size={25} /></div><i /><i /><i /></div><span className="eyebrow">CODEMIND AGENT</span><h2>{steps[Math.min(stage, steps.length - 1)]}<span className="loading-dots">...</span></h2><p>Reviewing this change against your codebase and team memory.</p><div className="activity-list">{steps.map((step, index) => <div className={`activity-step ${index < stage ? 'step-done' : index === stage ? 'step-current' : ''}`} key={step}><span>{index < stage ? <Check size={13} /> : <i />}</span>{step}{index < stage && <small>Complete</small>}</div>)}</div><div className="loading-footnote"><SlidersHorizontal size={13} />No code leaves your workspace in this prototype</div></div>
}

export function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>{children}</section></div>
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="toast"><span><Check size={14} /></span>{message}<button aria-label="Dismiss notification" onClick={onClose}><X size={14} /></button></div>
}