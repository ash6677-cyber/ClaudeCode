/**
 * Measuring the prose itself.
 *
 * Everything here is arithmetic over `scene.plainText`, which every scene
 * already stores. No API key, no network, no cost per run, no waiting — and
 * every measure is a pure function with an obvious test, which is the only
 * reason to trust a number the app puts in front of a writer.
 *
 * These are diagnostics, not rules. Filter words are not banned and adverbs
 * are not a sin; the point is to show a writer their own habits at a scale
 * they cannot see from inside a scene. Nothing here says "fix this".
 */

/**
 * Words that put distance between the reader and the story, by naming the
 * act of perceiving instead of the thing perceived. "She saw the door open"
 * against "the door opened". Common in first drafts and nearly invisible to
 * the person who wrote them.
 */
export const FILTER_WORDS = [
  'saw', 'heard', 'felt', 'noticed', 'realised', 'realized', 'thought',
  'wondered', 'watched', 'looked', 'seemed', 'decided', 'knew', 'remembered',
  'observed', 'considered', 'experienced', 'sensed',
] as const

/**
 * Words that soften a sentence without adding to it. A few are fine; a page
 * built out of them reads as though the writer is hedging.
 */
export const HEDGE_WORDS = [
  'very', 'really', 'quite', 'rather', 'somewhat', 'fairly', 'just', 'almost',
  'nearly', 'slightly', 'perhaps', 'maybe', 'actually', 'basically', 'literally',
  'simply', 'truly', 'totally', 'completely', 'absolutely',
] as const

/** Forms of "to be" that, followed by a participle, make a passive. */
const BE_FORMS = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being', "isn't", "wasn't", "weren't"])

/** Irregular past participles that don't end in -ed. */
const IRREGULAR_PARTICIPLES = new Set([
  'begun', 'bent', 'bitten', 'blown', 'born', 'borne', 'bound', 'broken',
  'brought', 'built', 'burnt', 'burst', 'bought', 'cast', 'caught', 'chosen',
  'come', 'cut', 'dealt', 'done', 'drawn', 'driven', 'eaten', 'fallen', 'felt',
  'flown', 'forbidden', 'forgotten', 'found', 'frozen', 'given', 'gone',
  'grown', 'heard', 'held', 'hidden', 'hit', 'hung', 'hurt', 'kept', 'known',
  'laid', 'led', 'left', 'lent', 'let', 'lit', 'lost', 'made', 'meant', 'met',
  'paid', 'put', 'read', 'ridden', 'risen', 'run', 'said', 'seen', 'sent',
  'set', 'shaken', 'shone', 'shot', 'shown', 'shrunk', 'shut', 'slain', 'sold',
  'spent', 'split', 'spoken', 'spread', 'sprung', 'stolen', 'struck', 'stuck',
  'stung', 'sung', 'sunk', 'swept', 'sworn', 'taken', 'taught', 'thrown',
  'told', 'torn', 'trodden', 'understood', 'woken', 'won', 'worn', 'woven',
  'written', 'wound',
])

/**
 * Words that look like participles but act as plain adjectives after "to be".
 *
 * "She was tired" is a description, not a passive; "she was opened" is not a
 * sentence anyone writes. Without this list every scene containing weather or
 * a mood reported a passive on almost every page, and a count that fires on
 * ordinary description tells the writer nothing. It is a list rather than
 * grammar because telling the two apart properly needs a parser, and being
 * right about the two dozen commonest cases is most of the benefit.
 */
const PREDICATE_ADJECTIVES = new Set([
  'tired', 'scared', 'frightened', 'worried', 'interested', 'excited', 'bored',
  'confused', 'surprised', 'pleased', 'annoyed', 'married', 'crowded', 'aged',
  'delighted', 'exhausted', 'embarrassed', 'ashamed', 'determined', 'prepared',
  'satisfied', 'disappointed', 'relieved', 'concerned', 'convinced', 'amused',
  'astonished', 'closed', 'crooked', 'naked', 'wicked', 'sacred', 'wretched',
  'gifted', 'talented', 'dated', 'faded', 'aged', 'used',
])

export interface WordTally {
  word: string
  count: number
}

export interface Repetition {
  word: string
  /** How many times it appears inside one window. */
  count: number
  /** Word index where the cluster starts, for locating it in the scene. */
  at: number
}

