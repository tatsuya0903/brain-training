import { formatElapsedTime } from '../training/resultAnalyzer'

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
  totalMs: number,
  dependencies: ShareResultUrlDependencies,
): Promise<ShareResultUrlOutcome> {
  const text = `暗算トレーニングの記録：${formatElapsedTime(totalMs)}\n${url}`

  if (dependencies.share) {
    try {
      await dependencies.share({
        title: '暗算トレーニングの結果',
        text,
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
    await dependencies.writeClipboard(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
