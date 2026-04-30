const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const { getStore } = await import("@netlify/blobs");
  const store = getStore("otb-acquisti");
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
