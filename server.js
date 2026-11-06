eradmin/tasks/status"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    let body;

    try {
      body =
        await readBody(req);
    } catch (error) {
      sendError(
        res,
        400,
        error.message
      );

      return;
    }

    const taskId =
      cleanString(
        body.taskId,
        100
      );

    const active =
      Boolean(
        body.active
      );

    const task =
      db.tasks.find(
        (item) =>
          item.id === taskId
      );

    if (!task) {
      sendError(
        res,
        404,
        "Task not found."
      );

      return;
    }

    task.active =
      active;

    audit(
      db,
      "task_status_changed",
      user,
      {
        taskId,
        active
      }
    );

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        task
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SUPER ADMIN — TASK LIST
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/superadmin/tasks/list"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        tasks:
          db.tasks
      }
    );

    return;
  }


/* ============================================================
   RIZORA HELP CENTER / SUPPORT
============================================================ */

if (
  (
    method === "GET" ||
    method === "POST"
  ) &&
  pathname === "/api/support/tickets"
) {

  const user =
    getCurrentUser(
      db,
      req
    );

  if (!user) {
    sendError(
      res,
      401,
      "Authentication required."
    );

    return;
  }

  db.supportTickets ||= [];

  if (method === "GET") {

    const tickets =
      db.supportTickets
        .filter(
          ticket =>
            ticket.userId === user.id
        )
        .slice()
        .reverse()
        .slice(0, 50);

    sendJSON(
      res,
      200,
      {
        success: true,
        tickets
      }
    );

    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(
      res,
      400,
      error.message
    );

    return;
  }

  const subject =
    cleanString(
      body.subject,
      160
    );

  const message =
    cleanString(
      body.message,
      5000
    );

  if (!subject || !message) {
    sendError(
      res,
      400,
      "Subject and message are required."
    );

    return;
  }

  const ticket = {
    id: uid("ticket_"),
    userId: user.id,
    username:
      user.username ||
      "",
    displayName:
      user.displayName ||
      user.username ||
      "",
    subject,
    status: "open",
    priority: "normal",
    messages: [
      {
        id: uid("ticket_msg_"),
        senderId: user.id,
        senderRole: "user",
        senderName:
          user.displayName ||
          user.username ||
          "User",
        message,
        createdAt:
          new Date().toISOString()
      }
    ],
    createdAt:
      new Date().toISOString(),
    updatedAt:
      new Date().toISOString()
  };

  db.supportTickets.push(
    ticket
  );

  saveDB(db);

  sendJSON(
    res,
    201,
    {
      success: true,
      ticket
    }
  );

  return;
}


/* ============================================================
   SUPER ADMIN SUPPORT INBOX
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/superadmin/support"
) {

  const user =
    getCurrentUser(
      db,
      req
    );

  if (
    !user ||
    user.role !== "super_admin"
  ) {
    sendError(
      res,
      403,
      "Super Admin access required."
    );

    return;
  }

  db.supportTickets ||= [];

  sendJSON(
    res,
    200,
    {
      success: true,
      tickets:
        db.supportTickets
          .slice()
          .reverse()
          .slice(0, 200)
    }
  );

  return;
}


/* ============================================================
   SUPER ADMIN SUPPORT REPLY
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/superadmin/support/reply"
) {

  const user =
    getCurrentUser(
      db,
      req
    );

  if (
    !user ||
    user.role !== "super_admin"
  ) {
    sendError(
      res,
      403,
      "Super Admin access required."
    );

    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(
      res,
      400,
      error.message
    );

    return;
  }

  const ticketId =
    cleanString(
      body.ticketId,
      100
    );

  const reply =
    cleanString(
      body.reply,
      5000
    );

  if (!ticketId || !reply) {
    sendError(
      res,
      400,
      "Ticket ID and reply are required."
    );

    return;
  }

  db.supportTickets ||= [];

  const ticket =
    db.supportTickets.find(
      item =>
        item.id === ticketId
    );

  if (!ticket) {
    sendError(
      res,
      404,
      "Support ticket not found."
    );

    return;
  }

  ticket.messages ||= [];

  ticket.messages.push(
    {
      id:
        uid("ticket_msg_"),
      senderId:
        user.id,
      senderRole:
        "super_admin",
      senderName:
        user.displayName ||
        user.username ||
        "RIZORA Support",
      message:
        reply,
      createdAt:
        new Date().toISOString()
    }
  );

  ticket.status =
    "answered";

  ticket.updatedAt =
    new Date().toISOString();

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success: true,
      ticket
    }
  );

  return;
}


/* ============================================================
   SUPER ADMIN SUPPORT STATUS
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/superadmin/support/status"
) {

  const user =
    getCurrentUser(
      db,
      req
    );

  if (
    !user ||
    user.role !== "super_admin"
  ) {
    sendError(
      res,
      403,
      "Super Admin access required."
    );

    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(
      res,
      400,
      error.message
    );

    return;
  }

  const ticketId =
    cleanString(
      body.ticketId,
      100
    );

  const status =
    cleanString(
      body.status,
      30
    );

  const allowed =
    [
      "open",
      "answered",
      "closed"
    ];

  if (
    !ticketId ||
    !allowed.includes(status)
  ) {
    sendError(
      res,
      400,
      "Invalid ticket status."
    );

    return;
  }

  db.supportTickets ||= [];

  const ticket =
    db.supportTickets.find(
      item =>
        item.id === ticketId
    );

  if (!ticket) {
    sendError(
      res,
      404,
      "Support ticket not found."
    );

    return;
  }

  ticket.status =
    status;

  ticket.updatedAt =
    new Date().toISOString();

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success: true,
      ticket
    }
  );

  return;
}

/* ============================================================
   RIZORA CREATOR INTELLIGENCE
============================================================ */

