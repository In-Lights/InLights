/**
 * /api/spotify-search
 * Proxies Spotify Web API search requests server-side.
 * Accepts: POST { clientId, clientSecret, query, type, limit, market }
 * Returns: Spotify search response JSON
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok || !data.access_token) {
    throw new Error((data.error_description as string) || (data.error as string) || `Auth failed: ${res.status}`);
  }
  return data.access_token as string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clientId, clientSecret, query, type = 'track', limit = 5, market = 'US' } = req.body ?? {};
  if (!clientId || !clientSecret || !query) {
    return res.status(400).json({ error: 'Missing required fields: clientId, clientSecret, query' });
  }

  try {
    const token = await getToken(clientId.trim(), clientSecret.trim());
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}&market=${market}`;
    const searchRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await searchRes.json();
    return res.status(searchRes.status).json(data);
  } catch (e) {
    return res.status(500).json({
      error: 'proxy_error',
      error_description: e instanceof Error ? e.message : 'Unknown error',
    });
  }
}
