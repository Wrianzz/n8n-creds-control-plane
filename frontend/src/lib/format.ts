export function formatDate(value?: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export function stringifyPretty(value: unknown) {
  return JSON.stringify(value, null, 2)
}
