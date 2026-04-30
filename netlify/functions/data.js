const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-OTB-Access",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  const appPassword = process.env.OTB_APP_PASSWORD;

  if (!appPassword) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Password app non configurata" })
    };
  }

  if (event.headers["x-otb-access"] !== appPassword) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Accesso non autorizzato" })
    };
  }

  if (!siteID || !token) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Configurazione Netlify Blobs incompleta",
        missing: {
          NETLIFY_SITE_ID: !siteID,
          NETLIFY_BLOBS_TOKEN: !token
        }
      })
    };
  }

  const { getStore } = await import("@netlify/blobs");
  const store = getStore({
    name: "otb-acquisti",
    siteID,
    token
  });
  const key = "ss27";

  if (event.httpMethod === "GET") {
    const data = await store.get(key, { type: "json" });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: data || null })
    };
  }

  if (event.httpMethod === "POST") {
    const payload = JSON.parse(event.body || "{}");
    await store.setJSON(key, payload);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, savedAt: new Date().toISOString() })
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: "Metodo non supportato" })
  };
};
