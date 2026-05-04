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

    const shop = process.env.SHOPIFY_SHOP;
    const access_token = process.env.SHOPIFY_ADMIN_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-04';

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const SITE_EMAIL = process.env.SITE_EMAIL;
    const FROM_EMAIL = process.env.FROM_EMAIL || SITE_EMAIL;
    const REPORT_WEBHOOK_URL = process.env.REPORT_WEBHOOK_URL;

    if (!access_token) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'SHOPIFY_ADMIN_TOKEN manquant' })
      };
    }

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

    const isInternational = equipe.toLowerCase().includes('international');

    const teamTag = isInternational
      ? 'equipe-international-cobra'
      : 'equipe-cobra';

    const engagementTitle = isInternational
      ? 'Engagement équipe compétition International Cobra'
      : 'Engagement équipe compétition Cobra';

    const note = [
      'ENGAGEMENT ÉQUIPE COMPÉTITION',
      '---',
      `Type : Signature sans commande`,
      `Compétiteur : ${competiteur}`,
      `Email : ${email}`,
      `Équipe : ${equipe}`,
      `Dojo : ${dojo}`,
      `Date de naissance : ${dateNaissance || ''}`,
      parentTuteur ? `Parent / Tuteur : ${parentTuteur}` : '',
      `Signature électronique : ${signature}`,
      `Date de signature : ${dateSignature || ''}`,
      '---',
      'Aucune commande d’équipement associée à cet engagement.'
    ].filter(Boolean).join('\n');

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

      <p>Karaté Sunfuki</p>
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
          subject: `Confirmation d’engagement — ${engagementTitle}`,
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

    const draftPayload = {
      draft_order: {
        line_items: [
          {
            title: engagementTitle,
            price: '0.00',
            quantity: 1,
            requires_shipping: false,
            taxable: false
          }
        ],
        email,
        note,
        tags: `competition-2026,engagement-equipe,signature-seule,${teamTag}`
      }
    };

    const draftRes = await fetch(
      `https://${shop}/admin/api/${apiVersion}/draft_orders.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': access_token
        },
        body: JSON.stringify(draftPayload)
      }
    );

    const draftText = await draftRes.text();

    if (!draftRes.ok) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Erreur création Draft Order engagement.',
          status: draftRes.status,
          detail: draftText
        })
      };
    }

    const { draft_order } = JSON.parse(draftText);

    const completeRes = await fetch(
      `https://${shop}/admin/api/${apiVersion}/draft_orders/${draft_order.id}/complete.json`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': access_token
        },
        body: JSON.stringify({
          payment_pending: false
        })
      }
    );

    const completeText = await completeRes.text();

    if (!completeRes.ok) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Engagement créé en brouillon, mais erreur lors de la conversion en commande.',
          draftOrderId: draft_order.id,
          status: completeRes.status,
          detail: completeText
        })
      };
    }

    if (REPORT_WEBHOOK_URL) {
      await fetch(REPORT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mode || 'signature_only',
          competiteur,
          email,
          equipe,
          dojo,
          dateNaissance,
          parentTuteur: parentTuteur || '',
          signature,
          dateSignature,
          hasOrder: false,
          shopifyDraftOrderId: draft_order.id,
          createdAt: new Date().toISOString()
        })
      });
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Engagement signé, envoyé et ajouté dans Shopify.',
        draftOrderId: draft_order.id
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
