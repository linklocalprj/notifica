// pages/api/loadAllPending.js
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const tables           = [
  'pubblicazioni_facebook',
  'pubblicazioni_instagram',
  'pubblicazioni_linkedin',
  'pubblicazioni_google'
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Solo GET consentito' });
  }
  try {
    // 1) Carico tutte le pubblicazioni pending
    const allPubs = await Promise.all(tables.map(async table => {
      const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
      url.searchParams.set('stato_invio', 'eq.pending');
      const resp = await fetch(url.toString(), {
        headers: {
          apikey:        SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        }
      });
      if (!resp.ok) throw new Error(`Errore ${table}: ${await resp.text()}`);
      const data = await resp.json();
      return data.map(r => ({ ...r, table }));
    }));
    const pubs = allPubs.flat();

    // 2) Estraggo tutti i user_id unici
    const userIds = Array.from(new Set(pubs.map(r => r.user_id).filter(Boolean)));
    let configsMap = {};
    if (userIds.length) {
      // 3) Chiamo config_prenotazioni una sola volta
      const cfgUrl = new URL(`${SUPABASE_URL}/rest/v1/config_prenotazioni`);
      cfgUrl.searchParams.set('user_id', `in.${userIds.join(',')}`);
      const cfgResp = await fetch(cfgUrl.toString(), {
        headers: {
          apikey:        SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        }
      });
      if (!cfgResp.ok) throw new Error(`Errore config_prenotazioni: ${await cfgResp.text()}`);
      const cfgData = await cfgResp.json();
      // mappa user_id → contatto
      configsMap = Object.fromEntries(cfgData.map(c => [c.user_id, c.contatto]));
    }

    // 4) Unisco l'email_gestore a ogni pubblicazione
    const rows = pubs.map(r => ({
      ...r,
      email_gestore: configsMap[r.user_id] || null
    }));

    return res.status(200).json(rows);
  } catch (err) {
    console.error('[loadAllPending]', err);
    return res.status(500).json({ error: err.message });
  }
}
