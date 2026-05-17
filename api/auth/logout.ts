import { buildClearSessionCookie, isSecureRequest } from './_session'

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  res.setHeader('Set-Cookie', buildClearSessionCookie(isSecureRequest(req)))
  res.status(200).json({ success: true })
}
