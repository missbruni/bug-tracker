import { escapeHtml, getEmailLogoUrl, renderEmailCta, renderEmailLayout } from './_emailLayout'

export function buildBugMentionEmailHtml({
  actorName,
  bugId,
  bugTitle,
  commentText,
  bugUrl,
  appUrl,
  assetBaseUrl = appUrl,
  logoUrl = getEmailLogoUrl(appUrl, assetBaseUrl),
}: {
  actorName: string
  bugId: string
  bugTitle: string
  commentText: string
  bugUrl: string
  appUrl: string
  assetBaseUrl?: string
  logoUrl?: string
}): string {
  const safeActorName = escapeHtml(actorName)
  const safeBugId = escapeHtml(bugId)
  const safeBugTitle = escapeHtml(bugTitle)
  const safeCommentText = escapeHtml(commentText)

  return renderEmailLayout({
    logoUrl,
    footer: 'You received this because someone tagged you in a Mushi bug comment.',
    content: `
      <p style="margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #00FFCC; letter-spacing: 0.04em; text-transform: uppercase;">
        You were tagged on a bug
      </p>
      <h2 style="margin: 0 0 18px; font-size: 18px; font-weight: 700; color: #ECF2EF; line-height: 1.4;">
        ${safeBugId}: ${safeBugTitle}
      </h2>
      <p style="margin: 0 0 14px; font-size: 15px; color: #B9CBC2; line-height: 1.6;">
        <strong style="color: #ECF2EF;">${safeActorName}</strong> mentioned you in a comment:
      </p>
      <div style="margin: 0 0 28px; padding: 16px; background-color: #11161d; border: 1px solid #2f353d; border-radius: 10px; color: #ECF2EF; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
        ${safeCommentText}
      </div>
      ${renderEmailCta({ href: bugUrl, label: 'Open bug' })}
    `,
  })
}
