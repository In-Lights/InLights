export default function handler(req, res) {
  return res.status(200).json({ ok: true, message: 'API reachable', ts: Date.now() });
}
