import { describe, expect, it, vi } from 'vitest'

import { shareResultUrl } from './shareResultUrl'

describe('shareResultUrl', () => {
  it('uses the Web Share API when available', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined)
    const writeClipboard = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

    await expect(
      shareResultUrl('https://example.com/#/result?s=data', 40_200, { share, writeClipboard }),
    ).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({
      title: '暗算トレーニングの結果',
      text: '暗算トレーニングの記録：40.20秒\nhttps://example.com/#/result?s=data',
    })
    expect(share.mock.calls[0]?.[0]).not.toHaveProperty('url')
    expect(writeClipboard).not.toHaveBeenCalled()
  })

  it('copies to the clipboard when Web Share is unavailable', async () => {
    const writeClipboard = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

    await expect(
      shareResultUrl('https://example.com/#/result?s=data', 40_200, { writeClipboard }),
    ).resolves.toBe('copied')
    expect(writeClipboard).toHaveBeenCalledWith(
      '暗算トレーニングの記録：40.20秒\nhttps://example.com/#/result?s=data',
    )
    expect(writeClipboard.mock.calls[0]?.[0]).not.toContain('\n\n')
    expect(writeClipboard.mock.calls[0]?.[0]).not.toContain('暗算トレーニングの結果を共有します。')
  })

  it('falls back to the clipboard when Web Share cannot start', async () => {
    const share = vi
      .fn<(data: ShareData) => Promise<void>>()
      .mockRejectedValue(new TypeError('Sharing unavailable'))
    const writeClipboard = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

    await expect(shareResultUrl('url', 40_200, { share, writeClipboard })).resolves.toBe('copied')
    expect(writeClipboard).toHaveBeenCalledWith('暗算トレーニングの記録：40.20秒\nurl')
  })

  it('treats cancelling the share sheet as a non-fatal outcome', async () => {
    const share = vi
      .fn<(data: ShareData) => Promise<void>>()
      .mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
    const writeClipboard = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

    await expect(shareResultUrl('url', 40_200, { share, writeClipboard })).resolves.toBe(
      'cancelled',
    )
    expect(writeClipboard).not.toHaveBeenCalled()
  })
})
