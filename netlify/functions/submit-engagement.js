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
      dateSignature,
      mode
    } = JSON.parse(event.body);

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const SITE_EMAIL = process.env.SITE_EMAIL;
    const FROM_EMAIL = process.env.FROM_EMAIL || SITE_EMAIL;
    const REPORT_WEBHOOK_URL = process.env.REPORT_WEBHOOK_URL;

    if (!competiteur || !email || !equipe || !dojo || !signature) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Informations obligatoires manquantes.'
        })
      };
    }

    const engagementMode = mode || 'signature_only';

    const emailHtml = `
      <h2>Confirmation d’engagement — Karaté Sunfuki</h2>

      <p>Bonjour ${competiteur},</p>

      <p>
        Votre engagement pour le programme compétitif Karaté Sunfuki a bien été reçu.
      </p>

      <h3>Informations du compétiteur</h3>
      <ul>
        <li><strong>Compétiteur :</strong> ${competiteur}</li>
        <li><strong>Équipe :</strong> ${equipe}</li>
        <li><strong>Dojo :</strong> ${dojo}</li>
        <li><strong>Date de naissance :</strong> ${dateNaissance || ''}</li>
        ${parentTuteur ? `<li><strong>Parent / tuteur :</strong> ${parentTuteur}</li>` : ''}
      </ul>

      <h3>Signature électronique</h3>
      <p><strong>Signature :</strong> ${signature}</p>
      <p><strong>Date de signature :</strong> ${dateSignature || ''}</p>

      <p>
        Merci d’avoir confirmé votre engagement envers l’équipe.
      </p>

      <p>
        Karaté Sunfuki
      </p>
    `;

    if (RESEND_API_KEY && FROM_EMAIL && SITE_EMAIL) {
      const mailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email, SITE_EMAIL],
          subject: 'Confirmation d’engagement — Karaté Sunfuki',
          html: emailHtml
        })
      });

      if (!mailRes.ok) {
        const mailText = await mailRes.text();
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Erreur lors de l’envoi du courriel.',
            detail: mailText
          })
        };
      }
    }

    if (REPORT_WEBHOOK_URL) {
      await fetch(REPORT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: engagementMode,
          competiteur,
          email,
          equipe,
          dojo,
          dateNaissance,
          parentTuteur: parentTuteur || '',
          signature,
          dateSignature,
          hasOrder: false,
          createdAt: new Date().toISOString()
        })
      });
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Engagement signé et envoyé avec succès.'
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: err.message
      })
    };
  }
};