export interface ProseReport {
  words: number
  sentences: number
  paragraphs: number
  /** Average words per sentence. */
  meanSentenceLength: number
  /** Word count of each sentence in order — the rhythm of the passage. */
  sentenceLengths: number[]
  /** Longest sentence, in words. */
  longestSentence: number
  adverbs: number
  filterWords: WordTally[]
  hedgeWords: WordTally[]
  passiveCount: number
  /** Words inside quotation marks, as a fraction of all words. */
  dialogueRatio: number
  repetitions: Repetition[]
  mostUsedVerbs: WordTally[]
  /** Flesch reading ease: higher is plainer. Null when there is too little text. */
  readingEase: number | null
}

const WORD_PATTERN = /[A-Za-z][A-Za-z'’-]*/g

export function words(text: string): string[] {
  return text.match(WORD_PATTERN) ?? []
}

/**
 * Splits into sentences on terminal punctuation.
 *
 * Deliberately naive about abbreviations: "Mr." and "St." will each end a
 * sentence. Handling them properly needs a dictionary, and getting the mean
 * sentence length wrong by a fraction matters far less than the shape of the
 * distribution, which is what the writer is actually looking at.
 */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])["'”’)\]]*\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => words(sentence).length > 0)
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .map((para) => para.trim())
    .filter((para) => para.length > 0)
}

/**
 * Adverb count, by the -ly test.
 *
 * Catches "quietly" and misses "well"; also catches "family", which is why
 * the obvious nouns are excluded rather than left to inflate the number.
 */
const LY_NOT_ADVERBS = new Set([
  'family', 'reply', 'supply', 'apply', 'imply', 'rely', 'fly', 'ally', 'belly',
  'jelly', 'lily', 'only', 'holy', 'ugly', 'early', 'italy', 'july', 'melancholy',
])

export function countAdverbs(list: string[]): number {
  return list.filter(
    (word) => word.length > 4 && word.endsWith('ly') && !LY_NOT_ADVERBS.has(word),
  ).length
}

function tally(list: string[], vocabulary: readonly string[]): WordTally[] {
  const wanted = new Set(vocabulary)
  const counts = new Map<string, number>()
  for (const word of list) {
    if (wanted.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
}

/** A "to be" followed within two words by a participle. */
export function countPassive(list: string[]): number {
  let found = 0
  for (let i = 0; i < list.length - 1; i++) {
    if (!BE_FORMS.has(list[i])) continue
    for (let ahead = 1; ahead <= 2 && i + ahead < list.length; ahead++) {
      const candidate = list[i + ahead]
      if (PREDICATE_ADJECTIVES.has(candidate)) break
      const participle =
        (candidate.endsWith('ed') && candidate.length > 3) || IRREGULAR_PARTICIPLES.has(candidate)
      if (participle) {
        found++
        break
      }
      // Only an adverb may sit between the auxiliary and the participle;
      // anything else means this "was" is not part of a passive at all.
      if (!candidate.endsWith('ly')) break
    }
  }
  return found
}

/**
 * Fraction of words inside quotation marks.
 *
 * A scene at 90% dialogue is talking heads; one at 0% across a whole chapter
 * is a synopsis. Neither is wrong, and both are worth being able to see.
 */
export function dialogueRatio(text: string): number {
  const total = words(text).length
  if (total === 0) return 0
  const quoted = text.match(/[“"']([^“”"']{2,})[”"']/g) ?? []
  const inQuotes = quoted.reduce((sum, run) => sum + words(run).length, 0)
  return Math.min(1, inQuotes / total)
}

/** Words that carry no signal when repeated, so they never count as one. */
const COMMON = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'from', 'by', 'as', 'is', 'was', 'were', 'are', 'be', 'been', 'it',
  'its', 'that', 'this', 'these', 'those', 'he', 'she', 'they', 'them', 'his',
  'her', 'their', 'him', 'i', 'you', 'we', 'us', 'me', 'my', 'not', 'no',
  'so', 'if', 'then', 'than', 'had', 'has', 'have', 'do', 'did', 'does',
  'said', 'up', 'down', 'out', 'into', 'over', 'all', 'one', 'what', 'when',
  'there', 'here', 'would', 'could', 'about', 'like',
])

