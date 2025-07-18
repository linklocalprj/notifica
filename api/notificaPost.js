// pages/api/notificaPost.js
export default async function handler(req, res) {
  console.log('[notificaPost] body ricevuto:', req.body);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    return res.status(500).json({ error: 'Chiave Brevo non trovata' });
  }

  try {
    const { email, nome, piattaforma, cliente, titolo, data_pubblicazione, testo, link } = req.body;

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoKey
      },
      body: JSON.stringify({
        to: [{ email, name: nome }],
        templateId: 5,
        params: {
          piattaforma,
          cliente,
          titolo,
          data_pubblicazione,
          testo,
          link
        }
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: err });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Errore invio mail:', err);
    res.status(500).json({ error: 'Errore interno' });
  }
}
