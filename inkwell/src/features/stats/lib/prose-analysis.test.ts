import { describe, expect, it } from 'vitest'

import {
  analyseProse,
  countAdverbs,
  countPassive,
  dialogueRatio,
  findRepetitions,
  paragraphs,
  per10k,
  readingEase,
  sentences,
  syllablesIn,
  words,
} from './prose-analysis'

describe('words', () => {
  it('counts words, not punctuation', () => {
    expect(words('The door — the one she’d locked — opened.')).toEqual([
      'The', 'door', 'the', 'one', 'she’d', 'locked', 'opened',
    ])
  })

  it('keeps hyphenated and apostrophised words whole', () => {
    expect(words("a half-open door isn't shut")).toEqual(['a', 'half-open', 'door', "isn't", 'shut'])
  })

  it('is empty for text with no letters', () => {
    expect(words('  ...  123 ')).toEqual([])
  })
})

describe('sentences', () => {
  it('splits on terminal punctuation', () => {
    expect(sentences('She left. He stayed! Why? Nobody knew…')).toHaveLength(4)
  })

  it('keeps a closing quote with the sentence it ends', () => {
    expect(sentences('"Go," she said. He went.')).toHaveLength(2)
  })

  it('does not invent a sentence from trailing whitespace', () => {
    expect(sentences('One sentence.   ')).toHaveLength(1)
    expect(sentences('')).toHaveLength(0)
  })
})

describe('paragraphs', () => {
  it('counts blank-line and single-line breaks alike', () => {
    expect(paragraphs('One.\n\nTwo.\nThree.')).toHaveLength(3)
  })
})

describe('countAdverbs', () => {
  it('finds -ly adverbs', () => {
    expect(countAdverbs(words('she walked quietly and spoke softly'))).toBe(2)
  })

  it('does not count nouns that merely end in -ly', () => {
    // "family" and "reply" would otherwise inflate every domestic scene.
    expect(countAdverbs(words('the family sent a reply'))).toBe(0)
  })
})

describe('countPassive', () => {
  it('finds a plain passive', () => {
    expect(countPassive(words('the door was opened by someone'))).toBe(1)
  })

  it('finds one with an adverb wedged in', () => {
    expect(countPassive(words('the letter was quietly burned'))).toBe(1)
  })

  it('finds an irregular participle', () => {
    expect(countPassive(words('the glass was broken'))).toBe(1)
  })

  it('does not call every "was" passive', () => {
    // "was cold" is a plain description, and flagging it would make the
    // number meaningless in any scene containing weather.
    expect(countPassive(words('the room was cold and she was tired'))).toBe(0)
  })

  it('does not leap over an unrelated word to find a participle', () => {
    expect(countPassive(words('he was a tired man who walked'))).toBe(0)
  })
})

describe('dialogueRatio', () => {
  it('is about half for a passage half in quotes', () => {
    const ratio = dialogueRatio('"Come inside now," she said, and he followed her in.')
    expect(ratio).toBeGreaterThan(0.2)
    expect(ratio).toBeLessThan(0.6)
  })

  it('is zero for pure narration and never exceeds one', () => {
    expect(dialogueRatio('He crossed the yard and shut the gate.')).toBe(0)
    expect(dialogueRatio('"All of this is spoken aloud by her."')).toBeLessThanOrEqual(1)
  })

  it('is zero for empty text rather than dividing by nothing', () => {
    expect(dialogueRatio('')).toBe(0)
  })
})

describe('findRepetitions', () => {
  it('flags a distinctive word used three times close together', () => {
    const text = 'The lantern swung. She lifted the lantern high and the lantern went out.'
    expect(findRepetitions(words(text.toLowerCase())).map((r) => r.word)).toContain('lantern')
  })

  it('ignores the same word spread far apart', () => {
    // Letters only: the tokeniser ignores digits, so `word0 word1 …` would
    // all collapse to the same token and the filler would itself repeat.
    const filler = Array.from({ length: 80 }, (_, i) =>
      `f${'a'.repeat((i % 5) + 1)}${'z'.repeat(Math.floor(i / 5) + 1)}`,
    ).join(' ')
    const text = `lantern ${filler} lantern ${filler} lantern`
    expect(findRepetitions(words(text))).toEqual([])
  })

  it('never flags ordinary connective words', () => {
    // Otherwise "the" and "she" would be the top result on every page. The
    // content word in the same sentence is flagged, and should be.
    const text = 'she went to the door and she opened the door and she looked at the door'
    const flagged = findRepetitions(words(text)).map((r) => r.word)
    expect(flagged).not.toContain('the')
    expect(flagged).not.toContain('she')
    expect(flagged).toContain('door')
  })

  it('reports where the cluster starts, so it can be found', () => {
    const text = 'alpha beta lantern gamma lantern delta lantern'
    const [first] = findRepetitions(words(text))
    expect(first.word).toBe('lantern')
    expect(first.at).toBe(2)
  })

  it('reports every cluster, not just the first one in the manuscript', () => {
    // The whole point of a book-length report: a word leaned on in one
    // chapter and again in another is two places to go and fix, and only
    // reporting the first sends the writer to one and hides the other.
    const filler = Array.from({ length: 80 }, (_, i) =>
      `f${'a'.repeat((i % 5) + 1)}${'z'.repeat(Math.floor(i / 5) + 1)}`,
    ).join(' ')
    const cluster = 'lantern one lantern two lantern'
    const found = findRepetitions(words(`${cluster} ${filler} ${cluster}`))
    expect(found).toHaveLength(2)
    expect(found.every((r) => r.word === 'lantern')).toBe(true)
    expect(found[0].at).toBeLessThan(found[1].at)
  })

  it('counts a cluster at its true size rather than always three', () => {
    const text = 'lantern a lantern b lantern c lantern'
    const [first] = findRepetitions(words(text))
    expect(first.count).toBe(4)
  })

  it('does not split one long cluster into overlapping findings', () => {
    const text = 'lantern a lantern b lantern c lantern d lantern'
    expect(findRepetitions(words(text))).toHaveLength(1)
  })
})