/**
 * The same distinctive word used more than twice within fifty words.
 *
 * Fifty is roughly a paragraph, and a paragraph is the distance at which a
 * reader still hears the earlier use. Wider than that and the repetition
 * stops registering; narrower and deliberate anaphora gets flagged.
 */
export function findRepetitions(list: string[], windowSize = 50, threshold = 3): Repetition[] {
  const found: Repetition[] = []
  const positions = new Map<string, number[]>()

  list.forEach((word, index) => {
    if (word.length < 4 || COMMON.has(word)) return
    const seen = positions.get(word) ?? []
    seen.push(index)
    positions.set(word, seen)
  })

  for (const [word, at] of positions) {
    if (at.length < threshold) continue
    // Every cluster, not just the first. Reporting one per word would mean a
    // verb leaned on in chapter two and again in chapter thirty shows up once,
    // sending the writer to the first one and silently hiding the rest —
    // which is precisely the thing a whole-manuscript report exists to catch.
    let start = 0
    while (start + threshold - 1 < at.length) {
      if (at[start + threshold - 1] - at[start] > windowSize) {
        start++
        continue
      }
      // Grow the cluster while the window still holds, so four uses in forty
      // words is one finding of four rather than two overlapping findings.
      let last = start + threshold - 1
      while (last + 1 < at.length && at[last + 1] - at[start] <= windowSize) last++
      found.push({ word, count: last - start + 1, at: at[start] })
      start = last + 1
    }
  }

  return found.sort((a, b) => a.at - b.at || a.word.localeCompare(b.word))
}

/** Syllables, by counting vowel groups. Approximate, and good enough. */
export function syllablesIn(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '')
  if (clean.length === 0) return 0
  if (clean.length <= 3) return 1
  const trimmed = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  return Math.max(1, (trimmed.match(/[aeiouy]{1,2}/g) ?? []).length)
}

/**
 * Flesch reading ease. Around 60–70 is ordinary contemporary prose; lower is
 * denser. Needs a couple of sentences before it means anything.
 */
export function readingEase(list: string[], sentenceCount: number): number | null {
  if (sentenceCount < 2 || list.length < 20) return null
  const syllables = list.reduce((sum, word) => sum + syllablesIn(word), 0)
  const score =
    206.835 - 1.015 * (list.length / sentenceCount) - 84.6 * (syllables / list.length)
  return Math.round(score * 10) / 10
}

/**
 * Words the -ed and -ing test catches that are not verbs.
 *
 * Without this, "nothing" tops the list on almost any manuscript — it ends in
 * -ing, it is long enough, and it is common enough in prose to outrank every
 * real verb in the book. Same shape as LY_NOT_ADVERBS above: the heuristic is
 * kept, and the words it is known to be wrong about are named.
 */
const NOT_VERBS = new Set([
  // -ing that are nouns, adjectives or prepositions
  'nothing', 'something', 'anything', 'everything', 'thing', 'things',
  'morning', 'evening', 'during', 'ceiling', 'ceilings', 'building', 'buildings',
  'feeling', 'feelings', 'lightning', 'clothing', 'meaning', 'painting', 'paintings',
  'king', 'kings', 'ring', 'rings', 'string', 'strings', 'spring', 'wing', 'wings',
  'darling', 'sibling', 'siblings', 'offspring', 'ling', 'cunning', 'willing',
  // -ed that are adjectives, nouns or adverbs
  'sacred', 'hundred', 'naked', 'wicked', 'hatred', 'kindred', 'rugged', 'ragged',
  'jagged', 'crooked', 'wretched', 'aged', 'indeed', 'seed', 'seeds', 'creed',
  'greed', 'deed', 'deeds', 'reed', 'reeds', 'tweed',
])

/** Verbs are hard without a parser; -ed and -ing endings catch most of them. */
function verbish(word: string): boolean {
  if (COMMON.has(word) || NOT_VERBS.has(word) || word.length < 4) return false
  return word.endsWith('ed') || word.endsWith('ing') || IRREGULAR_PARTICIPLES.has(word)
}

