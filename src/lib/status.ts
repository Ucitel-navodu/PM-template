import type { Status, StatusDef } from '../types'
import { STATUS_KINDS } from '../data/settings'

/**
 * Meaning of a user-defined status name. Unknown names fall back to their own
 * value when it is one of the built-in meanings, otherwise "Not started".
 */
export function statusKind(name: string, statuses?: StatusDef[]): Status {
  const def = statuses?.find((s) => s.name === name)
  if (def) return def.kind
  return (STATUS_KINDS as string[]).includes(name) ? (name as Status) : 'Not started'
}

/** First status of the list with the given meaning (e.g. the "done" column). */
export function statusOfKind(kind: Status, statuses?: StatusDef[]): string {
  return statuses?.find((s) => s.kind === kind)?.name ?? kind
}
