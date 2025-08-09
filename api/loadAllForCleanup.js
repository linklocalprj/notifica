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
    // 1) Prendo tutte le pubblicazioni pending
    const allPubs = await Promise.all(tables.map(async table => {
      const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
      url.searchParams.set('stato_invio', 'eq.sent');
      const resp = await fetch(url, {
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
    const userIds = Array.from(new Set(
      pubs.map(r => r.user_id).filter(Boolean)
    ));

    // 3) Se ci sono user_id, prendo tutti i config_prenotazioni in un solo fetch
    let configsMap = {};
    if (userIds.length) {
      const cfgUrl = new URL(`${SUPABASE_URL}/rest/v1/config_prenotazioni`);
      // **attenzione**: la sintassi corretta è in.(id1,id2,...)
      cfgUrl.searchParams.set('user_id', `in.(${userIds.join(',')})`);

      const cfgResp = await fetch(cfgUrl, {
        headers: {
          apikey:        SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        }
      });
      if (!cfgResp.ok) throw new Error(`Errore config_prenotazioni: ${await cfgResp.text()}`);
      const cfgData = await cfgResp.json();
      configsMap = Object.fromEntries(
        cfgData.map(c => [c.user_id, c.contatto])
      );
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
