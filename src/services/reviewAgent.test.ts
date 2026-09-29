import { describe, expect, it } from 'vitest'
import { defaultMemories, defaultRules } from '../data'
import { analyzeCode } from './reviewAgent'

function review(code: string, memoryEnabled = true) {
  return analyzeCode({ code, language: 'Python', rules: defaultRules, memories: defaultMemories, memoryEnabled })
}

function findIssue(code: string, title: string) {
  return review(code).issues.find(issue => issue.title === title)
}

describe('CodeMind sample review cases', () => {
  it('detects missing Python colons and unmatched parentheses', () => {
    const samples = [
      'print("Total:", total',
      'def login(username, password)',
      'else',
      'if name in users',
      'for i in range(5)',
      'print(greet("Developer")',
    ]

    for (const code of samples) {
      expect(review(code).issues.some(issue => issue.title === 'Python syntax error')).toBe(true)
    }
  })

  it('ignores delimiter characters inside Python strings and comments', () => {
    const code = 'message = "an unmatched ( and colon:" # comment ]'
    expect(review(code).issues.filter(issue => issue.title === 'Python syntax error')).toHaveLength(0)
  })

  it('01 detects SQL injection and links PR #18', () => {
    const result = review('def get_user(user_id):\n    query = "SELECT * FROM users WHERE id=" + user_id\n    return database.execute(query)')
    const issue = result.issues.find(item => item.title === 'SQL Injection Risk')
    expect(issue?.severity).toBe('CRITICAL')
    expect(issue?.memoryId).toBe(1)
  })

  it('02 detects an embedded API key and links the team rule', () => {
    const issue = findIssue('API_KEY = "sk_test_123456789"\n\ndef get_data():\n    return API_KEY', 'Hard-coded secret')
    expect(issue?.severity).toBe('CRITICAL')
    expect(issue?.memoryId).toBe(3)
  })

  it('03 detects an unguarded division and links error handling memory', () => {
    const issue = findIssue('def divide(a, b):\n    return a / b', 'Potential division by zero')
    expect(issue?.severity).toBe('WARNING')
    expect(issue?.memoryId).toBe(2)
  })

  it('04 detects repeated database calls and links PR #27', () => {
    const issue = findIssue('def get_user_details(user_id):\n    user = database.get_user(user_id)\n    orders = database.get_user_orders(user_id)\n    profile = database.get_user_profile(user_id)\n    return user, orders, profile', 'Multiple database calls')
    expect(issue?.severity).toBe('WARNING')
    expect(issue?.memoryId).toBe(14)
  })

  it('05 flags unclear names and links the naming rule', () => {
    const issue = findIssue('def calculate(x, y):\n    z = x * y\n    return z', 'Unclear variable names')
    expect(issue?.severity).toBe('SUGGESTION')
    expect(issue?.memoryId).toBe(16)
  })

  it('06 detects duplicate function bodies and links PR #14', () => {
    const code = 'def calculate_user_total(price, quantity):\n    total = price * quantity\n    print(total)\n    return total\n\ndef calculate_order_total(price, quantity):\n    total = price * quantity\n    print(total)\n    return total'
    const issue = findIssue(code, 'Duplicate code')
    expect(issue?.severity).toBe('WARNING')
    expect(issue?.memoryId).toBe(17)
  })

  it('07 finds empty-list division without inventing a memory match', () => {
    const result = review('def calculate_average(numbers):\n    return sum(numbers) / len(numbers)')
    const issue = result.issues.find(item => item.title === 'Potential division by zero')
    expect(issue?.severity).toBe('WARNING')
    expect(issue?.memoryId).toBeUndefined()
    expect(result.summary).toContain('No relevant previous team decision found')
    expect(result.fixedCode).toBeUndefined()
  })

  it('08 passes the clean calculation with no findings', () => {
    const result = review('def calculate_total(price, quantity):\n    if price < 0 or quantity < 0:\n        raise ValueError("Invalid input")\n\n    return price * quantity')
    expect(result.issues).toHaveLength(0)
    expect(result.summary).toContain('REVIEW PASSED')
  })

  it('09 catches SQL injection in a different query and function', () => {
    const issue = findIssue('def find_product(product_id):\n    query = "SELECT * FROM products WHERE id=" + product_id\n    return database.execute(query)', 'SQL Injection Risk')
    expect(issue?.severity).toBe('CRITICAL')
    expect(issue?.memoryId).toBe(1)
  })

  it('10 detects an assigned variable that is never read', () => {
    const issue = findIssue('def calculate_price(price, tax):\n    discount = 10\n    final_price = price + tax\n    return final_price', 'Unused variable')
    expect(issue?.severity).toBe('SUGGESTION')
    expect(issue?.snippet).toContain('discount')
  })

  it('11 detects mutable defaults and generates the safe Python fix', () => {
    const result = review('def add_item(item, items=[]):\n    items.append(item)\n    return items')
    expect(result.issues.some(issue => issue.title === 'Mutable default argument')).toBe(true)
    expect(result.fixedCode).toContain('items=None')
    expect(result.fixedCode).toContain('if items is None:')
  })

  it('generates a mutable-default fix when the argument has spaces', () => {
    const result = review('def add_item(item, items = []):\n    items.append(item)\n    return items')
    expect(result.fixedCode).toContain('items = None')
    expect(result.fixedCode).toContain('if items is None:')
  })

  it('12 returns separate SQL and password memory matches', () => {
    const code = 'def login(username, password):\n    query = "SELECT * FROM users WHERE username=\'" + username + "\' AND password=\'" + password + "\'"\n    return database.execute(query)'
    const result = review(code)
    const sqlIssue = result.issues.find(issue => issue.title === 'SQL Injection Risk')
    const passwordIssue = result.issues.find(issue => issue.title === 'Unsafe password handling')
    expect(sqlIssue?.memoryId).toBe(1)
    expect(passwordIssue?.severity).toBe('CRITICAL')
    expect(passwordIssue?.memoryId).toBe(4)
  })

  it('13 produces one combined fix for multiple Python issues', () => {
    const code = `def get_user(user_id, items=[]):
    query = "SELECT * FROM users WHERE id=" + user_id
    items.append(user_id)
    return database.execute(query), items`
    const result = review(code)
    expect(result.fixedCode).toContain('items=None')
    expect(result.fixedCode).toContain('if items is None:')
    expect(result.fixedCode).toContain('%s')
    expect(result.fixedCode).toContain('database.execute(query, (user_id,))')
  })
})