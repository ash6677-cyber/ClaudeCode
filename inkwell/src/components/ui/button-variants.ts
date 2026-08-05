import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/92 hover:shadow-glow',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md',
        outline:
          'border border-input bg-background shadow-xs hover:border-accent-foreground/20 hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/70',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline active:scale-100',
      },
      /*
       * Two sizes for every button: the one a cursor needs and the one a
       * fingertip does. A mouse pointer is a single pixel and a fingertip is
       * about 44 of them, which is why every platform's guidance lands on
       * that number — and why a 32px control that feels precise on a desktop
       * is a control most people miss on a phone.
       *
       * The height grows below `sm`; padding and type do not, so the buttons
       * stay the same shape and weight rather than becoming a different
       * design at a different width.
       */
      size: {
        default: 'h-9 max-sm:h-11 px-4 py-2',
        sm: 'h-8 max-sm:h-11 rounded-md px-3 text-xs',
        lg: 'h-10 max-sm:h-12 rounded-md px-6',
        icon: 'size-9 max-sm:size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
