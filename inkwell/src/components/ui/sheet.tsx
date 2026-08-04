import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in',
      className,
    )}
    {...props}
  />
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

// `overflow-y-auto` on the base for the same reason the dialog has it: a
// sheet with more in it than the screen is tall otherwise runs off the end
// with nothing to scroll, and the items past the edge are unreachable rather
// than merely out of sight. That is not hypothetical now a theme can scale
// the whole interface up — the mobile nav at 125% on a short phone is taller
// than the phone.
//
// `dvh` rather than `vh` throughout: on a phone `vh` keeps reporting the
// height the viewport has when the browser chrome is hidden, which is not
// the height the sheet actually has to fit into.
const sheetVariants = cva('fixed z-50 flex flex-col gap-4 overflow-y-auto bg-card shadow-lg', {
  variants: {
    side: {
      // Heights come from `--vvh` — the screen minus the keyboard — for the
      // same reason the dialog's do. A side sheet pinned `inset-y-0` runs the
      // full layout viewport, so with a keyboard up its lower third is
      // underneath one.
      left: 'left-0 top-[var(--vvtop,0px)] h-[var(--vvh,100dvh)] w-full max-w-xs border-r border-border data-[state=open]:animate-sheet-in-left',
      right:
        'right-0 top-[var(--vvtop,0px)] h-[var(--vvh,100dvh)] w-full max-w-xs border-l border-border data-[state=open]:animate-sheet-in-right',
      top: 'inset-x-0 top-[var(--vvtop,0px)] max-h-[calc(var(--vvh,100dvh)*0.85)] border-b border-border data-[state=open]:animate-sheet-in-top',
      bottom:
        'inset-x-0 bottom-0 max-h-[calc(var(--vvh,100dvh)*0.85)] rounded-t-xl border-t border-border data-[state=open]:animate-sheet-in-bottom',
    },
  },
  defaultVariants: {
    side: 'right',
  },
})

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  hideClose?: boolean
}

const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ side = 'right', className, children, hideClose, ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 opacity-60 ring-offset-background transition-opacity hover:bg-accent hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  ),
)
SheetContent.displayName = DialogPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 px-5 pt-5', className)} {...props} />
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-auto flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end', className)} {...props} />
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('font-serif text-base font-semibold text-foreground', className)}
    {...props}
  />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
SheetDescription.displayName = DialogPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
