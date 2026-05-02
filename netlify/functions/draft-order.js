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
    const { competiteur, equipe, dojo, dateNaissance, parentTuteur, signature, dateSignature, items } = JSON.parse(event.body);

    const shop = process.env.SHOPIFY_SHOP;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

    // Token via client_credentials
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' })
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return { statusCode: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Token error', detail: err }) };
    }

    const { access_token } = await tokenRes.json();

    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const deposit = Math.round(total * 0.5 * 100) / 100;

    const draftPayload = {
      draft_order: {
        line_items: items.map(item => ({ variant_id: item.variantId, quantity: item.qty })),
        note: [
          'COMMANDE ÉQUIPEMENT COMPÉTITION',
          '---',
          `Compétiteur : ${competiteur}`,
          `Équipe : ${equipe}`,
          `Dojo : ${dojo}`,
          `Date de naissance : ${dateNaissance}`,
          parentTuteur ? `Parent / Tuteur : ${parentTuteur}` : '',
          `Signature électronique : ${signature}`,
          `Date de signature : ${dateSignature}`,
          '---',
          `Total commande : ${total.toFixed(2)} $`,
          `Acompte 50% : ${deposit.toFixed(2)} $`,
        ].filter(Boolean).join('\n'),
        applied_discount: {
          description: 'Acompte 50% — solde à la livraison',
          value_type: 'percentage',
          value: '50.0',
          amount: String(deposit),
          title: 'Acompte 50%'
        },
        tags: 'acompte-50,equipement-competition'
      }
    };

    const draftRes = await fetch(`https://${shop}/admin/api/2024-01/draft_orders.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': access_token },
      body: JSON.stringify(draftPayload)
    });

    if (!draftRes.ok) {
      const err = await draftRes.text();
      return { statusCode: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Draft order error', detail: err }) };
    }

    const { draft_order } = await draftRes.json();

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, invoiceUrl: draft_order.invoice_url, draftOrderId: draft_order.id, depositAmount: deposit })
    };

  } catch (err) {
    return { statusCode: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
  }
};
