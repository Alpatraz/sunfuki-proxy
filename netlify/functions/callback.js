exports.handler = async function (event) {
  const shop = process.env.SHOPIFY_SHOP;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  const code = event.queryStringParameters?.code;

  if (!code) {
    return {
      statusCode: 400,
      body: "Code OAuth manquant"
    };
  }

  try {
    const tokenRes = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code
        })
      }
    );

    const text = await tokenRes.text();

    let content = "";

    try {
      const data = JSON.parse(text);

      content = `
        <h1>Token Shopify généré ✅</h1>
        <p>Status : ${tokenRes.status}</p>
        <p>Copie ce token dans Netlify comme variable :</p>
        <b>SHOPIFY_ADMIN_TOKEN</b>
        <textarea style="width:100%;height:140px;">
${data.access_token || JSON.stringify(data, null, 2)}
        </textarea>
      `;
    } catch {
      content = `
        <h1>Réponse Shopify non JSON ⚠️</h1>
        <p>Status : ${tokenRes.status}</p>
        <pre style="white-space:pre-wrap;background:#eee;padding:20px;">
${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </pre>
      `;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html"
      },
      body: content
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: `Erreur serveur callback : ${err.message}`
    };
  }
};
