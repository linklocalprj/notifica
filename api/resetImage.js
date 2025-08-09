// pages/api/resetImage.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { table, id, placeholder } = req.body;
  if (!table || !id) {
    return res.status(400).json({ error: 'Mancano table o id' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(500).json({ error: 'Env non configurate' });
  }

  const PLACEHOLDER =
    placeholder || 'https://via.placeholder.com/1200x1200?text=MEDIA';

  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
    const body = { immagine_url: PLACEHOLDER }; // ⬅️ SOLO questo campo

    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(body)
    });

    const text = await resp.text();
    if (!resp.ok) return res.status(500).json({ error: text });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[resetImage] errore:', err);
    return res.status(500).json({ error: 'Errore interno' });
  }
}
