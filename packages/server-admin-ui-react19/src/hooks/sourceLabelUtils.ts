interface SourceMetadata {
  description?: string
  [key: string]: unknown
}

function getDeepestSourceMetadata(
  sourceRef: string,
  sources: Record<string, unknown>
): SourceMetadata | null {
  if (!sourceRef?.startsWith('ws.') || !sources || typeof sources !== 'object') {
    return null
  }

  const node = sourceRef
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      sources
    )

  return node && typeof node === 'object' ? (node as SourceMetadata) : null
}

export function getSourceDisplayLabel(
  sourceRef: string,
  sources: Record<string, unknown> = {}
): string {
  const metadata = getDeepestSourceMetadata(sourceRef, sources)
  const description = metadata?.description
  return description || sourceRef
}
