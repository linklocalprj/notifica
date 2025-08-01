// /api/statsPerCliente.js
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Solo GET consentito" });
  }

  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // 1. Prendo i profili
    const { data: profili, error: errProfili } = await supabase.from("profilo_azienda").select("user_id, nome, email, creato_il");
    if (errProfili) throw errProfili;

    // 2. Conteggio generazioni oggi
    const { data: generazioni, error: errGen } = await supabase
      .from("generazioni_post")
      .select("user_id, created_at")
      .gte("created_at", `${today}T00:00:00Z`);
    if (errGen) throw errGen;

    const generazioniMap = {};
    generazioni.forEach(g => {
      const id = g.user_id;
      generazioniMap[id] = (generazioniMap[id] || 0) + 1;
    });

    const risultati = profili.map(p => ({
      user_id: p.user_id,
      nome: p.nome,
      email: p.email,
      generazioni_oggi: generazioniMap[p.user_id] || 0,
      login_oggi: "-", // da implementare
      tempo_utilizzo: "-", // da implementare
      email_inviate: "-", // da implementare
    }));

    return res.status(200).json(risultati);
  } catch (err) {
    console.error("[statsPerCliente]", err);
    return res.status(500).json({ error: err.message });
  }
}
