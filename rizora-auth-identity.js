"use strict";

function authContactForUser(user) {
  if (!user) return null;
  const email = String(user.email || "").trim().toLowerCase();
  const phone = String(user.phoneNormalized || user.phone || "").trim();
  if (email && user.emailVerified !== false) return { email, phone: "" };
  if (phone && user.phoneVerified === true) return { email: "", phone };
  if (email) return { email, phone: "" };
  if (phone) return { email: "", phone };
  return null;
}

module.exports = { authContactForUser };
