export function buildInviteEmailHtml({
  inviterName,
  teamName,
  appUrl,
}: {
  inviterName: string
  teamName: string
  appUrl: string
}): string {
  const logoUrl = `${appUrl}/mushi-logo-email.png`

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
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 24px;">
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="${logoUrl}" alt="Mushi" width="320" height="60" style="display: inline-block;" />
    </div>

    <!-- Card -->
    <div style="background-color: #1c2026; border: 1px solid #2f353d; border-radius: 12px; padding: 32px 28px;">
      <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 700; color: #ECF2EF;">
        You're invited! 🐛
      </h2>
      <p style="margin: 0 0 12px; font-size: 15px; color: #B9CBC2; line-height: 1.6;">
        <strong style="color: #ECF2EF;">${inviterName}</strong> has invited you to join
        <strong style="color: #00FFCC;">${teamName}</strong> on Mushi.
      </p>
      <p style="margin: 0 0 28px; font-size: 15px; color: #B9CBC2; line-height: 1.6;">
        Sign in to get started.
      </p>

      <!-- Bulletproof CTA button — background + padding on td so email clients can't override -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color: #00FFCC; border-radius: 8px; mso-padding-alt: 14px 32px;" align="center">
                  <a href="${appUrl}" style="display: inline-block; padding: 14px 32px; color: #0a0e14; font-weight: 700; font-size: 14px; text-decoration: none; letter-spacing: 0.5px; mso-line-height-rule: exactly; line-height: 1;">
                    <!--[if mso]><span style="font-size:14px;font-weight:700;color:#0a0e14;">Open Mushi &#8594;</span><![endif]-->
                    <!--[if !mso]><!--><span style="color: #0a0e14;">Open Mushi &#8594;</span><!--<![endif]-->
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <p style="margin: 24px 0 0; font-size: 12px; color: #404750; text-align: center; line-height: 1.5;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim()
}