function creatorProfileFor(db, userId) {
  db.creatorProfiles ||= {};

  if (!db.creatorProfiles[userId]) {
    db.creatorProfiles[userId] = {
      niche: "",
      platforms: [],
      goals: [],
      bio: "",
      strengths: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  return db.creatorProfiles[userId];
}

function creatorAnalyticsFor(db, userId) {
  db.analytics ||= {};

  if (!db.analytics[userId]) {
    db.analytics[userId] = {
      posts: [],
      scores: [],
      ideasGenerated: 0
    };
  }

  return db.analytics[userId];
}

function analyzeCreatorPost(body = {}) {
  const hook = cleanString(body.hook, 1000);
  const caption = cleanString(body.caption, 3000);
  const hashtags = cleanString(body.hashtags, 1500);
  const topic = cleanString(body.topic, 300);

  let hookScore = 45;
  let captionScore = 45;
  let hashtagScore = 45;
  let clarityScore = 45;
  let engagementScore = 45;

  if (hook.length >= 15 && hook.length <= 90) hookScore += 15;
  if (/[?!]/.test(hook)) hookScore += 8;
  if (/\b(secret|truth|mistake|why|how|before|after|nobody|stop|wait|pov)\b/i.test(hook)) hookScore += 15;
  if (/\b(you|your)\b/i.test(hook)) hookScore += 7;

  if (caption.length >= 30 && caption.length <= 500) captionScore += 20;
  if (caption.includes("\n") || caption.length > 80) captionScore += 10;

  const tagList = hashtags
    .split(/[,\s]+/)
    .map(x => x.trim())
    .filter(Boolean);

  if (tagList.length >= 3 && tagList.length <= 8) hashtagScore += 25;
  if (tagList.length > 10) hashtagScore -= 20;

  const totalText = `${topic} ${hook} ${caption}`.trim();

  if (totalText.length >= 40) clarityScore += 20;
  if (/\b(follow|comment|save|share|tell me|what do you think)\b/i.test(totalText)) {
    engagementScore += 30;
  }

  hookScore = Math.max(0, Math.min(100, hookScore));
  captionScore = Math.max(0, Math.min(100, captionScore));
  hashtagScore = Math.max(0, Math.min(100, hashtagScore));
  clarityScore = Math.max(0, Math.min(100, clarityScore));
  engagementScore = Math.max(0, Math.min(100, engagementScore));

  const score = Math.round(
    hookScore * 0.30 +
    captionScore * 0.20 +
    hashtagScore * 0.15 +
    clarityScore * 0.15 +
    engagementScore * 0.20
  );

  const improvements = [];

  if (hookScore < 70) improvements.push("Make the opening more curiosity-driven.");
  if (captionScore < 70) improvements.push("Give the caption a clearer reason to keep reading.");
  if (hashtagScore < 70) improvements.push("Use a smaller, more focused hashtag mix.");
  if (clarityScore < 70) improvements.push("Make the message easier to understand quickly.");
  if (engagementScore < 70) improvements.push("Add a simple interaction prompt.");

  let rating = "Needs Work";
  if (score >= 90) rating = "Elite";
  else if (score >= 80) rating = "Strong";
  else if (score >= 70) rating = "Promising";
  else if (score >= 60) rating = "Needs polish";

  return {
    score,
    rating,
    componentScores: {
      hook: hookScore,
      caption: captionScore,
      hashtags: hashtagScore,
      clarity: clarityScore,
      engagement: engagementScore
    },
    improvements
  };
}

function generateCreatorIdeas(niche = "content") {
  return [
    `3 things I wish I knew about ${niche}.`,
    `Before vs after: ${niche}.`,
    `A hot take about ${niche}.`,
    `A common misconception about ${niche}.`,
    `Beginner vs expert: ${niche}.`,
    `Behind the scenes of my ${niche} process.`,
    `Answer the most common ${niche} question.`,
    `React to a trending ${niche} topic.`,
    `Tell a short story about ${niche}.`,
    `Things nobody tells you about ${niche}.`
  ];
}

/* ============================================================
   CREATOR PROFILE
============================================================ */

if (
  (method === "GET" || method === "POST") &&
  pathname === "/api/creator/profile"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  if (method === "GET") {
    sendJSON(res, 200, {
      success: true,
      profile: creatorProfileFor(db, user.id)
    });
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const profile = creatorProfileFor(db, user.id);

  profile.niche = cleanString(body.niche, 120);
  profile.platforms = Array.isArray(body.platforms)
    ? body.platforms.slice(0, 10).map(x => cleanString(x, 30))
    : [];
  profile.goals = Array.isArray(body.goals)
    ? body.goals.slice(0, 10).map(x => cleanString(x, 80))
    : [];
  profile.bio = cleanString(body.bio, 500);
  profile.updatedAt = new Date().toISOString();

  saveDB(db);

  sendJSON(res, 200, {
    success: true,
    profile
  });

  return;
}

/* ============================================================
   CREATOR ANALYTICS
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/creator/analytics"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  const analytics = creatorAnalyticsFor(db, user.id);

  const scores = Array.isArray(analytics.scores)
    ? analytics.scores
    : [];

  const averageScore = scores.length
    ? Math.round(
        scores.reduce((a, b) => a + Number(b.score || 0), 0) /
        scores.length
      )
    : 0;

  const bestScore = scores.length
    ? Math.max(...scores.map(x => Number(x.score || 0)))
    : 0;

  sendJSON(res, 200, {
    success: true,
    posts: analytics.posts || [],
    scores,
    ideasGenerated: Number(analytics.ideasGenerated || 0),
    averageScore,
    bestScore,
    totalPosts: analytics.posts?.length || 0
  });

  return;
}

/* ============================================================
   POST ANALYSIS
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/creator/analyze"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const result = analyzeCreatorPost(body);
  const analytics = creatorAnalyticsFor(db, user.id);

  analytics.scores.push({
    id: uid("score_"),
    score: result.score,
    rating: result.rating,
    createdAt: new Date().toISOString()
  });

  if (analytics.scores.length > 100) {
    analytics.scores = analytics.scores.slice(-100);
  }

  saveDB(db);

  sendJSON(res, 200, {
    success: true,
    ...result
  });

  return;
}

/* ============================================================
   IDEAS
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/creator/ideas"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const ideas = generateCreatorIdeas(
    cleanString(body.niche, 120) || "content"
  );

  const analytics = creatorAnalyticsFor(db, user.id);

  analytics.ideasGenerated =
    Number(analytics.ideasGenerated || 0) + ideas.length;

  saveDB(db);

  sendJSON(res, 200, {
    success: true,
    ideas
  });

  return;
}

/* ============================================================
   LEADERBOARD
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/leaderboard"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  const leaderboard = [...db.users]
    .filter(x => x.status === "active")
    .sort((a, b) =>
      Number(b.points || 0) -
      Number(a.points || 0)
    )
    .slice(0, 50)
    .map((item, index) => ({
      rank: index + 1,
      username: item.username,
      displayName: item.displayName || item.username,
      points: Number(item.points || 0)
    }));

  sendJSON(res, 200, {
    success: true,
    leaderboard
  });

  return;
}

/* ============================================================
   COMMUNITY
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/community"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  db.communityPosts ||= [];

  sendJSON(res, 200, {
    success: true,
    posts: db.communityPosts
      .slice()
      .reverse()
      .slice(0, 50)
  });

  return;
}

if (
  method === "POST" &&
  pathname === "/api/community"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const text = cleanString(body.text, 500);

  if (!text) {
    sendError(res, 400, "Community message required.");
    return;
  }

  db.communityPosts ||= [];

  const post = {
    id: uid("community_"),
    userId: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    text,
    createdAt: new Date().toISOString()
  };

  db.communityPosts.push(post);

  if (db.communityPosts.length > 500) {
    db.communityPosts =
      db.communityPosts.slice(-500);
  }

  saveDB(db);

  sendJSON(res, 201, {
    success: true,
    post
  });

  return;
}

/* ============================================================
   EXPERIMENT LAB
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/experiments"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  db.experiments ||= [];

  sendJSON(res, 200, {
    success: true,
    experiments:
      db.experiments
        .filter(x => x.userId === user.id)
        .reverse()
        .slice(0, 50)
  });

  return;
}

if (
  method === "POST" &&
  pathname === "/api/experiments"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const experiment = {
    id: uid("experiment_"),
    userId: user.id,
    name: cleanString(body.name, 120) || "New experiment",
    hookA: cleanString(body.hookA, 500),
    hookB: cleanString(body.hookB, 500),
    notes: cleanString(body.notes, 1000),
    createdAt: new Date().toISOString()
  };

  db.experiments ||= [];
  db.experiments.push(experiment);

  saveDB(db);

  sendJSON(res, 201, {
    success: true,
    experiment
  });

  return;
}

/* ============================================================
   HISTORY
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/history"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  const ledger =
    (db.pointsLedger || [])
      .filter(x => x.userId === user.id)
      .slice()
      .reverse()
      .slice(0, 100);

  const scores =
    (creatorAnalyticsFor(db, user.id).scores || [])
      .slice()
      .reverse()
      .slice(0, 50)
      .map(x => ({
        type: "content_score",
        amount: x.score,
        details: {
          rating: x.rating
        },
        createdAt: x.createdAt
      }));

  sendJSON(res, 200, {
    success: true,
    history: [
      ...ledger.map(x => ({
        type: x.type,
        amount: x.amount,
        details: x.details || {},
        createdAt: x.createdAt
      })),
      ...scores
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    )
  });

  return;
}

/* ============================================================
   SETTINGS
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/settings"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  db.userSettings ||= {};

  sendJSON(res, 200, {
    success: true,
    settings:
      db.userSettings[user.id] || {
        notifications: true,
        compactMode: false
      }
  });

  return;
}

if (
  method === "POST" &&
  pathname === "/api/settings"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  db.userSettings ||= {};

  db.userSettings[user.id] = {
    notifications: Boolean(body.notifications),
    compactMode: Boolean(body.compactMode)
  };

  saveDB(db);

  sendJSON(res, 200, {
    success: true,
    settings:
      db.userSettings[user.id]
  });

  return;
}

  // ----------------------------------------------------------
  /* ============================================================
   RIZORA VERIFICATION ROUTES
   Inserted immediately before STATIC FRONTEND
============================================================ */


/* ------------------------------------------------------------
   VERIFICATION — MY STATUS
------------------------------------------------------------ */

if (
  method === "GET" &&
  pathname === "/api/verification/me"
) {

  const user =
    getCurrentUser(
      db,
      req
    );

  if (!user) {
    sendError(
      res,
      401,
      "Authentication required."
    );
    return;
  }

  db.verificationRequests ||= [];

  const username =
    normalizeUsername(
      user.username
    );

  const isSuperAdmin =
    user.role === "super_admin" &&
    isConfiguredSuperAdminUsername(username);

  if (isSuperAdmin) {

    user.verified = true;

    user.verificationStatus =
      "verified";

    user.verifiedAt =
      user.verifiedAt ||
      new Date().toISOString();

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        status: "verified",
        verified: true,
        request: null
      }
    );

    return;
  }

  const request =
    db.verificationRequests
      .slice()
      .reverse()
      .find(
        item =>
          item.userId ===
          user.id
      ) || null;

  let status =
    request?.status ||
    user.verificationStatus ||
    "not_submitted";

  if (
    user.verified === true
  ) {
    status = "verified";
  }

  sendJSON(
    res,
    200,
    {
      success: true,
      status,
      verified:
        status === "verified",
      request
    }
  );

  return;
}


/* ------------------------------------------------------------
   VERIFICATION — APPLY
------------------------------------------------------------ */

if (
  method === "POST" &&
  pathname === "/api/verification/apply"
) {

  const user =
    getCurrentUser(
      db,
      req
    );

  if (!user) {
    sendError(
      res,
      401,
      "Authentication required."
    );
    return;
  }

  db.verificationRequests ||= [];

  const username =
    normalizeUsername(
      user.username
    );

  if (
    user.role === "super_admin" &&
    isConfiguredSuperAdminUsername(username)
  ) {

    user.verified = true;

    user.verificationStatus =
      "verified";

    user.verifiedAt =
      user.verifiedAt ||
      new Date().toISOString();

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        status: "verified",
        message:
          "Super Admin verification is already active."
      }
    );

    return;
  }

  let body;

  try {

    body =
      await readBody(req);

  } catch (error) {

    sendError(
      res,
      400,
      error.message ||
      "Invalid request body."
    );

    return;
  }

  const reason =
    cleanString(
      body.reason || "",
      1500
    ).trim();

  const proofUrl =
    cleanString(
      body.proofUrl ||
      body.proof ||
      body.url ||
      "",
      500
    ).trim();

  if (
    reason.length < 10
  ) {

    sendError(
      res,
      400,
      "Please provide more information about your creator identity."
    );

    return;
  }

  if (!proofUrl) {

    sendError(
      res,
      400,
      "A public proof URL is required."
    );

    return;
  }

  try {

    const parsed =
      new URL(
        proofUrl
      );

    if (
      ![
        "http:",
        "https:"
      ].includes(
        parsed.protocol
      )
    ) {
      throw new Error();
    }

  } catch {

    sendError(
      res,
      400,
      "Proof URL must be a valid http or https URL."
    );

    return;
  }

  const pending =
    db.verificationRequests.find(
      item =>
        item.userId ===
        user.id &&
        item.status ===
        "pending"
    );

  if (pending) {

    sendJSON(
      res,
      409,
      {
        success: false,
        status: "pending",
        message:
          "Your verification request is already under review.",
        request: pending
      }
    );

    return;
  }

  if (
    user.verified === true ||
    user.verificationStatus ===
      "verified"
  ) {

    sendJSON(
      res,
      200,
      {
        success: true,
        status: "verified",
        message:
          "Your account is already verified."
      }
    );

    return;
  }

  const now =
    new Date().toISOString();

  const request = {
    id:
      "verification_" +
      Date.now().toString(36) +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 9),

    userId:
      user.id,

    username:
      user.username,

    displayName:
      user.displayName ||
      user.username,

    reason,

    proofUrl,

    status:
      "pending",

    createdAt:
      now,

    updatedAt:
      now,

    reviewedAt:
      null,

    reviewedBy:
      null
  };

  db.verificationRequests.push(
    request
  );

  user.verificationStatus =
    "pending";

  user.verified =
    false;

  user.updatedAt =
    now;

  saveDB(db);

  sendJSON(
    res,
    201,
    {
      success: true,
      status: "pending",
      message:
        "Verification request submitted successfully.",
      request
    }
  );

  return;
}


