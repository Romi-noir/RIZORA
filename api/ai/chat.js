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
    const auth = req.headers.authorization || "";

    if (!auth) {
      res.statusCode = 401;
      return res.end(JSON.stringify({
        success: false,
        error: "Authentication required."
      }));
    }

    const response = await fetch(
      "https://rizora-guse.onrender.com/api/ai/chat",
      {
        method: "POST",
        headers: {
          "Content-Type":
            req.headers["content-type"] || "application/json",
          "Authorization": auth
        },
        body:
          typeof req.body === "string"
            ? req.body
            : JSON.stringify(req.body || {})
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