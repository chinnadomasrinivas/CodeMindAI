import type { AppData, MemoryItem, ReviewRecord, TeamRule } from './types'

export const defaultCode = `def get_user(user_id):
    query = "SELECT * FROM users WHERE id=" + user_id
    return database.execute(query)
`

export const defaultRules: TeamRule[] = [
  'Use parameterized SQL queries', 'Never hard-code API keys', 'Use async/await',
  'Use centralized error handling', 'Avoid duplicate database calls', 'Use meaningful variable names',
  'Follow repository pattern', 'Validate all user input', 'Log errors with request context',
  'Keep functions under 40 lines', 'Write unit tests for services', 'No secrets in logs',
].map((title, index) => ({ id: index + 1, title, enabled: index !== 9 }))

const memorySeeds: [MemoryItem['type'], string, string, string, number][] = [
  ['Team Rule', 'Use parameterized SQL queries', 'All database queries must bind user-controlled values as parameters. Never build SQL with string concatenation.', 'PR #18', 14],
  ['Architecture Decision', 'Use centralized error handling', 'Route service errors through the shared error middleware and preserve request context.', 'PR #23', 9],
  ['Team Rule', 'Never hard-code API keys', 'Load credentials from the managed secrets store or environment configuration.', 'PR #12', 11],
  ['Previous Review', 'Never store or compare plain-text passwords', 'Passwords must be salted and verified with the approved password-hashing library; never query or store them as plain text.', 'PR #31', 6],
  ['Common Mistake', 'String-concatenated SQL queries', 'This pattern has repeatedly introduced injection risk in service endpoints.', 'PR #18', 8],
  ['Common Mistake', 'Missing await on async database calls', 'Un-awaited operations can return before a database write or error has completed.', 'PR #27', 5],
  ['Architecture Decision', 'Service layer owns business logic', 'Keep request handlers thin and place business rules in the service layer.', 'PR #9', 7],
  ['Previous Review', 'Use async/await over callbacks', 'Prefer async functions for readable, composable asynchronous control flow.', 'PR #14', 10],
  ['Previous Review', 'Avoid N+1 queries in list endpoints', 'Load related records in batches before mapping the response.', 'PR #35', 4],
  ['Common Mistake', 'Swallowed exceptions with bare except', 'Catch only expected exceptions and report failures through shared logging.', 'PR #21', 6],
  ['Architecture Decision', 'Use Redis for session caching', 'Session lookups should use the shared Redis adapter with the standard TTL.', 'PR #29', 3],
  ['Team Rule', 'Validate all user input', 'Validate type, shape, and bounds at the API boundary before processing.', 'PR #16', 9],
  ['Previous Review', 'Rotate tokens via secrets manager', 'Do not rotate credentials by editing application source or config files.', 'PR #33', 2],
  ['Previous Review', 'Avoid unnecessary duplicate database calls', 'Combine related reads for one request instead of issuing several independent calls for the same entity.', 'PR #27', 5],
  ['Previous Review', 'REST error envelope format', 'Return errors using the shared code, message, and requestId response shape.', 'PR #19', 6],
  ['Team Rule', 'Use meaningful variable names', 'Names should describe the value and remain consistent with the domain language.', 'PR #7', 8],
  ['Previous Review', 'Prefer reusable functions over duplicate logic', 'Extract repeated calculations into one reusable function so behavior stays consistent.', 'PR #14', 2],
  ['Common Mistake', 'Logging sensitive user data', 'Redact personal data and credentials before writing structured logs.', 'PR #30', 4],
  ['Previous Review', 'Feature flags for risky rollouts', 'Gate user-facing behavior changes behind the shared feature flag service.', 'PR #37', 1],
  ['Previous Review', 'Prefer dependency injection in services', 'Inject repositories and clients so service behavior stays testable.', 'PR #40', 3],
]

export const defaultMemories: MemoryItem[] = memorySeeds.map(([type, title, description, source, usage], index) => ({
  id: index + 1, type, title, description, source, date: index === 0 ? 'Sep 18, 2026' : `Sep ${String(20 - (index % 12)).padStart(2, '0')}, 2026`, usage,
}))

