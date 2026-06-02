import { describe, expect, test } from 'bun:test'
import { buildBugMentionEmailHtml } from '../_mentionEmail'

describe('buildBugMentionEmailHtml', () => {
  test('escapes user-controlled mention email content', () => {
    const html = buildBugMentionEmailHtml({
      actorName: '<Triager>',
      bugId: 'HI-01',
      bugTitle: 'Copy breaks <checkout>',
      commentText: '@Alex please check <script>alert("x")</script>',
      bugUrl: 'https://mushi.example.com/?q=HI-01',
      appUrl: 'https://mushi.example.com',
    })

    expect(html).toContain('&lt;Triager&gt;')
    expect(html).toContain('https://mushi.example.com/mushi-logo-email.png')
    expect(html).toContain('Copy breaks &lt;checkout&gt;')
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(html).toContain('https://mushi.example.com/?q=HI-01')
  })

  test('uses a separate public asset base url for the logo', () => {
    const html = buildBugMentionEmailHtml({
      actorName: 'Triager',
      bugId: 'HI-01',
      bugTitle: 'Copy breaks',
      commentText: '@Alex please check',
      bugUrl: 'http://localhost:5174/?q=HI-01',
      appUrl: 'http://localhost:5174',
      assetBaseUrl: 'https://mushi.vercel.app',
    })

    expect(html).toContain('https://mushi.vercel.app/mushi-logo-email.png')
    expect(html).toContain('http://localhost:5174/?q=HI-01')
  })
})
