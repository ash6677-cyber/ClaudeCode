/**
 * The knobs a theme can turn.
 *
 * Every one of these is already a CSS custom property the whole app is built
 * on, so a theme does not need a parallel styling system — it sets the same
 * variables the stylesheet sets, and everything downstream follows without
 * knowing a theme exists.
 *
 * Grouped the way someone changing them thinks, not the way the stylesheet
 * lists them. "Make the sidebar darker" is one thought; finding `--sidebar`
 * among twenty-seven alphabetised names is a search.
 */

export const THEME_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'brand-2',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'border',
  'input',
  'ring',
  'sidebar',
  'sidebar-foreground',
  'sidebar-border',
] as const

export type ThemeToken = (typeof THEME_TOKENS)[number]

const TOKEN_SET: ReadonlySet<string> = new Set(THEME_TOKENS)

export function isThemeToken(name: string): name is ThemeToken {
  return TOKEN_SET.has(name)
}

export interface TokenSpec {
  token: ThemeToken
  label: string
  /** What it actually paints, in the app the writer is looking at. */
  hint: string
  /**
   * The token text sits on, when there is one. Drives the contrast readout:
   * a foreground is only meaningful against the thing behind it.
   */
  against?: ThemeToken
}

export interface TokenGroup {
  id: string
  label: string
  description: string
  tokens: TokenSpec[]
}

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    id: 'canvas',
    label: 'Canvas',
    description: 'The page itself, and the panels that sit on it.',
    tokens: [
      { token: 'background', label: 'Background', hint: 'Behind everything' },
      { token: 'foreground', label: 'Text', hint: 'Body text', against: 'background' },
      { token: 'card', label: 'Card', hint: 'Panels, project cards, the editor surface' },
      { token: 'card-foreground', label: 'Card text', hint: 'Text on cards', against: 'card' },
      { token: 'popover', label: 'Popover', hint: 'Menus and dialogs' },
      {
        token: 'popover-foreground',
        label: 'Popover text',
        hint: 'Text in menus',
        against: 'popover',
      },
    ],
  },
  {
    id: 'brand',
    label: 'Accent',
    description: 'The colour the app is recognisably in.',
    tokens: [
      { token: 'primary', label: 'Primary', hint: 'Buttons, links, the active nav item' },
      {
        token: 'primary-foreground',
        label: 'On primary',
        hint: 'Text on a primary button',
        against: 'primary',
      },
      { token: 'brand-2', label: 'Secondary accent', hint: 'The far end of brand gradients' },
      { token: 'accent', label: 'Accent', hint: 'Hover and selected rows' },
      {
        token: 'accent-foreground',
        label: 'On accent',
        hint: 'Text on a hovered row',
        against: 'accent',
      },
      { token: 'ring', label: 'Focus ring', hint: 'The keyboard focus outline' },
    ],
  },
  {
    id: 'surfaces',
    label: 'Surfaces',
    description: 'The quieter fills and the lines between things.',
    tokens: [
      { token: 'secondary', label: 'Secondary', hint: 'Secondary buttons and chips' },
      {
        token: 'secondary-foreground',
        label: 'On secondary',
        hint: 'Text on those',
        against: 'secondary',
      },
      { token: 'muted', label: 'Muted', hint: 'Recessed panels and empty states' },
      {
        token: 'muted-foreground',
        label: 'Muted text',
        hint: 'Hints, captions, counts',
        against: 'muted',
      },
      { token: 'border', label: 'Border', hint: 'Every dividing line' },
      { token: 'input', label: 'Input border', hint: 'Field outlines' },
    ],
  },
  {
    id: 'sidebar',
    label: 'Sidebar',
    description: 'The navigation rail, which carries its own depth.',
    tokens: [
      { token: 'sidebar', label: 'Sidebar', hint: 'The rail background' },
      {
        token: 'sidebar-foreground',
        label: 'Sidebar text',
        hint: 'Nav labels',
        against: 'sidebar',
      },
      { token: 'sidebar-border', label: 'Sidebar border', hint: 'Its edge' },
    ],
  },
  {
    id: 'signals',
    label: 'Signals',
    description: 'Colours that mean something. Worth keeping conventional.',
    tokens: [
      { token: 'destructive', label: 'Destructive', hint: 'Delete, and anything final' },
      {
        token: 'destructive-foreground',
        label: 'On destructive',
        hint: 'Text on it',
        against: 'destructive',
      },
      { token: 'success', label: 'Success', hint: 'Saved, synced, done' },
      {
        token: 'success-foreground',
        label: 'On success',
        hint: 'Text on it',
        against: 'success',
      },
      { token: 'warning', label: 'Warning', hint: 'Drafting status, unsaved work' },
      {
        token: 'warning-foreground',
        label: 'On warning',
        hint: 'Text on it',
        against: 'warning',
      },
    ],
  },
]

/** Every spec, flat, for lookups that don't care about grouping. */
export const TOKEN_SPECS: Record<ThemeToken, TokenSpec> = Object.fromEntries(
  TOKEN_GROUPS.flatMap((group) => group.tokens).map((spec) => [spec.token, spec]),
) as Record<ThemeToken, TokenSpec>