/* ------------------------------------------------------------
   VERIFICATION — PUBLIC USER STATUS
------------------------------------------------------------ */

if (
  method === "GET" &&
  pathname.startsWith(
    "/api/verification/user/"
  )
) {

  const username =
    decodeURIComponent(
      pathname.slice(
        "/api/verification/user/".length
      )
    ).trim();

  const target =
    db.users.find(
      item =>
        normalizeUsername(
          item.username
        ) ===
        normalizeUsername(
          username
        )
    );

  if (!target) {

    sendError(
      res,
      404,
      "User not found."
    );

    return;
  }

  const verified =
    target.verified === true ||
    target.verificationStatus ===
      "verified";

  sendJSON(
    res,
    200,
    {
      success: true,
      username:
        target.username,

      displayName:
        target.displayName ||
        target.username,

      verified,

      status:
        verified
          ? "verified"
          : "not_verified"
    }
  );

  return;
}


/* ------------------------------------------------------------
   SUPER ADMIN — VERIFICATION QUEUE
------------------------------------------------------------ */

if (
  method === "GET" &&
  pathname ===
    "/api/superadmin/verification/requests"
) {

  const admin =
    getCurrentUser(
      db,
      req
    );

  if (!admin) {

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;
  }

  const allowed =
    admin.role ===
      "super_admin" &&
    isConfiguredSuperAdminUsername(admin.username);

  if (!allowed) {

    sendError(
      res,
      403,
      "Super Admin access required."
    );

    return;
  }

  db.verificationRequests ||= [];

  const requests =
    db.verificationRequests
      .slice()
      .reverse()
      .map(
        item => {

          const target =
            db.users.find(
              user =>
                user.id ===
                item.userId
            );

          return {
            id:
              item.id,

            userId:
              item.userId,

            username:
              target?.username ||
              item.username,

            displayName:
              target?.displayName ||
              item.displayName,

            reason:
              item.reason,

            proofUrl:
              item.proofUrl,

            status:
              item.status,

            createdAt:
              item.createdAt,

            updatedAt:
              item.updatedAt,

            reviewedAt:
              item.reviewedAt,

            reviewedBy:
              item.reviewedBy
          };

        }
      );

  sendJSON(
    res,
    200,
    {
      success: true,
      requests
    }
  );

  return;
}


