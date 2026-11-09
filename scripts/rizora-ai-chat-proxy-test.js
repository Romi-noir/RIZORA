"use strict";

const assert = require("node:assert/strict");
const handler = require("../api/ai/chat");

async function dispatch(request, upstream) {
  let forwarded = null;
  const previousFetch = global.fetch;
  global.fetch = async (url, options) => {
    forwarded = {url, options};
    return {
      status: upstream.status,
      text: async () => upstream.body
    };
  };

  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value) {
      this.body = value;
      return value;
    }
  };

  try {
    await handler(request, response);
    return {response, forwarded};
  } finally {
    global.fetch = previousFetch;
  }
}

async function main() {
  const cookie = "rizora_session=test-session; rizora_csrf=test-csrf";
  const cookieRequest = await dispatch({
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": "test-csrf"
    },
    body: {message: "hi"}
  }, {
    status: 200,
    body: JSON.stringify({success: true, reply: "Hello."})
  });

  assert.equal(cookieRequest.forwarded.url, "https://rizora-guse.onrender.com/api/ai/chat");
  assert.equal(cookieRequest.forwarded.options.headers.Cookie, cookie);
  assert.equal(cookieRequest.forwarded.options.headers.Authorization, undefined);
  assert.equal(cookieRequest.forwarded.options.headers["X-CSRF-Token"], "test-csrf");
  assert.equal(cookieRequest.response.statusCode, 200);
  assert.equal(JSON.parse(cookieRequest.response.body).reply, "Hello.");

  const unauthenticated = await dispatch({method: "POST", headers: {}, body: {message: "hi"}}, {
    status: 401,
    body: JSON.stringify({success: false, error: "Authentication required."})
  });
  assert.ok(unauthenticated.forwarded, "the backend must remain the authentication authority");
  assert.equal(unauthenticated.response.statusCode, 401);
  assert.equal(JSON.parse(unauthenticated.response.body).error, "Authentication required.");

  const bearerRequest = await dispatch({
    method: "POST",
    headers: {authorization: "Bearer test-token"},
    body: "{\"message\":\"hi\"}"
  }, {status: 200, body: JSON.stringify({success: true, reply: "Hello."})});
  assert.equal(bearerRequest.forwarded.options.headers.Authorization, "Bearer test-token");
  assert.equal(bearerRequest.forwarded.options.body, "{\"message\":\"hi\"}");

  const wrongMethod = await dispatch({method: "GET", headers: {}, body: null}, {
    status: 200,
    body: "{}"
  });
  assert.equal(wrongMethod.response.statusCode, 405);
  assert.equal(wrongMethod.forwarded, null);

  console.log("RIZORA AI chat proxy test: PASS");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});