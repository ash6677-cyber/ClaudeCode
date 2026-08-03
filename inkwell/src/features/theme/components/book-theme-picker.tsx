import { useEffect } from 'react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { themeChoices, useThemeStore } from '@/stores/theme-store'

/** The value the select uses for "no look of its own". `null` is not a valid
 * option value, and an empty string closes a Radix select rather than
 * choosing anything in it. */
const FOLLOW_APP = 'follow-app'

interface BookThemePickerProps {
  value: string | null
  onChange: (themeId: string | null) => void
}

/**
 * A look for this book alone.
 *
 * Worth having because a writer with a horror novel and a cosy mystery open
 * in the same week does not want one palette for both, and choosing it in
 * Settings every time they switch is not a feature, it is a chore. Set here,
 * the book carries its own look between devices and puts it on whenever it
 * is opened.
 */
export function BookThemePicker({ value, onChange }: BookThemePickerProps) {
  const custom = useThemeStore((s) => s.custom)
  const load = useThemeStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  const choices = themeChoices(custom)
  // A theme deleted on another device leaves a book holding an id that names
  // nothing. Showing "Follows the app" is honest — that is what it will do.
  const known = value !== null && choices.some((choice) => choice.id === value)

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="project-theme">This book’s look</Label>
      <Select
        value={known ? value : FOLLOW_APP}
        onValueChange={(next) => onChange(next === FOLLOW_APP ? null : next)}
      >
        <SelectTrigger id="project-theme" aria-label="This book’s look">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FOLLOW_APP}>Follows the app</SelectItem>
          {choices.map((choice) => (
            <SelectItem key={choice.id} value={choice.id}>
              {choice.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Worn whenever this book is open, and only then. Leave it following the app if one look
        suits everything you write.
      </p>
    </div>
  )
}