export function analyseProse(text: string): ProseReport {
  const lowered = text.toLowerCase()
  const list = words(lowered)
  const sentenceList = sentences(text)
  const sentenceLengths = sentenceList.map((sentence) => words(sentence).length)

  const verbCounts = new Map<string, number>()
  for (const word of list) {
    if (verbish(word)) verbCounts.set(word, (verbCounts.get(word) ?? 0) + 1)
  }

  return {
    words: list.length,
    sentences: sentenceList.length,
    paragraphs: paragraphs(text).length,
    meanSentenceLength:
      sentenceList.length === 0
        ? 0
        : Math.round((list.length / sentenceList.length) * 10) / 10,
    sentenceLengths,
    longestSentence: sentenceLengths.length === 0 ? 0 : Math.max(...sentenceLengths),
    adverbs: countAdverbs(list),
    filterWords: tally(list, FILTER_WORDS),
    hedgeWords: tally(list, HEDGE_WORDS),
    passiveCount: countPassive(list),
    dialogueRatio: dialogueRatio(text),
    repetitions: findRepetitions(list),
    mostUsedVerbs: [...verbCounts.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
      .slice(0, 8),
    readingEase: readingEase(list, sentenceList.length),
  }
}

/** Per ten thousand words, so scenes of different lengths can be compared. */
export function per10k(count: number, totalWords: number): number {
  if (totalWords === 0) return 0
  return Math.round((count / totalWords) * 10_000)
}

export interface ChapterPace {
  title: string
  words: number
  /** Fraction of the chapter's words inside quotes. */
  dialogueRatio: number
  meanSentenceLength: number
}

/**
 * The book chapter by chapter — the scale where pacing lives.
 *
 * A whole-book mean hides the sagging middle; a scene-level view drowns it
 * in noise. Chapter grain is where a writer plans, so it is where the shape
 * of the thing — a short sharp chapter among long ones, a talky stretch, a
 * chapter of forty-word sentences — actually shows.
 */
export function chapterPacing(chapters: { title: string; text: string }[]): ChapterPace[] {
  return chapters.map(({ title, text }) => {
    const list = words(text)
    const sentenceCount = sentences(text).length
    return {
      title,
      words: list.length,
      dialogueRatio: dialogueRatio(text),
      meanSentenceLength:
        sentenceCount === 0 ? 0 : Math.round((list.length / sentenceCount) * 10) / 10,
    }
  })
}

export interface CrutchWord {
  word: string
  count: number
  per10k: number
}

/**
 * The writer's own crutch words: distinctive vocabulary leaned on so often
 * across the whole book that it has become a habit.
 *
 * Different from `findRepetitions`, which hears echoes within a paragraph;
 * a crutch word can be spread perfectly evenly and still wear a groove.
 * There is no universal list to check against, because a crutch is personal
 * — so the test is plain frequency, with three kinds of word excused:
 * function words, the filter/hedge lists (they have their own panels), and
 * names. The cast is excluded by name — the Almanac already knows them —
 * and anything else almost always capitalised is treated as a name the
 * Almanac hasn't met yet, because "Whitby" appearing three hundred times is
 * a setting, not a habit.
 */
export function findCrutchWords(
  text: string,
  excludeNames: string[] = [],
  top = 12,
): CrutchWord[] {
  const original = words(text)
  const total = original.length
  // A habit needs scale: on a short text every word is "frequent".
  if (total < 2000) return []

  const excluded = new Set<string>()
  for (const name of excludeNames) {
    for (const part of words(name.toLowerCase())) excluded.add(part)
  }
  for (const word of FILTER_WORDS) excluded.add(word)
  for (const word of HEDGE_WORDS) excluded.add(word)

  const counts = new Map<string, number>()
  const capitalised = new Map<string, number>()
  for (const raw of original) {
    const lower = raw.toLowerCase()
    if (lower.length < 4 || COMMON.has(lower) || excluded.has(lower)) continue
    counts.set(lower, (counts.get(lower) ?? 0) + 1)
    if (raw[0] !== lower[0]) capitalised.set(lower, (capitalised.get(lower) ?? 0) + 1)
  }

  const found: CrutchWord[] = []
  for (const [word, count] of counts) {
    if (count < 6) continue
    const rate = (count / total) * 10_000
    if (rate < 8) continue
    // Sentence starts capitalise anything; a real name is capitalised
    // nearly every time it appears.
    if ((capitalised.get(word) ?? 0) / count >= 0.6) continue
    found.push({ word, count, per10k: Math.round(rate) })
  }

  return found
    .sort((a, b) => b.per10k - a.per10k || b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, top)
}
