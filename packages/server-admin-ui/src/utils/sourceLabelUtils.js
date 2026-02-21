function getDeepestSourceMetadata(sourceRef, sources) {
  if (
    !sourceRef?.startsWith('ws.') ||
    !sources ||
    typeof sources !== 'object'
  ) {
    return null
  }

  const node = sourceRef
    .split('.')
    .reduce(
      (acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined),
      sources
    )

  return node && typeof node === 'object' ? node : null
}

export function getSourceDisplayLabel(sourceRef, sources = {}) {
  const metadata = getDeepestSourceMetadata(sourceRef, sources)
  const description = metadata?.description
  return description || sourceRef
}