/* ------------------------------------------------------------
   SUPER ADMIN — VERIFICATION ACTION
------------------------------------------------------------ */

if (
  method === "POST" &&
  pathname ===
    "/api/superadmin/verification/action"
) {

  const admin =
    getCurrentUser(
      db,
      req
    );

  if (!admin) {

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;
  }

  const allowed =
    admin.role ===
      "super_admin" &&
    isConfiguredSuperAdminUsername(admin.username);

  if (!allowed) {

    sendError(
      res,
      403,
      "Super Admin access required."
    );

    return;
  }

  let body;

  try {

    body =
      await readBody(req);

  } catch (error) {

    sendError(
      res,
      400,
      error.message ||
      "Invalid request body."
    );

    return;
  }

  const requestId =
    cleanString(
      body.requestId || "",
      200
    ).trim();

  const action =
    cleanString(
      body.action || "",
      40
    ).toLowerCase()
     .trim();

  if (!requestId) {

    sendError(
      res,
      400,
      "Verification request ID is required."
    );

    return;
  }

  if (
    ![
      "approve",
      "verify",
      "reject",
      "revoke"
    ].includes(action)
  ) {

    sendError(
      res,
      400,
      "Invalid verification action."
    );

    return;
  }

  db.verificationRequests ||= [];

  const request =
    db.verificationRequests.find(
      item =>
        item.id ===
        requestId
    );

  if (!request) {

    sendError(
      res,
      404,
      "Verification request not found."
    );

    return;
  }

  const target =
    db.users.find(
      user =>
        user.id ===
        request.userId
    );

  if (!target) {

    sendError(
      res,
      404,
      "Verification user not found."
    );

    return;
  }

  const now =
    new Date().toISOString();

  if (
    action === "approve" ||
    action === "verify"
  ) {

    request.status =
      "verified";

    target.verified =
      true;

    target.verificationStatus =
      "verified";

    target.verifiedAt =
      now;

  } else if (
    action === "reject"
  ) {

    request.status =
      "rejected";

    target.verified =
      false;

    target.verificationStatus =
      "rejected";

  } else {

    request.status =
      "revoked";

    target.verified =
      false;

    target.verificationStatus =
      "revoked";

  }

  request.updatedAt =
    now;

  request.reviewedAt =
    now;

  request.reviewedBy =
    admin.username;

  target.updatedAt =
    now;

  db.notifications ||= [];
  db.notifications.unshift({
    id:uid("notif_"),
    userId:target.id,
    title:(action === "approve" || action === "verify") ? "RIZORA verification approved" : "RIZORA verification update",
    message:(action === "approve" || action === "verify") ? "Your creator account is now RIZORA Verified." : "Your verification request is now "+String(action||"updated")+".",
    type:"verification",
    read:false,
    createdAt:now
  });

  const verificationEmailDelivery =
    queueRizoraVerificationEmail(db,target,action,request.reviewNote || request.reason || "",req);

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success: true,

      action,

      message:
        action === "approve" ||
        action === "verify"
          ? "Account verified successfully."
          : action === "reject"
            ? "Verification request rejected."
            : "Verification revoked.",
      emailDelivery: {
        status: verificationEmailDelivery.status,
        queued: verificationEmailDelivery.queued,
        configured: verificationEmailDelivery.configured
      }
    }
  );

  return;
}

