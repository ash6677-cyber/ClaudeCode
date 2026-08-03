import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * These cover the parts of social sign-in that only show up against a real
 * provider — a closed window, a blocked popup, an installed app with no
 * opener to hand a result back to — none of which the Firebase emulator can
 * produce. The Firebase SDK is mocked because the behaviour under test is
 * entirely ours: which flow is chosen, and what the caller is told happened.
 */

const signInWithPopup = vi.fn()
const signInWithRedirect = vi.fn()
const getRedirectResult = vi.fn()
const getAdditionalUserInfo = vi.fn()
const updateProfile = vi.fn()

class FakeProvider {
  scopes: string[] = []
  id: string
  constructor(id: string) {
    this.id = id
  }
  addScope(scope: string) {
    this.scopes.push(scope)
  }
}

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => () => undefined),
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirect(...args),
  getRedirectResult: (...args: unknown[]) => getRedirectResult(...args),
  getAdditionalUserInfo: (...args: unknown[]) => getAdditionalUserInfo(...args),
  updateProfile: (...args: unknown[]) => updateProfile(...args),
  GoogleAuthProvider: class extends FakeProvider {
    constructor() {
      super('google')
    }
  },
  FacebookAuthProvider: class extends FakeProvider {
    constructor() {
      super('facebook')
    }
  },
  OAuthProvider: FakeProvider,
}))

vi.mock('@/lib/firebase/config', () => ({ firebaseAuth: { name: 'test-auth' } }))
vi.mock('@/lib/db/tauri-bridge', () => ({ isTauriRuntime: () => false }))

const installed = vi.fn(() => false)
vi.mock('@/lib/storage/durability', () => ({ isInstalled: () => installed() }))

const { useAuthStore } = await import('./auth-store')

const account = { uid: 'u1', email: 'mara@example.com', displayName: 'Mara', photoURL: null }
const authError = (code: string) => Object.assign(new Error(code), { code })

beforeEach(() => {
  vi.clearAllMocks()
  installed.mockReturnValue(false)
  getAdditionalUserInfo.mockReturnValue(undefined)
  useAuthStore.setState({ user: null, status: 'signed-out', error: null })
})

describe('signInWith — popup', () => {
  it('signs the writer in', async () => {
    signInWithPopup.mockResolvedValue({ user: account })

    await expect(useAuthStore.getState().signInWith('google')).resolves.toBe('signed-in')

    expect(useAuthStore.getState().user?.uid).toBe('u1')
    expect(useAuthStore.getState().status).toBe('signed-in')
    expect(useAuthStore.getState().error).toBeNull()
  })

  it('reports a closed window as dismissed, not as a sign-in', async () => {
    // The bug this exists to stop: cancelling used to resolve the same way a
    // successful sign-in did, so the dialog announced "Signed in" and closed
    // itself while the writer was still signed out.
    signInWithPopup.mockRejectedValue(authError('auth/popup-closed-by-user'))

    await expect(useAuthStore.getState().signInWith('google')).resolves.toBe('dismissed')

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().status).toBe('signed-out')
    // Changing your mind is not an error worth showing.
    expect(useAuthStore.getState().error).toBeNull()
    expect(signInWithRedirect).not.toHaveBeenCalled()
  })

  it('reports clicking a second provider as dismissed too', async () => {
    signInWithPopup.mockRejectedValue(authError('auth/cancelled-popup-request'))
    await expect(useAuthStore.getState().signInWith('facebook')).resolves.toBe('dismissed')
    expect(useAuthStore.getState().error).toBeNull()
  })

  it('falls back to a redirect when the popup is blocked', async () => {
    signInWithPopup.mockRejectedValue(authError('auth/popup-blocked'))
    signInWithRedirect.mockResolvedValue(undefined)

    await expect(useAuthStore.getState().signInWith('google')).resolves.toBe('redirecting')

    expect(signInWithRedirect).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().error).toBeNull()
  })

  it('surfaces a real failure instead of navigating away', async () => {
    // A redirect would lose the page's state and then fail identically.
    signInWithPopup.mockRejectedValue(authError('auth/unauthorized-domain'))

    await expect(useAuthStore.getState().signInWith('google')).rejects.toThrow()

    expect(signInWithRedirect).not.toHaveBeenCalled()
    expect(useAuthStore.getState().error).toContain('authorised domains')
  })

  it('asks Apple for the scopes its name arrives in', async () => {
    signInWithPopup.mockResolvedValue({ user: account })
    await useAuthStore.getState().signInWith('apple')

    const provider = signInWithPopup.mock.calls[0][1] as FakeProvider
    expect(provider.id).toBe('apple.com')
    expect(provider.scopes).toEqual(['email', 'name'])
  })
})

