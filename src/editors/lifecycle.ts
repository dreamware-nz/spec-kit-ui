import type { Section, EntityLifecycle, LifecycleTransition } from '../models/artifact'

/** Parse lifecycle markdown into structured data */
export function parseLifecycle(content: string): EntityLifecycle {
  const lifecycle: EntityLifecycle = {
    entityName: '',
    states: [],
    transitions: [],
    terminalStates: [],
    reEntryRules: '',
  }

  const lines = content.split('\n')
  let inTransitionTable = false
  let headerParsed = false
  let reEntryLines: string[] = []
  let inReEntry = false

  for (const line of lines) {
    // Entity name
    const entityMatch = line.match(/^#+\s+(.+)\s+Lifecycle$/i)
    if (entityMatch) {
      lifecycle.entityName = entityMatch[1].trim()
      continue
    }

    // States list
    const statesMatch = line.match(/^\*\*States\*\*:\s*(.+)/i)
    if (statesMatch) {
      lifecycle.states = statesMatch[1].split(',').map(s => s.trim()).filter(Boolean)
      inReEntry = false
      continue
    }

    // Terminal states
    const termMatch = line.match(/^\*\*Terminal [Ss]tates?\*\*:\s*(.+)/i)
    if (termMatch) {
      lifecycle.terminalStates = termMatch[1].split(',').map(s => s.trim()).filter(Boolean)
      inReEntry = false
      continue
    }

    // Re-entry rules
    const reEntryMatch = line.match(/^\*\*Re-entry [Rr]ules?\*\*:\s*(.*)/i)
    if (reEntryMatch) {
      inReEntry = true
      inTransitionTable = false
      if (reEntryMatch[1].trim()) {
        reEntryLines.push(reEntryMatch[1].trim())
      }
      continue
    }

    if (inReEntry) {
      if (line.match(/^\*\*/)) {
        inReEntry = false
      } else {
        reEntryLines.push(line)
        continue
      }
    }

    // Transition table detection
    if (line.match(/^\|\s*From\s*\|/i)) {
      inTransitionTable = true
      headerParsed = false
      continue
    }

    if (inTransitionTable) {
      // Skip separator row
      if (line.match(/^\|[\s-|]+$/)) {
        headerParsed = true
        continue
      }
      // Parse data row
      if (headerParsed && line.startsWith('|')) {
        const cells = line.split('|').map(c => c.trim()).filter(Boolean)
        if (cells.length >= 4) {
          lifecycle.transitions.push({
            from: cells[0],
            to: cells[1],
            trigger: cells[2],
            guardCondition: cells[3],
          })
        }
        continue
      }
      // End of table
      if (!line.startsWith('|')) {
        inTransitionTable = false
      }
    }
  }

  lifecycle.reEntryRules = reEntryLines.join('\n').trim()
  return lifecycle
}

/** Serialize lifecycle to markdown */
export function lifecycleToMarkdown(lc: EntityLifecycle): string {
  const parts: string[] = []

  if (lc.states.length > 0) {
    parts.push(`**States**: ${lc.states.join(', ')}`)
  }

  if (lc.transitions.length > 0) {
    parts.push('')
    parts.push('| From | To | Trigger | Guard |')
    parts.push('| --- | --- | --- | --- |')
    for (const t of lc.transitions) {
      parts.push(`| ${t.from} | ${t.to} | ${t.trigger} | ${t.guardCondition} |`)
    }
  }

  if (lc.terminalStates.length > 0) {
    parts.push('')
    parts.push(`**Terminal States**: ${lc.terminalStates.join(', ')}`)
  }

  if (lc.reEntryRules) {
    parts.push('')
    parts.push(`**Re-entry Rules**: ${lc.reEntryRules}`)
  }

  return parts.join('\n')
}

export function renderLifecycleEditor(
  section: Section,
  onUpdate: (structuredData: EntityLifecycle) => void,
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'structured-editor lifecycle-editor'

  const lifecycle = parseLifecycle(section.content)

  function fireUpdate(): void {
    section.content = lifecycleToMarkdown(lifecycle)
    section.structuredData = { ...lifecycle, transitions: [...lifecycle.transitions] }
    onUpdate(lifecycle)
  }

  // Entity Name
  container.appendChild(makeLabel('Entity Name'))
  const nameInput = document.createElement('input')
  nameInput.className = 'input'
  nameInput.value = lifecycle.entityName
  nameInput.addEventListener('input', () => {
    lifecycle.entityName = nameInput.value
    fireUpdate()
  })
  container.appendChild(nameInput)

  // States
  container.appendChild(makeLabel('States (comma-separated)'))
  const statesInput = document.createElement('input')
  statesInput.className = 'input'
  statesInput.value = lifecycle.states.join(', ')
  statesInput.addEventListener('input', () => {
    lifecycle.states = statesInput.value.split(',').map(s => s.trim()).filter(Boolean)
    fireUpdate()
  })
  container.appendChild(statesInput)

  // Transitions table
  container.appendChild(makeLabel('Transitions'))
  const tableWrap = document.createElement('div')
  tableWrap.style.overflowX = 'auto'
  tableWrap.style.marginBottom = 'var(--space-2)'

  function rebuildTable(): void {
    tableWrap.textContent = ''

    const table = document.createElement('table')
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.fontSize = 'var(--text-sm)'

    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    for (const h of ['From', 'To', 'Trigger', 'Guard', '']) {
      const th = document.createElement('th')
      th.textContent = h
      th.style.padding = 'var(--space-2)'
      th.style.borderBottom = '2px solid var(--color-border)'
      th.style.textAlign = 'left'
      headRow.appendChild(th)
    }
    thead.appendChild(headRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (let i = 0; i < lifecycle.transitions.length; i++) {
      const tr = document.createElement('tr')
      const t = lifecycle.transitions[i]

      for (const [key] of [['from'], ['to'], ['trigger'], ['guardCondition']] as const) {
        const td = document.createElement('td')
        td.style.padding = 'var(--space-1, 4px)'
        const inp = document.createElement('input')
        inp.className = 'input'
        inp.value = t[key as keyof LifecycleTransition]
        inp.style.width = '100%'
        const field = key as keyof LifecycleTransition
        inp.addEventListener('input', () => {
          (t as unknown as Record<string, string>)[field] = inp.value
          fireUpdate()
        })
        td.appendChild(inp)
        tr.appendChild(td)
      }

      // Delete button
      const delTd = document.createElement('td')
      delTd.style.padding = 'var(--space-1, 4px)'
      const delBtn = document.createElement('button')
      delBtn.className = 'btn'
      delBtn.textContent = '\u00D7'
      delBtn.title = 'Remove transition'
      const idx = i
      delBtn.addEventListener('click', () => {
        lifecycle.transitions.splice(idx, 1)
        fireUpdate()
        rebuildTable()
      })
      delTd.appendChild(delBtn)
      tr.appendChild(delTd)

      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    tableWrap.appendChild(table)

    const addBtn = document.createElement('button')
    addBtn.className = 'btn btn--primary'
    addBtn.textContent = 'Add Transition'
    addBtn.style.marginTop = 'var(--space-2)'
    addBtn.addEventListener('click', () => {
      lifecycle.transitions.push({ from: '', to: '', trigger: '', guardCondition: '' })
      fireUpdate()
      rebuildTable()
    })
    tableWrap.appendChild(addBtn)
  }

  rebuildTable()
  container.appendChild(tableWrap)

  // Terminal States
  container.appendChild(makeLabel('Terminal States (comma-separated)'))
  const termInput = document.createElement('input')
  termInput.className = 'input'
  termInput.value = lifecycle.terminalStates.join(', ')
  termInput.addEventListener('input', () => {
    lifecycle.terminalStates = termInput.value.split(',').map(s => s.trim()).filter(Boolean)
    fireUpdate()
  })
  container.appendChild(termInput)

  // Re-entry Rules
  container.appendChild(makeLabel('Re-entry Rules'))
  const reEntryInput = document.createElement('textarea')
  reEntryInput.className = 'textarea'
  reEntryInput.rows = 3
  reEntryInput.value = lifecycle.reEntryRules
  reEntryInput.addEventListener('input', () => {
    lifecycle.reEntryRules = reEntryInput.value
    fireUpdate()
  })
  container.appendChild(reEntryInput)

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
