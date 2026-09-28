import type { MemoryItem, ReviewIssue, TeamRule } from '../types'

interface AnalyzeInput {
  code: string
  language: string
  rules: TeamRule[]
  memories: MemoryItem[]
  memoryEnabled: boolean
}

export interface ReviewAnalysis {
  issues: ReviewIssue[]
  summary: string
  fixedCode?: string
}

function sourceFile(language: string) {
  const extensions: Record<string, string> = {
    Python: 'py', JavaScript: 'js', TypeScript: 'ts', Java: 'java', Go: 'go', 'C#': 'cs',
  }
  return `submitted.${extensions[language] ?? 'txt'}`
}

function findMemory(memories: MemoryItem[], pattern: RegExp) {
  return memories.find(item => pattern.test(`${item.title} ${item.description}`))
}

function pythonFunctions(lines: string[]) {
  const functions: { name: string; start: number; end: number; body: string[] }[] = []
  for (let start = 0; start < lines.length; start++) {
    const definition = lines[start].match(/^(\s*)def\s+(\w+)\s*\(/)
    if (!definition) continue
    const baseIndent = definition[1].length
    let end = start + 1
    while (end < lines.length) {
      const line = lines[end]
      if (line.trim() && (line.match(/^\s*/)?.[0].length ?? 0) <= baseIndent) break
      end++
    }
    functions.push({ name: definition[2], start, end, body: lines.slice(start + 1, end).filter(line => line.trim()) })
    start = end - 1
  }
  return functions
}

function createPythonSqlFix(lines: string[], injectionLine: number) {
  const sqlAssignment = lines[injectionLine].match(/^(\s*)(\w+)\s*=\s*(["'])(.+?)(?:\s*)\+\s*(\w+)\s*$/)
  if (!sqlAssignment) return undefined

  const [, indent, queryName, quote, statement, valueName] = sqlAssignment
  if (!/\b(select|insert|update|delete)\b/i.test(statement)) return undefined
  const sqlPrefix = statement.endsWith(quote) ? statement.slice(0, -1) : statement
  const executeLine = lines.findIndex(line => new RegExp(`\\bexecute\\s*\\(\\s*${queryName}\\s*\\)`).test(line))
  if (executeLine < 0) return undefined

  const updated = [...lines]
  updated[injectionLine] = `${indent}${queryName} = ${quote}${sqlPrefix}%s${quote}`
  updated[executeLine] = updated[executeLine].replace(
    new RegExp(`(\\bexecute\\s*\\(\\s*${queryName})\\s*\\)`),
    `$1, (${valueName},))`,
  )
  return updated.join('\n')
}

function createMutableDefaultFix(lines: string[], definitionLine: number) {
  const argument = lines[definitionLine].match(/\b(\w+)\s*=\s*(\[\]|\{\})/)
  if (!argument) return undefined
  const [, name, defaultValue] = argument
  const updated = [...lines]
  updated[definitionLine] = updated[definitionLine].replace(`${name}=${defaultValue}`, `${name}=None`)
  const indent = `${lines[definitionLine].match(/^\s*/)?.[0] ?? ''}    `
  updated.splice(definitionLine + 1, 0, `${indent}if ${name} is None:`, `${indent}    ${name} = ${defaultValue}`)
  return updated.join('\n')
}

export function analyzeCode({ code, language, rules, memories, memoryEnabled }: AnalyzeInput): ReviewAnalysis {
  const lines = code.split('\n')
  const file = sourceFile(language)
  const issues: ReviewIssue[] = []
  const enabledRules = rules.filter(rule => rule.enabled).map(rule => rule.title.toLowerCase())
  const parameterizedRule = enabledRules.some(rule => rule.includes('parameterized sql'))
  const repositoryRule = enabledRules.some(rule => rule.includes('repository pattern'))
  const functions = pythonFunctions(lines)
  const matchMemory = (pattern: RegExp) => memoryEnabled ? findMemory(memories, pattern) : undefined
  const parameterizedMemory = matchMemory(/parameterized sql/i)
  const addIssue = (severity: ReviewIssue['severity'], title: string, line: number, snippet: string, why: string, fix: string, matchedMemories: (MemoryItem | undefined)[] = []) => {
    const memoryIds = [...new Set(matchedMemories.flatMap(memory => memory ? [memory.id] : []))]
    issues.push({
      severity, title, file, line: line + 1, snippet: snippet.trim(), why, fix,
      ...(memoryIds.length === 1 ? { memoryId: memoryIds[0] } : {}),
      ...(memoryIds.length ? { memoryIds } : {}),
    })
  }
  let sqlInjectionLine = -1
  let mutableDefaultLine = -1

  lines.forEach((line, index) => {
    const sqlStatement = /\b(select|insert|update|delete)\b/i.test(line)
      const interpolatedSql = sqlStatement && (/["'][^"']*["']\s*\+\s*\w+/.test(line) || /\b\w+\s*\+\s*\w+/.test(line) || /\$\{|\.format\s*\(/.test(line) || /\bf["'][^"']*\{\w+\}/i.test(line))

    if (interpolatedSql) {
      sqlInjectionLine = index
      addIssue('CRITICAL', 'SQL Injection Risk', index, line,
        'SQL text is combined with a value in source code. If that value is user-controlled, it can alter the query and expose or modify data.',
        'Use a parameterized query and bind values separately from the SQL statement.', [parameterizedMemory])
      if (/\bpassword\b/i.test(line)) {
        const passwordMemory = matchMemory(/plain.?text password|password hash|never store.*password/i)
        addIssue('CRITICAL', 'Unsafe password handling', index, line,
          'Password values appear to be compared in SQL instead of being checked against a salted password hash.',
          'Fetch the account by username, then verify the submitted password with the approved password-hashing library.', [passwordMemory])
      }
    }

    if (/(?:api[_-]?(?:key|token)|secret|password|access[_-]?token)\s*[=:]\s*["'][^"']{4,}["']/i.test(line)) {
      const credentialMemory = matchMemory(/never hard.?code.*(?:api|credential|secret)|api key/i)
      addIssue('CRITICAL', 'Hard-coded secret', index, line,
        'An API credential is directly stored in source code and may be exposed through repository history.',
        'Read the credential from an environment variable or secure secret manager.', [credentialMemory])
    }

    if (/\b(?:eval|exec)\s*\(/.test(line)) {
      addIssue('WARNING', 'Dynamic code execution', index, line,
        'Executing a constructed string can become code injection if the input is untrusted.',
        'Replace dynamic execution with an explicit parser or a fixed mapping of allowed operations.')
    }

    if (/^\s*except\s*:\s*(?:#.*)?$/.test(line)) {
      const errorMemory = matchMemory(/centralized error handling|specific exceptions/i)
      addIssue('WARNING', 'Bare exception handler', index, line,
        'A bare handler catches every exception, including errors the code cannot safely recover from.',
        'Catch the specific exceptions this operation is expected to raise.', [errorMemory])
    }

    if (/\b(?:database|db)\.(?:execute|query)\s*\(/i.test(line) && repositoryRule) {
      const repositoryMemory = matchMemory(/repository pattern|repository function/i)
      addIssue('WARNING', 'Team convention: use the repository layer', index, line,
        'Direct database calls bypass the team repository pattern and couple application logic to persistence details.',
        'Move this operation into a reusable repository function.', [repositoryMemory])
    }

    if (/\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i.test(line) && !interpolatedSql && parameterizedRule && /\b(?:query|sql)\s*=/.test(line)) {
      const hasBinding = lines.slice(index + 1, index + 4).some(next => /\b(?:execute|query)\s*\([^)]*,/.test(next))
      if (!hasBinding) addIssue('SUGGESTION', 'Confirm query values are parameterized', index, line,
        'The team standard requires query values to be bound separately from SQL text.',
        'Pass values as driver parameters rather than embedding them in the query string.')
    }

    if (/^\s*def\s+\w+\s*\([^)]*=\s*(?:\[\]|\{\})/.test(line)) mutableDefaultLine = index

    const variableAssignment = line.match(/^\s{0,8}([a-zA-Z_]\w*)\s*=\s*[^=]/)
    if (variableAssignment && variableAssignment[1] !== '_') {
      const name = variableAssignment[1]
      const occurrences = code.match(new RegExp(`\\b${name}\\b`, 'g'))?.length ?? 0
      if (occurrences === 1) addIssue('SUGGESTION', 'Unused variable', index, line,
        `The variable ${name} is assigned but never read.`,
        'Remove the unused variable or use it in the calculation.')
    }

    if (/^\s*def\s+calculate\s*\([^)]*\b[xyz]\b/.test(line)) {
      const namingMemory = matchMemory(/meaningful variable names/i)
      addIssue('SUGGESTION', 'Unclear variable names', index, line,
        'Single-letter names such as x, y, and z do not explain their values or intent.',
        'Use domain-specific names such as price, quantity, and total.', [namingMemory])
    }

    const division = line.match(/\breturn\s+[^/]+\/\s*(len\s*\([^)]*\)|\w+)/)
    if (division) {
      const denominator = division[1].replace(/\s+/g, '')
      const fn = functions.find(candidate => index >= candidate.start && index < candidate.end)
      const body = fn?.body.join('\n') ?? ''
      const guarded = denominator.startsWith('len(')
        ? /if\s+not\s+\w+|if\s+len\s*\(/.test(body)
        : new RegExp(`if\\s+(?:not\\s+)?${denominator}\\s*(?:==|<=|<)\\s*0|if\\s+not\\s+${denominator}`).test(body)
      if (!guarded) {
        const errorMemory = denominator.startsWith('len(') ? undefined : matchMemory(/centralized error handling/i)
        addIssue('WARNING', 'Potential division by zero', index, line,
          `The denominator ${denominator} can be zero, causing a runtime ZeroDivisionError.`,
          `Validate ${denominator} before dividing or handle ZeroDivisionError.`, [errorMemory])
      }
    }
  })

  for (const fn of functions) {
    const dbCalls = fn.body.filter(line => /\b(?:database|db)\.\w+\s*\(/i.test(line))
    if (dbCalls.length >= 3) {
      const databaseMemory = matchMemory(/avoid.*(?:duplicate|unnecessary).*database|duplicate database calls/i)
      addIssue('WARNING', 'Multiple database calls', fn.start, lines[fn.start],
        `This function performs ${dbCalls.length} database calls for one request, increasing database traffic and latency.`,
        'Combine the data access into a batch query or a repository method.', [databaseMemory])
    }
    const body = fn.body.map(line => line.trim()).join('\n')
    if (fn.body.length >= 2 && functions.some(other => other.start < fn.start && other.body.map(line => line.trim()).join('\n') === body)) {
      const reusableMemory = matchMemory(/reusable function|duplicate logic/i)
      addIssue('WARNING', 'Duplicate code', fn.start, lines[fn.start],
        'This function repeats the same statements as another function in the submitted code.',
        'Extract the shared logic into a reusable function.', [reusableMemory])
    }
  }

  if (mutableDefaultLine >= 0) addIssue('WARNING', 'Mutable default argument', mutableDefaultLine, lines[mutableDefaultLine],
    'A mutable default value is reused across calls, so one call can affect the next.',
    'Use None as the default and create a new list or dictionary inside the function.')

  if (issues.length === 0) return { issues, summary: 'REVIEW PASSED. No critical security issues found. No major team-rule violations found. Code quality: Good.' }

  const hasMemoryMatch = issues.some(issue => issue.memoryId !== undefined || (issue.memoryIds?.length ?? 0) > 0)
  const summary = hasMemoryMatch
    ? 'Relevant team decisions matched these findings. Each Memory Match below shows the rule or previous review that applies.'
    : `${issues.length} finding${issues.length === 1 ? '' : 's'} identified by local security and team-rule checks. No relevant previous team decision found.`
  const fixedCode = language === 'Python' && sqlInjectionLine >= 0
    ? createPythonSqlFix(lines, sqlInjectionLine)
    : language === 'Python' && mutableDefaultLine >= 0
      ? createMutableDefaultFix(lines, mutableDefaultLine)
      : undefined

  return { issues, summary, fixedCode }
}