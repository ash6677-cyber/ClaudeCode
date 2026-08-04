import { describe, expect, it } from 'vitest'

import {
  accentFor,
  DEFAULT_DESIGN,
  designClasses,
  designIsDefault,
  designStyle,
  FINISHES,
  FINISH_HINT,
  FINISH_LABEL,
  FRAMES,
  FRAME_HINT,
  FRAME_LABEL,
  generatedAccent,
  hueFromName,
  normalizeDesign,
} from './card-design'
import { contrastRatio, parseOklch } from '@/features/theme/lib/oklch'
import type { CardDesign } from '@/types'

const design = (changes: Partial<CardDesign> = {}): CardDesign => ({
  ...DEFAULT_DESIGN,
  ...changes,
})

describe('normalizeDesign', () => {
  it('draws the app’s own card when there is no design at all', () => {
    // Every card made before this feature existed has none, and none of them
    // should change appearance because the app was updated.
    expect(normalizeDesign(undefined)).toEqual(DEFAULT_DESIGN)
  })

  it('falls back on a frame or finish this version has never heard of', () => {
    const odd = normalizeDesign({
      ...DEFAULT_DESIGN,
      frame: 'engraved' as CardDesign['frame'],
      finish: 'velvet' as CardDesign['finish'],
    })
    expect(odd.frame).toBe(DEFAULT_DESIGN.frame)
    expect(odd.finish).toBe(DEFAULT_DESIGN.finish)
  })

  it('rejects an accent that is not a colour rather than writing it to the DOM', () => {
    expect(normalizeDesign(design({ accent: 'javascript:alert(1)' })).accent).toBeNull()
    expect(normalizeDesign(design({ accent: '' })).accent).toBeNull()
    expect(normalizeDesign(design({ accent: 'oklch(60% 0.1 200)' })).accent).toBe(
      'oklch(60% 0.1 200)',
    )
  })

  it('clamps the dials, so a hand-edited file cannot produce a broken card', () => {
    expect(normalizeDesign(design({ gloss: 40 })).gloss).toBe(1)
    expect(normalizeDesign(design({ vignette: -3 })).vignette).toBe(0)
    expect(normalizeDesign(design({ gloss: Number.NaN })).gloss).toBe(0)
  })
})

describe('the generated accent', () => {
  it('is the same colour for the same character every time', () => {
    // Derived, not random. A cast that reshuffles its colours on reload is
    // worse than one colour for everybody.
    expect(generatedAccent('Mira Vale')).toBe(generatedAccent('Mira Vale'))
    expect(hueFromName('Mira Vale')).toBe(hueFromName('Mira Vale'))
  })

  it('gives different characters different colours', () => {
    const names = ['Mira Vale', 'Tomas Reed', 'The Cartographer', 'Anselm', 'Beatrix']
    const hues = new Set(names.map(hueFromName))
    expect(hues.size).toBeGreaterThan(3)
  })

  it('keeps every generated colour at the same weight', () => {
    // Hue varies; lightness and chroma do not. That is what stops a grid of
    // them reading as a bag of sweets.
    for (const name of ['a', 'Mira', 'The Cartographer of Broken Roads']) {
      const parsed = parseOklch(generatedAccent(name))!
      expect(parsed.l).toBeCloseTo(0.68, 5)
      expect(parsed.c).toBeCloseTo(0.13, 5)
    }
  })

  it('stays inside the hue circle for any name', () => {
    for (const name of ['', 'z'.repeat(400), 'Ω≈ç√∫', 'Mira']) {
      const h = hueFromName(name)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
    }
  })
})

describe('accentFor', () => {
  it('prefers the colour the writer chose', () => {
    expect(accentFor(design({ accent: 'oklch(50% 0.2 20)' }), 'Mira')).toBe('oklch(50% 0.2 20)')
  })

  it('falls back to the character’s own colour, not the theme’s', () => {
    // A wall of cards all in the theme primary is the contact sheet this
    // feature exists to break up.
    expect(accentFor(undefined, 'Mira')).toBe(generatedAccent('Mira'))
  })
})

describe('designStyle', () => {
  it('writes the properties the stylesheet reads', () => {
    const style = designStyle(design({ gloss: 0.8, vignette: 0.2 }), 'Mira')
    expect(style['--card-gloss']).toBe('0.8')
    expect(style['--card-vignette']).toBe('0.2')
    expect(style['--card-accent']).toBe(generatedAccent('Mira'))
  })

  it('always picks an ink that can be read on the accent', () => {
    // The writer picks one colour; the app owes them a second that works on
    // it. Checked across the whole hue circle and both ends of lightness.
    for (let h = 0; h < 360; h += 15) {
      for (const l of [0.25, 0.5, 0.75, 0.95]) {
        const accent = `oklch(${l * 100}% 0.14 ${h})`
        const style = designStyle(design({ accent }), 'Mira')
        const ratio = contrastRatio(parseOklch(accent)!, parseOklch(style['--card-ink'])!)
        expect(ratio, `${accent} vs ${style['--card-ink']}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('still produces an ink when the accent is unusable', () => {
    const style = designStyle(design({ accent: 'not a colour' }), 'Mira')
    expect(style['--card-ink']).toBeTruthy()
  })
})

describe('designClasses', () => {
  it('names the frame and the finish', () => {
    expect(designClasses(design({ frame: 'arch', finish: 'holo' }))).toBe(
      'card-face card-frame-arch card-finish-holo',
    )
  })

  it('never emits a class for a frame this version does not know', () => {
    const classes = designClasses({ ...DEFAULT_DESIGN, frame: 'nonsense' as CardDesign['frame'] })
    expect(classes).toContain('card-frame-plain')
    expect(classes).not.toContain('nonsense')
  })
})

describe('designIsDefault', () => {
  it('is true for nothing, and for a design that changed nothing', () => {
    expect(designIsDefault(undefined)).toBe(true)
    expect(designIsDefault(DEFAULT_DESIGN)).toBe(true)
  })

  it('is false the moment one thing is chosen', () => {
    expect(designIsDefault(design({ finish: 'holo' }))).toBe(false)
    expect(designIsDefault(design({ accent: 'oklch(60% 0.1 200)' }))).toBe(false)
  })
})

describe('the catalogue', () => {
  it('describes every frame and finish it offers', () => {
    // A picker with an unlabelled option is a picker with a blank button.
    for (const frame of FRAMES) {
      expect(FRAME_LABEL[frame]).toBeTruthy()
      expect(FRAME_HINT[frame]).toBeTruthy()
    }
    for (const finish of FINISHES) {
      expect(FINISH_LABEL[finish]).toBeTruthy()
      expect(FINISH_HINT[finish]).toBeTruthy()
    }
  })
})
