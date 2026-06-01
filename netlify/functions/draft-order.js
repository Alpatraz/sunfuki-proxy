exports.handler = async function(event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://boutique-karatesunfuki.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: "Method not allowed"
    };
  }

  function cleanText(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function splitNameSafe(fullName) {
    const cleaned = cleanText(fullName);
    const parts = cleaned.split(" ").filter(Boolean);

    if (parts.length === 0) {
      return {
        firstName: "Client",
        lastName: "-"
      };
    }

    if (parts.length === 1) {
      return {
        firstName: parts[0].slice(0, 50),
        lastName: "-"
      };
    }

    return {
      firstName: parts[0].slice(0, 50),
      lastName: parts.slice(1).join(" ").slice(0, 100)
    };
  }

  try {

    const body = JSON.parse(event.body || "{}");

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
    } = body;

    const safeCompetiteur = cleanText(competiteur);
    const safeEmail = cleanText(email);
    const safeEquipe = cleanText(equipe);
    const safeDojo = cleanText(dojo);

    const shop = process.env.SHOPIFY_SHOP;
    const access_token = process.env.SHOPIFY_ADMIN_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-04";

    if (!shop || !access_token) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Variables Shopify manquantes"
        })
      };
    }

    if (!Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Aucun item reçu"
        })
      };
    }

    const total = items.reduce((sum, item) => {
      return sum + Number(item.price || 0) * Number(item.qty || 0);
    }, 0);

    const deposit = Math.round(total * 0.5 * 100) / 100;
    const balance = deposit;

    const isInternational = safeEquipe
      .toLowerCase()
      .includes("international");

    const teamTag = isInternational
      ? "equipe-international-cobra"
      : "equipe-cobra";

    const teamShort = isInternational
      ? "International Cobra"
      : "Cobra";

    // ─────────────────────────────────────────────
    // FIX TAGS LONGS SHOPIFY
    // ─────────────────────────────────────────────

    const safeDojoTag = safeDojo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);

    const safeCompetiteurTag = safeCompetiteur
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 25);

    // ─────────────────────────────────────────────

    const nameData = splitNameSafe(safeCompetiteur);

    console.log("NAME DEBUG:", {
      original: competiteur,
      firstName: nameData.firstName,
      lastName: nameData.lastName
    });

    const depositItems = items.map(function(item) {

      const price = Number(item.price || 0);
      const qty = Number(item.qty || 0);

      const sizeLabel =
        item.variantTitle &&
        item.variantTitle !== "Taille unique"
          ? ` — ${item.variantTitle}`
          : "";

      return {
        title: `${item.title}${sizeLabel} — acompte 50%`,
        price: (price * 0.5).toFixed(2),
        quantity: qty,
        requires_shipping: true,

        properties: [
          { name: "Compétiteur", value: safeCompetiteur },
          { name: "Dojo", value: safeDojo },
          { name: "Équipe", value: safeEquipe },

          ...(item.variantTitle &&
          item.variantTitle !== "Taille unique"
            ? [{
                name: "Taille",
                value: item.variantTitle
              }]
            : []),

          {
            name: "Prix réel unitaire",
            value: `${price.toFixed(2)} $`
          },

          {
            name: "Acompte unitaire",
            value: `${(price * 0.5).toFixed(2)} $`
          },

          {
            name: "Solde unitaire",
            value: `${(price * 0.5).toFixed(2)} $`
          }
        ]
      };
    });

    const note = [
      "COMMANDE ÉQUIPEMENT COMPÉTITION",
      "---",
      `Compétiteur : ${safeCompetiteur}`,
      safeEmail ? `Email : ${safeEmail}` : "",
      `Équipe : ${safeEquipe}`,
      `Dojo : ${safeDojo}`,
      `Date de naissance : ${dateNaissance || ""}`,
      parentTuteur
        ? `Parent / Tuteur : ${parentTuteur}`
        : "",
      `Signature électronique : ${signature || ""}`,
      `Date de signature : ${dateSignature || ""}`,
      "---",
      `Total commande réel : ${total.toFixed(2)} $`,
      `Acompte payé aujourd'hui : ${deposit.toFixed(2)} $`,
      `Solde à payer à la livraison : ${balance.toFixed(2)} $`,
      "---",
      "IMPORTANT : Le paiement effectué aujourd'hui correspond à un acompte de 50 %. Le solde sera payable à la réception des produits."
    ]
      .filter(Boolean)
      .join("\n");

    const draftPayload = {
      draft_order: {

        email: safeEmail || undefined,

        line_items: depositItems,

        billing_address: {
          first_name: nameData.firstName,
          last_name: nameData.lastName,
          company: safeDojo,
          address1: "Retrait au dojo",
          city: safeDojo,
          province: "QC",
          country: "Canada",
          zip: "J0J 0J0"
        },

        shipping_address: {
          first_name: nameData.firstName,
          last_name: nameData.lastName,
          company: safeDojo,
          address1: "Retrait au dojo",
          city: safeDojo,
          province: "QC",
          country: "Canada",
          zip: "J0J 0J0"
        },

        note,

        note_attributes: [
          {
            name: "Type de formulaire",
            value: "Commande équipement compétition"
          },

          {
            name: "Compétiteur",
            value: safeCompetiteur
          },

          {
            name: "Courriel compétiteur",
            value: safeEmail || ""
          },

          {
            name: "Équipe",
            value: safeEquipe
          },

          {
            name: "Équipe courte",
            value: teamShort
          },

          {
            name: "Dojo",
            value: safeDojo
          },

          {
            name: "Date de naissance",
            value: dateNaissance || ""
          },

          {
            name: "Parent / Tuteur",
            value: parentTuteur || ""
          },

          {
            name: "Signature électronique",
            value: signature || ""
          },

          {
            name: "Date de signature",
            value: dateSignature || ""
          },

          {
            name: "Total commande réel",
            value: total.toFixed(2)
          },

          {
            name: "Acompte payé",
            value: deposit.toFixed(2)
          },

          {
            name: "Solde livraison",
            value: balance.toFixed(2)
          }
        ],

        tags: [
          "competition-2026",
          "commande-equipement",
          "acompte-50",
          teamTag,
          `dojo-${safeDojoTag}`,
          `competiteur-${safeCompetiteurTag}`
        ].join(",")
      }
    };

    console.log("SHOPIFY PAYLOAD READY");

    const draftRes = await fetch(
      `https://${shop}/admin/api/${apiVersion}/draft_orders.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": access_token
        },
        body: JSON.stringify(draftPayload)
      }
    );

    const draftText = await draftRes.text();

    console.log("SHOPIFY STATUS:", draftRes.status);
    console.log("SHOPIFY RESPONSE:", draftText);

    if (!draftRes.ok) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Erreur création draft order",
          status: draftRes.status,
          detail: draftText
        })
      };
    }

    const parsed = JSON.parse(draftText);
    const draft_order = parsed.draft_order;

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

    console.error("DRAFT ORDER ERROR:", err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: err.message
      })
    };
  }
};
