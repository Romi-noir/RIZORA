"use strict";

function ensureBusiness(db) {
  db.rzV2 = db.rzV2 || {};
  db.rzV2.businessEvents = db.rzV2.businessEvents || [];
  db.rzV2.creatorMemberships = db.rzV2.creatorMemberships || [];
  db.rzV2.creatorMembershipTiers = db.rzV2.creatorMembershipTiers || [];
  db.rzV2.creatorMembershipEvents = db.rzV2.creatorMembershipEvents || [];
  db.rzV2.tips = db.rzV2.tips || [];
  db.rzV2.productPurchases = db.rzV2.productPurchases || [];
  db.rzV2.products = db.rzV2.products || [];
  db.rzV2.transactions = db.rzV2.transactions || [];
  db.rzV2.adCampaigns = db.rzV2.adCampaigns || [];
}

function currentUser(ctx) {
  return ctx.getCurrentUser(ctx.db, ctx.req);
}

function safe(ctx, value, max) {
  return ctx.cleanString(value == null ? "" : value, max || 1200);
}

function findUser(db, key) {
  var q = String(key || "").trim().replace(/^@/, "").toLowerCase();
  if (!q) return null;
  return (db.users || []).find(function (u) {
    return String(u.id || "").toLowerCase() === q ||
      String(u.username || "").toLowerCase() === q ||
      String(u.publicUsername || "").toLowerCase() === q;
  }) || null;
}

