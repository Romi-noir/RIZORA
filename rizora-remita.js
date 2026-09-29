"use strict";

const crypto = require("crypto");

function clean(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max || 1000);
}

function sha512(value) {
  return crypto.createHash("sha512").update(String(value), "utf8").digest("hex");
}

function config() {
  return {
    merchantId: clean(process.env.REMITA_MERCHANT_ID, 120),
    serviceTypeId: clean(process.env.REMITA_SERVICE_TYPE_ID, 120),
    apiKey: clean(process.env.REMITA_API_KEY, 200),
    baseUrl: clean(process.env.REMITA_BASE_URL || "https://demo.remita.net", 300).replace(/\/+$/, "")
  };
}

function configured() {
  const c = config();
  return Boolean(c.merchantId && c.serviceTypeId && c.apiKey);
}

function paymentUrl(rrr) {
  const c = config();
  if (!rrr) return "";
  return c.baseUrl + "/remita/onepage/api/v1/so.spa?rrr=" + encodeURIComponent(rrr);
}

async function remitaRequest(url, options) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_) {
    data = { raw };
  }
  return { response, data };
}

async function createInvoice(input) {
  const c = config();
  if (!configured()) throw new Error("Remita is not configured on the RIZORA server.");

  const amount = String(Math.round(Number(input.amountNaira || 0)));
  const orderId = clean(input.orderId, 120);
  if (!orderId || Number(amount) <= 0) throw new Error("A valid amount and order ID are required.");

  const apiHash = sha512(c.merchantId + c.serviceTypeId + orderId + amount + c.apiKey);
  const url = c.baseUrl + "/remita/exapp/api/v1/send/api/echannelsvc/merchant/api/paymentinit";
  const body = {
    serviceTypeId: c.serviceTypeId,
    amount,
    orderId,
    payerName: clean(input.payerName || "RIZORA Creator", 160),
    payerEmail: clean(input.payerEmail, 240),
    payerPhone: clean(input.payerPhone || "", 50),
    description: clean(input.description || "RIZORA payment", 300),
    apiHash
  };

  const result = await remitaRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "remitaConsumerKey=" + c.merchantId + ",remitaConsumerToken=" + c.apiKey
    },
    body: JSON.stringify(body)
  });

  const d = result.data || {};
  const rrr = String(
    d.RRR ||
    d.rrr ||
    (d.data && (d.data.RRR || d.data.rrr)) ||
    ""
  ).trim();
  const statuscode = String(
    d.statuscode ||
    (d.data && d.data.statuscode) ||
    ""
  ).trim();
  const status = String(d.status || (d.data && d.data.status) || "").trim();

  if (!result.response.ok || (!rrr && !["00", "01", "025"].includes(statuscode))) {
    const message = String(
      d.message ||
      (d.data && d.data.message) ||
      status ||
      "Remita could not generate a payment reference."
    ).slice(0, 500);
    throw new Error(message);
  }

  return {
    orderId,
    rrr,
    statuscode,
    status,
    paymentUrl: paymentUrl(rrr),
    response: d
  };
}

async function verifyOrder(orderId) {
  const c = config();
  if (!configured()) throw new Error("Remita is not configured on the RIZORA server.");
  const id = clean(orderId, 120);
  const hash = sha512(id + c.apiKey + c.merchantId);
  const url = c.baseUrl +
    "/remita/exapp/api/v1/send/api/echannelsvc/" +
    encodeURIComponent(c.merchantId) + "/" +
    encodeURIComponent(id) + "/" +
    encodeURIComponent(c.apiKey) +
    "/orderstatus.reg?hash=" + encodeURIComponent(hash);

  const result = await remitaRequest(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "remitaConsumerKey=" + c.merchantId + ",remitaConsumerToken=" + c.apiKey
    }
  });

  return normalizeStatus(result.data, result.response);
}

async function verifyRrr(rrr) {
  const c = config();
  if (!configured()) throw new Error("Remita is not configured on the RIZORA server.");
  const ref = clean(rrr, 120);
  const hash = sha512(ref + c.apiKey + c.merchantId);
  const url = c.baseUrl +
    "/remita/exapp/api/v1/send/api/echannelsvc/" +
    encodeURIComponent(c.merchantId) + "/" +
    encodeURIComponent(ref) + "/" +
    encodeURIComponent(c.apiKey) +
    "/status.reg?hash=" + encodeURIComponent(hash);

  const result = await remitaRequest(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "remitaConsumerKey=" + c.merchantId + ",remitaConsumerToken=" + c.apiKey
    }
  });

  return normalizeStatus(result.data, result.response);
}

function normalizeStatus(data, response) {
  const d = data || {};
  const statuscode = String(
    d.statuscode ||
    d.statusCode ||
    (d.data && (d.data.statuscode || d.data.statusCode)) ||
    ""
  ).trim();
  const status = String(
    d.status ||
    d.message ||
    (d.data && (d.data.status || d.data.message)) ||
    ""
  ).trim();
  const paid = ["00", "01"].includes(statuscode);
  return {
    ok: Boolean(response && response.ok),
    paid,
    statuscode,
    status,
    rrr: String(d.RRR || d.rrr || (d.data && (d.data.RRR || d.data.rrr)) || "").trim(),
    response: d
  };
}

module.exports = {
  configured,
  config,
  createInvoice,
  verifyOrder,
  verifyRrr
};
