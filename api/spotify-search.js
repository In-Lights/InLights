async function getToken(id, secret) {
  const creds = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${creds}`,
    },
    body: 'grant_type=client_credentials',
  });
  const d = await res.json();
  if (!res.ok || !d.access_token) throw new Error(d.error_description || 'Auth failed');
  return d.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clientId, clientSecret, query, type = 'track', limit = 5, market = '' } = req.body || {};
  if (!clientId || !clientSecret || !query) {
    return res.status(400).json({ error: 'Missing clientId, clientSecret, or query' });
  }

  try {
    const token = await getToken(String(clientId).trim(), String(clientSecret).trim());
    // Only add market param if explicitly provided — omitting it searches the global catalog
    const marketParam = market ? `&market=${market}` : '';
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(String(query))}&type=${type}&limit=${limit}${marketParam}`;
    const searchRes = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await searchRes.json();
    return res.status(searchRes.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'proxy_error', error_description: e.message });
  }
}