describe('syllablesIn', () => {
  it('counts vowel groups', () => {
    expect(syllablesIn('cat')).toBe(1)
    expect(syllablesIn('lantern')).toBe(2)
    expect(syllablesIn('remarkable')).toBe(4)
  })

  it('never returns zero for a real word', () => {
    for (const word of ['a', 'the', 'rhythm', 'strength']) {
      expect(syllablesIn(word)).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('readingEase', () => {
  it('rates short plain sentences as easier than long dense ones', () => {
    const plain =
      'He ran fast. She sat down. The dog slept. They went out. It was warm. ' +
      'The sun rose. A bird sang. He ate bread. She read a book. They went home.'
    const dense =
      'The extraordinarily convoluted administrative determination, having been promulgated ' +
      'without adequate consultation, subsequently necessitated comprehensive ' +
      'reconsideration by the responsible authorities. Nevertheless the committee ' +
      'persevered indefinitely, notwithstanding considerable institutional opposition.'
    const easy = readingEase(words(plain), sentences(plain).length)
    const hard = readingEase(words(dense), sentences(dense).length)
    expect(easy).not.toBeNull()
    expect(hard).not.toBeNull()
    expect(easy as number).toBeGreaterThan(hard as number)
  })

  it('declines to score a fragment', () => {
    // A number computed from six words would be noise presented as insight.
    expect(readingEase(words('Too short to score.'), 1)).toBeNull()
  })
})

describe('analyseProse', () => {
  const passage = [
    '"You saw it too," she said. "Don\'t tell me you didn\'t."',
    '',
    'He looked away. The lantern was lit by someone else, and he knew it, and he ' +
      'thought about the lantern for a very long time. The lantern went out. ' +
      'He walked slowly. He spoke quietly.',
  ].join('\n')

  it('reports the shape of a passage', () => {
    const report = analyseProse(passage)
    expect(report.words).toBeGreaterThan(40)
    expect(report.sentences).toBeGreaterThan(4)
    expect(report.paragraphs).toBe(2)
    expect(report.meanSentenceLength).toBeGreaterThan(0)
    expect(report.sentenceLengths).toHaveLength(report.sentences)
    expect(report.longestSentence).toBe(Math.max(...report.sentenceLengths))
  })

  it('finds the habits a writer cannot see from inside the scene', () => {
    const report = analyseProse(passage)
    expect(report.filterWords.map((f) => f.word)).toEqual(
      expect.arrayContaining(['saw', 'looked', 'knew', 'thought']),
    )
    expect(report.hedgeWords.map((h) => h.word)).toContain('very')
    expect(report.adverbs).toBeGreaterThanOrEqual(2)
    expect(report.passiveCount).toBeGreaterThanOrEqual(1)
    expect(report.repetitions.map((r) => r.word)).toContain('lantern')
  })

  it('does not offer nouns as the most-worn verbs', () => {
    // "nothing", "something" and "morning" all end in -ing, and on a real
    // manuscript they outrank every actual verb in the book — the top of the
    // list was pure noise before they were excluded.
    const text =
      'Nothing happened that morning. Something moved. Nothing moved again. ' +
      'The ceiling held. Nothing else stirred, and the building settled.'
    const verbs = analyseProse(text).mostUsedVerbs.map((v) => v.word)
    expect(verbs).not.toContain('nothing')
    expect(verbs).not.toContain('something')
    expect(verbs).not.toContain('morning')
    expect(verbs).not.toContain('ceiling')
    expect(verbs).not.toContain('building')
    expect(verbs).toContain('happened')
    expect(verbs).toContain('moved')
  })

  it('sorts tallies by how often they occur', () => {
    const report = analyseProse('He saw it. He saw her. He saw them. He heard nothing.')
    expect(report.filterWords[0]).toMatchObject({ word: 'saw', count: 3 })
  })

  it('survives empty text without dividing by zero', () => {
    const report = analyseProse('')
    expect(report).toMatchObject({
      words: 0, sentences: 0, paragraphs: 0, meanSentenceLength: 0,
      longestSentence: 0, adverbs: 0, passiveCount: 0, dialogueRatio: 0, readingEase: null,
    })
    expect(report.filterWords).toEqual([])
    expect(report.repetitions).toEqual([])
  })

  it('returns finite numbers for every measure', () => {
    // These go straight into a chart; a NaN would render as a blank bar with
    // no indication anything went wrong.
    const report = analyseProse(passage)
    for (const value of [
      report.words, report.sentences, report.meanSentenceLength,
      report.longestSentence, report.adverbs, report.passiveCount, report.dialogueRatio,
    ]) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })
})

describe('per10k', () => {
  it('makes scenes of different lengths comparable', () => {
    expect(per10k(5, 1000)).toBe(50)
    expect(per10k(50, 10_000)).toBe(50)
  })

  it('is zero rather than infinite for an empty scene', () => {
    expect(per10k(3, 0)).toBe(0)
  })
})
