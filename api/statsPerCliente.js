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
    const today = new Date().toISOString().split("T")[0];

    // 1. Profili
    const { data: profili, error: errProfili } = await supabase
      .from("profilo_azienda")
      .select("user_id, nome");
    if (errProfili) throw errProfili;

    // 2. Email dai config_prenotazioni
    const { data: contatti, error: errContatti } = await supabase
      .from("config_prenotazioni")
      .select("user_id, contatto");
    if (errContatti) throw errContatti;

    const emailMap = {};
    (contatti || []).forEach(c => {
      emailMap[c.user_id] = c.contatto;
    });

    // 3. Generazioni post
    const { data: generazioni, error: errGen } = await supabase
      .from("generazioni_post")
      .select("user_id, created_at")
      .gte("created_at", `${today}T00:00:00Z`);
    if (errGen) throw errGen;

    const generazioniMap = {};
    (generazioni || []).forEach(g => {
      generazioniMap[g.user_id] = (generazioniMap[g.user_id] || 0) + 1;
    });

    // 4. Accessi
    const { data: accessi, error: errAcc } = await supabase
      .from("log_accessi")
      .select("user_id, tipo, timestamp")
      .gte("timestamp", `${today}T00:00:00Z`);
    if (errAcc) throw errAcc;

    const loginMap = {};
    const tempoMap = {};
    const accessiPerUtente = {};
    (accessi || []).forEach(entry => {
      const list = accessiPerUtente[entry.user_id] ||= [];
      list.push(entry);
    });

    for (const [user_id, logs] of Object.entries(accessiPerUtente)) {
      const ordinati = logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      let tempo = 0, loginCount = 0;

      for (let i = 0; i < ordinati.length - 1; i++) {
        const a = ordinati[i];
        const b = ordinati[i + 1];
        if (a.tipo === "login" && b.tipo === "logout") {
          const diff = (new Date(b.timestamp) - new Date(a.timestamp)) / 1000;
          tempo += diff;
          loginCount++;
          i++;
        }
      }

      loginMap[user_id] = loginCount;
      tempoMap[user_id] = tempo;
    }

    // 5. Email inviate oggi
    const { data: inviate, error: errMail } = await supabase
      .from("log_email")
      .select("user_id")
      .gte("inviata_il", `${today}T00:00:00Z`);
    if (errMail) throw errMail;

    const emailCountMap = {};
    (inviate || []).forEach(e => {
      emailCountMap[e.user_id] = (emailCountMap[e.user_id] || 0) + 1;
    });

    // 6. Costruzione finale
    const risultati = profili.map(p => {
      const sec = tempoMap[p.user_id] || 0;
      const ore = Math.floor(sec / 3600);
      const min = Math.floor((sec % 3600) / 60);
      const tempoStr = sec ? `${ore}h ${min}m` : "-";

      return {
        user_id: p.user_id,
        nome: p.nome,
        email: emailMap[p.user_id] || "-",
        generazioni_oggi: generazioniMap[p.user_id] || 0,
        login_oggi: loginMap[p.user_id] || 0,
        tempo_utilizzo: tempoStr,
        email_inviate: emailCountMap[p.user_id] || 0
      };
    });

    return res.status(200).json(risultati);
  } catch (err) {
    console.error("[statsPerCliente] ERRORE:", err);
    return res.status(500).json({ error: err.message });
  }
}
