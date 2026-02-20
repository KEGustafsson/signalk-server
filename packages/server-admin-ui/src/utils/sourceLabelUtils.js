function getDeepestSourceMetadata(sourceRef, sources) {
  if (
    !sourceRef ||
    !sources ||
    typeof sources !== 'object' ||
    !sourceRef.startsWith('ws.')
  ) {
    return null
  }

  const parts = sourceRef.split('.')
  let node = sources

  for (let i = 0; i < parts.length; i++) {
    if (!node || typeof node !== 'object' || !(parts[i] in node)) {
      break
    }
    node = node[parts[i]]
  }

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
