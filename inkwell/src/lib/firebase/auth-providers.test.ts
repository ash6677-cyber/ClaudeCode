import { describe, expect, it } from 'vitest'

import { ALL_AUTH_PROVIDERS, AUTH_PROVIDER_LABELS, parseProviderList } from './auth-providers'

describe('parseProviderList', () => {
  it('offers all three when unconfigured', () => {
    // Local development against the emulator must keep working untouched.
    expect(parseProviderList(undefined)).toEqual(['google', 'apple', 'facebook'])
    expect(parseProviderList(null)).toEqual(['google', 'apple', 'facebook'])
  })

  it('treats a blank value as unconfigured, not as "none"', () => {
    // `VITE_AUTH_PROVIDERS=` in an env file arrives as an empty string. An
    // unfilled placeholder must not silently delete the sign-in buttons.
    expect(parseProviderList('')).toEqual(['google', 'apple', 'facebook'])
    expect(parseProviderList('   ')).toEqual(['google', 'apple', 'facebook'])
  })

  it('turns every social button off only when asked explicitly', () => {
    expect(parseProviderList('none')).toEqual([])
    expect(parseProviderList('NONE')).toEqual([])
  })

  it('keeps only the providers named — the Apple-less deployment', () => {
    // Sign in with Apple needs a paid Apple Developer membership; a build
    // without one should not show a button that can only ever error.
    expect(parseProviderList('google,facebook')).toEqual(['google', 'facebook'])
    expect(parseProviderList('google')).toEqual(['google'])
  })

  it('tolerates whitespace, casing and duplicates', () => {
    expect(parseProviderList(' Google , GOOGLE ,facebook ')).toEqual(['google', 'facebook'])
  })

  it('renders in canonical order however the variable is written', () => {
    expect(parseProviderList('facebook,google')).toEqual(['google', 'facebook'])
  })

  it('drops unknown names instead of failing', () => {
    // A typo in a deployment variable should cost one button, not the app.
    expect(parseProviderList('google,twitter')).toEqual(['google'])
    expect(parseProviderList('twitter')).toEqual([])
  })

  it('labels every provider it can offer', () => {
    for (const id of ALL_AUTH_PROVIDERS) {
      expect(AUTH_PROVIDER_LABELS[id]).toMatch(/\S/)
    }
  })
})
