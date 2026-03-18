import { markdownToHtml } from '../parsers/markdown-io'
import { addToast } from '../store/state'

const PRINT_STYLES = `
  @page {
    size: A4;
    margin: 2cm;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 100%;
  }
  h1 {
    font-size: 22pt;
    border-bottom: 2px solid #2563eb;
    padding-bottom: 8pt;
    margin-bottom: 16pt;
    color: #1a1a1a;
  }
  h2 {
    font-size: 16pt;
    margin-top: 24pt;
    margin-bottom: 8pt;
    color: #1a1a1a;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 4pt;
  }
  h3 {
    font-size: 13pt;
    margin-top: 16pt;
    margin-bottom: 6pt;
    color: #333;
  }
  h4 { font-size: 11pt; font-weight: 700; margin-top: 12pt; }
  p { margin-bottom: 8pt; }
  ul, ol { padding-left: 24pt; margin-bottom: 8pt; }
  li { margin-bottom: 4pt; }
  code {
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 9pt;
    background: #f5f5f5;
    padding: 1pt 3pt;
    border-radius: 2pt;
  }
  pre {
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    padding: 8pt;
    border-radius: 4pt;
    font-size: 9pt;
    overflow-x: auto;
    page-break-inside: avoid;
  }
  pre code { background: none; padding: 0; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 8pt 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #e0e0e0;
    padding: 4pt 8pt;
    text-align: left;
  }
  th { background: #f5f5f5; font-weight: 600; }
  blockquote {
    border-left: 3px solid #e0e0e0;
    padding-left: 12pt;
    color: #555;
    margin: 8pt 0;
  }
  strong { font-weight: 700; }
  em { font-style: italic; }
  hr {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 16pt 0;
  }
  /* Page break hints */
  h2 { page-break-before: auto; page-break-after: avoid; }
  h3 { page-break-after: avoid; }
  /* Header/footer */
  .pdf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #2563eb;
    padding-bottom: 12pt;
    margin-bottom: 24pt;
  }
  .pdf-header-title { font-size: 10pt; color: #555; }
  .pdf-header-date { font-size: 9pt; color: #888; }
  .pdf-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 8pt;
    color: #888;
    padding: 8pt 0;
  }
  /* Hide comments */
  .hidden { display: none; }
`

export function exportSpecAsPdf(specContent: string, projectName: string): void {
  // Convert markdown to HTML
  const htmlContent = markdownToHtml(specContent)

  // Strip HTML comments from the rendered output
  const cleanHtml = htmlContent.replace(/<!--[\s\S]*?-->/g, '')

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Build full HTML document for printing
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${projectName} — Specification</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="pdf-header">
    <span class="pdf-header-title">${projectName}</span>
    <span class="pdf-header-date">${date}</span>
  </div>
  ${cleanHtml}
</body>
</html>`

  // Create hidden iframe for printing
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    addToast('Failed to create PDF preview', 'error')
    document.body.removeChild(iframe)
    return
  }

  iframeDoc.open()
  iframeDoc.write(fullHtml)
  iframeDoc.close()

  // Wait for content to render, then print
  setTimeout(() => {
    try {
      iframe.contentWindow?.print()
      addToast('PDF print dialog opened — choose "Save as PDF"', 'info')
    } catch (err) {
      addToast('Failed to open print dialog', 'error')
    }
    // Clean up iframe after a delay (print dialog blocks)
    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 1000)
  }, 250)
}
