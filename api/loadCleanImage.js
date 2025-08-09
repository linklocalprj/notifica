// pages/api/cleanupHandler.js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const tables = [
  'pubblicazioni_facebook',
  'pubblicazioni_instagram',
  'pubblicazioni_linkedin',
  'pubblicazioni_google'
];

export default async function handler(req, res) {
  // ✅ Azione selezionata (GET = loadAllForCleanup, POST = resetImage)
  const action = req.query.action || req.body?.action;

  // ========================
  // 1) LOAD ALL FOR CLEANUP
  // ========================
  if (req.method === 'GET' && action === 'load') {
    try {
      const allPubs = await Promise.all(tables.map(async table => {
        const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
        url.searchParams.set('stato_invio', 'eq.sent');
        url.searchParams.set('pub_end', 'is.false');
        const resp = await fetch(url, {
          headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`
          }
        });
        if (!resp.ok) throw new Error(`Errore ${table}: ${await resp.text()}`);
        const data = await resp.json();
        return data.map(r => ({ ...r, table }));
      }));
      const pubs = allPubs.flat();

      // Email gestori
      const userIds = Array.from(new Set(pubs.map(r => r.user_id).filter(Boolean)));
      let configsMap = {};
      if (userIds.length) {
        const cfgUrl = new URL(`${SUPABASE_URL}/rest/v1/config_prenotazioni`);
        cfgUrl.searchParams.set('user_id', `in.(${userIds.join(',')})`);
        const cfgResp = await fetch(cfgUrl, {
          headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`
          }
        });
        if (!cfgResp.ok) throw new Error(`Errore config_prenotazioni: ${await cfgResp.text()}`);
        const cfgData = await cfgResp.json();
        configsMap = Object.fromEntries(cfgData.map(c => [c.user_id, c.contatto]));
      }

      const rows = pubs.map(r => ({
        ...r,
        email_gestore: configsMap[r.user_id] || null
      }));

      return res.status(200).json(rows);
    } catch (err) {
      console.error('[cleanupHandler-load]', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ========================
  // 2) RESET IMAGE
  // ========================
// POST /api/loadCleanImage  { action:"reset", table, id, placeholder? }
if (req.method === 'POST' && action === 'reset') {
  const { table, id, placeholder } = req.body;
  if (!table || !id) {
    return res.status(400).json({ error: 'Mancano table o id' });
  }

  const PLACEHOLDER =
    placeholder || 'https://jljljrkubullcrspicvj.supabase.co/storage/v1/object/public/post-images/placeholders/placeholder.jpg';

  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        // ritorna la riga aggiornata per debug
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        immagine_url: PLACEHOLDER,
        pub_end: true
        })

    });

    const json = await resp.json();
    if (!resp.ok) {
      // utile per capire subito l’errore (RLS, nome colonna, ecc.)
      return res.status(500).json({ error: json });
    }

    return res.status(200).json({ success: true, updated: json });
  } catch (err) {
    console.error('[loadCleanImage reset] errore:', err);
    return res.status(500).json({ error: 'Errore interno' });
  }
}

  // ========================
  // Metodo non consentito
  // ========================
  return res.status(405).json({ error: 'Metodo o action non valido' });
}
