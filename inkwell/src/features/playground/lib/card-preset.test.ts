import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DESIGN,
  DESIGN_PRESETS,
  applyPreset,
  matchingPreset,
  normalizeDesign,
} from './card-design'

describe('design presets', () => {
  it('are all distinct looks, not the same one relabelled', () => {
    const shapes = DESIGN_PRESETS.map((p) => JSON.stringify(p.design))
    expect(new Set(shapes).size).toBe(DESIGN_PRESETS.length)
    expect(new Set(DESIGN_PRESETS.map((p) => p.id)).size).toBe(DESIGN_PRESETS.length)
  })

  it('never touch the character’s colour', () => {
    // The accent is the one part of a card that means something — it is that
    // character's. A preset that overwrote it would make six characters look
    // like the same person.
    const chosen = { ...DEFAULT_DESIGN, accent: 'oklch(68% 0.13 320)' }
    for (const preset of DESIGN_PRESETS) {
      expect(applyPreset(chosen, preset).accent).toBe('oklch(68% 0.13 320)')
      expect(applyPreset(undefined, preset).accent).toBeNull()
    }
  })

  it('produce a design the app considers valid', () => {
    for (const preset of DESIGN_PRESETS) {
      const applied = applyPreset(undefined, preset)
      expect(normalizeDesign(applied)).toEqual(applied)
    }
  })

  it('recognise themselves once applied, whatever the colour', () => {
    for (const preset of DESIGN_PRESETS) {
      expect(matchingPreset(applyPreset(undefined, preset))?.id).toBe(preset.id)
      expect(matchingPreset(applyPreset({ ...DEFAULT_DESIGN, accent: 'oklch(68% 0.13 15)' }, preset))?.id).toBe(
        preset.id,
      )
    }
  })

  it('claim nothing when the dials have been moved by hand', () => {
    const tweaked = { ...applyPreset(undefined, DESIGN_PRESETS[0]), gloss: 0.05 }
    expect(matchingPreset(tweaked)).toBeUndefined()
  })
})
