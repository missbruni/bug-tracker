import { escapeHtml, getEmailLogoUrl, renderEmailCta, renderEmailLayout } from './_emailLayout'

export function buildInviteEmailHtml({
  inviterName,
  teamName,
  appUrl,
  assetBaseUrl = appUrl,
  logoUrl = getEmailLogoUrl(appUrl, assetBaseUrl),
}: {
  inviterName: string
  teamName: string
  appUrl: string
  assetBaseUrl?: string
  logoUrl?: string
}): string {
  const safeInviterName = escapeHtml(inviterName)
  const safeTeamName = escapeHtml(teamName)

  return renderEmailLayout({
    logoUrl,
    maxWidth: 480,
    footer: "If you weren't expecting this invitation, you can safely ignore this email.",
    content: `
      <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 700; color: #ECF2EF;">
        You're invited! 🐛
      </h2>
      <p style="margin: 0 0 12px; font-size: 15px; color: #B9CBC2; line-height: 1.6;">
        <strong style="color: #ECF2EF;">${safeInviterName}</strong> has invited you to join
        <strong style="color: #00FFCC;">${safeTeamName}</strong> on Mushi.
      </p>
      <p style="margin: 0 0 28px; font-size: 15px; color: #B9CBC2; line-height: 1.6;">
        Sign in to get started.
      </p>
      ${renderEmailCta({ href: appUrl, label: 'Open Mushi' })}
    `,
  })
}
