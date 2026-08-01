import { Fragment, type ReactNode } from 'react'

/**
 * Renders TipTap's stored JSON as read-only React nodes.
 *
 * The reader can't reuse the editor for this: an editable ProseMirror
 * instance per page (six live at once during a turn) would be both heavy
 * and interactive, and the whole point of the book view is inert, crisp
 * text that CSS columns can flow across pages.
 */

interface TipTapMark {
  type: string
  attrs?: Record<string, unknown>
}

interface TipTapNode {
  type?: string
  text?: string
  marks?: TipTapMark[]
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
}

function applyMarks(text: string, marks: TipTapMark[] | undefined, key: string): ReactNode {
  if (!marks || marks.length === 0) return text
  return marks.reduce<ReactNode>((node, mark) => {
    switch (mark.type) {
      case 'bold':
      case 'strong':
        return <strong>{node}</strong>
      case 'italic':
      case 'em':
        return <em>{node}</em>
      case 'strike':
        return <s>{node}</s>
      case 'code':
        return <code>{node}</code>
      case 'highlight':
        return <mark>{node}</mark>
      case 'link': {
        // Inert in the reader — a book page shouldn't navigate away.
        return <span className="underline underline-offset-2">{node}</span>
      }
      default:
        return node
    }
  }, <Fragment key={key}>{text}</Fragment>)
}

function renderNode(node: TipTapNode, key: string): ReactNode {
  if (node.type === 'text') return applyMarks(node.text ?? '', node.marks, key)
  if (node.type === 'hardBreak') return <br key={key} />
  if (node.type === 'horizontalRule') return <hr key={key} className="book-rule" />

  const children = (node.content ?? []).map((child, index) => renderNode(child, `${key}-${index}`))

  switch (node.type) {
    case 'doc':
      return <Fragment key={key}>{children}</Fragment>
    case 'paragraph':
      // An empty paragraph is a deliberate beat of white space in prose, so
      // it needs to occupy a line rather than collapse to nothing.
      return (
        <p key={key} className="book-p">
          {children.length > 0 ? children : ' '}
        </p>
      )
    case 'heading': {
      const level = Number(node.attrs?.level ?? 2)
      const Tag = (level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3') as 'h1' | 'h2' | 'h3'
      return (
        <Tag key={key} className="book-h">
          {children}
        </Tag>
      )
    }
    case 'blockquote':
      return (
        <blockquote key={key} className="book-quote">
          {children}
        </blockquote>
      )
    case 'bulletList':
      return (
        <ul key={key} className="book-list">
          {children}
        </ul>
      )
    case 'orderedList':
      return (
        <ol key={key} className="book-list">
          {children}
        </ol>
      )
    case 'listItem':
      return <li key={key}>{children}</li>
    case 'codeBlock':
      return (
        <pre key={key} className="book-pre">
          <code>{children}</code>
        </pre>
      )
    default:
      return <Fragment key={key}>{children}</Fragment>
  }
}

/** Falls back to plain text when the stored content isn't TipTap JSON. */
export function RichText({ content, fallback }: { content: unknown; fallback?: string }) {
  const node = content as TipTapNode | null | undefined

  if (!node || typeof node !== 'object' || !node.type) {
    if (!fallback?.trim()) return null
    return (
      <>
        {fallback.split(/\n{2,}/).map((paragraph, index) => (
          <p key={index} className="book-p">
            {paragraph}
          </p>
        ))}
      </>
    )
  }

  return <>{renderNode(node, 'n')}</>
}
