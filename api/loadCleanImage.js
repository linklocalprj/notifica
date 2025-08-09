// In cima a loadCleanImage.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);



// pages/api/loadCleanImage.js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const tables = [
  'pubblicazioni_facebook',
  'pubblicazioni_instagram',
  'pubblicazioni_linkedin',
  'pubblicazioni_google'
];

export default async function handler(req, res) {
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
  if (req.method === 'POST' && action === 'reset') {
    const { table, id, placeholder } = req.body;
    if (!table || !id) {
      return res.status(400).json({ error: 'Mancano table o id' });
    }

    const PLACEHOLDER =
      placeholder || `${SUPABASE_URL}/storage/v1/object/public/post-images/placeholders/placeholder.jpg`;

    try {
      const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
      const resp = await fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          immagine_url: PLACEHOLDER,
          pub_end: true
        })
      });

      const json = await resp.json();
      if (!resp.ok) {
        return res.status(500).json({ error: json });
      }

      return res.status(200).json({ success: true, updated: json });
    } catch (err) {
      console.error('[loadCleanImage reset] errore:', err);
      return res.status(500).json({ error: 'Errore interno' });
    }
  }

  // ========================
  // 3) LISTA FILE BUCKET
  // ========================
if (req.method === 'GET' && action === 'listBucket') {
  try {
    const { data, error } = await supabaseAdmin
      .storage
      .from('post-images')
      .list('', {
        limit: 1000,
        sortBy: { column: 'name', order: 'desc' }
      });

    if (error) throw error;

    const mapped = data.map(file => ({
      name: file.name,
      url: supabaseAdmin.storage.from('post-images').getPublicUrl(file.name).data.publicUrl,
      created_at: file.updated_at || null
    }));

    return res.status(200).json(mapped);
  } catch (err) {
    console.error('[listBucket] errore:', err);
    return res.status(500).json({ error: err.message });
  }
}


  // ========================
  // 4) DELETE FILE BUCKET
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

  // ========================
  // Metodo non consentito
  // ========================
  return res.status(405).json({ error: 'Metodo o action non valido' });
}

// Helper per estrarre bucket e path da URL Supabase Storage
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
