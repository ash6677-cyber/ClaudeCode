// Minimal inline brand marks — lucide-react is a generic icon set and has
// no Google/Apple/Facebook logos, and these are recognizable enough that a
// generic stand-in (e.g. a browser icon for "Google") would misrepresent
// the button's actual destination.

export function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...props}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}

export function AppleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
      <path d="M16.365 1.43c0 1.14-.462 2.11-1.213 2.83-.83.79-2.02 1.35-3.03 1.28-.14-1.1.46-2.24 1.19-2.94.83-.8 2.16-1.28 3.05-1.17ZM20.7 17.13c-.4.9-.87 1.75-1.44 2.55-.78 1.08-1.6 2.16-2.87 2.18-1.24.03-1.65-.73-3.06-.73-1.42 0-1.87.71-3.04.76-1.24.05-2.18-1.17-2.97-2.24-1.63-2.2-2.87-6.22-1.2-8.94.83-1.35 2.31-2.2 3.92-2.22 1.19-.02 2.32.8 3.05.8.72 0 2.08-.99 3.51-.85.6.03 2.28.24 3.36 1.82-.09.05-2 1.17-1.98 3.49.02 2.77 2.43 3.7 2.46 3.72-.02.06-.38 1.31-1.26 2.66Z" />
    </svg>
  )
}

export function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...props}>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07Z"
      />
    </svg>
  )
}
