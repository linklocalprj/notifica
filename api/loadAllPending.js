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
    const allRows = await Promise.all(tables.map(async table => {
      // chiamo il REST endpoint: filtra stato_invio e include il join su config_prenotazioni
      const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
      url.searchParams.set('stato_invio', 'eq.pending');
      // assume la relazione config_prenotazioni.user_id → pubblicazioni.user_id è configurata in Supabase
      url.searchParams.set('select', '*,config_prenotazioni(contatto)');

      const resp = await fetch(url.toString(), {
        headers: {
          apikey:        SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        }
      });
      if (!resp.ok) {
        throw new Error(`Errore ${table}: ${await resp.text()}`);
      }
      const data = await resp.json();
      // estraggo contatto (prima voce, se esiste)
      return data.map(r => ({
        ...r,
        table,
        email_gestore: Array.isArray(r.config_prenotazioni) && r.config_prenotazioni[0]
          ? r.config_prenotazioni[0].contatto
          : null
      }));
    }));

    res.status(200).json(allRows.flat());
  } catch (err) {
    console.error('[loadAllPending]', err);
    res.status(500).json({ error: err.message });
  }
}