function money(v) {
  var n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function creatorSummary(db, user) {
  var tips = db.rzV2.tips.filter(function (t) {
    return t.creatorId === user.id;
  });
  var products = db.rzV2.products.filter(function (p) {
    return p.creatorId === user.id;
  });
  var sales = db.rzV2.productPurchases.filter(function (p) {
    return p.creatorId === user.id;
  });
  var tiers = db.rzV2.creatorMembershipTiers.filter(function (t) {
    return t.creatorId === user.id && t.status === "active";
  });
  var memberships = db.rzV2.creatorMemberships.filter(function (m) {
    return m.creatorId === user.id;
  });

  var confirmedTips = tips.filter(function (t) { return t.status === "success"; });
  var confirmedSales = sales.filter(function (p) { return p.status === "success"; });
  var activeMemberships = memberships.filter(function (m) {
    return ["active", "attention", "non-renewing", "free"].includes(m.status);
  });

  var tipRevenue = confirmedTips.reduce(function (sum, t) {
    return sum + money(t.amountNaira);
  }, 0);
  var productRevenue = confirmedSales.reduce(function (sum, p) {
    return sum + money(p.amountNaira);
  }, 0);
  var monthlyMembershipGross = activeMemberships.reduce(function (sum, m) {
    var tier = tiers.find(function (t) { return t.id === m.tierId; });
    return sum + (tier && Number(tier.priceNaira) > 0 ? money(tier.priceNaira) : 0);
  }, 0);
  var pendingTips = tips.filter(function (t) { return t.status === "pending"; }).reduce(function (sum, t) {
    return sum + money(t.amountNaira);
  }, 0);
  var pendingSales = sales.filter(function (p) { return p.status === "pending"; }).reduce(function (sum, p) {
    return sum + money(p.amountNaira);
  }, 0);

  var ledger = [];
  confirmedTips.forEach(function (t) {
    ledger.push({
      id: t.id,
      kind: "tip",
      status: t.status,
      grossNaira: money(t.amountNaira),
      currency: t.currency || "NGN",
      reference: t.reference || "",
      createdAt: t.createdAt,
      description: "Creator Support"
    });
  });
  confirmedSales.forEach(function (p) {
    var product = db.rzV2.products.find(function (x) { return x.id === p.productId; });
    ledger.push({
      id: p.id,
      kind: "product_sale",
      status: p.status,
      grossNaira: money(p.amountNaira),
      currency: "NGN",
      reference: p.reference || "",
      createdAt: p.createdAt,
      description: product ? product.title : "Digital product sale"
    });
  });

  ledger.sort(function (a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return {
    creator: {
      id: user.id,
      username: user.publicUsername || user.username,
      displayName: user.displayName || user.username
    },
    totals: {
      grossConfirmedNaira: tipRevenue + productRevenue,
      tipsConfirmedNaira: tipRevenue,
      productSalesConfirmedNaira: productRevenue,
      pendingNaira: pendingTips + pendingSales,
      recurringMonthlyGrossNaira: monthlyMembershipGross
    },
    audience: {
      paidAndFreeMembers: activeMemberships.length,
      paidMembers: activeMemberships.filter(function (m) { return m.status !== "free"; }).length,
      freeMembers: activeMemberships.filter(function (m) { return m.status === "free"; }).length,
      activeTiers: tiers.length,
      products: products.length,
      confirmedProductSales: confirmedSales.length,
      confirmedTips: confirmedTips.length
    },
    settlement: {
      automaticCreatorPayoutsEnabled: false,
      note: "These are gross confirmed creator transactions recorded by RIZORA. They are not a payout statement. Creator Support currently settles to the RIZORA merchant account until creator payout configuration is enabled."
    },
    ledger: ledger.slice(0, 100)
  };
}

async function readBody(req) {
  var raw = "";
  for await (var chunk of req) {
    raw += chunk.toString();
    if (raw.length > 250000) throw new Error("Request body too large.");
  }
  return raw ? JSON.parse(raw) : {};
}

async function handleRizoraBusiness(ctx) {
  var db = ctx.db;
  var req = ctx.req;
  var res = ctx.res;
  var user = currentUser(ctx);
  var url = new URL(req.url, "http://rizora.local");
  var path = url.pathname;
  var method = String(req.method || "GET").toUpperCase();

  ensureBusiness(db);

  // ---------- RIZORA ADS ----------
  // Registered RIZORA accounts may run ads only with an active RIZORA+ (Premium+)
  // subscription. External businesses may purchase an ad campaign through Paystack.
  function isRizoraPlus(account) {
    if (!account) return false;
    var sub = (db.rzV2.premiumSubscriptions || []).find(function (x) {
      return x.userId === account.id &&
        ["active", "attention", "non-renewing"].includes(x.status) &&
        (x.plan === "premium_plus" || x.paystackPlanCode === String(process.env.PAYSTACK_PREMIUM_PLUS_PLAN_CODE || "").trim());
    });
    return !!sub;
  }

  function adSafeUrl(value) {
    var raw = safe(ctx, value, 1200);
    if (!raw) return "";
    try {
      var parsed = new URL(raw);
      if (!["http:", "https:"].includes(parsed.protocol)) return "";
      return parsed.toString();
    } catch (_) {
      return "";
    }
  }

  if (path === "/api/v2/ads/access" && method === "GET") {
    ctx.sendJSON(res, 200, {
      success: true,
      registered: !!user,
      userId: user ? user.id : null,
      rizoraPlus: !!(user && isRizoraPlus(user)),
      paymentProvider: "paystack",
      currency: String(process.env.RIZORA_CURRENCY || "NGN"),
      externalMinimumNaira: Number(process.env.RIZORA_EXTERNAL_AD_MIN_NAIRA || 1000),
      externalMaximumNaira: Number(process.env.RIZORA_EXTERNAL_AD_MAX_NAIRA || 10000000)
    });
    return true;
  }

  if (path === "/api/v2/ads" && method === "GET") {
    var nowMs = Date.now();
    var activeAds = (db.rzV2.adCampaigns || []).filter(function (ad) {
      return ad.status === "active" &&
        (!ad.expiresAt || new Date(ad.expiresAt).getTime() > nowMs);
    }).sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }).slice(0, 10).map(function (ad) {
      ad.impressions = Number(ad.impressions || 0) + 1;
      return {
        id: ad.id,
        title: ad.title,
        description: ad.description,
        imageUrl: ad.imageUrl || "",
        destinationUrl: ad.destinationUrl,
        advertiserName: ad.businessName || "Business advertiser",
        createdAt: ad.createdAt,
        expiresAt: ad.expiresAt || null
      };
    });
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, { success: true, ads: activeAds });
    return true;
  }

  if (path === "/api/v2/ads/mine" && method === "GET") {
    if (!user) {
      ctx.sendError(res, 401, "Authentication required.");
      return true;
    }
    var mine = (db.rzV2.adCampaigns || []).filter(function (ad) {
      return ad.userId === user.id;
    }).sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }).map(function (ad) {
      return Object.assign({}, ad, {
        canManage: true,
        billingType: ad.billingType || "rizora_plus"
      });
    });
    ctx.sendJSON(res, 200, { success: true, rizoraPlus: isRizoraPlus(user), ads: mine.slice(0, 100) });
    return true;
  }

  if (path === "/api/v2/ads" && method === "POST") {
    if (!user) {
      ctx.sendError(res, 401, "Log in to run ads from a RIZORA account.");
      return true;
    }
    if (!isRizoraPlus(user)) {
      ctx.sendError(res, 403, "RIZORA+ is required for registered businesses to run ads.");
      return true;
    }
    var body;
    try {
      body = await readBody(req);
    } catch (e) {
      ctx.sendError(res, 400, e.message);
      return true;
    }
    var title = safe(ctx, body.title, 120);
    var description = safe(ctx, body.description, 500);
    var businessName = safe(ctx, body.businessName, 120);
    var destinationUrl = adSafeUrl(body.destinationUrl);
    var imageUrl = adSafeUrl(body.imageUrl);
    var durationDays = Math.max(1, Math.min(90, Number(body.durationDays || 7)));
    if (!businessName || !title || !destinationUrl) {
      ctx.sendError(res, 400, "Business name, ad title and a valid destination URL are required.");
      return true;
    }
    var ad = {
      id: ctx.uid("ad_"),
      userId: user.id,
      advertiserType: "rizora_registered",
      billingType: "rizora_plus",
      businessName,
      title,
      description,
      imageUrl,
      destinationUrl,
      amountNaira: 0,
      currency: String(process.env.RIZORA_CURRENCY || "NGN"),
      reference: "",
      status: "active",
      durationDays: Math.round(durationDays),
      expiresAt: null,
      impressions: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.rzV2.adCampaigns.push(ad);
    db.notifications = db.notifications || [];
    db.notifications.push({
      id: ctx.uid("notif_"),
      userId: user.id,
      title: "RIZORA+ ad campaign live",
      message: 'Your business ad "' + ad.title + '" is now live.',
      type: "ads",
      read: false,
      createdAt: new Date().toISOString()
    });
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, { success: true, ad: ad });
    return true;
  }

  if (path === "/api/v2/ads/external/initialize" && method === "POST") {
    if (user) {
      if (!isRizoraPlus(user)) {
        ctx.sendError(res, 403, "Registered RIZORA businesses must subscribe to RIZORA+ to run ads.");
        return true;
      }
      ctx.sendError(res, 400, "Your registered RIZORA+ business should launch ads from Ads Manager instead.");
      return true;
    }
    var ext;
    try {
      ext = await readBody(req);
    } catch (e) {
      ctx.sendError(res, 400, e.message);
      return true;
    }
    var businessName = safe(ctx, ext.businessName, 120);
    var email = safe(ctx, ext.email, 180).toLowerCase();
    var title = safe(ctx, ext.title, 120);
    var description = safe(ctx, ext.description, 500);
    var destinationUrl = adSafeUrl(ext.destinationUrl);
    var imageUrl = adSafeUrl(ext.imageUrl);
    var amountNaira = Number(ext.amountNaira);
    var durationDays = Math.max(1, Math.min(90, Number(ext.durationDays || 7)));
    var minNaira = Number(process.env.RIZORA_EXTERNAL_AD_MIN_NAIRA || 1000);
    var maxNaira = Number(process.env.RIZORA_EXTERNAL_AD_MAX_NAIRA || 10000000);
    if (!businessName || !email.includes("@") || !title || !destinationUrl) {
      ctx.sendError(res, 400, "Business name, valid email, ad title and destination URL are required.");
      return true;
    }
    if (!Number.isFinite(amountNaira) || amountNaira < minNaira || amountNaira > maxNaira) {
      ctx.sendError(res, 400, "Ad budget must be between ₦" + minNaira.toLocaleString() + " and ₦" + maxNaira.toLocaleString() + ".");
      return true;
    }
    var secret = String(process.env.PAYSTACK_SECRET_KEY || "").trim();
    if (!secret) {
      ctx.sendError(res, 503, "Paystack is not configured on the RIZORA server yet.");
      return true;
    }
    var reference = "RZA-AD-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    var ad = {
      id: ctx.uid("ad_"),
      userId: null,
      advertiserType: "external",
      billingType: "paystack",
      businessName,
      email,
      title,
      description,
      imageUrl,
      destinationUrl,
      amountNaira,
      currency: String(process.env.RIZORA_CURRENCY || "NGN"),
      reference,
      status: "pending_payment",
      durationDays: Math.round(durationDays),
      expiresAt: null,
      impressions: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    var payload = {
      email: email,
      amount: String(Math.round(amountNaira * 100)),
      currency: ad.currency,
      reference: reference,
      callback_url: String(process.env.RIZORA_PAYMENT_CALLBACK || "https://rizora.com.ng/"),
      metadata: JSON.stringify({
        purpose: "rizora_external_ad",
        adId: ad.id,
        businessName: businessName,
        email: email
      })
    };
    try {
      var response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + secret,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      var result = await response.json();
      if (!response.ok || !result.status || !result.data) {
        ctx.sendError(res, 502, result.message || "Unable to initialize Paystack ad payment.");
        return true;
      }
      ad.authorizationUrl = result.data.authorization_url || "";
      ad.accessCode = result.data.access_code || "";
      ad.reference = result.data.reference || reference;
      ad.updatedAt = new Date().toISOString();
      db.rzV2.adCampaigns.push(ad);
      db.rzV2.transactions.push({
        id: ctx.uid("tx_"),
        userId: null,
        provider: "paystack",
        reference: ad.reference,
        amountNaira: amountNaira,
        amountSubunit: Math.round(amountNaira * 100),
        currency: ad.currency,
        purpose: "rizora_external_ad",
        campaignId: ad.id,
        status: "initialized",
        authorizationUrl: ad.authorizationUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      ctx.saveDB(db);
      ctx.sendJSON(res, 200, {
        success: true,
        authorizationUrl: ad.authorizationUrl,
        reference: ad.reference,
        adId: ad.id,
        amountNaira: amountNaira
      });
    } catch (e) {
      ctx.sendError(res, 502, "Paystack ad payment could not be initialized.");
    }
    return true;
  }

  var adVerify = path.match(/^\/api\/v2\/ads\/external\/verify\/([^/]+)$/);
  if (adVerify && method === "GET") {
    var verifyRef = decodeURIComponent(adVerify[1]);
    var verifyAd = (db.rzV2.adCampaigns || []).find(function (ad) { return ad.reference === verifyRef; });
    if (!verifyAd) {
      ctx.sendError(res, 404, "Ad payment reference not found.");
      return true;
    }
    ctx.sendJSON(res, 200, {
      success: true,
      status: verifyAd.status,
      active: verifyAd.status === "active",
      adId: verifyAd.id
    });
    return true;
  }

  if (path === "/api/v2/business/summary" && method === "GET") {
    if (!user) {
      ctx.sendError(res, 401, "Authentication required.");
      return true;
    }
    ctx.sendJSON(res, 200, { success: true, business: creatorSummary(db, user) });
    return true;
  }

  if (path === "/api/v2/business/ledger" && method === "GET") {
    if (!user) {
      ctx.sendError(res, 401, "Authentication required.");
      return true;
    }
    var summary = creatorSummary(db, user);
    ctx.sendJSON(res, 200, { success: true, ledger: summary.ledger, settlement: summary.settlement });
    return true;
  }

  if (path === "/api/v2/business/export" && method === "GET") {
    if (!user) {
      ctx.sendError(res, 401, "Authentication required.");
      return true;
    }
    var s = creatorSummary(db, user);
    var rows = [
      ["date", "kind", "description", "gross_ngn", "status", "reference"]
    ];
    s.ledger.forEach(function (row) {
      rows.push([
        row.createdAt || "",
        row.kind || "",
        row.description || "",
        String(money(row.grossNaira)),
        row.status || "",
        row.reference || ""
      ]);
    });
    function csvCell(v) {
      return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    }
    var csv = rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n");
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rizora-business-ledger.csv"',
      "Cache-Control": "no-store"
    });
    res.end(csv);
    return true;
  }

  // Optional free community membership. Paid tiers remain handled by the normal
  // Paystack membership flow in rizora-v2-enterprise.js.
  if (path === "/api/v2/memberships/free-tiers" && method === "POST") {
    if (!user) {
      ctx.sendError(res, 401, "Authentication required.");
      return true;
    }
    var body;
    try {
      body = await readBody(req);
    } catch (e) {
      ctx.sendError(res, 400, e.message);
      return true;
    }
    var price = Number(body.priceNaira);
    if (!Number.isFinite(price) || price !== 0) return false;

    var name = safe(ctx, body.name, 100);
    var description = safe(ctx, body.description, 600);
    var perks = Array.isArray(body.perks)
      ? body.perks.slice(0, 12).map(function (x) { return safe(ctx, x, 100); }).filter(Boolean)
      : [];
    if (!name) {
      ctx.sendError(res, 400, "Free tier name is required.");
      return true;
    }

    var activeCount = db.rzV2.creatorMembershipTiers.filter(function (t) {
      return t.creatorId === user.id && t.status === "active";
    }).length;
    if (activeCount >= 20) {
      ctx.sendError(res, 400, "You can have up to 20 active membership tiers.");
      return true;
    }

    var existing = db.rzV2.creatorMembershipTiers.find(function (t) {
      return t.creatorId === user.id &&
        t.status === "active" &&
        Number(t.priceNaira) === 0 &&
        String(t.name || "").toLowerCase() === name.toLowerCase();
    });
    if (existing) {
      ctx.sendJSON(res, 200, { success: true, tier: existing, existing: true });
      return true;
    }

    var tier = {
      id: ctx.uid("mtier_"),
      creatorId: user.id,
      name: name,
      description: description,
      priceNaira: 0,
      currency: "NGN",
      interval: "free",
      perks: perks,
      paystackPlanCode: "",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.rzV2.creatorMembershipTiers.push(tier);
    db.rzV2.creatorMembershipEvents.push({
      id: ctx.uid("mevent_"),
      event: "free_tier.created",
      tierId: tier.id,
      creatorId: user.id,
      createdAt: new Date().toISOString()
    });
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, { success: true, tier: tier, free: true });
    return true;
  }

  var join = path.match(/^\/api\/v2\/memberships\/free-tiers\/([^/]+)\/join$/);
  if (join && method === "POST") {
    var tier = db.rzV2.creatorMembershipTiers.find(function (t) {
      return t.id === join[1] && t.status === "active";
    });
    if (!tier || Number(tier.priceNaira) !== 0) return false;
    if (!user) {
      ctx.sendError(res, 401, "Authentication required.");
      return true;
    }
    if (tier.creatorId === user.id) {
      ctx.sendError(res, 400, "You already own this free tier.");
      return true;
    }
    var duplicate = db.rzV2.creatorMemberships.find(function (m) {
      return m.tierId === tier.id &&
        m.memberId === user.id &&
        ["active", "free"].includes(m.status);
    });
    if (duplicate) {
      ctx.sendError(res, 409, "You already joined this free membership.");
      return true;
    }
    var creator = (db.users || []).find(function (u) { return u.id === tier.creatorId; });
    if (!creator) {
      ctx.sendError(res, 404, "Creator not found.");
      return true;
    }
    var membership = {
      id: ctx.uid("member_"),
      tierId: tier.id,
      creatorId: tier.creatorId,
      memberId: user.id,
      memberEmail: user.email || "",
      reference: "",
      status: "free",
      amountNaira: 0,
      currency: "NGN",
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.rzV2.creatorMemberships.push(membership);
    db.rzV2.creatorMembershipEvents.push({
      id: ctx.uid("mevent_"),
      event: "free_membership.joined",
      tierId: tier.id,
      membershipId: membership.id,
      creatorId: tier.creatorId,
      memberId: user.id,
      createdAt: new Date().toISOString()
    });
    db.notifications = db.notifications || [];
    db.notifications.push({
      id: ctx.uid("notif_"),
      userId: tier.creatorId,
      title: "New free member",
      message: "@" + (user.publicUsername || user.username) + " joined your free community membership.",
      type: "membership",
      read: false,
      createdAt: new Date().toISOString()
    });
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, {
      success: true,
      joined: true,
      membership: membership,
      tier: tier,
      creator: {
        id: creator.id,
        username: creator.publicUsername || creator.username,
        displayName: creator.displayName || creator.username
      }
    });
    return true;
  }

  var cancel = path.match(/^\/api\/v2\/memberships\/free-memberships\/([^/]+)\/cancel$/);
  if (cancel && method === "POST") {
    var ownMembership = db.rzV2.creatorMemberships.find(function (m) {
      return m.id === cancel[1] && m.memberId === user?.id;
    });
    if (!ownMembership || !["free"].includes(ownMembership.status)) return false;
    ownMembership.status = "cancelled";
    ownMembership.updatedAt = new Date().toISOString();
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, { success: true, status: ownMembership.status });
    return true;
  }

  var gift = path.match(/^\/api\/v2\/memberships\/free-tiers\/([^/]+)\/gift$/);
  if (gift && method === "POST") {
    if (!user) {
      ctx.sendError(res, 401, "Authentication required.");
      return true;
    }
    var giftTier = db.rzV2.creatorMembershipTiers.find(function (t) {
      return t.id === gift[1] && t.creatorId === user.id && t.status === "active" && Number(t.priceNaira) === 0;
    });
    if (!giftTier) {
      ctx.sendError(res, 404, "Free membership tier not found.");
      return true;
    }
    var giftBody;
    try {
      giftBody = await readBody(req);
    } catch (e) {
      ctx.sendError(res, 400, e.message);
      return true;
    }
    var recipient = findUser(db, giftBody.username || giftBody.creator || giftBody.user);
    if (!recipient) {
      ctx.sendError(res, 404, "Recipient not found.");
      return true;
    }
    if (recipient.id === user.id) {
      ctx.sendError(res, 400, "You cannot gift yourself.");
      return true;
    }
    var days = Math.max(1, Math.min(365, Number(giftBody.days || 30)));
    var existingGift = db.rzV2.creatorMemberships.find(function (m) {
      return m.tierId === giftTier.id &&
        m.memberId === recipient.id &&
        m.giftedBy === user.id &&
        ["active", "free"].includes(m.status);
    });
    if (existingGift) {
      existingGift.expiresAt = new Date(Date.now() + days * 86400000).toISOString();
      existingGift.updatedAt = new Date().toISOString();
      ctx.saveDB(db);
      ctx.sendJSON(res, 200, { success: true, membership: existingGift, extended: true });
      return true;
    }
    var gifted = {
      id: ctx.uid("member_"),
      tierId: giftTier.id,
      creatorId: user.id,
      memberId: recipient.id,
      memberEmail: recipient.email || "",
      reference: "",
      status: "free",
      amountNaira: 0,
      currency: "NGN",
      giftedBy: user.id,
      giftedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.rzV2.creatorMemberships.push(gifted);
    db.rzV2.creatorMembershipEvents.push({
      id: ctx.uid("mevent_"),
      event: "free_membership.gifted",
      tierId: giftTier.id,
      membershipId: gifted.id,
      creatorId: user.id,
      memberId: recipient.id,
      days: days,
      createdAt: new Date().toISOString()
    });
    db.notifications = db.notifications || [];
    db.notifications.push({
      id: ctx.uid("notif_"),
      userId: recipient.id,
      title: "Free membership gifted",
      message: "@" + (user.publicUsername || user.username) + " gifted you free access to their RIZORA community membership.",
      type: "membership",
      read: false,
      createdAt: new Date().toISOString()
    });
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, { success: true, membership: gifted, days: days });
    return true;
  }

  return false;
}

module.exports = { handleRizoraBusiness };
