// Amazon Send-to-Kindle: 50 MB per email attachment, 200 MB via web/app (from Amazon's docs, unverified).
const EMAIL_LIMIT_BYTES = 50 * 1024 * 1024

export const sizeWarning = (bytes: number): string | null =>
  bytes > EMAIL_LIMIT_BYTES ? 'Over Send-to-Kindle email limit (50 MB); use the web or app upload' : null
