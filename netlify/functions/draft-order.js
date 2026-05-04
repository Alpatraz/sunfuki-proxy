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
      items
    } = JSON.parse(event.body);

    const shop = process.env.SHOPIFY_SHOP;
    const access_token = process.env.SHOPIFY_ADMIN_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-04';

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const SITE_EMAIL = process.env.SITE_EMAIL;
    const FROM_EMAIL = process.env.FROM_EMAIL || SITE_EMAIL;

    if (!access_token) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'SHOPIFY_ADMIN_TOKEN manquant' })
      };
    }

    // ===== CALCULS =====
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const deposit = Math.round(total * 0.5 * 100) / 100;
    const balance = deposit;

    const teamTag = equipe && equipe.toLowerCase().includes('international')
      ? 'equipe-international-cobra'
      : 'equipe-cobra';

    // ===== LIGNES SHOPIFY =====
    const depositItems = items.map(item => ({
      title: `${item.title} — acompte 50%`,
      price: (item.price * 0.5).toFixed(2),
      quantity: item.qty,
      requires_shipping: true
    }));

    // ===== NOTE SHOPIFY =====
    const note = [
      'COMMANDE ÉQUIPEMENT COMPÉTITION',
      '---',
      `Compétiteur : ${competiteur}`,
      `Email : ${email}`,
      `Équipe : ${equipe}`,
      `Dojo : ${dojo}`,
      `Date de naissance : ${dateNaissance}`,
      parentTuteur ? `Parent / Tuteur : ${parentTuteur}` : '',
      `Signature : ${signature}`,
      `Date : ${dateSignature}`,
      '---',
      `Total réel : ${total.toFixed(2)} $`,
      `Acompte payé : ${deposit.toFixed(2)} $`,
      `Solde : ${balance.toFixed(2)} $`
    ].filter(Boolean).join('\n');

    // ===== CREATION DRAFT ORDER =====
    const draftRes = await fetch(
      `https://${shop}/admin/api/${apiVersion}/draft_orders.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': access_token
        },
        body: JSON.stringify({
          draft_order: {
            line_items: depositItems,
            note,
            tags: `competition-2026,acompte-50,equipement-competition,${teamTag}`
          }
        })
      }
    );

    const draftText = await draftRes.text();

    if (!draftRes.ok) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Erreur draft order',
          detail: draftText
        })
      };
    }

    const { draft_order } = JSON.parse(draftText);

    // ===== EMAIL HTML =====
    const emailHtml = `
      <h2>Confirmation d’engagement – Karaté Sunfuki</h2>
      <p>Bonjour ${competiteur},</p>

      <p>Votre engagement a bien été reçu.</p>

      <ul>
        <li><strong>Équipe :</strong> ${equipe}</li>
        <li><strong>Dojo :</strong> ${dojo}</li>
        <li><strong>Date de naissance :</strong> ${dateNaissance}</li>
        ${parentTuteur ? `<li><strong>Parent :</strong> ${parentTuteur}</li>` : ''}
      </ul>

      <h3>Résumé de la commande</h3>
      <p>Total : ${total.toFixed(2)} $</p>
      <p>Acompte payé : ${deposit.toFixed(2)} $</p>
      <p>Solde à payer à la livraison : ${balance.toFixed(2)} $</p>

      <p><strong>Signature :</strong> ${signature}</p>
      <p><strong>Date :</strong> ${dateSignature}</p>

      <p>Merci de votre confiance envers Karaté Sunfuki.</p>
    `;

    // ===== ENVOI EMAIL =====
    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email, SITE_EMAIL],
          subject: 'Confirmation engagement + commande',
          html: emailHtml
        })
      });
    }

    // ===== RAPPORT (OPTIONNEL) =====
    if (process.env.REPORT_WEBHOOK_URL) {
      await fetch(process.env.REPORT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'commande',
          competiteur,
          email,
          equipe,
          dojo,
          total,
          deposit,
          balance,
          date: new Date().toISOString()
        })
      });
    }

    // ===== RETOUR CLIENT =====
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        invoiceUrl: draft_order.invoice_url
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    };
  }
};
