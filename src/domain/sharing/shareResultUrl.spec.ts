import { describe, expect, it, vi } from 'vitest'

import { shareResultUrl } from './shareResultUrl'

describe('shareResultUrl', () => {
  it('uses the Web Share API when available', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined)
    const writeClipboard = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

    await expect(
      shareResultUrl('https://example.com/#/result?share=data', { share, writeClipboard }),
    ).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/#/result?share=data' }),
    )
    expect(writeClipboard).not.toHaveBeenCalled()
  })

  it('copies to the clipboard when Web Share is unavailable', async () => {
    const writeClipboard = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

    await expect(
      shareResultUrl('https://example.com/#/result?share=data', { writeClipboard }),
    ).resolves.toBe('copied')
    expect(writeClipboard).toHaveBeenCalledWith('https://example.com/#/result?share=data')
  })

  it('falls back to the clipboard when Web Share cannot start', async () => {
    const share = vi
      .fn<(data: ShareData) => Promise<void>>()
      .mockRejectedValue(new TypeError('Sharing unavailable'))
    const writeClipboard = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

    await expect(shareResultUrl('url', { share, writeClipboard })).resolves.toBe('copied')
  })

  it('treats cancelling the share sheet as a non-fatal outcome', async () => {
    const share = vi
      .fn<(data: ShareData) => Promise<void>>()
      .mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
    const writeClipboard = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

    await expect(shareResultUrl('url', { share, writeClipboard })).resolves.toBe('cancelled')
    expect(writeClipboard).not.toHaveBeenCalled()
  })
})
