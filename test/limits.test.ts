import { describe, expect, it } from 'vitest'
import { sizeWarning } from '../src/limits'

const MB = 1024 * 1024

describe('F-7 Send-to-Kindle size warning', () => {
  it('warns above 50 MB', () => {
    expect(sizeWarning(50 * MB + 1)).toBe('Over Send-to-Kindle email limit (50 MB); use the web or app upload')
  })
  it('stays silent at or below 50 MB', () => {
    expect(sizeWarning(50 * MB)).toBeNull()
    expect(sizeWarning(1000)).toBeNull()
  })
})