describe('signInWith — installed app', () => {
  it('skips the popup entirely', async () => {
    // In a Home Screen app `window.open` has no opener to report back to, so
    // the popup promise never settles and the spinner spins forever.
    installed.mockReturnValue(true)
    signInWithRedirect.mockResolvedValue(undefined)

    await expect(useAuthStore.getState().signInWith('google')).resolves.toBe('redirecting')

    expect(signInWithPopup).not.toHaveBeenCalled()
    expect(signInWithRedirect).toHaveBeenCalledTimes(1)
  })

  it('reports a redirect that could not even start', async () => {
    installed.mockReturnValue(true)
    signInWithRedirect.mockRejectedValue(authError('auth/network-request-failed'))

    await expect(useAuthStore.getState().signInWith('google')).rejects.toThrow()
    expect(useAuthStore.getState().error).toContain('connection')
  })
})

describe('consumeRedirectResult', () => {
  it('does nothing on an ordinary page load', async () => {
    getRedirectResult.mockResolvedValue(null)
    await useAuthStore.getState().consumeRedirectResult()
    expect(useAuthStore.getState().status).toBe('signed-out')
    expect(useAuthStore.getState().error).toBeNull()
  })

  it('completes a sign-in that came back by redirect', async () => {
    getRedirectResult.mockResolvedValue({ user: account })
    await useAuthStore.getState().consumeRedirectResult()
    expect(useAuthStore.getState().user?.uid).toBe('u1')
    expect(useAuthStore.getState().status).toBe('signed-in')
  })

  it('rescues the name Apple sends exactly once', async () => {
    // Apple returns the name only on first authorisation and Firebase does
    // not write it to the account. Missed here, it is gone for good.
    const nameless = { ...account, displayName: null }
    getRedirectResult.mockResolvedValue({ user: nameless })
    getAdditionalUserInfo.mockReturnValue({
      profile: { name: { firstName: 'Mara', lastName: 'Vance' } },
    })
    updateProfile.mockResolvedValue(undefined)

    await useAuthStore.getState().consumeRedirectResult()

    expect(updateProfile).toHaveBeenCalledWith(nameless, { displayName: 'Mara Vance' })
  })

  it('leaves a failed redirect visible without throwing', async () => {
    // Nothing awaits this call, so an unhandled rejection would be silent and
    // the writer would land back on a page that just says "not signed in".
    getRedirectResult.mockRejectedValue(
      Object.assign(new Error('x'), {
        code: 'auth/account-exists-with-different-credential',
        customData: { email: 'mara@example.com' },
      }),
    )

    await expect(useAuthStore.getState().consumeRedirectResult()).resolves.toBeUndefined()
    expect(useAuthStore.getState().error).toContain('mara@example.com')
  })

  it('says nothing when the writer simply backed out', async () => {
    getRedirectResult.mockRejectedValue(authError('auth/user-cancelled'))
    await useAuthStore.getState().consumeRedirectResult()
    expect(useAuthStore.getState().error).toBeNull()
  })

  it('says nothing for a failure it cannot name', async () => {
    // Pressing Back on the provider's page comes back as a bare timeout. The
    // writer is signed out, which is exactly where they started — telling
    // them something went wrong is a false alarm.
    for (const code of ['auth/timeout', 'auth/internal-error']) {
      useAuthStore.setState({ error: null })
      getRedirectResult.mockRejectedValue(authError(code))
      await useAuthStore.getState().consumeRedirectResult()
      expect(useAuthStore.getState().error).toBeNull()
    }
  })
})
