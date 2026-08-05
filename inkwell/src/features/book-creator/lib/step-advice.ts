/**
 * What each step of the wizard has to say about itself.
 *
 * Validation used to be one disabled button on step one and silence after
 * that. Silence is the problem: a character typed without a name is skipped
 * at creation, quietly, and the writer finds out by counting cards later.
 *
 * So there are two kinds of thing to say, and they are deliberately not the
 * same kind. A *block* is a thing that must be fixed — there is exactly one,
 * because a book needs a name. A *note* is a consequence the writer might not
 * expect, said before it happens rather than discovered after; it never stops
 * anyone, because the wizard's whole point is that none of this is binding.
 */

export interface StepAdvice {
  /** Fix this before moving on. Disables the forward button. */
  block?: string
  /** True, worth knowing, and no reason to stop. */
  note?: string
}

interface StepState {
  title: string
  chapters: { title: string }[]
  cast: { name: string }[]
}

export function stepAdvice(step: string, state: StepState): StepAdvice {
  if (step === 'concept') {
    return state.title.trim()
      ? {}
      : { block: 'Your book needs a title before the rest of this can help.' }
  }

  if (step === 'outline') {
    if (state.chapters.length === 0) {
      return {
        note: 'No chapters yet. Your format’s own chapters will be created, and you can add more whenever.',
      }
    }
    const unnamed = state.chapters.filter((c) => !c.title.trim()).length
    if (unnamed > 0) {
      return {
        note:
          unnamed === 1
            ? 'One chapter has no title — it will be numbered for you.'
            : `${unnamed} chapters have no title — they will be numbered for you.`,
      }
    }
    return {}
  }

  if (step === 'cast') {
    const unnamed = state.cast.filter((c) => !c.name.trim()).length
    if (unnamed > 0) {
      return {
        note:
          unnamed === 1
            ? 'One character has no name, so it will not be created.'
            : `${unnamed} characters have no name, so they will not be created.`,
      }
    }
    return {}
  }

  return {}
}
