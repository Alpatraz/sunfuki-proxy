exports.handler = async function (event) {
  const shop = process.env.SHOPIFY_SHOP;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  const code = event.queryStringParameters.code;

  if (!code) {
    return {
      statusCode: 400,
      body: "Code OAuth manquant"
    };
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code
    })
  });

  const data = await tokenRes.json();

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html"
    },
    body: `
      <h1>Token Shopify généré</h1>
      <p>Copie ce token dans Netlify comme SHOPIFY_ADMIN_TOKEN :</p>
      <textarea style="width:100%;height:120px;">${data.access_token || JSON.stringify(data)}</textarea>
    `
  };
};
