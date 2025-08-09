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
  if (req.method === 'POST' && action === 'reset') {
    const { table, id, placeholder } = req.body;
    if (!table || !id) {
      return res.status(400).json({ error: 'Mancano table o id' });
    }

    const PLACEHOLDER =
      placeholder || 'https://via.placeholder.com/1200x1200?text=MEDIA';

    try {
      const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
      const body = { immagine_url: PLACEHOLDER };

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
      console.error('[cleanupHandler-reset]', err);
      return res.status(500).json({ error: 'Errore interno' });
    }
  }

  // ========================
  // Metodo non consentito
  // ========================
  return res.status(405).json({ error: 'Metodo o action non valido' });
}