const makeReview = (
  id: number, repository: string, language: string, issueCount: number, status: string,
  date: string, critical: number, summary: string,
): ReviewRecord => ({
  id, repository, language, issueCount, status, date, critical, summary,
  fixedCode: id === 42 ? `def get_user(user_id):\n    query = "SELECT * FROM users WHERE id=%s"\n    return database.execute(query, (user_id,))\n` : undefined,
  issues: id === 42 ? [
    {
      severity: 'CRITICAL', title: 'SQL Injection Risk', file: 'users.py', line: 2,
      snippet: 'query = "SELECT * FROM users WHERE id=" + user_id',
      why: 'User-controlled input is directly inserted into a SQL query, so crafted values can alter the query and expose or modify data.',
      fix: 'Use a parameterized query instead of string concatenation.', memoryId: 1,
    },
    {
      severity: 'CRITICAL', title: 'User identifier is not validated', file: 'users.py', line: 1,
      snippet: 'def get_user(user_id):',
      why: 'The handler assumes an identifier with the expected type and shape reaches the database layer.',
      fix: 'Validate the identifier at the API boundary before calling the user repository.',
    },
    {
      severity: 'WARNING', title: 'Team convention: use the repository layer', file: 'users.py', line: 3,
      snippet: 'return database.execute(query)',
      why: 'Direct database calls couple application behavior to persistence details and bypass the shared repository.',
      fix: 'Move the query into a reusable UserRepository method.',
    },
    {
      severity: 'WARNING', title: 'Database errors are not normalized', file: 'users.py', line: 3,
      snippet: 'return database.execute(query)',
      why: 'Raw database exceptions can leak implementation details and do not follow the shared error response format.',
      fix: 'Handle expected repository errors through centralized error handling.',
    },
    {
      severity: 'SUGGESTION', title: 'Improve database abstraction', file: 'users.py', line: 3,
      snippet: 'return database.execute(query)',
      why: 'A named repository function makes this query easier to reuse and test.',
      fix: 'Call user_repository.get_by_id(user_id) from the service layer.',
    },
  ] : [],
})

export const defaultReviews: ReviewRecord[] = [
  makeReview(42, 'User Service', 'Python', 5, 'Needs Changes', 'Today', 2, 'SQL input is concatenated into a query, matching a security decision from PR #18.'),
  makeReview(41, 'Payment API', 'JavaScript', 2, 'Approved with Suggestions', 'Yesterday', 0, 'Retry behavior is sound; two suggestions improve observability.'),
  makeReview(40, 'User Service', 'Python', 4, 'Needs Changes', 'Sep 26', 1, 'The service bypasses repository conventions in two data access paths.'),
  makeReview(39, 'Auth Gateway', 'TypeScript', 3, 'Needs Changes', 'Sep 25', 1, 'Token handling needs a secrets-manager update and tighter validation.'),
  makeReview(38, 'Payment API', 'JavaScript', 1, 'Approved', 'Sep 25', 0, 'One low-risk naming suggestion; no blocking issues.'),
  makeReview(37, 'Notifications', 'Python', 6, 'Needs Changes', 'Sep 24', 3, 'Un-awaited database calls and repeated queries affect delivery reliability.'),
  makeReview(35, 'Orders API', 'Go', 2, 'Approved with Suggestions', 'Sep 24', 0, 'Batch related records to avoid an N+1 query pattern.'),
  makeReview(33, 'Auth Service', 'Python', 4, 'Needs Changes', 'Sep 23', 1, 'Credential rotation should use the shared secrets manager.'),
  makeReview(31, 'User Repository', 'TypeScript', 2, 'Approved with Suggestions', 'Sep 22', 0, 'A small service-level abstraction would make this path easier to test.'),
  makeReview(23, 'Error Middleware', 'JavaScript', 1, 'Approved', 'Sep 20', 0, 'Centralized error envelope matches the team architecture decision.'),
]

export const initialData: AppData = { reviews: defaultReviews, memories: defaultMemories, rules: defaultRules }

export const activitySteps = [
  'Analyzing code', 'Checking security', 'Searching team memory',
  'Comparing previous reviews', 'Generating recommendations',
]