export type ShareResultUrlOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

export interface ShareResultUrlDependencies {
  share?: (data: ShareData) => Promise<void>
  writeClipboard?: (text: string) => Promise<void>
}

function isShareCancellation(error: unknown): boolean {
  return (
    (error instanceof DOMException ||
      (typeof error === 'object' && error !== null && 'name' in error)) &&
    error.name === 'AbortError'
  )
}

export async function shareResultUrl(
  url: string,
  dependencies: ShareResultUrlDependencies,
): Promise<ShareResultUrlOutcome> {
  if (dependencies.share) {
    try {
      await dependencies.share({
        title: '暗算トレーニングの結果',
        text: '暗算トレーニングの結果を共有します。',
        url,
      })
      return 'shared'
    } catch (error: unknown) {
      if (isShareCancellation(error)) {
        return 'cancelled'
      }
    }
  }

  if (!dependencies.writeClipboard) {
    return 'failed'
  }

  try {
    await dependencies.writeClipboard(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
