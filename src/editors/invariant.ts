import type { Section, Invariant } from '../models/artifact'

/** Parse INV-### patterns from markdown content */
export function parseInvariants(content: string): Invariant[] {
  const invariants: Invariant[] = []
  const lines = content.split('\n')
  let current: Invariant | null = null

  for (const line of lines) {
    const invMatch = line.match(/^-\s+\*\*INV-(\d+)\*\*:\s*(.*)/)
    if (invMatch) {
      if (current) invariants.push(current)
      current = {
        id: `INV-${invMatch[1]}`,
        rule: invMatch[2].trim(),
        scope: '',
        violationConsequence: '',
      }
      continue
    }

    if (current) {
      const scopeMatch = line.match(/^\s+-\s+\*\*Scope\*\*:\s*(.*)/)
      if (scopeMatch) {
        current.scope = scopeMatch[1].trim()
        continue
      }
      const violationMatch = line.match(/^\s+-\s+\*\*Violation consequence\*\*:\s*(.*)/)
      if (violationMatch) {
        current.violationConsequence = violationMatch[1].trim()
        continue
      }
    }
  }

  if (current) invariants.push(current)
  return invariants
}

/** Serialize invariants to markdown */
export function invariantsToMarkdown(invariants: Invariant[]): string {
  return invariants
    .map(inv =>
      `- **${inv.id}**: ${inv.rule}\n  - **Scope**: ${inv.scope}\n  - **Violation consequence**: ${inv.violationConsequence}`,
    )
    .join('\n')
}

function nextId(invariants: Invariant[]): string {
  const nums = invariants.map(i => {
    const m = i.id.match(/INV-(\d+)/)
    return m ? parseInt(m[1], 10) : 0
  })
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return `INV-${String(max + 1).padStart(3, '0')}`
}

export function renderInvariantEditor(
  section: Section,
  onUpdate: (structuredData: Invariant[]) => void,
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'structured-editor invariant-editor'

  let invariants: Invariant[] = parseInvariants(section.content)

  function fireUpdate(): void {
    section.content = invariantsToMarkdown(invariants)
    section.structuredData = [...invariants]
    onUpdate(invariants)
  }

  function rebuild(): void {
    container.textContent = ''

    for (let i = 0; i < invariants.length; i++) {
      const inv = invariants[i]
      const card = document.createElement('div')
      card.className = 'structured-item'
      card.style.border = '1px solid var(--color-border)'
      card.style.borderRadius = 'var(--radius-sm)'
      card.style.padding = 'var(--space-3)'
      card.style.marginBottom = 'var(--space-2)'
      card.style.position = 'relative'

      // Delete button
      const delBtn = document.createElement('button')
      delBtn.className = 'btn'
      delBtn.textContent = '\u00D7'
      delBtn.title = 'Remove invariant'
      delBtn.style.position = 'absolute'
      delBtn.style.top = 'var(--space-2)'
      delBtn.style.right = 'var(--space-2)'
      delBtn.style.padding = '0 var(--space-2)'
      delBtn.style.minWidth = '0'
      const idx = i
      delBtn.addEventListener('click', () => {
        invariants.splice(idx, 1)
        fireUpdate()
        rebuild()
      })
      card.appendChild(delBtn)

      // ID label
      const idLabel = document.createElement('div')
      idLabel.style.fontWeight = '600'
      idLabel.style.marginBottom = 'var(--space-2)'
      idLabel.textContent = inv.id
      card.appendChild(idLabel)

      // Rule
      card.appendChild(makeLabel('Rule'))
      const ruleInput = document.createElement('textarea')
      ruleInput.className = 'textarea'
      ruleInput.rows = 2
      ruleInput.value = inv.rule
      ruleInput.addEventListener('input', () => {
        inv.rule = ruleInput.value
        fireUpdate()
      })
      card.appendChild(ruleInput)

      // Scope
      card.appendChild(makeLabel('Scope'))
      const scopeInput = document.createElement('input')
      scopeInput.className = 'input'
      scopeInput.value = inv.scope
      scopeInput.addEventListener('input', () => {
        inv.scope = scopeInput.value
        fireUpdate()
      })
      card.appendChild(scopeInput)

      // Violation Consequence
      card.appendChild(makeLabel('Violation Consequence'))
      const vcInput = document.createElement('input')
      vcInput.className = 'input'
      vcInput.value = inv.violationConsequence
      vcInput.addEventListener('input', () => {
        inv.violationConsequence = vcInput.value
        fireUpdate()
      })
      card.appendChild(vcInput)

      container.appendChild(card)
    }

    // Add button
    const addBtn = document.createElement('button')
    addBtn.className = 'btn btn--primary'
    addBtn.textContent = 'Add Invariant'
    addBtn.addEventListener('click', () => {
      invariants.push({
        id: nextId(invariants),
        rule: '',
        scope: '',
        violationConsequence: '',
      })
      fireUpdate()
      rebuild()
    })
    container.appendChild(addBtn)
  }

  rebuild()
  return container
}

function makeLabel(text: string): HTMLElement {
  const label = document.createElement('label')
  label.style.display = 'block'
  label.style.fontSize = 'var(--text-sm)'
  label.style.fontWeight = '500'
  label.style.marginTop = 'var(--space-2)'
  label.style.marginBottom = 'var(--space-1, 4px)'
  label.style.color = 'var(--color-text-secondary)'
  label.textContent = text
  return label
}
