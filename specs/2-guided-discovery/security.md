# Security Model: Guided Discovery

**Branch**: `2-guided-discovery` | **Date**: 2026-03-18
**Input**: `specs/2-guided-discovery/spec.md` (INV-001, FR-009)

## Threat Model

This feature introduces a new attack surface: the Claude API key. The application remains local-first with no backend, but now makes outbound HTTPS requests to `api.anthropic.com`. The primary security concern is protecting the API key from leakage.

### Assets

| Asset | Sensitivity | Storage |
|-------|------------|---------|
| Claude API key | HIGH — grants access to user's Anthropic account, can incur costs | localStorage only |
| Conversation history | LOW — user's own data, local only | IndexedDB |
| Spec content | LOW — user's own data, local only | IndexedDB |

### Threat Vectors

| Threat | Mitigation |
|--------|-----------|
| API key leaked via IndexedDB export | Key is never stored in IndexedDB. Export functions do not access localStorage. |
| API key logged to console | Config module never logs key values. All logging uses redacted representations. |
| API key visible in network tab | Only transmitted to `https://api.anthropic.com` via HTTPS. CSP `connect-src` restricts outbound connections. |
| API key exposed via DOM inspection | Input uses `type="password"`. Key is not rendered in any DOM element after entry. |
| XSS exfiltrates API key | CSP disallows inline scripts and restricts script sources. DOMPurify sanitizes all rendered markdown (existing Feature 1 mitigation). |
| Malicious browser extension reads localStorage | Out of scope — browser extensions have full access regardless. User responsibility. |
| API key in URL or query params | Key is sent only in the `x-api-key` HTTP header by the SDK. Never in URLs. |

## API Key Handling (INV-001)

### Storage Rules

1. The API key MUST be stored in `localStorage` under key `spec-workbench-llm-config`
2. The API key MUST NOT be stored in IndexedDB — not in conversations, not in project data, not anywhere
3. The API key MUST NOT appear in exported files (markdown export, JSON export)
4. The API key MUST NOT be logged to `console.log`, `console.error`, or any logging mechanism
5. The API key MUST NOT be transmitted over the network except to `https://api.anthropic.com` via HTTPS

### Input Handling

- API key input field uses `type="password"` to mask the value
- A show/hide toggle allows the user to verify the key before saving
- On save, the key is validated by making a test API call (`messages.create` with minimal payload)
- If validation fails, the key is not saved and an error is shown
- After successful save, the input value is cleared from the DOM

### Deletion

- User can clear the API key via a "Remove API Key" button in settings
- Clearing removes the entire `spec-workbench-llm-config` entry from localStorage
- The app returns to the API key modal state

## Content Security Policy

Update `index.html` to allow outbound connections to the Anthropic API:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.anthropic.com;
  img-src 'self' data:;
">
```

The key addition is `connect-src https://api.anthropic.com` — this allows `fetch` / SSE connections to the Claude API while blocking connections to any other external origin.

## Input Sanitization

### User Chat Input

- User messages are plain text — no HTML rendering
- Messages are displayed using `textContent` (not `innerHTML`)
- Messages sent to the LLM are passed as-is (the LLM API handles its own input safely)

### LLM Response Rendering

- Conversational text from the LLM is rendered as plain text in chat bubbles using `textContent`
- Spec update content extracted by the response parser is treated as markdown and sanitized through the existing `markdownToHtml` pipeline (which uses DOMPurify) before rendering in section cards
- The response parser's delimiter detection uses string matching, not regex on untrusted input — the delimiters are fixed strings

### Spec Content

- All spec content continues to be sanitized through DOMPurify when rendered as HTML (existing Feature 1 behavior)
- Raw markdown is stored in IndexedDB — no sanitization needed for storage

## Authentication

No user authentication — the application is local-only. The Claude API key serves as the authentication credential for the Anthropic API.

## Authorization

No authorization model — single-user application. All data belongs to the local user.

## Network Security

- All API calls use HTTPS (enforced by the SDK and CSP)
- No backend server to secure
- No cookies, sessions, or tokens beyond the API key
- CORS is handled by the Anthropic API (they set appropriate headers for browser clients)

## Data Classification

| Data Type | Classification | Handling |
|-----------|---------------|----------|
| API key | Sensitive | localStorage only, never logged, never exported, password-masked input |
| Conversation messages | Internal | IndexedDB, included in exports if user explicitly exports |
| Spec content | Internal | IndexedDB, markdown export |
| LLM config (non-key fields) | Internal | localStorage, not sensitive |
