// Next ID in the workbook's style (M06, B011, R-002), derived from the IDs
// already present - a module-level counter would restart after every reload
// and hand out duplicates.
export function nextSequentialId(existing: string[], prefix: string, pad: number): string {
  const max = existing.reduce((acc, id) => {
    if (!id.startsWith(prefix)) return acc
    const n = Number(id.slice(prefix.length))
    return Number.isInteger(n) && n > acc ? n : acc
  }, 0)
  return prefix + String(max + 1).padStart(pad, '0')
}
