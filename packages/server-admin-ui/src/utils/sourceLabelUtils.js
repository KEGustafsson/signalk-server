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

function getSourceDescription(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return null
  }

  if (typeof metadata.description === 'string' && metadata.description) {
    return metadata.description
  }

  if (
    metadata.n2k &&
    typeof metadata.n2k.description === 'string' &&
    metadata.n2k.description
  ) {
    return metadata.n2k.description
  }

  return null
}

export function getSourceDisplayLabel(sourceRef, sources = {}) {
  const metadata = getDeepestSourceMetadata(sourceRef, sources)
  const description = getSourceDescription(metadata)
  return description || sourceRef
}
