// pages/api/loadAllPending.js
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE;
const tables        = [
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
    // Per ogni tabella, chiedo i record con stato_invio = pending
    const promises = tables.map(table => {
      const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
      url.searchParams.set('stato_invio', 'eq.pending');
      // Se vuoi limiti o ordinamenti, aggiungi params: select=*,order=...
      return fetch(url.toString(), {
        headers: {
          apikey:        SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json'
        }
      })
      .then(async resp => {
        if (!resp.ok) throw new Error(await resp.text());
        const data = await resp.json();
        return data.map(r => ({ ...r, table }));
      });
    });

    const rows = (await Promise.all(promises)).flat();
    res.status(200).json(rows);
  } catch (err) {
    console.error('[loadAllPending]', err);
    res.status(500).json({ error: err.message });
  }
}
