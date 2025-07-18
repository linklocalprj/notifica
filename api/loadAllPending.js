// pages/api/loadAllPending.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const tables = [
    'pubblicazioni_facebook',
    'pubblicazioni_instagram',
    'pubblicazioni_linkedin',
    'pubblicazioni_google'
  ];

  try {
    // interroga tutte le tabelle in parallelo
    const results = await Promise.all(
      tables.map(table =>
        supabase
          .from(table)
          .select('*')
          .eq('stato_invio', 'pending')
          .then(({ data, error }) => {
            if (error) throw error;
            // aggiungi il nome della tabella a ogni riga
            return data.map(r => ({ ...r, table }));
          })
      )
    );

    // unisci i risultati e restituisci
    const rows = results.flat();
    res.status(200).json(rows);
  } catch (err) {
    console.error('[loadAllPending API] ', err);
    res.status(500).json({ error: err.message });
  }
}
