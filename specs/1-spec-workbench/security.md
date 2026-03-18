# Security Model: Spec Workbench

**Branch**: `1-spec-workbench` | **Date**: 2026-03-18

## Overview

The Spec Workbench is a local-first, browser-only application with no server component. The security model is minimal by design — there is no authentication, no authorization, and no data transmission.

## Authentication

**Not applicable.** The application runs entirely in the browser with no user accounts or server-side sessions. All data is stored locally in IndexedDB.

## Authorization

**Not applicable.** Single-user application. All data is accessible to whoever has access to the browser profile. No roles, permissions, or access control needed.

## Data Classification

| Data Type | Classification | Storage Location | Transmitted? |
|-----------|---------------|-----------------|-------------|
| Project metadata | Non-sensitive | IndexedDB | No |
| Artifact content (markdown) | Non-sensitive (user-generated specs) | IndexedDB | No |
| UI state (collapsed sections, current stage) | Non-sensitive | IndexedDB | No |

No PII is collected or stored by the application itself. Users may include PII in their specification content — this is their responsibility and the data never leaves the browser.

## XSS Prevention

The primary attack vector is cross-site scripting via markdown rendering. User-authored markdown is rendered to HTML by marked.js and inserted into the DOM.

### Mitigations

- **Sanitize HTML output**: Configure marked.js with `sanitize: true` or use DOMPurify as a post-processing step to strip `<script>`, `<iframe>`, event handlers (`onclick`, `onerror`), and `javascript:` URLs
- **Content Security Policy**: Set a strict CSP meta tag disallowing `unsafe-inline` scripts and restricting script sources to `self`
- **No `innerHTML` for user content**: Use marked.js output only through a sanitization pipeline; never insert raw user strings into the DOM via `innerHTML` without sanitization

### Implementation

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
```

marked.js configuration:

```typescript
import { marked } from "marked";
import DOMPurify from "dompurify";

export function renderMarkdown(input: string): string {
  const raw = marked.parse(input);
  return DOMPurify.sanitize(raw);
}
```

## Secrets Management

**Not applicable.** No API keys, tokens, or credentials. No environment variables with sensitive values. No server-side secrets.

## Dependency Security

- Keep dependencies minimal (marked.js, CodeMirror 6, idb, DOMPurify)
- Run `npm audit` as part of CI
- Pin dependency versions in `package-lock.json`
- Review dependency updates before upgrading

## Threat Summary

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| XSS via markdown rendering | Medium | Low (local-only, no auth tokens to steal) | DOMPurify sanitization, CSP headers |
| Data loss (browser storage cleared) | Medium | Medium (user work lost) | Export functionality, storage warnings |
| Malicious markdown import | Low | Low | Sanitize imported content through same pipeline |
| Supply chain attack (npm dependency) | Low | Medium | Minimal deps, npm audit, version pinning |
