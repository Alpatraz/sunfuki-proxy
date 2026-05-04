exports.handler = async function(event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://boutique-karatesunfuki.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method not allowed' };
  }

  try {
    const {
      competiteur,
      email,
      equipe,
      dojo,
      dateNaissance,
      parentTuteur,
      signature,
      dateSignature
    } = JSON.parse(event.body);

    // 🔍 DEBUG VARIABLES
    console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY);
    console.log("FROM_EMAIL:", process.env.FROM_EMAIL);
    console.log("SITE_EMAIL:", process.env.SITE_EMAIL);

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.FROM_EMAIL;
    const SITE_EMAIL = process.env.SITE_EMAIL;

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY manquante");
    }

    const emailContent = `
      <h2>Engagement Équipe Compétition Karaté Sunfuki</h2>

      <p>Bonjour ${competiteur},</p>

      <p>Votre engagement a bien été enregistré.</p>

      <p><strong>Détails :</strong></p>
      <ul>
        <li>Compétiteur : ${competiteur}</li>
        <li>Équipe : ${equipe}</li>
        <li>Dojo : ${dojo}</li>
        <li>Date de naissance : ${dateNaissance}</li>
        ${parentTuteur ? `<li>Parent / Tuteur : ${parentTuteur}</li>` : ''}
        <li>Signature : ${signature}</li>
        <li>Date : ${dateSignature}</li>
      </ul>

      <p>Merci de faire partie de l’équipe compétition Karaté Sunfuki.</p>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email, SITE_EMAIL],
        subject: 'Confirmation de votre engagement - Karaté Sunfuki',
        html: emailContent
      })
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("Erreur Resend:", text);
      throw new Error("Erreur lors de l'envoi du courriel");
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error("Erreur globale:", err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    };
  }
};
