import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import {
  AppleIcon,
  FacebookIcon,
  GoogleIcon,
} from '@/features/auth/components/provider-icons'
import { isTauriRuntime } from '@/lib/db/tauri-bridge'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [socialPending, setSocialPending] = useState<string | null>(null)
  const desktopShell = isTauriRuntime()

  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail)
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const signInWithFacebook = useAuthStore((s) => s.signInWithFacebook)
  const signInWithApple = useAuthStore((s) => s.signInWithApple)
  const { toast } = useToast()

  function reset() {
    setEmail('')
    setPassword('')
    setAuthorName('')
    clearError()
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, authorName)
        toast({ title: `Welcome, ${authorName || 'there'}` })
      } else {
        await signInWithEmail(email, password)
        toast({ title: 'Signed in' })
      }
      reset()
      onOpenChange(false)
    } catch {
      // Error already surfaced via the store's `error` field, shown below.
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSocial(provider: 'google' | 'facebook' | 'apple') {
    setSocialPending(provider)
    clearError()
    try {
      if (provider === 'google') await signInWithGoogle()
      else if (provider === 'facebook') await signInWithFacebook()
      else await signInWithApple()
      toast({ title: 'Signed in' })
      reset()
      onOpenChange(false)
    } catch {
      // Error already surfaced via the store's `error` field, shown below.
    } finally {
      setSocialPending(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'signup' ? 'Create an account' : 'Sign in'}</DialogTitle>
          <DialogDescription>
            {mode === 'signup'
              ? 'Optional — INKWELL works fully offline without one. An account sets your author name and syncs your library across devices.'
              : 'Sign in to sync your library across devices.'}
          </DialogDescription>
        </DialogHeader>

        {/* Social sign-in relies on an OAuth popup handing its result back to
            the page's origin. The desktop shell runs on an internal
            `tauri://` origin that Firebase can't authorize, so these buttons
            cannot succeed there — hidden rather than shown-and-broken. See
            docs/CLOUD_AUTH_SETUP.md for the deep-link flow that would fix it. */}
        <div className={cn('flex-col gap-2', desktopShell ? 'hidden' : 'flex')}>
          <Button
            variant="outline"
            className="gap-2"
            disabled={socialPending !== null}
            onClick={() => handleSocial('google')}
          >
            {socialPending === 'google' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={socialPending !== null}
            onClick={() => handleSocial('apple')}
          >
            {socialPending === 'apple' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <AppleIcon />
            )}
            Continue with Apple
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={socialPending !== null}
            onClick={() => handleSocial('facebook')}
          >
            {socialPending === 'facebook' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FacebookIcon />
            )}
            Continue with Facebook
          </Button>
        </div>

        {!desktopShell && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        <form className="flex flex-col gap-3" onSubmit={handleEmailSubmit}>
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-author-name">Author name</Label>
              <Input
                id="auth-author-name"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name or pen name"
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="submit" disabled={submitting} className="w-full gap-1.5">
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup')
                clearError()
              }}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {mode === 'signup'
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
