/**
 * Which social sign-in buttons this build offers.
 *
 * The three providers are not equally available. Google and Facebook cost
 * nothing to register; Sign in with Apple requires a $99/year Apple Developer
 * Program membership. A build deployed without one still showed all three
 * buttons, and the Apple button could only ever fail with
 * `auth/operation-not-allowed` — a button that is guaranteed to error is
 * worse than no button, because the writer reads it as the app being broken
 * rather than as a provider that was never set up.
 *
 * So the offered set is configuration, not a hardcoded list. Set
 * `VITE_AUTH_PROVIDERS` to a comma-separated subset and only those appear.
 *
 * No Firebase imports here on purpose: the parsing is pure, so it can be
 * tested without initialising an app.
 */

export type AuthProviderId = 'google' | 'apple' | 'facebook'

/** Canonical display order, which is also the order buttons are rendered in. */
export const ALL_AUTH_PROVIDERS: readonly AuthProviderId[] = ['google', 'apple', 'facebook']

export const AUTH_PROVIDER_LABELS: Record<AuthProviderId, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
  facebook: 'Continue with Facebook',
}

function isProviderId(value: string): value is AuthProviderId {
  return (ALL_AUTH_PROVIDERS as readonly string[]).includes(value)
}

/**
 * Reads the configured provider list.
 *
 * Unset or blank means all three, so local development against the emulator
 * — where every provider is stubbed and all of them "work" — is unchanged and
 * nobody has to set an environment variable to see the buttons they already
 * had. Turning them all off is therefore a deliberate act and needs the
 * explicit word `none`; an accidentally empty variable must not silently
 * remove the sign-in UI.
 *
 * Unknown names are dropped rather than throwing. A typo in a deployment
 * variable should cost one button, not the whole application.
 */
export function parseProviderList(raw: string | undefined | null): AuthProviderId[] {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return [...ALL_AUTH_PROVIDERS]
  if (trimmed.toLowerCase() === 'none') return []

  const requested = new Set(
    trimmed
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(isProviderId),
  )
  // Filtering the canonical list rather than mapping the input keeps the
  // rendered order stable however the variable happens to be written.
  return ALL_AUTH_PROVIDERS.filter((id) => requested.has(id))
}

export const enabledAuthProviders = parseProviderList(import.meta.env.VITE_AUTH_PROVIDERS)
