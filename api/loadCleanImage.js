// pages/api/loadCleanImage.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL   = process.env.SUPABASE_URL;
const SERVICE_ROLE   = process.env.SUPABASE_SERVICE_ROLE;
const supabase       = createClient(SUPABASE_URL, SERVICE_ROLE);

const PLACEHOLDER_DEFAULT =
  `${SUPABASE_URL}/storage/v1/object/public/post-images/placeholders/placeholder.jpg`;

const TABLES = [
  'pubblicazioni_facebook',
  'pubblicazioni_instagram',
  'pubblicazioni_linkedin',
  'pubblicazioni_google'
];

export default async function handler(req, res) {
  try {
    const action = req.query.action || req.body?.action;

    // ========================
    // 1) LOAD: post "sent" da pulire
    //    (niente pub_end: filtriamo escludendo i record
    //     che hanno già il placeholder)
    // ========================
    if (req.method === 'GET' && action === 'load') {
      const results = await Promise.all(
        TABLES.map(async (table) => {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('stato_invio', 'sent')
            .neq('immagine_url', PLACEHOLDER_DEFAULT);

          if (error) throw new Error(`${table}: ${error.message}`);
          return (data || []).map((r) => ({ ...r, table }));
        })
      );

      const pubs = results.flat();

      // opzionale: porta dentro i contatti gestori
      const userIds = Array.from(new Set(pubs.map(r => r.user_id).filter(Boolean)));
      let contatti = {};
      if (userIds.length) {
        const { data: cfg, error: cfgErr } = await supabase
          .from('config_prenotazioni')
          .select('user_id, contatto')
          .in('user_id', userIds);
        if (cfgErr) throw new Error(`config_prenotazioni: ${cfgErr.message}`);
        contatti = Object.fromEntries((cfg || []).map(c => [c.user_id, c.contatto]));
      }

      const rows = pubs.map(r => ({
        ...r,
        email_gestore: contatti[r.user_id] || null
      }));

      return res.status(200).json(rows);
    }

    // ========================
    // 2) RESET: metti placeholder (e basta)
    // ========================
    if (req.method === 'POST' && action === 'reset') {
      const { table, id, placeholder } = req.body || {};
      if (!table || !id) {
        return res.status(400).json({ error: 'Mancano table o id' });
      }
      const PLACEHOLDER = placeholder || PLACEHOLDER_DEFAULT;

      const { data, error } = await supabase
        .from(table)
        .update({ immagine_url: PLACEHOLDER })
        .eq('id', id)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true, updated: data });
    }

    // ========================
    // 3) LISTA TUTTI I FILE DEL BUCKET (anche non assegnati)
    //    Nota: list() non è ricorsivo. Se usi sotto-cartelle,
    //    vedi la utility listFolder() qui sotto.
    // ========================
    if (req.method === 'GET' && action === 'listBucket') {
      const files = await listAllFilesRecursive('post-images', ''); // ricorsivo
      return res.status(200).json(files);
    }

    // ========================
    // 4) DELETE FILE dal bucket (dato l'URL pubblico)
    // ========================
    if (req.method === 'POST' && action === 'deleteFile') {
      const { oldUrl } = req.body || {};
      if (!oldUrl) {
        return res.status(400).json({ error: 'Manca oldUrl' });
      }

      const parsed = parseStorageUrl(oldUrl, SUPABASE_URL);
      if (!parsed) {
        return res.status(400).json({ error: 'URL non valido o non appartiene a questo Supabase' });
      }

      const { bucket, path } = parsed;
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Metodo o action non valido' });
  } catch (err) {
    console.error('[loadCleanImage] errore:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}

/**
 * Estrae bucket e path da una URL pubblica/firmata di Supabase Storage.
 */
function parseStorageUrl(url, base) {
  try {
    const u = new URL(url);
    const b = new URL(base);
    if (u.origin !== b.origin) return null;

    // /storage/v1/object/public/<bucket>/<path...>
    // /storage/v1/object/sign/<bucket>/<path...>
    // /storage/v1/object/<bucket>/<path...>
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('object');
    if (idx === -1) return null;

    let bucketIndex = idx + 1;
    if (parts[bucketIndex] === 'public' || parts[bucketIndex] === 'sign') {
      bucketIndex += 1;
    }
    const bucket = parts[bucketIndex];
    const path   = parts.slice(bucketIndex + 1).join('/');
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

/**
 * Lista *ricorsivamente* tutti i file nel bucket, restituendo:
 * [{ name, url, created_at }]
 */
async function listAllFilesRecursive(bucket, prefix = '') {
  const out = [];

  // lista elementi nel "prefix"
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'desc' }
  });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);

  // separa cartelle e file
  for (const entry of data || []) {
    // Heuristics: se ha 'metadata' è un file, se è null è cartella
    const isFile = !!entry?.metadata;
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (isFile) {
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(fullPath);
      out.push({
        name: fullPath,
        url: pub.publicUrl,
        created_at: entry.updated_at || entry.created_at || null
      });
    } else {
      // cartella: scendi ricorsivamente
      const nested = await listAllFilesRecursive(bucket, fullPath);
      out.push(...nested);
    }
  }

  return out;
}
