import { useEffect, useMemo, useRef } from 'react'

/** Returns a stable debounced wrapper around the latest `callback`, flushed on unmount. */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
) {
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingArgsRef = useRef<Args | null>(null)

  const debounced = useMemo(() => {
    function run(...args: Args) {
      pendingArgsRef.current = args
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        if (pendingArgsRef.current) callbackRef.current(...pendingArgsRef.current)
        pendingArgsRef.current = null
      }, delayMs)
    }
    run.flush = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (pendingArgsRef.current) {
        callbackRef.current(...pendingArgsRef.current)
        pendingArgsRef.current = null
      }
    }
    return run
  }, [delayMs])

  useEffect(() => {
    return () => debounced.flush()
  }, [debounced])

  return debounced
}