/* ============================================================
   RIZORA SOCIAL ROUTES V2
   ============================================================ */

if(
  method === "GET" &&
  pathname === "/api/social/tasks"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const tasks =
    db.socialTasks
      .filter(
        task =>
          task.status === "active" &&
          (
            task.creatorId !== user.id ||
            task.sponsored
          )
      )
      .map(
        task => {

          const cooldown =
            task.sponsored
              ? rzSocialCooldown(
                  db,
                  user.id,
                  task.id
                )
              : 0;

          return {

            ...task,

            completed:
              task.sponsored
                ? cooldown > 0
                : db.socialCompletions.some(
                    item =>
                      item.userId === user.id &&
                      item.taskId === task.id
                  ),

            cooldownMs:
              cooldown

          };

        }
      );

  sendJSON(
    res,
    200,
    {
      success:true,
      tasks
    }
  );

  return;

}

if(
  method === "GET" &&
  pathname === "/api/social/overview"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const completed =
    db.socialCompletions.filter(
      item =>
        item.userId === user.id
    );

  const campaigns =
    db.socialTasks.filter(
      task =>
        task.creatorId === user.id
    );

  const earned =
    completed.reduce(
      (
        total,
        item
      ) =>
        total +
        rzSocialNumber(
          item.reward,
          0
        ),
      0
    );

  sendJSON(
    res,
    200,
    {
      success:true,

      points:
        rzSocialNumber(
          user.points,
          0
        ),

      completed:
        completed.length,

      earned,

      campaigns:
        campaigns.length
    }
  );

  return;

}

