import type { VercelRequest, VercelResponse } from '@vercel/node';

async function getToken(id: string, secret: string): Promise<string> {
  const creds = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${creds}`,
    },
    body: 'grant_type=client_credentials',
  });
  const d = await res.json() as Record<string, unknown>;
  if (!res.ok || !d.access_token) throw new Error((d.error_description as string) || 'Auth failed');
  return d.access_token as string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clientId, clientSecret, query, type = 'track', limit = 5, market = 'US' } = req.body ?? {};
  if (!clientId || !clientSecret || !query) {
    return res.status(400).json({ error: 'Missing clientId, clientSecret, or query' });
  }

  try {
    const token = await getToken(String(clientId).trim(), String(clientSecret).trim());
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(String(query))}&type=${type}&limit=${limit}&market=${market}`;
    const searchRes = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await searchRes.json();
    return res.status(searchRes.status).json(data);
  } catch (e) {
    return res.status(500).json({
      error: 'proxy_error',
      error_description: e instanceof Error ? e.message : 'Unknown',
    });
  }
}
