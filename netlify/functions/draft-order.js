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

    if (!access_token) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'SHOPIFY_ADMIN_TOKEN manquant' })
      };
    }

    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const deposit = Math.round(total * 0.5 * 100) / 100;
    const balance = deposit;

    const isInternational = equipe && equipe.toLowerCase().includes('international');

    const teamTag = isInternational
      ? 'equipe-international-cobra'
      : 'equipe-cobra';

    const teamShort = isInternational
      ? 'International Cobra'
      : 'Cobra';

    const safeDojoTag = dojo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const safeCompetiteurTag = competiteur
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const nameParts = competiteur.trim().split(' ');
    const firstName = nameParts.shift() || competiteur;
    const lastName = nameParts.join(' ') || '-';

    const depositItems = items.map(item => ({
      title: `${item.title} — acompte 50%`,
      price: (item.price * 0.5).toFixed(2),
      quantity: item.qty,
      requires_shipping: true
    }));

    const note = [
      'COMMANDE ÉQUIPEMENT COMPÉTITION',
      '---',
      `Compétiteur : ${competiteur}`,
      email ? `Email : ${email}` : '',
      `Équipe : ${equipe}`,
      `Dojo : ${dojo}`,
      `Date de naissance : ${dateNaissance}`,
      parentTuteur ? `Parent / Tuteur : ${parentTuteur}` : '',
      `Signature électronique : ${signature}`,
      `Date de signature : ${dateSignature}`,
      '---',
      `Total commande réel : ${total.toFixed(2)} $`,
      `Acompte payé aujourd’hui : ${deposit.toFixed(2)} $`,
      `Solde à payer à la livraison : ${balance.toFixed(2)} $`,
      '---',
      'IMPORTANT : Le paiement effectué aujourd’hui correspond à un acompte de 50 %. Le solde sera payable à la réception des produits.'
    ].filter(Boolean).join('\n');

    const draftPayload = {
      draft_order: {
        email: email || undefined,
        line_items: depositItems,

        billing_address: {
          first_name: firstName,
          last_name: lastName,
          company: dojo,
          address1: 'Retrait au dojo',
          city: dojo,
          province: 'QC',
          country: 'Canada',
          zip: 'J0J 0J0'
        },

        shipping_address: {
          first_name: firstName,
          last_name: lastName,
          company: dojo,
          address1: 'Retrait au dojo',
          city: dojo,
          province: 'QC',
          country: 'Canada',
          zip: 'J0J 0J0'
        },

        note,

        note_attributes: [
          { name: 'Type de formulaire', value: 'Commande équipement compétition' },
          { name: 'Compétiteur', value: competiteur },
          { name: 'Courriel compétiteur', value: email || '' },
          { name: 'Équipe', value: equipe },
          { name: 'Équipe courte', value: teamShort },
          { name: 'Dojo', value: dojo },
          { name: 'Date de naissance', value: dateNaissance },
          { name: 'Parent / Tuteur', value: parentTuteur || '' },
          { name: 'Signature électronique', value: signature },
          { name: 'Date de signature', value: dateSignature },
          { name: 'Total commande réel', value: total.toFixed(2) },
          { name: 'Acompte payé', value: deposit.toFixed(2) },
          { name: 'Solde livraison', value: balance.toFixed(2) }
        ],

        tags: [
          'competition-2026',
          'commande-equipement',
          'acompte-50',
          teamTag,
          `dojo-${safeDojoTag}`,
          `competiteur-${safeCompetiteurTag}`
        ].join(',')
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
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Erreur création draft order',
          status: draftRes.status,
          detail: draftText
        })
      };
    }

    const { draft_order } = JSON.parse(draftText);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        invoiceUrl: draft_order.invoice_url,
        draftOrderId: draft_order.id,
        depositAmount: deposit,
        balanceAmount: balance,
        totalAmount: total
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
