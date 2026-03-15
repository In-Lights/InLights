/**
 * /api/spotify-token
 * Proxies Spotify Client Credentials token requests server-side.
 * This avoids CORS issues — browsers can't call accounts.spotify.com/api/token
 * directly from non-whitelisted origins (like Vercel deployments).
 *
 * Called by the frontend with: POST /api/spotify-token
 * Body: { clientId: string, clientSecret: string }
 * Returns: { access_token, expires_in } or { error, error_description }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientId, clientSecret } = req.body ?? {};

  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Missing clientId or clientSecret' });
  }

  try {
    const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    const data = await spotifyRes.json();

    // Forward Spotify's response as-is (success or error)
    return res.status(spotifyRes.status).json(data);
  } catch (e) {
    return res.status(500).json({
      error: 'proxy_error',
      error_description: e instanceof Error ? e.message : 'Unknown error',
    });
  }
}
