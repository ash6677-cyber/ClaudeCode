import { describe, expect, it } from 'vitest'

import { BUILT_IN_THEMES } from './presets'
import {
  DEFAULT_TYPE,
  FACE_DEFAULT,
  FACE_OPTIONS,
  faceFamily,
  typeIsDefault,
  typeStyle,
} from './typography'
import { EDITOR_FONTS } from '@/lib/editor/fonts'
import type { ThemeType } from '@/types'

const type = (changes: Partial<ThemeType> = {}): ThemeType => ({ ...DEFAULT_TYPE, ...changes })

describe('faceFamily', () => {
  it('resolves a known face to a real font stack', () => {
    expect(faceFamily('lora')).toContain('Lora')
  })

  it('leaves the app’s own alone for the default', () => {
    expect(faceFamily(FACE_DEFAULT)).toBeNull()
  })

  it('changes nothing for a face this version has never heard of', () => {
    // A theme written by a newer version, or hand-edited. Silently falling
    // back to the first face in the list would claim an intent nobody had.
    expect(faceFamily('some-face-from-2027')).toBeNull()
  })

  it('offers every manuscript face, so one catalogue serves both', () => {
    for (const font of EDITOR_FONTS) {
      expect(FACE_OPTIONS.some((option) => option.id === font.id)).toBe(true)
    }
  })
})

describe('typeStyle', () => {
  it('writes nothing at all when nothing was chosen', () => {
    expect(typeStyle(undefined)).toBeNull()
    expect(typeStyle(DEFAULT_TYPE)).toBeNull()
  })

  it('writes only the face that was chosen', () => {
    const style = typeStyle(type({ display: 'lora' }))
    expect(style).toEqual({ '--display-font': expect.stringContaining('Lora') })
    // The interface font is untouched, so it keeps following the design.
    expect(style).not.toHaveProperty('--ui-font')
  })

  it('puts each face on the property that surface actually reads', () => {
    const style = typeStyle(type({ ui: 'inter', display: 'lora', reading: 'literata' }))
    expect(style?.['--ui-font']).toContain('Inter')
    expect(style?.['--display-font']).toContain('Lora')
    expect(style?.['--reading-font']).toContain('Literata')
  })

  it('scales prose only when it differs from the app’s own', () => {
    expect(typeStyle(type({ proseScale: 1 }))).toBeNull()
    expect(typeStyle(type({ proseScale: 1.25 }))).toEqual({ '--prose-scale': '1.25' })
    expect(typeStyle(type({ leading: 1.2 }))).toEqual({ '--prose-leading': '1.2' })
  })

  it('clamps sizes that would make the app unusable', () => {
    // A file can say anything. 40× prose is not a look, it is a broken app.
    expect(typeStyle(type({ proseScale: 40 }))?.['--prose-scale']).toBe('1.6')
    expect(typeStyle(type({ proseScale: 0 }))?.['--prose-scale']).toBe('0.8')
    expect(typeStyle(type({ leading: -3 }))?.['--prose-leading']).toBe('0.85')
  })

  it('treats a non-number as no change rather than writing NaN', () => {
    expect(typeStyle(type({ proseScale: Number.NaN }))?.['--prose-scale']).toBe('0.8')
  })

  it('drops a face nobody knows rather than the whole set', () => {
    const style = typeStyle(type({ ui: 'nonsense', display: 'lora' }))
    expect(style).toEqual({ '--display-font': expect.stringContaining('Lora') })
  })

  it('never writes a name Tailwind has baked into its utilities', () => {
    // `--font-sans` set at runtime looks like it works and changes nothing:
    // `@theme inline` copies the literal stack into every `.font-sans` rule.
    // This is the regression guard for that, because the symptom is silence.
    const style = typeStyle(type({ ui: 'inter', display: 'lora', reading: 'lora' }))
    expect(Object.keys(style ?? {}).some((name) => name.startsWith('--font-'))).toBe(false)
  })
})

describe('typeIsDefault', () => {
  it('is true for anything that would write nothing', () => {
    expect(typeIsDefault(undefined)).toBe(true)
    expect(typeIsDefault(DEFAULT_TYPE)).toBe(true)
    expect(typeIsDefault(type({ ui: 'unknown-face' }))).toBe(true)
  })

  it('is false the moment one thing is chosen', () => {
    expect(typeIsDefault(type({ reading: 'spectral' }))).toBe(false)
    expect(typeIsDefault(type({ leading: 1.1 }))).toBe(false)
  })
})

describe('the presets that choose faces', () => {
  it('name faces that exist, so a preset never ships a dead reference', () => {
    for (const preset of BUILT_IN_THEMES) {
      if (!preset.type) continue
      for (const face of [preset.type.ui, preset.type.display, preset.type.reading]) {
        if (face === FACE_DEFAULT) continue
        expect(faceFamily(face), `${preset.name} names ${face}`).not.toBeNull()
      }
    }
  })
})
