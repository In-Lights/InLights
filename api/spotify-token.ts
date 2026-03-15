import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clientId, clientSecret } = req.body ?? {};
  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Missing clientId or clientSecret' });
  }

  try {
    const creds = Buffer.from(`${String(clientId).trim()}:${String(clientSecret).trim()}`).toString('base64');
    const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${creds}`,
      },
      body: 'grant_type=client_credentials',
    });
    const data = await spotifyRes.json();
    return res.status(spotifyRes.status).json(data);
  } catch (e) {
    return res.status(500).json({
      error: 'proxy_error',
      error_description: e instanceof Error ? e.message : 'Unknown',
    });
  }
}