if(
  method === "GET" &&
  pathname === "/api/social/mine"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const campaigns =
    db.socialTasks
      .filter(
        task =>
          task.creatorId === user.id
      )
      .sort(
        (a,b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

  sendJSON(
    res,
    200,
    {
      success:true,
      campaigns
    }
  );

  return;

}

if(
  method === "POST" &&
  pathname === "/api/social/tasks/create"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  let body;

  try{

    body =
      await readBody(req);

  }catch(error){

    sendError(
      res,
      400,
      error.message
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const platform =
    cleanString(
      body.platform,
      30
    ).toLowerCase();

  const action =
    cleanString(
      body.action,
      30
    ).toLowerCase();

  const url =
    cleanString(
      body.url,
      1000
    );

  const title =
    cleanString(
      body.title,
      160
    ) ||
    "Creator growth campaign";

  const description =
    cleanString(
      body.description,
      1000
    );

  const reward =
    Math.floor(
      rzSocialNumber(
        body.reward,
        0
      )
    );

  const quantity =
    Math.floor(
      rzSocialNumber(
        body.quantity,
        0
      )
    );

  if(
    !RIZORA_SOCIAL_PLATFORMS.has(
      platform
    )
  ){

    sendError(
      res,
      400,
      "Unsupported social platform."
    );

    return;

  }

  if(
    !RIZORA_SOCIAL_ACTIONS.has(
      action
    )
  ){

    sendError(
      res,
      400,
      "Unsupported social action."
    );

    return;

  }

  if(
    !rzSocialValidURL(url)
  ){

    sendError(
      res,
      400,
      "Enter a valid social URL."
    );

    return;

  }

  if(
    reward <
      RIZORA_SOCIAL_MIN_REWARD ||
    reward >
      RIZORA_SOCIAL_MAX_REWARD
  ){

    sendError(
      res,
      400,
      "Reward must be between 5 and 100 points."
    );

    return;

  }

  if(
    quantity < 1 ||
    quantity >
      RIZORA_SOCIAL_MAX_QUANTITY
  ){

    sendError(
      res,
      400,
      "Quantity must be between 1 and 500."
    );

    return;

  }

  const budget =
    reward * quantity;

  const points =
    rzSocialNumber(
      user.points,
      0
    );

  if(points < budget){

    sendError(
      res,
      400,
      `You need ${budget} points to fund this campaign.`
    );

    return;

  }

  user.points =
    points -
    budget;

  const task = {

    id:
      uid("social_"),

    title,

    description,

    platform,

    action,

    url,

    reward,

    quantity,

    completedCount:0,

    fundedRemaining:
      budget,

    creatorId:
      user.id,

    sponsored:false,

    status:
      "active",

    createdAt:
      new Date().toISOString()

  };

  db.socialTasks.push(
    task
  );

  saveDB(db);

  sendJSON(
    res,
    201,
    {
      success:true,
      task,
      points:
        rzSocialNumber(
          user.points,
          0
        )
    }
  );

  return;

}

if(
  method === "POST" &&
  pathname === "/api/social/tasks/complete"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  let body;

  try{

    body =
      await readBody(req);

  }catch(error){

    sendError(
      res,
      400,
      error.message
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const taskId =
    cleanString(
      body.taskId ||
      body.id,
      120
    );

  const task =
    db.socialTasks.find(
      item =>
        item.id === taskId &&
        item.status === "active"
    );

  if(!task){

    sendError(
      res,
      404,
      "Social task not found."
    );

    return;

  }

  if(
    task.creatorId === user.id &&
    !task.sponsored
  ){

    sendError(
      res,
      400,
      "You cannot complete your own campaign."
    );

    return;

  }

  const previous =
    db.socialCompletions.find(
      item =>
        item.userId === user.id &&
        item.taskId === task.id
    );

  if(
    task.sponsored
  ){

    const cooldown =
      rzSocialCooldown(
        db,
        user.id,
        task.id
      );

    if(cooldown > 0){

      sendError(
        res,
        429,
        "This mission is on cooldown. Come back later."
      );

      return;

    }

  }else{

    if(previous){

      sendError(
        res,
        409,
        "You already completed this campaign."
      );

      return;

    }

  }

  const reward =
    Math.max(
      5,
      Math.floor(
        rzSocialNumber(
          task.reward,
          0
        )
      )
    );

  if(
    !task.sponsored &&
    rzSocialNumber(
      task.fundedRemaining,
      0
    ) < reward
  ){

    sendError(
      res,
      409,
      "This campaign has no funded rewards remaining."
    );

    return;

  }

  const completion = {

    id:
      uid("social_completion_"),

    taskId:
      task.id,

    userId:
      user.id,

    creatorId:
      task.creatorId || null,

    reward,

    createdAt:
      new Date().toISOString()

  };

  db.socialCompletions.push(
    completion
  );

  user.points =
    rzSocialNumber(
      user.points,
      0
    ) +
    reward;

  task.completedCount =
    rzSocialNumber(
      task.completedCount,
      0
    ) +
    1;

  if(!task.sponsored){

    task.fundedRemaining =
      Math.max(
        0,
        rzSocialNumber(
          task.fundedRemaining,
          0
        ) -
        reward
      );

    if(
      task.fundedRemaining <= 0
    ){

      task.status =
        "completed";

    }

    if(task.creatorId){

      rzSocialNotify(
        db,
        task.creatorId,
        "Campaign completed",
        `${user.displayName || user.username || "A creator"} completed "${task.title}" and earned ${reward} points.`
      );

    }

  }

  if(
    typeof pushPointsLedger ===
    "function"
  ){

    try{

      pushPointsLedger(
        db,
        user.id,
        "credit",
        reward,
        "social_task",
        {
          taskId:
            task.id
        }
      );

    }catch(_){}

  }

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success:true,

      reward,

      points:
        rzSocialNumber(
          user.points,
          0
        ),

      user: safeUser(user),

      completion
    }
  );

  return;

}

if(
  method === "POST" &&
  pathname === "/api/social/tasks/cancel"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  let body;

  try{

    body =
      await readBody(req);

  }catch(error){

    sendError(
      res,
      400,
      error.message
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const task =
    db.socialTasks.find(
      item =>
        item.id ===
        cleanString(
          body.taskId ||
          body.id,
          120
        )
    );

  if(!task){

    sendError(
      res,
      404,
      "Campaign not found."
    );

    return;

  }

  if(
    task.creatorId !==
    user.id
  ){

    sendError(
      res,
      403,
      "You cannot cancel this campaign."
    );

    return;

  }

  if(
    task.status !==
    "active"
  ){

    sendError(
      res,
      400,
      "This campaign is already closed."
    );

    return;

  }

  const refund =
    Math.max(
      0,
      rzSocialNumber(
        task.fundedRemaining,
        0
      )
    );

  user.points =
    rzSocialNumber(
      user.points,
      0
    ) +
    refund;

  task.status =
    "cancelled";

  task.fundedRemaining =
    0;

  if(
    typeof pushPointsLedger ===
    "function"
  ){

    try{

      pushPointsLedger(
        db,
        user.id,
        "credit",
        refund,
        "social_campaign_refund",
        {
          taskId:
            task.id
        }
      );

    }catch(_){}

  }

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success:true,
      refund,

      points:
        rzSocialNumber(
          user.points,
          0
        ),

      user
    }
  );

  return;

}

if(
  method === "GET" &&
  pathname === "/api/notifications"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const notifications =
    db.notifications
      .filter(
        item =>
          item.userId === user.id
      )
      .sort(
        (a,b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
      .slice(0,100);

  sendJSON(
    res,
    200,
    {
      success:true,
      notifications
    }
  );

  return;

}

if(
  method === "POST" &&
  pathname === "/api/notifications/read"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  ensureRizoraSocialDB(db);

  for(
    const notification
    of db.notifications
  ){

    if(
      notification.userId ===
      user.id
    ){

      notification.read =
        true;

    }

  }

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success:true
    }
  );

  return;

}

/* ============================================================
   OFFICIAL VERIFIED PROFILES
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/official/profiles"
) {

  const officialDb =
    loadDB();

  officialDb.officialProfiles ||=
    [];

  sendJSON(
    res,
    200,
    {
      success: true,
      profiles:
        officialDb
          .officialProfiles
          .filter(
            profile =>
              profile &&
              profile.verified === true
          )
          .map(profile => ({
            ...profile
          }))
    }
  );

  return;
}


/* ============================================================
   PUBLIC CREATOR PROFILE
============================================================ */

if (
  method === "GET" &&
  pathname.startsWith("/api/public/creator/")
) {

  const username =
    decodeURIComponent(
      pathname.slice(
        "/api/public/creator/".length
      )
    ).replace(/^@/, "").trim();

  const creator =
    db.users.find(
      user =>
        normalizeUsername(user.username) === normalizeUsername(username) ||
        normalizeUsername(user.publicUsername) === normalizeUsername(username)
    );

  if (!creator) {
    sendError(res, 404, "Creator not found.");
    return;
  }

  const profile =
    creatorProfileFor(
      db,
      creator.id
    );

  sendJSON(
    res,
    200,
    {
      success:true,
      creator:{
        id:creator.id,
        username:creator.username,
        publicUsername:creator.publicUsername,
        displayName:creator.displayName,
        verified:
          creator.verified === true ||
          creator.verificationStatus === "verified",
        points:Number(creator.points || 0),
        profile
      }
    }
  );

  return;
}


// STATIC FRONTEND
  // ----------------------------------------------------------

  serveStatic(
    req,
    res,
    pathname
  );
}


// ============================================================
// GLOBAL ERROR HANDLING
// ============================================================

async function requestHandler(
  req,
  res
) {

  // ============================================================
  // RIZORA CORS COMPATIBILITY
  // ============================================================

  const RIZORA_ALLOWED_ORIGINS = new Set([
    "https://rizora.com.ng",
    "https://www.rizora.com.ng",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ]);

  const rizoraOrigin = req.headers.origin;

  if (
    rizoraOrigin &&
    RIZORA_ALLOWED_ORIGINS.has(rizoraOrigin)
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      rizoraOrigin
    );

    res.setHeader(
      "Access-Control-Allow-Credentials",
      "true"
    );
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-CSRF-Token"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  res.setHeader(
    "Vary",
    "Origin"
  );

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!res.headersSent) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  }
  try {

    await handleRequest(
      req,
      res
    );

  } catch (error) {

    console.error(
      "Request error:",
      error
    );

    if (!res.headersSent) {

      sendError(
        res,
        500,
        "Internal server error."
      );

    } else {

      res.end();

    }
  }
}


