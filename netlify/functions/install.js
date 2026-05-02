exports.handler = async function () {
  const shop = process.env.SHOPIFY_SHOP;
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  const scopes = "write_draft_orders,read_draft_orders";
  const redirectUri = "https://sunfuki-proxy.netlify.app/.netlify/functions/callback";

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return {
    statusCode: 302,
    headers: {
      Location: installUrl
    }
  };
};
