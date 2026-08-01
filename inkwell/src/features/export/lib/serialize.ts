/**
 * Converts stored TipTap JSON into the plain formats the exporters need.
 *
 * The editor's own HTML serializer isn't reused here because it emits
 * editor-flavoured markup (ProseMirror classes, decoration spans, the
 * Codex-highlight marks). An exported manuscript should carry the author's
 * words and structure and nothing about the tool that wrote them.
 */

interface Mark {
  type: string
}

interface Node {
  type?: string
  text?: string
  marks?: Mark[]
  attrs?: Record<string, unknown>
  content?: Node[]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escapes the characters Markdown would otherwise treat as syntax. */
function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_[\]])/g, '\\$1')
}

function hasMark(node: Node, type: string): boolean {
  return (node.marks ?? []).some((mark) => mark.type === type)
}

function inlineToMarkdown(node: Node): string {
  if (node.type === 'hardBreak') return '  \n'
  if (node.type !== 'text') return (node.content ?? []).map(inlineToMarkdown).join('')

  let text = escapeMarkdown(node.text ?? '')
  // Code first: its content is literal, so other markers must sit outside it.
  if (hasMark(node, 'code')) text = `\`${node.text ?? ''}\``
  if (hasMark(node, 'bold') || hasMark(node, 'strong')) text = `**${text}**`
  if (hasMark(node, 'italic') || hasMark(node, 'em')) text = `*${text}*`
  if (hasMark(node, 'strike')) text = `~~${text}~~`
  return text
}

function inlineToHtml(node: Node): string {
  if (node.type === 'hardBreak') return '<br/>'
  if (node.type !== 'text') return (node.content ?? []).map(inlineToHtml).join('')

  let text = escapeHtml(node.text ?? '')
  if (hasMark(node, 'code')) text = `<code>${text}</code>`
  if (hasMark(node, 'bold') || hasMark(node, 'strong')) text = `<strong>${text}</strong>`
  if (hasMark(node, 'italic') || hasMark(node, 'em')) text = `<em>${text}</em>`
  if (hasMark(node, 'strike')) text = `<s>${text}</s>`
  return text
}

function blockToMarkdown(node: Node): string {
  const inline = () => (node.content ?? []).map(inlineToMarkdown).join('')

  switch (node.type) {
    case 'paragraph':
      return inline()
    case 'heading':
      return `${'#'.repeat(Number(node.attrs?.level ?? 2))} ${inline()}`
    case 'blockquote':
      return (node.content ?? [])
        .map(blockToMarkdown)
        .join('\n\n')
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => `- ${(item.content ?? []).map(blockToMarkdown).join(' ')}`)
        .join('\n')
    case 'orderedList':
      return (node.content ?? [])
        .map((item, i) => `${i + 1}. ${(item.content ?? []).map(blockToMarkdown).join(' ')}`)
        .join('\n')
    case 'codeBlock':
      return `\`\`\`\n${(node.content ?? []).map((c) => c.text ?? '').join('')}\n\`\`\``
    case 'horizontalRule':
      return '---'
    default:
      return inline()
  }
}

function blockToHtml(node: Node): string {
  const inline = () => (node.content ?? []).map(inlineToHtml).join('')

  switch (node.type) {
    case 'paragraph': {
      const body = inline()
      // Preserve deliberate blank paragraphs — in prose they're a beat.
      return body.trim() ? `<p>${body}</p>` : '<p>&#160;</p>'
    }
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 2)))
      return `<h${level}>${inline()}</h${level}>`
    }
    case 'blockquote':
      return `<blockquote>${(node.content ?? []).map(blockToHtml).join('')}</blockquote>`
    case 'bulletList':
      return `<ul>${(node.content ?? [])
        .map((item) => `<li>${(item.content ?? []).map(blockToHtml).join('')}</li>`)
        .join('')}</ul>`
    case 'orderedList':
      return `<ol>${(node.content ?? [])
        .map((item) => `<li>${(item.content ?? []).map(blockToHtml).join('')}</li>`)
        .join('')}</ol>`
    case 'codeBlock':
      return `<pre><code>${escapeHtml(
        (node.content ?? []).map((c) => c.text ?? '').join(''),
      )}</code></pre>`
    case 'horizontalRule':
      return '<hr/>'
    default:
      return inline() ? `<p>${inline()}</p>` : ''
  }
}

function topLevelBlocks(content: unknown): Node[] {
  const doc = content as Node | null | undefined
  if (!doc || typeof doc !== 'object') return []
  if (doc.type === 'doc') return doc.content ?? []
  return [doc]
}

export function sceneToMarkdown(content: unknown, fallback: string): string {
  const blocks = topLevelBlocks(content)
  if (blocks.length === 0) return fallback.trim()
  return blocks.map(blockToMarkdown).join('\n\n').trim()
}

export function sceneToHtml(content: unknown, fallback: string): string {
  const blocks = topLevelBlocks(content)
  if (blocks.length === 0) {
    return fallback
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join('\n')
  }
  return blocks.map(blockToHtml).join('\n')
}

/** Flat paragraph strings, used by the DOCX builder which needs runs rather
 * than markup. Formatting marks are dropped; DOCX styling comes from the
 * paragraph style instead. */
export function sceneToParagraphs(content: unknown, fallback: string): string[] {
  const blocks = topLevelBlocks(content)
  if (blocks.length === 0) {
    return fallback.split(/\n{2,}/).filter((p) => p.trim().length > 0)
  }
  return blocks
    .map((block) => (block.content ?? []).map(plainInline).join(''))
    .filter((line) => line.trim().length > 0)
}

function plainInline(node: Node): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(plainInline).join('')
}

export { escapeHtml }