// ============================================================
// INITIAL SEEDING
// ============================================================

/* ============================================================
   RIZORA OFFICIAL VERIFIED IDENTITIES V1
============================================================ */

function seedRizoraOfficialIdentities(db) {

  db.officialProfiles ||= [];

  let romiUser =
    db.users.find(
      user =>
        normalizeUsername(user.username) === "romi" ||
        normalizeUsername(user.publicUsername) === "romi.noir"
    );

  if (!romiUser) {
    romiUser = {
      id: uid("usr_"),
      username: "romi",
      publicUsername: "romi.noir",
      displayName: "RoMi",
      email: normalizeEmail(process.env.RIZORA_SUPER_ADMIN_EMAIL || "romi@rizora.com.ng"),
      socialHandle: "romi.noir",
      passwordHash: "",
      passwordSetupRequired: true,
      role: "super_admin",
      status: "active",
      points: 0,
      referralCode: randomReferralCode("romi"),
      referredBy: null,
      referralCount: 0,
      verified: true,
      verificationStatus: "verified",
      verificationType: "official_creator",
      official: true,
      accountType: "creator",
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      avatarUrl: "/rizora-cover.png"
    };
    db.users.push(romiUser);
  }

  if (romiUser) {

    romiUser.displayName =
      romiUser.displayName ||
      "RoMi";

    romiUser.publicUsername =
      "romi.noir";

    romiUser.socialHandle =
      "romi.noir";

    romiUser.verified = true;

    romiUser.verificationStatus =
      "verified";

    romiUser.verificationType =
      "official_creator";

    romiUser.official = true;

    romiUser.accountType =
      "creator";

    romiUser.avatarUrl =
      romiUser.avatarUrl ||
      "/rizora-cover.png";
  }

  const profiles = [
    {
      id: "official_rizora",
      username: "rizora",
      displayName: "RIZORA",
      publicUsername: "rizora",
      bio:
        "Creator growth. Content. Community. AI. Built for creators.",
      avatarUrl: "/rizora-cover.png",
      verified: true,
      verificationStatus: "verified",
      verificationType: "official_platform",
      official: true,
      accountType: "platform",
      verifiedBadgeUrl: "/assets/rizora_verified_badge.svg",
      links: {
        website: "https://rizora.com.ng/",
        tiktok:
          "https://www.tiktok.com/@official_rizora.hq",
        instagram:
          "https://www.instagram.com/rizora.hq",
        x:
          "https://x.com/Rizora_hq"
      }
    },
    {
      id: "official_romi",
      username: "romi.noir",
      displayName: "RoMi",
      publicUsername: "romi.noir",
      bio:
        "Artist. Developer. Creator. Builder. Creator of RIZORA.",
      avatarUrl: "/rizora-cover.png",
      verified: true,
      verificationStatus: "verified",
      verificationType: "official_creator",
      official: true,
      accountType: "creator",
      verifiedBadgeUrl: "/assets/rizora_verified_badge.svg",
      links: {
        tiktok:
          "https://www.tiktok.com/@romi.noir",
        website:
          "https://rizora.com.ng/"
      },
      userId:
        romiUser
          ? romiUser.id
          : null
    }
  ];

  for (const profile of profiles) {

    const existing =
      db.officialProfiles.find(
        item =>
          item.id === profile.id
      );

    if (existing) {
      Object.assign(
        existing,
        profile
      );
    } else {
      db.officialProfiles.push({
        ...profile,
        createdAt:
          new Date().toISOString(),
        updatedAt:
          new Date().toISOString()
      });
    }
  }

  return db;
}

/* ============================================================
   RIZORA GROQ RESILIENT COMPLETION V1
============================================================ */

async function rizoraGroqCompletion(options) {

  const apiKey =
    String(options.apiKey || "").trim();

  const primaryModel =
    String(
      options.model ||
      "openai/gpt-oss-120b"
    ).trim();

  const messages =
    Array.isArray(options.messages)
      ? options.messages
      : [];

  async function request(modelName) {

    return fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.7,
          reasoning_effort: "low",
          include_reasoning: false,
          max_completion_tokens: 1200
        })
      }
    );
  }

  let response =
    await request(primaryModel);

  if (
    [500, 502, 503].includes(
      response.status
    ) &&
    primaryModel !==
      "openai/gpt-oss-20b"
  ) {

    console.warn(
      "RIZORA AI primary model unavailable. Falling back to openai/gpt-oss-20b."
    );

    try {
      await response.text();
    } catch (_) {}

    response =
      await request(
        "openai/gpt-oss-20b"
      );
  }

  return response;
}

/* ============================================================
   OFFICIAL PROFILE API
============================================================ */
function seedDatabase() {
  const db = loadDB();

  seedTasks(db);
  seedRizoraOfficialIdentities(db);
  ensureOfficialPlatformAccount(db);

  const configuredSuperAdminsChanged =
    ensureConfiguredSuperAdminAccounts(db);

  // Re-sync verified identity profiles after account seeding so the
  // official RoMi profile is linked on the first boot too.
  seedRizoraOfficialIdentities(db);

  let changed = configuredSuperAdminsChanged;

  for (
    const username of
    SUPER_ADMINS
  ) {

    let user =
      db.users.find(
        (item) =>
          normalizeUsername(
            item.username
          ) === username
      );

    if (!user) {

      console.log(
        `Super admin account "${username}" does not exist yet.`
      );

      continue;
    }

    if (
      user.role !==
      "super_admin"
    ) {
      user.role =
        "super_admin";

      changed = true;
    }

    if (
      user.status !==
      "active"
    ) {
      user.status =
        "active";

      changed = true;
    }

    if (
      user.plan !==
      "premium_plus"
    ) {
      user.plan =
        "premium_plus";

      changed = true;
    }

    if (
      user.verified !== true ||
      user.verificationStatus !== "verified"
    ) {
      user.verified = true;
      user.verificationStatus = "verified";

      changed = true;
    }

    if (!user.referralCode) {

      user.referralCode =
        randomReferralCode(
          user.username
        );

      changed = true;
    }
  }

  cleanupSessions(db);

  if (changed) {
    saveDB(db);
  } else {
    saveDB(db);
  }
}


