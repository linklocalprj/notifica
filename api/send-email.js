export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { nome, email, attivita } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ error: 'Parametri mancanti' });
  }

  const emailPayload = {
    templateId: 6,
    to: [
      { email, name: nome },
      { email: 'postami@sf-music.com', name: 'Postami' }
    ],
    params: {
      nome,
      email,
      attivita
    }
  };

  try {
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('Errore Brevo:', errorText);
      return res.status(500).json({ error: 'Errore invio email', details: errorText });
    }

    return res.status(200).json({ message: 'Email inviata correttamente' });
  } catch (err) {
    console.error('Errore server:', err);
    return res.status(500).json({ error: 'Errore interno' });
  }
}
