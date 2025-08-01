import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

const piattaforme = [
  "pubblicazioni_facebook",
  "pubblicazioni_instagram",
  "pubblicazioni_linkedin",
  "pubblicazioni_google"
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Solo GET consentito" });
  }

  try {
    const oggi = new Date();
    const setteGiorniFa = new Date(oggi);
    setteGiorniFa.setDate(oggi.getDate() - 7);
    const inizio = setteGiorniFa.toISOString();

    // Profili e contatti
    const { data: profili, error: errProfili } = await supabase
      .from("profilo_azienda")
      .select("user_id, nome");
    if (errProfili) throw errProfili;

    const { data: contatti, error: errContatti } = await supabase
      .from("config_prenotazioni")
      .select("user_id, contatto");
    if (errContatti) throw errContatti;

    const emailMap = {};
    (contatti || []).forEach(c => {
      emailMap[c.user_id] = c.contatto;
    });

    // Raccolta pubblicazioni
    const pubMap = {};
    for (const piattaforma of piattaforme) {
      const { data, error } = await supabase
        .from(piattaforma)
        .select("user_id, stato_invio, creato_il")
        .gte("creato_il", inizio);

      if (error) throw error;

      data.forEach(p => {
        const u = p.user_id;
        pubMap[u] ||= { totali: 0, inviati: 0, giorni: {} };
        pubMap[u].totali++;
        if (p.stato_invio === "sent") pubMap[u].inviati++;

        const giorno = p.creato_il.split("T")[0];
        pubMap[u].giorni[giorno] = (pubMap[u].giorni[giorno] || 0) + 1;
      });
    }

    // Prenotazioni ricevute
    const { data: prenotazioni, error: errPren } = await supabase
      .from("prenotazioni_effettive")
      .select("user_id")
      .gte("created_at", inizio);
    if (errPren) throw errPren;

    const prenotazioniMap = {};
    prenotazioni.forEach(p => {
      prenotazioniMap[p.user_id] = (prenotazioniMap[p.user_id] || 0) + 1;
    });

    // Costruzione risultati
    const risultati = profili.map(p => {
      const dati = pubMap[p.user_id] || { totali: 0, inviati: 0, giorni: {} };
      const giorniAttivi = Object.entries(dati.giorni)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g, c]) => `${g} (${c} post)`);

      return {
        user_id: p.user_id,
        nome: p.nome,
        email: emailMap[p.user_id] || "-",
        post_totali: dati.totali,
        post_inviati: dati.inviati,
        prenotazioni_7gg: prenotazioniMap[p.user_id] || 0,
        giorni_piu_attivi: giorniAttivi.join(", ") || "-"
      };
    });

    return res.status(200).json(risultati);
  } catch (err) {
    console.error("[statsPubblicazioni] ERRORE:", err);
    return res.status(500).json({ error: err.message });
  }
}
