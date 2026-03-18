import type { Section, SystemBehavior } from '../models/artifact'

const TRIGGER_TYPES: SystemBehavior['triggerType'][] = [
  'user-action',
  'time-based',
  'external-event',
  'state-change',
  'threshold-breach',
]

/** Parse SB-### patterns from markdown content */
export function parseBehaviors(content: string): SystemBehavior[] {
  const behaviors: SystemBehavior[] = []
  const lines = content.split('\n')
  let current: SystemBehavior | null = null

  for (const line of lines) {
    const sbMatch = line.match(/^-\s+\*\*SB-(\d+)\*\*:\s*When\s+(.*?),\s*the system MUST\s*(.*)/)
    if (sbMatch) {
      if (current) behaviors.push(current)
      current = {
        id: `SB-${sbMatch[1]}`,
        trigger: sbMatch[2].trim(),
        action: sbMatch[3].trim(),
        triggerType: 'user-action',
        failureHandling: '',
      }
      continue
    }

    // Fallback: SB pattern without "When ... MUST" structure
    const sbFallback = line.match(/^-\s+\*\*SB-(\d+)\*\*:\s*(.*)/)
    if (sbFallback && !sbMatch) {
      if (current) behaviors.push(current)
      current = {
        id: `SB-${sbFallback[1]}`,
        trigger: sbFallback[2].trim(),
        action: '',
        triggerType: 'user-action',
        failureHandling: '',
      }
      continue
    }

    if (current) {
      const triggerTypeMatch = line.match(/^\s+-\s+\*\*Trigger type\*\*:\s*(.*)/i)
      if (triggerTypeMatch) {
        const val = triggerTypeMatch[1].trim() as SystemBehavior['triggerType']
        if (TRIGGER_TYPES.includes(val)) {
          current.triggerType = val
        }
        continue
      }
      const failMatch = line.match(/^\s+-\s+\*\*Failure handling\*\*:\s*(.*)/i)
      if (failMatch) {
        current.failureHandling = failMatch[1].trim()
        continue
      }
    }
  }

  if (current) behaviors.push(current)
  return behaviors
}

/** Serialize behaviors to markdown */
export function behaviorsToMarkdown(behaviors: SystemBehavior[]): string {
  return behaviors
    .map(sb =>
      `- **${sb.id}**: When ${sb.trigger}, the system MUST ${sb.action}\n  - **Trigger type**: ${sb.triggerType}\n  - **Failure handling**: ${sb.failureHandling}`,
    )
    .join('\n')
}

function nextId(behaviors: SystemBehavior[]): string {
  const nums = behaviors.map(b => {
    const m = b.id.match(/SB-(\d+)/)
    return m ? parseInt(m[1], 10) : 0
  })
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return `SB-${String(max + 1).padStart(3, '0')}`
}

export function renderBehaviorEditor(
  section: Section,
  onUpdate: (structuredData: SystemBehavior[]) => void,
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'structured-editor behavior-editor'

  let behaviors: SystemBehavior[] = parseBehaviors(section.content)

  function fireUpdate(): void {
    section.content = behaviorsToMarkdown(behaviors)
    section.structuredData = [...behaviors]
    onUpdate(behaviors)
  }

  function rebuild(): void {
    container.textContent = ''

    for (let i = 0; i < behaviors.length; i++) {
      const sb = behaviors[i]
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
      delBtn.title = 'Remove behavior'
      delBtn.style.position = 'absolute'
      delBtn.style.top = 'var(--space-2)'
      delBtn.style.right = 'var(--space-2)'
      delBtn.style.padding = '0 var(--space-2)'
      delBtn.style.minWidth = '0'
      const idx = i
      delBtn.addEventListener('click', () => {
        behaviors.splice(idx, 1)
        fireUpdate()
        rebuild()
      })
      card.appendChild(delBtn)

      // ID label
      const idLabel = document.createElement('div')
      idLabel.style.fontWeight = '600'
      idLabel.style.marginBottom = 'var(--space-2)'
      idLabel.textContent = sb.id
      card.appendChild(idLabel)

      // Trigger
      card.appendChild(makeLabel('Trigger'))
      const triggerInput = document.createElement('textarea')
      triggerInput.className = 'textarea'
      triggerInput.rows = 2
      triggerInput.value = sb.trigger
      triggerInput.addEventListener('input', () => {
        sb.trigger = triggerInput.value
        fireUpdate()
      })
      card.appendChild(triggerInput)

      // Action
      card.appendChild(makeLabel('Action'))
      const actionInput = document.createElement('textarea')
      actionInput.className = 'textarea'
      actionInput.rows = 2
      actionInput.value = sb.action
      actionInput.addEventListener('input', () => {
        sb.action = actionInput.value
        fireUpdate()
      })
      card.appendChild(actionInput)

      // Trigger Type
      card.appendChild(makeLabel('Trigger Type'))
      const select = document.createElement('select')
      select.className = 'input'
      for (const tt of TRIGGER_TYPES) {
        const opt = document.createElement('option')
        opt.value = tt
        opt.textContent = tt
        if (tt === sb.triggerType) opt.selected = true
        select.appendChild(opt)
      }
      select.addEventListener('change', () => {
        sb.triggerType = select.value as SystemBehavior['triggerType']
        fireUpdate()
      })
      card.appendChild(select)

      // Failure Handling
      card.appendChild(makeLabel('Failure Handling'))
      const failInput = document.createElement('textarea')
      failInput.className = 'textarea'
      failInput.rows = 2
      failInput.value = sb.failureHandling
      failInput.addEventListener('input', () => {
        sb.failureHandling = failInput.value
        fireUpdate()
      })
      card.appendChild(failInput)

      container.appendChild(card)
    }

    // Add button
    const addBtn = document.createElement('button')
    addBtn.className = 'btn btn--primary'
    addBtn.textContent = 'Add Behavior'
    addBtn.addEventListener('click', () => {
      behaviors.push({
        id: nextId(behaviors),
        trigger: '',
        action: '',
        triggerType: 'user-action',
        failureHandling: '',
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