// ============================================================
// START SERVER
// ============================================================

ensureDatabase();
seedDatabase();

/* ============================================================
   RIZORA SOCIAL ENGINE V2
   ============================================================ */

const RIZORA_SOCIAL_COOLDOWN_MS =
  7 * 60 * 1000;

const RIZORA_SOCIAL_MIN_REWARD =
  5;

const RIZORA_SOCIAL_MAX_REWARD =
  100;

const RIZORA_SOCIAL_MAX_QUANTITY =
  500;

const RIZORA_SOCIAL_PLATFORMS =
  new Set([
    "tiktok",
    "instagram",
    "x",
    "youtube",
    "facebook",
    "website"
  ]);

const RIZORA_SOCIAL_ACTIONS =
  new Set([
    "follow",
    "like",
    "share",
    "comment",
    "subscribe",
    "visit"
  ]);

function ensureRizoraSocialDB(db){

  db.socialTasks ||= [];
  db.socialCompletions ||= [];
  db.notifications ||= [];

  const official = [
    {
      id:"rz_official_tiktok",

      title:
        "Follow @official_rizora.hq on TikTok",

      description:
        "Follow the official RIZORA TikTok account.",

      platform:"tiktok",

      action:"follow",

      url:
        "https://www.tiktok.com/@official_rizora.hq",

      reward:100,

      sponsored:true
    },

    {
      id:"rz_official_instagram",

      title:
        "Follow @rizora.hq on Instagram",

      description:
        "Follow the official RIZORA Instagram account.",

      platform:"instagram",

      action:"follow",

      url:
        "https://www.instagram.com/rizora.hq",

      reward:75,

      sponsored:true
    },

    {
      id:"rz_official_x",

      title:
        "Follow @Rizora_hq on X",

      description:
        "Follow the official RIZORA X account.",

      platform:"x",

      action:"follow",

      url:
        "https://x.com/Rizora_hq",

      reward:75,

      sponsored:true
    },

    {
      id:"rz_romi_tiktok",

      title:
        "Follow @romi.noir on TikTok",

      description:
        "Follow RoMi's official TikTok account.",

      platform:"tiktok",

      action:"follow",

      url:
        "https://www.tiktok.com/@romi.noir",

      reward:75,

      sponsored:true
    }
  ];

  for(const task of official){
    const exists=db.socialTasks.find(item=>item.id===task.id);
    if(!exists){
      db.socialTasks.push({
        ...task,
        creatorId:null,
        quantity:null,
        completedCount:0,
        fundedRemaining:null,
        status:"active",
        createdAt:new Date().toISOString()
      });
    }else{
      Object.assign(exists,{
        title:task.title,
        description:task.description,
        platform:task.platform,
        action:task.action,
        url:task.url,
        reward:task.reward,
        sponsored:true,
        creatorId:null,
        quantity:null,
        fundedRemaining:null,
        status:exists.status==="completed" ? "active" : (exists.status||"active")
      });
    }
  }
  return db;
}

function rzSocialNumber(
  value,
  fallback
){

  const n =
    Number(value);

  if(
    Number.isFinite(n)
  ){
    return n;
  }

  return fallback || 0;
}

function rzSocialValidURL(
  value
){

  try{

    const parsed =
      new URL(
        String(value || "").trim()
      );

    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
    );

  }catch{

    return false;

  }

}

function rzSocialCooldown(
  db,
  userId,
  taskId
){

  const latest =
    db.socialCompletions
      .filter(
        item =>
          item.userId === userId &&
          item.taskId === taskId
      )
      .sort(
        (a,b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )[0];

  if(!latest){

    return 0;

  }

  const next =
    new Date(
      latest.createdAt
    ).getTime() +
    RIZORA_SOCIAL_COOLDOWN_MS;

  return Math.max(
    0,
    next - Date.now()
  );

}

function rzSocialNotify(
  db,
  userId,
  title,
  message
){

  db.notifications.push({

    id:
      uid("notif_"),

    userId,

    title,

    message,

    type:
      "social",

    read:false,

    createdAt:
      new Date().toISOString()

  });

}

let RIZORA_SCHEDULE_PUBLISHER = null;

const server =
  http.createServer(
    requestHandler
  );

server.on(
  "error",
  (error) => {
    console.error(
      "Server error:",
      error
    );
  }
);

async function startRizoraServer() {
  await initializePersistentDatabase();

  RIZORA_SCHEDULE_PUBLISHER = setInterval(() => {
    try {
      const scheduledDb = loadDB();
      publishDueSchedules(scheduledDb, { saveDB, cleanString, uid });
    } catch (error) {
      console.error("RIZORA scheduler error:", error);
    }
  }, 30000);

  server.listen(
    PORT,
    HOST,
    () => {
      console.log("");
      console.log(
        "=========================================="
      );
      console.log(
        "           RIZORA BACKEND"
      );
      console.log(
        "=========================================="
      );
      console.log(
        "Version:  8.1.0"
      );
      console.log(
        `Server:   http://${HOST}:${PORT}`
      );
      console.log(
        `DB:       ${DATABASE_URL ? "Render PostgreSQL" : DB_FILE}`
      );
      console.log(
        "Status:   ONLINE"
      );
      console.log(
        "=========================================="
      );
      console.log("");
    }
  );
}

startRizoraServer().catch(function(error) {
  console.error("RIZORA startup failed:", error);
  process.exitCode = 1;
});


// ============================================================
// SHUTDOWN
// ============================================================

function shutdown(signal) {

  console.log(
    `\n${signal} received. Shutting down...`
  );

  if (RIZORA_SCHEDULE_PUBLISHER) {
    clearInterval(RIZORA_SCHEDULE_PUBLISHER);
  }

  Promise.resolve()
    .then(flushDBPersistence)
    .finally(function() {
      return postgresPool ? postgresPool.end() : null;
    })
    .finally(function() {
      server.close(
        () => {
          console.log(
            "RIZORA server stopped."
          );
          process.exit(0);
        }
      );
    });

  setTimeout(
    () => {
      process.exit(1);
    },
    5000
  );
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught exception:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "Unhandled rejection:",
      error
    );
  }
);
























































































































































