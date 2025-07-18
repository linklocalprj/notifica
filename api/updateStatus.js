import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from '../env.js';

export default async function handler(req, res) {
  console.log('[updateStatus] body:', req.method, req.body);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { table, id } = req.body;
  if (!table || !id) {
    console.error('[updateStatus] mancano table o id');
    return res.status(400).json({ error: 'Mancano table o id' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    console.error('[updateStatus] ENV mancanti:', {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE
    });
    return res.status(500).json({ error: 'Env non configurate' });
  }

  try {
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stato_invio: 'sent' })
      }
    );

    const text = await patchRes.text();
    if (!patchRes.ok) {
      console.error('[updateStatus] supabase errore:', patchRes.status, text);
      return res.status(500).json({ error: text });
    }

    console.log('[updateStatus] OK:', text);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[updateStatus] eccezione:', err);
    return res.status(500).json({ error: 'Errore interno' });
  }
}