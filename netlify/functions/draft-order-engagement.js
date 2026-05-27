exports.handler = async function(event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://boutique-karatesunfuki.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const { competiteur, email, equipe, dojo, dateNaissance,
            parentTuteur, signature, dateSignature, teamKey } = JSON.parse(event.body);

    const shop = process.env.SHOPIFY_SHOP;
    const access_token = process.env.SHOPIFY_ADMIN_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-04';

    const engagementTitle = teamKey === 'international'
      ? 'Engagement équipe compétition International Cobra'
      : teamKey === 'coach'
      ? 'Engagement Coach Sunfuki'
      : teamKey === 'assistant'
      ? 'Engagement Assistant-Coach Sunfuki'
      : 'Engagement équipe compétition Cobra';

    const nameParts = (competiteur||'').trim().split(' ');
    const firstName = nameParts.shift() || competiteur;
    const lastName = nameParts.join(' ') || '-';

    const note = [
      'ENGAGEMENT ÉQUIPE COMPÉTITION',
      '---',
      `Type : Signature sans commande`,
      `Compétiteur : ${competiteur}`,
      email ? `Email : ${email}` : '',
      `Équipe : ${equipe}`,
      `Dojo : ${dojo}`,
      `Date de naissance : ${dateNaissance}`,
      parentTuteur ? `Parent / Tuteur : ${parentTuteur}` : '',
      `Signature électronique : ${signature}`,
      `Date de signature : ${dateSignature}`,
      '---',
      'Aucune commande d\'équipement associée à cet engagement.'
    ].filter(Boolean).join('\n');

    const draftPayload = {
      draft_order: {
        email: email || undefined,
        line_items: [{
          title: engagementTitle,
          price: '0.00',
          quantity: 1,
          requires_shipping: false
        }],
        note,
        note_attributes: [
          { name: 'Type de formulaire', value: 'Engagement sans commande' },
          { name: 'Compétiteur', value: competiteur },
          { name: 'Courriel compétiteur', value: email || '' },
          { name: 'Équipe', value: equipe },
          { name: 'Dojo', value: dojo },
          { name: 'Date de naissance', value: dateNaissance },
          { name: 'Parent / Tuteur', value: parentTuteur || '' },
          { name: 'Signature électronique', value: signature },
          { name: 'Date de signature', value: dateSignature }
        ],
        tags: 'competition-2026,engagement-signe',
        billing_address: {
          first_name: firstName,
          last_name: lastName,
          address1: dojo,
          city: 'Québec',
          province: 'QC',
          country: 'Canada',
          zip: 'J0J 0J0'
        }
      }
    };

    const res = await fetch(
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

    const data = await res.json();
    if (!res.ok) {
      return { statusCode: 500, headers: corsHeaders,
               body: JSON.stringify({ error: 'Erreur Shopify', detail: data }) };
    }

    // Compléter automatiquement la commande à 0$
    const orderId = data.draft_order.id;
    await fetch(
      `https://${shop}/admin/api/${apiVersion}/draft_orders/${orderId}/complete.json`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json',
                                   'X-Shopify-Access-Token': access_token } }
    );

    return { statusCode: 200, headers: corsHeaders,
             body: JSON.stringify({ success: true }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders,
             body: JSON.stringify({ error: err.message }) };
  }
};
