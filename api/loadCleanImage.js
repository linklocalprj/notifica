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
  // 2) DELETE THE FILE
  // ========================

if (req.method === 'POST' && action === 'deleteFile') {
  const { oldUrl } = req.body;
  if (!oldUrl) {
    return res.status(400).json({ error: 'Manca oldUrl' });
  }

  try {
    const parsed = parseStorageUrl(oldUrl, SUPABASE_URL);
    if (!parsed) {
      return res.status(400).json({ error: 'URL non valido o non nel dominio Supabase' });
    }

    const { bucket, path } = parsed;
    const delResp = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`
      }
    });

    if (!delResp.ok) {
      const errTxt = await delResp.text();
      return res.status(500).json({ error: errTxt });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[deleteFile] errore:', err);
    return res.status(500).json({ error: 'Errore interno' });
  }
}

// Helper per estrarre bucket e path da una URL Supabase Storage
function parseStorageUrl(url, base) {
  try {
    const u = new URL(url);
    const b = new URL(base);
    if (u.origin !== b.origin) return null;

    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('object');
    if (idx === -1) return null;

    let bucketIndex = idx + 1;
    if (parts[bucketIndex] === 'public' || parts[bucketIndex] === 'sign') {
      bucketIndex++;
    }

    const bucket = parts[bucketIndex];
    const path = parts.slice(bucketIndex + 1).join('/');
    return { bucket, path };
  } catch {
    return null;
  }
}

// ========================
// 4) LIST BUCKET FILES
// ========================
// ========================
// 3) LISTA TUTTI I FILE NEL BUCKET
// ========================
if (req.method === 'GET' && action === 'listBucket') {
  const BUCKET = 'post-images'; // nome del bucket
  try {
    const listUrl = `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`;
    const resp = await fetch(listUrl, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        limit: 1000,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      })
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      return res.status(500).json({ error: errTxt });
    }

    const files = await resp.json();

    // Creo la lista con URL pubblico e date leggibili
    const mapped = files.map(f => ({
      name: f.name,
      url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${f.name}`,
      created_at: f.created_at || f.updated_at || null
    }));

    return res.status(200).json(mapped);
  } catch (err) {
    console.error('[listBucket] errore:', err);
    return res.status(500).json({ error: 'Errore interno' });
  }
}

// ========================
// 4) ELIMINA FILE DAL BUCKET
// ========================
if (req.method === 'POST' && action === 'deleteFile') {
  const { oldUrl } = req.body;
  if (!oldUrl) {
    return res.status(400).json({ error: 'Manca oldUrl' });
  }

  try {
    const parsed = parseStorageUrl(oldUrl, SUPABASE_URL);
    if (!parsed) {
      return res.status(400).json({ error: 'URL non valido o non nel dominio Supabase' });
    }

    const { bucket, path } = parsed;
    const delResp = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`
      }
    });

    if (!delResp.ok) {
      const errTxt = await delResp.text();
      return res.status(500).json({ error: errTxt });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[deleteFile] errore:', err);
    return res.status(500).json({ error: 'Errore interno' });
  }
}

// Helper per estrarre bucket e path da una URL Supabase Storage
function parseStorageUrl(url, base) {
  try {
    const u = new URL(url);
    const b = new URL(base);
    if (u.origin !== b.origin) return null;

    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('object');
    if (idx === -1) return null;

    let bucketIndex = idx + 1;
    if (parts[bucketIndex] === 'public' || parts[bucketIndex] === 'sign') {
      bucketIndex++;
    }

    const bucket = parts[bucketIndex];
    const path = parts.slice(bucketIndex + 1).join('/');
    return { bucket, path };
  } catch {
    return null;
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
