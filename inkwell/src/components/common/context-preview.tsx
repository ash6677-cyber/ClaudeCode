import { Check, EyeOff, Scissors } from 'lucide-react'

import { omittedItems, sentItems, type ContextItem, type ContextPlan } from '@/lib/ai/context-plan'
import { cn } from '@/lib/utils'

/**
 * What the model sees, and what it doesn't.
 *
 * One component for every feature that talks to a model, on purpose: the
 * answer to "why did it not know that?" should look the same in a chat, in
 * the editor and in the Book Creator, because it is the same question.
 *
 * The omitted half is the part that earns this screen. A list of what was sent
 * cannot explain an absence, and an absence is what sends a writer looking.
 */
export function ContextPreview({ plan, className }: { plan: ContextPlan; className?: string }) {
  const sent = sentItems(plan)
  const omitted = omittedItems(plan)

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-xs text-muted-foreground">
        About <strong className="text-foreground">{plan.includedTokens.toLocaleString()}</strong>{' '}
        tokens go with your next message.
        {plan.excludedTokens > 0 && (
          <> Another {plan.excludedTokens.toLocaleString()} were considered and left out.</>
        )}{' '}
        Counts are estimates — every model counts a little differently.
      </p>

      <section className="space-y-1.5">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sent ({sent.length})
        </h3>
        {sent.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            Nothing yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sent.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      {omitted.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Not sent ({omitted.length})
          </h3>
          <ul className="space-y-1.5">
            {omitted.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Row({ item }: { item: ContextItem }) {
  const Icon = item.outcome === 'excluded' ? EyeOff : item.outcome === 'trimmed' ? Scissors : Check
  return (
    <li
      className={cn(
        'rounded-md border p-2.5',
        item.outcome === 'excluded' ? 'border-dashed border-border bg-muted/30' : 'border-border',
      )}
    >
      <div className="flex items-baseline gap-2">
        <Icon
          className={cn(
            'size-3.5 shrink-0 translate-y-0.5',
            item.outcome === 'excluded' ? 'text-muted-foreground' : 'text-primary',
          )}
          aria-hidden
        />
        <p className="min-w-0 flex-1 truncate text-xs font-medium">{item.label}</p>
        {item.source && (
          <span className="shrink-0 text-[11px] text-muted-foreground">{item.source}</span>
        )}
        <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
          ≈{item.tokens.toLocaleString()}
        </span>
      </div>
      {item.reason && (
        <p className="mt-1 pl-5 text-[11px] text-muted-foreground/90">{item.reason}</p>
      )}
      {item.outcome !== 'excluded' && item.content.trim() && (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap pl-5 text-[11px] text-muted-foreground/80">
          {item.content}
        </p>
      )}
    </li>
  )
}
