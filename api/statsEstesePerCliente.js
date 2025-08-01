import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Solo GET consentito" });
  }

  try {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const start = sevenDaysAgo.toISOString();

    // 1. Profili
    const { data: profili, error: errProfili } = await supabase
      .from("profilo_azienda")
      .select("user_id, nome");
    if (errProfili) throw errProfili;

    // 2. Email gestore
    const { data: contatti, error: errContatti } = await supabase
      .from("config_prenotazioni")
      .select("user_id, contatto");
    if (errContatti) throw errContatti;

    const emailMap = {};
    (contatti || []).forEach(c => {
      emailMap[c.user_id] = c.contatto;
    });

    // 3. Generazioni post 7gg
    const { data: gen, error: errGen } = await supabase
      .from("generazioni_post")
      .select("user_id, created_at")
      .gte("created_at", start);
    if (errGen) throw errGen;

    const genMap = {};
    gen.forEach(g => {
      genMap[g.user_id] = (genMap[g.user_id] || 0) + 1;
    });

    // 4. Email log 7gg
    const { data: mails, error: errMail } = await supabase
      .from("log_email")
      .select("user_id, successo")
      .gte("inviata_il", start);
    if (errMail) throw errMail;

    const mailMap = {}, failMap = {};
    mails.forEach(m => {
      mailMap[m.user_id] = (mailMap[m.user_id] || 0) + 1;
      if (!m.successo) failMap[m.user_id] = (failMap[m.user_id] || 0) + 1;
    });

    // 5. Accessi 7gg
    const { data: accessi, error: errAccessi } = await supabase
      .from("log_accessi")
      .select("user_id, tipo, timestamp")
      .gte("timestamp", start);
    if (errAccessi) throw errAccessi;

    const accessiUtente = {};
    accessi.forEach(a => {
      const list = accessiUtente[a.user_id] ||= [];
      list.push(a);
    });

    const tempoMap = {}, lastMap = {}, giorniMap = {};

    for (const [user_id, eventi] of Object.entries(accessiUtente)) {
      const ordinati = eventi.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      let tempo = 0;
      const giorni = new Set();
      let lastAccesso = "-";

      for (let i = 0; i < ordinati.length; i++) {
        const ev = ordinati[i];
        const giorno = ev.timestamp.split("T")[0];
        giorni.add(giorno);
        lastAccesso = ev.timestamp;

        if (ev.tipo === 'login' && i + 1 < ordinati.length && ordinati[i + 1].tipo === 'logout') {
          const diff = new Date(ordinati[i + 1].timestamp) - new Date(ev.timestamp);
          tempo += diff / 1000;
          i++;
        }
      }

      tempoMap[user_id] = tempo;
      lastMap[user_id] = lastAccesso;
      giorniMap[user_id] = giorni.size;
    }

    // 6. Risultato finale
    const risultati = profili.map(p => {
      const gen7 = genMap[p.user_id] || 0;
      const sec = tempoMap[p.user_id] || 0;
      const ore = Math.floor(sec / 3600);
      const min = Math.floor((sec % 3600) / 60);

      return {
        user_id: p.user_id,
        nome: p.nome,
        email: emailMap[p.user_id] || "-",
        generazioni_7gg: gen7,
        media_giornaliera: (gen7 / 7).toFixed(1),
        email_7gg: mailMap[p.user_id] || 0,
        email_fallite: failMap[p.user_id] || 0,
        ultimo_accesso: lastMap[p.user_id] ? new Date(lastMap[p.user_id]).toLocaleString("it-IT") : "-",
        tempo_totale: sec ? `${ore}h ${min}m` : "-",
        giorni_attivi: giorniMap[p.user_id] || 0
      };
    });

    return res.status(200).json(risultati);
  } catch (err) {
    console.error("[statsEstesePerCliente] ERRORE:", err);
    return res.status(500).json({ error: err.message });
  }
}
