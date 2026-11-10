import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('renderuje pogrubienie', () => {
    expect(renderMarkdown('**a**')).toContain('<strong>a</strong>')
  })

  it('escapuje surowy HTML', () => {
    const html = renderMarkdown('<script>x</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('nie przepuszcza linków javascript:', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href="javascript:')
  })

  it('zachowuje zwykłe linki', () => {
    expect(renderMarkdown('[x](https://example.com)')).toContain('href="https://example.com"')
  })
})
