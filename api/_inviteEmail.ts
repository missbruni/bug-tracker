// Inline SVG bug icon matching /public/bug.svg (mint on dark background)
const BUG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00FFCC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>`

export function buildInviteEmailHtml({
  inviterName,
  teamName,
  appUrl,
}: {
  inviterName: string
  teamName: string
  appUrl: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin: 0; padding: 0; background-color: #0a0e14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 24px;">
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; margin-bottom: 12px;">${BUG_SVG}</div>
      <div style="font-family: 'Courier New', monospace; font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #00FFCC;">MUSHI</div>
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
        Sign in with your Microsoft account to get started.
      </p>

      <!-- CTA button -->
      <div style="text-align: center;">
        <a href="${appUrl}" style="display: inline-block; background-color: #00FFCC; color: #0a0e14; font-weight: 700; font-size: 14px; padding: 14px 32px; border-radius: 8px; text-decoration: none; letter-spacing: 0.5px;">
          Open Mushi →
        </a>
      </div>
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
