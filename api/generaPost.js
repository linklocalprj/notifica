export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    console.error("❌ Chiave Gemini non trovata");
    return res.status(500).json({ error: 'Chiave Gemini non trovata' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      console.error("❌ Prompt non valido:", prompt);
      return res.status(400).json({ error: "Prompt mancante o non valido" });
    }

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      })
    });



    const result = await geminiResponse.json();

    console.log("📥 Risposta da Gemini:", JSON.stringify(result, null, 2)); // 👈 fondamentale per il debug

    if (!geminiResponse.ok) {
      console.error("❌ Errore API Gemini:", result);
      return res.status(500).json({ error: result });
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Errore fetch Gemini:", err);
    res.status(500).json({ error: 'Errore durante la generazione' });
  }
}

