export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function getEmailLogoUrl(appUrl: string, assetBaseUrl = appUrl): string {
  return `${assetBaseUrl.replace(/\/$/, '')}/mushi-logo-email.png`
}

export function renderEmailCta({ href, label }: { href: string; label: string }): string {
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color: #00FFCC; border-radius: 8px; mso-padding-alt: 14px 32px;" align="center">
                  <a href="${href}" style="display: inline-block; padding: 14px 32px; color: #0a0e14; font-weight: 700; font-size: 14px; text-decoration: none; letter-spacing: 0.5px; mso-line-height-rule: exactly; line-height: 1;">
                    <span style="color: #0a0e14;">${label} &#8594;</span>
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
  `.trim()
}

export function renderEmailLayout({
  logoUrl,
  content,
  footer,
  maxWidth = 520,
}: {
  logoUrl: string
  content: string
  footer: string
  maxWidth?: number
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
</head>
<body style="margin: 0; padding: 0; background-color: #0a0e14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-text-size-adjust: 100%;">
  <div style="max-width: ${maxWidth}px; margin: 0 auto; padding: 40px 24px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="${logoUrl}" alt="Mushi" width="320" height="60" style="display: inline-block;" />
    </div>

    <div style="background-color: #1c2026; border: 1px solid #2f353d; border-radius: 12px; padding: 32px 28px;">
      ${content}
    </div>

    <p style="margin: 24px 0 0; font-size: 12px; color: #404750; text-align: center; line-height: 1.5;">
      ${footer}
    </p>
  </div>
</body>
</html>
  `.trim()
}
