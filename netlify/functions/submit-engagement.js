exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: "Méthode non autorisée" })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const TEAM_LABELS = {
      cobra: "Équipe Cobra",
      international: "Équipe International Cobra",
      coach: "Coach Sunfuki",
      assistant: "Assistant-Coach Sunfuki"
    };

    const teamKey = body.teamKey || "";
    const equipeFinale = TEAM_LABELS[teamKey] || body.equipe || "Équipe non précisée";

    const competiteur = body.competiteur || "";
    const email = body.email || "";
    const dojo = body.dojo || "";
    const dateNaissance = body.dateNaissance || "";
    const parentTuteur = body.parentTuteur || "";
    const signature = body.signature || "";
    const dateSignature = body.dateSignature || "";
    const requirementsText = body.requirementsText || "";
    const mode = body.mode || "signature_only";
    const total = body.total || 0;
    const acompte = body.acompte || 0;
    const solde = body.solde || 0;
    const invoiceUrl = body.invoiceUrl || "";
    const draftOrderId = body.draftOrderId || "";

    if (!competiteur || !email || !signature || !equipeFinale) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Informations manquantes"
        })
      };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;
    const siteEmail = process.env.SITE_EMAIL;

    if (!resendApiKey || !fromEmail || !siteEmail) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Configuration courriel manquante"
        })
      };
    }

    const SUBJECT_LABELS = {
  cobra: "Engagement équipe compétition Cobra",
  international: "Engagement équipe compétition International Cobra",
  coach: "Engagement équipe Coach Sunfuki",
  assistant: "Engagement équipe Assistant-Coach Sunfuki"
};

const subject =
  "Confirmation d’engagement — " +
  (SUBJECT_LABELS[teamKey] || equipeFinale);

    const itemsHtml = Array.isArray(body.items) && body.items.length
      ? body.items.map(function(item) {
          return `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${item.title || ""}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${item.variantTitle || ""}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${item.qty || 0}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">${item.price || 0} $</td>
            </tr>
          `;
        }).join("")
      : "";

    const orderBlock = mode === "signature_and_order"
      ? `
        <h3>Commande</h3>
        <p><strong>Total commande :</strong> ${total} $</p>
        <p><strong>Acompte :</strong> ${acompte} $</p>
        <p><strong>Solde :</strong> ${solde} $</p>
        ${invoiceUrl ? `<p><strong>Lien de paiement :</strong> <a href="${invoiceUrl}">${invoiceUrl}</a></p>` : ""}
        ${draftOrderId ? `<p><strong>Draft Order ID :</strong> ${draftOrderId}</p>` : ""}

        ${itemsHtml ? `
          <table style="border-collapse:collapse;width:100%;margin-top:12px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Produit</th>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Taille / Variante</th>
                <th style="text-align:center;padding:8px;border-bottom:2px solid #333;">Qté</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #333;">Prix</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
        ` : ""}
      `
      : "";

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222;">
        <h2>${subject}</h2>

        <h3>Informations</h3>
        <p><strong>Équipe / rôle :</strong> ${equipeFinale}</p>
        <p><strong>Clé technique :</strong> ${teamKey}</p>
        <p><strong>Nom :</strong> ${competiteur}</p>
        <p><strong>Courriel :</strong> ${email}</p>
        <p><strong>Dojo :</strong> ${dojo}</p>
        <p><strong>Date de naissance :</strong> ${dateNaissance}</p>
        ${parentTuteur ? `<p><strong>Parent / tuteur :</strong> ${parentTuteur}</p>` : ""}

        <h3>Signature</h3>
        <p><strong>Signature :</strong> ${signature}</p>
        <p><strong>Date :</strong> ${dateSignature}</p>

        ${orderBlock}

        <h3>Exigences signées</h3>
        <div style="background:#f6f6f6;padding:15px;border-radius:8px;">
          ${requirementsText}
        </div>
      </div>
    `;

    const recipients = [email, siteEmail];

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        subject,
        html
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          success: false,
          error: data.message || "Erreur Resend",
          details: data
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        teamKey,
        equipe: equipeFinale,
        resend: data
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message
      })
    };
  }
};
