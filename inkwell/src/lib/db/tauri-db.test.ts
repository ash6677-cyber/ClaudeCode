import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Simulated "disk": what the last save wrote, and what a chosen export/import
// file would contain. Every test gets a fresh instance via resetModules().
let disk: { library: string | null; exportedPath: string | null; exportedJson: string | null } = {
  library: null,
  exportedPath: null,
  exportedJson: null,
}

vi.mock('./tauri-bridge', () => ({
  loadLibraryRaw: vi.fn(async () => disk.library),
  saveLibraryRaw: vi.fn(async (json: string) => {
    disk.library = json
  }),
  createBackup: vi.fn(async () => null),
  exportLibraryRaw: vi.fn(async (destPath: string, json: string) => {
    disk.exportedPath = destPath
    disk.exportedJson = json
  }),
  importLibraryRaw: vi.fn(async () => disk.exportedJson),
}))

describe('tauri-db', () => {
  beforeEach(() => {
    disk = { library: null, exportedPath: null, exportedJson: null }
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts empty when no library file exists yet', async () => {
    const { initTauriDb, tauriTables } = await import('./tauri-db')
    await initTauriDb()
    expect(await tauriTables.projects.toArray()).toEqual([])
  })

  it('autosave persists a created record, and restarting the app restores it', async () => {
    const { initTauriDb, tauriTables, flushPendingSave } = await import('./tauri-db')
    await initTauriDb()

    const project = {
      id: 'p1',
      title: 'Persisted Book',
      author: '',
      synopsis: '',
      genre: '',
      targetWordCount: 1000,
      coverId: null,
      seriesId: null,
  seriesOrder: 0,
      status: 'planning' as const,
      settings: { defaultAiPresetId: null, pov: 'first' as const, tense: 'past' as const, measureWidthCh: 68, structureMode: 'scenes' as const },
      createdAt: 1,
      updatedAt: 1,
    }
    await tauriTables.projects.add(project)
    await flushPendingSave()

    expect(disk.library).not.toBeNull()
    expect(JSON.parse(disk.library!).projects).toHaveLength(1)

    // Simulate an app restart: fresh module instance, same "disk" content.
    vi.resetModules()
    const restarted = await import('./tauri-db')
    await restarted.initTauriDb()
    const restoredProjects = await restarted.tauriTables.projects.toArray()

    expect(restoredProjects).toHaveLength(1)
    expect(restoredProjects[0].title).toBe('Persisted Book')
  })

  it('exports and re-imports a library losslessly', async () => {
    const { initTauriDb, tauriTables, exportLibraryToFile } = await import('./tauri-db')
    await initTauriDb()

    await tauriTables.projects.add({
      id: 'p1',
      title: 'Export Me',
      author: 'A. Writer',
      synopsis: 'A story.',
      genre: 'Drama',
      targetWordCount: 50000,
      coverId: null,
      seriesId: null,
  seriesOrder: 0,
      status: 'drafting',
      settings: { defaultAiPresetId: null, pov: 'third-limited', tense: 'past', measureWidthCh: 68, structureMode: 'chapters-only' },
      createdAt: 5,
      updatedAt: 5,
    })
    await tauriTables.chapters.add({
      id: 'c1',
      projectId: 'p1',
      title: 'Chapter One',
      order: 0,
      status: 'drafting',
      createdAt: 5,
      updatedAt: 5,
    })

    await exportLibraryToFile('/fake/exports/mybook.inkwell')
    expect(disk.exportedPath).toBe('/fake/exports/mybook.inkwell')
    expect(disk.exportedJson).not.toBeNull()

    // Import into a completely different, pre-populated library instance —
    // proves import *replaces* state, and does so losslessly.
    vi.resetModules()
    const target = await import('./tauri-db')
    await target.initTauriDb()
    await target.tauriTables.projects.add({
      id: 'stale',
      title: 'Should be replaced',
      author: '',
      synopsis: '',
      genre: '',
      targetWordCount: 0,
      coverId: null,
      seriesId: null,
  seriesOrder: 0,
      status: 'planning',
      settings: { defaultAiPresetId: null, pov: 'first', tense: 'past', measureWidthCh: 68, structureMode: 'scenes' },
      createdAt: 1,
      updatedAt: 1,
    })

    await target.importLibraryFromFile('/fake/exports/mybook.inkwell')

    const projects = await target.tauriTables.projects.toArray()
    const chapters = await target.tauriTables.chapters.toArray()
    expect(projects).toHaveLength(1)
    expect(projects[0]).toMatchObject({
      id: 'p1',
      title: 'Export Me',
      author: 'A. Writer',
      genre: 'Drama',
      targetWordCount: 50000,
    })
    expect(chapters).toHaveLength(1)
    expect(chapters[0].title).toBe('Chapter One')
  })
})
