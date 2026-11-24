import type { Status, StatusDef } from '../types'
import { STATUS_KINDS } from '../data/settings'
import { STATUS_ICON } from '../data/config'

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

/** Icon of a status: the one chosen in Settings, else the default of its meaning. */
export function statusIcon(name: string, statuses?: StatusDef[]): string {
  return statuses?.find((s) => s.name === name)?.icon || STATUS_ICON[statusKind(name, statuses)]
}

/** Icons offered for statuses, grouped (Settings > Task statuses). */
export const STATUS_ICON_GROUPS: { key: string; icons: string[] }[] = [
  { key: 'progress', icons: ['🚩', '📈', '▶️', '🔄', '🏃', '🚀', '⚙️', '🛠️', '🔧', '🧪'] },
  { key: 'waiting', icons: ['⏸️', '⏳', '⌛', '🕒', '💤', '🚧', '⛔', '🔒', '🧊', '📥'] },
  { key: 'review', icons: ['👀', '🔍', '📝', '✍️', '🗳️', '⚖️', '🧐', '📤', '📨', '🔁'] },
  { key: 'done', icons: ['✔️', '✅', '☑️', '🏁', '🎯', '🏆', '🎉', '📦', '🗄️', '🔚'] },
  { key: 'problems', icons: ['❌', '⚠️', '❗', '🔥', '🐞', '🆘', '🛑', '📉', '💥', '🚨'] },
  { key: 'people', icons: ['👤', '👥', '🤝', '🙋', '🧑‍💼', '📞', '💬', '🗣️', '👍', '👎'] },
  { key: 'documents', icons: ['📄', '📋', '📑', '📁', '🗂️', '📎', '🧾', '📜', '📚', '🖊️'] },
  { key: 'dates', icons: ['📅', '🗓️', '⏰', '⏱️', '📆', '🔔', '🌙', '☀️', '🕐', '⏭️'] },
  { key: 'colours', icons: ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟥', '🟩'] },
]
