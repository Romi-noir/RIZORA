module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end(JSON.stringify({
      success: false,
      error: "Method not allowed."
    }));
  }

  try {
    // Use the same cookie/bearer session authentication as direct API requests.
    // The Render backend remains responsible for validating the session.
    const requestHeaders = req.headers || {};
    const headers = {
      "Content-Type": requestHeaders["content-type"] || "application/json"
    };

    if (requestHeaders.authorization) {
      headers.Authorization = requestHeaders.authorization;
    }
    if (requestHeaders.cookie) {
      headers.Cookie = requestHeaders.cookie;
    }
    if (requestHeaders["x-csrf-token"]) {
      headers["X-CSRF-Token"] = requestHeaders["x-csrf-token"];
    }

    const response = await fetch(
      "https://rizora-guse.onrender.com/api/ai/chat",
      {
        method: "POST",
        headers,
        body:
          typeof req.body === "string"
            ? req.body
            : JSON.stringify(req.body || {}),
        signal: AbortSignal.timeout(45000)
      }
    );

    const text = await response.text();

    res.statusCode = response.status;
    res.setHeader(
      "Content-Type",
      "application/json; charset=utf-8"
    );
    res.setHeader("Cache-Control", "no-store");

    return res.end(text);
  } catch (error) {
    console.error("RIZORA AI proxy error:", error);

    res.statusCode = 502;

    return res.end(JSON.stringify({
      success: false,
      error: "Unable to reach RIZORA AI."
    }));
  }
};