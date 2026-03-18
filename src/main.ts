import './styles/reset.css'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/responsive.css'

const app = document.getElementById('app')!

// Build shell using safe DOM methods
const shell = document.createElement('div')
shell.className = 'app-shell'

const sidebar = document.createElement('aside')
sidebar.className = 'sidebar'
sidebar.textContent = 'Sidebar'

const content = document.createElement('main')
content.className = 'content-panel'
content.textContent = 'Content'

shell.appendChild(sidebar)
shell.appendChild(content)
app.appendChild(shell)
