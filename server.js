const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

/*
  IMPORTANT:
  Use the current working directory first because Vercel can
  execute the server from a different runtime directory.
*/
const ROOT = process.cwd();
const SERVER_ROOT = __dirname;
const STATIC_ROOT = __dirname;

/* =========================================================
   RESPONSE HELPERS
   ========================================================= */

function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });

  res.end(body);
}

function sendText(
  res,
  statusCode,
  text,
  type = "text/plain"
) {
  res.writeHead(statusCode, {
    "Content-Type": `${type}; charset=utf-8`,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });

  res.end(text);
}

/* =========================================================
   REQUEST BODY
   ========================================================= */

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 3 * 1024 * 1024) {
        reject(new Error("Request too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body.trim()) {
        return resolve({});
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });

    req.on("error", reject);
  });
}

/* =========================================================
   UTILITY FUNCTIONS
   ========================================================= */

function clean(value, fallback = "") {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  return String(value)
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 3000);
}

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function unique(items) {
  return [...new Set(items)];
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "your",
  "you",
  "are",
  "was",
  "have",
  "has",
  "just",
  "into",
  "about",
  "what",
  "when",
  "where",
  "how",
  "why",
  "can",
  "will",
  "they",
  "them",
  "then",
  "than",
  "too",
  "very",
  "its",
  "it's",
  "but",
  "not",
  "all",
  "post",
  "video",
  "content"
]);

function keywords(text) {
  return clean(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(word => word.length >= 3)
    .filter(word => !STOP_WORDS.has(word));
}

/* =========================================================
   POST ANALYZER
   ========================================================= */

function analyzePost(data) {
  const hook = clean(data.hook);
  const caption = clean(data.caption);
  const hashtags = clean(data.hashtags);

  const hashtagList =
    hashtags
      .split(/[\s,]+/)
      .filter(Boolean);

  let hookScore = 35;
  let captionScore = 35;
  let hashtagScore = 35;
  let clarityScore = 35;
  let engagementScore = 35;

  const strengths = [];
  const improvements = [];

  if (hook.length >= 15) {
    hookScore += 15;
  }

  if (
    hook.length <= 90 &&
    hook.length > 0
  ) {
    hookScore += 8;
  }

  if (/[?!]/.test(hook)) {
    hookScore += 8;
  }

  if (
    /\b(secret|truth|mistake|why|how|before|after|nobody|stop|wait|pov)\b/i.test(
      hook
    )
  ) {
    hookScore += 14;
  }

  if (caption.length >= 20) {
    captionScore += 15;
  }

  if (caption.length >= 60) {
    captionScore += 8;
  }

  if (hashtagList.length >= 3) {
    hashtagScore += 15;
  }

  if (
    hashtagList.length >= 5 &&
    hashtagList.length <= 8
  ) {
    hashtagScore += 10;
  }

  if (hashtagList.length > 8) {
    hashtagScore -= 15;
  }

  if (hook && caption) {
    clarityScore += 20;
  }

  if (
    /\b(comment|follow|save|share|tell me|what do you think)\b/i.test(
      `${hook} ${caption}`
    )
  ) {
    engagementScore += 30;
  }

  if (hookScore >= 65) {
    strengths.push(
      "The opening has a usable attention trigger."
    );
  } else {
    improvements.push(
      "Make the first sentence more curiosity-driven."
    );
  }

  if (captionScore >= 60) {
    strengths.push(
      "The caption gives viewers useful context."
    );
  } else {
    improvements.push(
      "Give the caption a clearer reason to keep reading."
    );
  }

  if (hashtagScore >= 65) {
    strengths.push(
      "The hashtag mix is reasonably focused."
    );
  } else {
    improvements.push(
      "Use a smaller mix of relevant niche and broad hashtags."
    );
  }

  if (clarityScore >= 65) {
    strengths.push(
      "The message is easy to understand quickly."
    );
  } else {
    improvements.push(
      "Make the message simpler and easier to scan."
    );
  }

  if (engagementScore < 65) {
    improvements.push(
      "Add a simple question or clear interaction prompt."
    );
  } else {
    strengths.push(
      "There is a clear interaction opportunity."
    );
  }

  hookScore = clamp(hookScore, 0, 100);
  captionScore = clamp(captionScore, 0, 100);
  hashtagScore = clamp(hashtagScore, 0, 100);
  clarityScore = clamp(clarityScore, 0, 100);
  engagementScore = clamp(engagementScore, 0, 100);

  const score = clamp(
    Math.round(
      hookScore * 0.30 +
      captionScore * 0.20 +
      hashtagScore * 0.15 +
      clarityScore * 0.15 +
      engagementScore * 0.20
    ),
    0,
    100
  );

  let rating = "Needs Work";

  if (score >= 90) {
    rating = "Elite";
  } else if (score >= 80) {
    rating = "Strong";
  } else if (score >= 70) {
    rating = "Promising";
  } else if (score >= 60) {
    rating = "Needs polish";
  }

  return {
    score,
    rating,

    strengths: unique(strengths),

    improvements: unique(improvements),

    feedback:
      score >= 85
        ? "Strong setup. Focus on delivery and retention."
        : score >= 70
          ? "Good foundation. Sharpen one or two creative elements."
          : "The idea can work, but the packaging needs more strength.",

    componentScores: {
      hook: hookScore,
      caption: captionScore,
      hashtags: hashtagScore,
      clarity: clarityScore,
      engagement: engagementScore
    },

    breakdown: {
      hook: hookScore,
      caption: captionScore,
      hashtags: hashtagScore,
      clarity: clarityScore,
      engagement: engagementScore
    }
  };
}

/* =========================================================
   HOOK GENERATOR
   ========================================================= */

function generateHooks(data) {
  const topic = clean(
    data.topic,
    "this topic"
  );

  const category = clean(
    data.category,
    "General"
  );

  const hooks = [
    `Nobody talks about this side of ${topic}.`,
    `You need to see this before you try ${topic}.`,
    `The truth about ${topic} that people skip.`,
    `Wait... you're still doing ${topic} like this?`,
    `I tried ${topic} so you don't have to.`,
    `One thing I wish I knew before ${topic}.`,
    `${topic}: expectation vs reality.`,
    `POV: you finally figured out ${topic}.`
  ];

  if (/music/i.test(category)) {
    hooks.push(
      "Wait for the switch...",
      "This part hits completely different."
    );
  }

  if (/gaming/i.test(category)) {
    hooks.push(
      "Gamers will understand this immediately.",
      `If you play ${topic}, watch this first.`
    );
  }

  return {
    hooks: hooks.slice(0, 10),
    items: hooks.slice(0, 10)
  };
}

/* =========================================================
   HASHTAG GENERATOR
   ========================================================= */

function generateHashtags(data) {
  const topic = clean(
    data.topic,
    "content"
  );

  const category = clean(
    data.category,
    "general"
  ).toLowerCase();

  const topicWords =
    keywords(topic)
      .slice(0, 3)
      .map(word => `#${word}`);

  const categoryTags = {
    music: [
      "#afrobeats",
      "#musictok",
      "#newmusic",
      "#music",
      "#artistsoftiktok"
    ],

    fashion: [
      "#fashiontok",
      "#styleinspo",
      "#outfitideas",
      "#streetstyle",
      "#fashion"
    ],

    gaming: [
      "#gaming",
      "#gamertok",
      "#gamingcommunity",
      "#gamer",
      "#gamingclips"
    ],

    lifestyle: [
      "#lifestyle",
      "#lifestyletok",
      "#dailyvlog",
      "#creator",
      "#contentcreator"
    ],

    comedy: [
      "#comedy",
      "#comedytok",
      "#funny",
      "#skit",
      "#naijacomedy"
    ]
  };

  const fallback = [
    "#fyp",
    "#foryou",
    "#viral",
    "#tiktok",
    "#creator"
  ];

  const hashtags = unique([
    ...topicWords,
    ...(categoryTags[category] || fallback)
  ]).slice(0, 8);

  return {
    hashtags,
    items: hashtags
  };
}

/* =========================================================
   CAPTION GENERATOR
   ========================================================= */

function generateCaptions(data) {
  const topic = clean(
    data.topic,
    "this"
  );

  const vibe = clean(
    data.vibe,
    "confident"
  ).toLowerCase();

  let captions = [
    `${topic}. That's the post.`,
    "Had to let this one breathe.",
    "This one felt different.",
    "No long talk. The content says enough.",
    "POV: you finally stopped overthinking it.",
    "Just doing my thing and letting the result speak.",
    "One thing about me: I'm going to try it anyway.",
    "Say less."
  ];

  if (vibe.includes("funny")) {
    captions.push(
      "I had a plan. It clearly did not survive ðŸ˜‚.",
      "Please pretend this was intentional."
    );
  }

  if (vibe.includes("aesthetic")) {
    captions.push(
      "Quiet energy. Loud results.",
      "Just a little moment worth keeping."
    );
  }

  if (vibe.includes("gen")) {
    captions.push(
      "No yap, just vibes.",
      "Lowkey cooked with this one."
    );
  }

  return {
    captions: captions.slice(0, 10),
    items: captions.slice(0, 10)
  };
}

/* =========================================================
   IDEA GENERATOR
   ========================================================= */

function generateIdeas(data) {
  const niche = clean(
    data.niche,
    "content"
  );

  const ideas = [
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

  return {
    ideas,
    items: ideas
  };
}

/* =========================================================
   BOOST ENGINE
   ========================================================= */

function boostContent(data) {
  const topic = clean(
    data.topic,
    "your content"
  );

  const category = clean(
    data.category,
    "general"
  );

  const format = clean(
    data.format || data.length,
    "Short video"
  );

  const goal = clean(
    data.goal,
    "reach"
  );

  const analysis = analyzePost({
    hook: data.hook,
    caption: data.caption,
    hashtags: data.hashtags
  });

  const topicBonus =
    keywords(topic).length >= 2
      ? 5
      : 2;

  const score = clamp(
    analysis.score +
    topicBonus +
    3 +
    2,
    0,
    100
  );

  const optimizedHook =
    clean(data.hook) ||
    `You need to see this before you try ${topic}.`;

  const optimizedCaption =
    clean(data.caption) ||
    `${format} â€” what do you think?`;

  const hashtagResult =
    generateHashtags({
      topic,
      category
    });

  const topFixes = unique([
    ...analysis.improvements,
    "Keep the strongest visual or statement first.",
    "Give viewers a reason to stay until the payoff."
  ]).slice(0, 4);

  let verdict =
    "Needs stronger packaging";

  if (score >= 90) {
    verdict =
      "High-potential post";
  } else if (score >= 80) {
    verdict =
      "Strong growth setup";
  } else if (score >= 70) {
    verdict =
      "Promising â€” polish the packaging";
  }

  const postingPlan = [
    "Lead with the strongest visual or statement immediately.",
    "Avoid long introductions.",
    "Keep the caption easy to understand.",
    "Use relevant hashtags instead of stuffing tags.",
    "Reply to early comments naturally.",
    "Review performance after posting and test another variation."
  ].join(" ");

  return {
    score,
    verdict,

    componentScores: {
      hook: analysis.componentScores.hook,
      caption: analysis.componentScores.caption,
      hashtags: analysis.componentScores.hashtags,
      clarity: analysis.componentScores.clarity,
      engagement: analysis.componentScores.engagement
    },

    breakdown: {
      hook: analysis.componentScores.hook,
      caption: analysis.componentScores.caption,
      hashtags: analysis.componentScores.hashtags,
      clarity: analysis.componentScores.clarity,
      engagement: analysis.componentScores.engagement
    },

    strengths: analysis.strengths,
    improvements: analysis.improvements,
    topFixes,

    feedback: analysis.feedback,

    optimizedHook,
    optimizedCaption,

    hashtags: hashtagResult.hashtags,
    optimizedHashtags: hashtagResult.hashtags,

    cta:
      goal.toLowerCase().includes("engagement")
        ? "End with a specific question that invites an opinion."
        : "End with one natural question or action that gives viewers a reason to respond.",

    strategy: postingPlan,
    postingPlan,

    nextSteps: [
      "Test a stronger first-second hook.",
      "Keep the message clear.",
      "Review actual post performance after publishing."
    ],

    topic,
    category,
    format,
    goal
  };
}

/* =========================================================
   PERFORMANCE ANALYTICS
   ========================================================= */

function performanceAnalysis(data) {
  const views = Math.max(
    0,
    Number(data.views) || 0
  );

  const likes = Math.max(
    0,
    Number(data.likes) || 0
  );

  const comments = Math.max(
    0,
    Number(data.comments) || 0
  );

  const shares = Math.max(
    0,
    Number(data.shares) || 0
  );

  const saves = Math.max(
    0,
    Number(data.saves) || 0
  );

  const followers = Math.max(
    0,
    Number(data.followers) || 0
  );

  const engagements =
    likes +
    comments +
    shares +
    saves;

  const rate = value =>
    views > 0
      ? Number(
          (
            (value / views) *
            100
          ).toFixed(2)
        )
      : 0;

  const likeRate = rate(likes);
  const commentRate = rate(comments);
  const shareRate = rate(shares);
  const saveRate = rate(saves);
  const followerRate = rate(followers);
  const engagementRate = rate(engagements);

  let rating = "Weak";

  if (engagementRate >= 12) {
    rating = "Exceptional";
  } else if (engagementRate >= 8) {
    rating = "Strong";
  } else if (engagementRate >= 5) {
    rating = "Healthy";
  } else if (engagementRate >= 2) {
    rating = "Needs improvement";
  }

  const recommendations = [];

  if (shareRate < 1) {
    recommendations.push(
      "Create a more shareable moment or takeaway."
    );
  }

  if (commentRate < 0.5) {
    recommendations.push(
      "Use a simple question to invite comments."
    );
  }

  if (saveRate < 1) {
    recommendations.push(
      "Add something useful viewers would want to save."
    );
  }

  if (followerRate < 0.5) {
    recommendations.push(
      "Make your creator identity clearer so viewers have a reason to follow."
    );
  }

  if (!recommendations.length) {
    recommendations.push(
      "Your interaction mix is healthy. Focus on retention and consistency."
    );
  }

  return {
    views,
    likes,
    comments,
    shares,
    saves,
    followers,
    engagements,

    likeRate,
    commentRate,
    shareRate,
    saveRate,
    followerRate,
    engagementRate,

    rating,

    diagnosis:
      `${rating} performance with a ${engagementRate}% engagement rate.`,

    recommendations
  };
}

/* =========================================================
   A/B HOOK TESTER
   ========================================================= */

function scoreHook(hook) {
  const text = clean(hook);

  let score = 45;

  if (
    text.length >= 15 &&
    text.length <= 90
  ) {
    score += 15;
  }

  if (/[?!]/.test(text)) {
    score += 8;
  }

  if (
    /\b(secret|truth|mistake|why|how|before|after|nobody|stop|wait|pov)\b/i.test(
      text
    )
  ) {
    score += 15;
  }

  if (
    /\b(you|your)\b/i.test(text)
  ) {
    score += 7;
  }

  if (text.length > 120) {
    score -= 15;
  }

  return clamp(
    score,
    0,
    100
  );
}

function abTest(data) {
  const scoreA =
    scoreHook(data.hookA);

  const scoreB =
    scoreHook(data.hookB);

  let recommendation =
    "Test both";

  let reason =
    "The hooks are closely matched. A real audience test will provide the stronger signal.";

  if (scoreA > scoreB) {
    recommendation =
      "Use Hook A";

    reason =
      "Hook A has the stronger combination of curiosity, clarity, and immediate attention.";
  } else if (scoreB > scoreA) {
    recommendation =
      "Use Hook B";

    reason =
      "Hook B has the stronger combination of curiosity, clarity, and immediate attention.";
  }

  return {
    hookAScore: scoreA,
    hookBScore: scoreB,

    scoreA,
    scoreB,

    winner: recommendation,
    recommendation,

    reason
  };
}

/* =========================================================
   CREATOR INTELLIGENCE
   ========================================================= */

function creatorIntelligence(data) {
  const boosts =
    Array.isArray(data.boosts)
      ? data.boosts
      : [];

  if (!boosts.length) {
    return {
      hasData: false,

      averageScore: 0,
      bestScore: 0,
      lowestScore: 0,

      trend: "No data",

      strongestTopic: "â€”",
      weakestArea: "â€”",

      sampleSize: 0,

      confidence:
        "Boost a few posts to unlock Creator Intelligence.",

      nextAction:
        "Boost at least 3 posts so RIZORA can detect patterns.",

      insights: []
    };
  }

  const validBoosts =
    boosts.filter(Boolean);

  const scores =
    validBoosts
      .map(
        item =>
          Number(item.score) || 0
      )
      .filter(
        score => score >= 0
      );

  const average =
    scores.length
      ? Math.round(
          (
            scores.reduce(
              (a, b) => a + b,
              0
            ) /
            scores.length
          ) * 10
        ) / 10
      : 0;

  const best =
    scores.length
      ? Math.max(...scores)
      : 0;

  const lowest =
    scores.length
      ? Math.min(...scores)
      : 0;

  let trend = "Stable";

  if (scores.length >= 2) {
    if (scores[0] > scores[1]) {
      trend = "Improving â†‘";
    } else if (scores[0] < scores[1]) {
      trend = "Declining â†“";
    }
  }

  const topicStats = {};

  validBoosts.forEach(item => {
    const topic =
      clean(item.topic)
        .toLowerCase();

    if (!topic) {
      return;
    }

    if (!topicStats[topic]) {
      topicStats[topic] = {
        count: 0,
        total: 0
      };
    }

    topicStats[topic].count++;
    topicStats[topic].total +=
      Number(item.score) || 0;
  });

  let strongestTopic =
    "Mixed content";

  let strongestTopicScore =
    -1;

  for (
    const [
      topic,
      stat
    ] of Object.entries(topicStats)
  ) {
    const avg =
      stat.total /
      stat.count;

    if (avg > strongestTopicScore) {
      strongestTopicScore =
        avg;

      strongestTopic =
        topic;
    }
  }

  const totals = {
    hook: 0,
    caption: 0,
    hashtags: 0,
    clarity: 0,
    engagement: 0
  };

  let componentSamples = 0;

  validBoosts.forEach(item => {
    const c =
      item.componentScores ||
      item.breakdown ||
      {};

    const values = {
      hook:
        Number(c.hook) || 0,

      caption:
        Number(c.caption) || 0,

      hashtags:
        Number(c.hashtags) || 0,

      clarity:
        Number(
          c.clarity ??
          c.retention
        ) || 0,

      engagement:
        Number(c.engagement) || 0
    };

    if (
      values.hook ||
      values.caption ||
      values.hashtags ||
      values.clarity ||
      values.engagement
    ) {
      totals.hook +=
        values.hook;

      totals.caption +=
        values.caption;

      totals.hashtags +=
        values.hashtags;

      totals.clarity +=
        values.clarity;

      totals.engagement +=
        values.engagement;

      componentSamples++;
    }
  });

  let weakestArea =
    "Not enough data";

  let weakestAverage =
    101;

  if (componentSamples) {
    for (
      const [
        name,
        total
      ] of Object.entries(totals)
    ) {
      const avg =
        total /
        componentSamples;

      if (avg < weakestAverage) {
        weakestAverage =
          avg;

        weakestArea =
          name;
      }
    }

    weakestArea =
      weakestArea.charAt(0).toUpperCase() +
      weakestArea.slice(1);
  }

  let nextAction =
    "Keep testing different creative approaches.";

  if (weakestArea === "Hook") {
    nextAction =
      "Test shorter, curiosity-driven hooks before changing your overall strategy.";
  } else if (weakestArea === "Caption") {
    nextAction =
      "Make captions clearer and give viewers a simple reason to respond.";
  } else if (weakestArea === "Hashtags") {
    nextAction =
      "Use fewer, more relevant hashtags tied closely to the actual topic.";
  } else if (weakestArea === "Clarity") {
    nextAction =
      "Make the opening and message easier to understand at a glance.";
  } else if (weakestArea === "Engagement") {
    nextAction =
      "Create a stronger reason for viewers to comment, share, or save.";
  }

  if (trend === "Improving â†‘") {
    nextAction +=
      " Your recent scores are moving upward, so keep testing variations.";
  }

  if (trend === "Declining â†“") {
    nextAction +=
      " Your recent score is down, so review your latest hook and packaging.";
  }

  const insights = [];

  if (average >= 80) {
    insights.push(
      `Your average boost score is strong at ${average}/100.`
    );
  } else if (average >= 70) {
    insights.push(
      `Your average score is ${average}/100. The foundation is promising.`
    );
  } else {
    insights.push(
      `Your average score is ${average}/100. Packaging is the biggest opportunity.`
    );
  }

  if (
    strongestTopic !==
    "Mixed content"
  ) {
    insights.push(
      `${strongestTopic} is currently your strongest topic based on saved boost performance.`
    );
  }

  if (
    weakestArea !==
    "Not enough data"
  ) {
    insights.push(
      `${weakestArea} is currently your weakest measured content area.`
    );
  }

  if (trend !== "Stable") {
    insights.push(
      `Your recent score trend is ${trend}.`
    );
  }

  return {
    hasData: true,

    averageScore:
      average,

    bestScore:
      best,

    lowestScore:
      lowest,

    trend,

    strongestTopic,

    weakestArea,

    weakestAverage:
      componentSamples
        ? Math.round(
            weakestAverage * 10
          ) / 10
        : 0,

    sampleSize:
      validBoosts.length,

    confidence:
      validBoosts.length >= 5
        ? "RIZORA has enough data to identify useful patterns."
        : "RIZORA is still learning. More saved Boost results will improve the pattern detection.",

    nextAction,

    insights
  };
}

/* =========================================================
   STATIC FILE SERVER
   ========================================================= */

function getContentType(filePath) {
  const ext =
    path.extname(filePath)
      .toLowerCase();

  const types = {
    ".html":
      "text/html; charset=utf-8",

    ".js":
      "application/javascript; charset=utf-8",

    ".css":
      "text/css; charset=utf-8",

    ".json":
      "application/json; charset=utf-8",

    ".png":
      "image/png",

    ".jpg":
      "image/jpeg",

    ".jpeg":
      "image/jpeg",

    ".svg":
      "image/svg+xml",

    ".webp":
      "image/webp",

    ".ico":
      "image/x-icon",

    ".woff":
      "font/woff",

    ".woff2":
      "font/woff2",

    ".mp4":
      "video/mp4",

    ".webm":
      "video/webm"
  };

  return (
    types[ext] ||
    "application/octet-stream"
  );
}

/*
  Find the requested file in both possible roots.
  This makes the static server more tolerant of Vercel's
  runtime directory structure.
*/

function findStaticFile(requestedPath) {
  const cleanPath =
    requestedPath
      .replace(/^[/\\]+/, "");

  const candidates = [`r`n    path.join(STATIC_ROOT, cleanPath),`r`n    path.resolve(ROOT, cleanPath)`r`n  ];

  for (const filePath of candidates) {
    try {
      if (
        fs.existsSync(filePath) &&
        fs.statSync(filePath).isFile()
      ) {
        return filePath;
      }
    } catch {
      // Continue checking the next location.
    }
  }

  return null;
}

function serveStatic(
  res,
  pathname
) {
  const requested =
    pathname === "/"
      ? "index.html"
      : pathname.replace(
          /^[/\\]+/,
          ""
        );

  const filePath =
    findStaticFile(requested);

  if (!filePath) {
    console.error(
      "RIZORA static file missing:",
      requested
    );

    console.error(
      "ROOT:",
      ROOT
    );

    console.error(
      "SERVER_ROOT:",
      SERVER_ROOT
    );

    return sendText(
      res,
      404,
      "RIZORA file not found."
    );
  }

  fs.readFile(
    filePath,
    (error, data) => {
      if (error) {
        console.error(
          "Static file read error:",
          error
        );

        return sendText(
          res,
          500,
          "Unable to load file."
        );
      }

      res.writeHead(
        200,
        {
          "Content-Type":
            getContentType(
              filePath
            ),

          "Cache-Control":
            "no-cache"
        }
      );

      res.end(data);
    }
  );
}

/* =========================================================
   API ROUTES
   ========================================================= */

const routes = {
  "/api/analyze":
    analyzePost,

  "/api/generate/hooks":
    generateHooks,

  "/api/generate/hashtags":
    generateHashtags,

  "/api/generate/captions":
    generateCaptions,

  "/api/generate/ideas":
    generateIdeas,

  "/api/boost":
    boostContent,

  "/api/performance":
    performanceAnalysis,

  "/api/ab-test":
    abTest,

  "/api/intelligence":
    creatorIntelligence
};

/* =========================================================
   SERVER
   ========================================================= */

const server =
  http.createServer(
    async (req, res) => {
      try {
        if (
          req.method ===
          "OPTIONS"
        ) {
          res.writeHead(
            204,
            {
              "Access-Control-Allow-Origin":
                "*",

              "Access-Control-Allow-Headers":
                "Content-Type",

              "Access-Control-Allow-Methods":
                "GET, POST, OPTIONS"
            }
          );

          return res.end();
        }

        const url =
          new URL(
            req.url,
            `http://${req.headers.host || "localhost"}`
          );

        const pathname =
          url.pathname;

        /* STATUS */

        if (
          req.method === "GET" &&
          pathname === "/api/status"
        ) {
          return sendJSON(
            res,
            200,
            {
              ok: true,

              app: "RIZORA",

              version: "6.0",

              status: "online",

              port: PORT,

              host: HOST,

              engines: {
                organicGrowth:
                  "READY",

                smartBoost:
                  "READY",

                performanceAnalytics:
                  "READY",

                contentIntelligence:
                  "READY",

                creatorIntelligence:
                  "READY",

                abHookTester:
                  "READY",

                experimentLab:
                  "READY",

                creatorProfile:
                  "READY",

                savedHistory:
                  "READY",

                communityHub:
                  "READY",

                communityRewards:
                  "READY"
              }
            }
          );
        }

        /* API POST */

        if (
          req.method === "POST" &&
          routes[pathname]
        ) {
          const data =
            await readBody(req);

          const result =
            routes[pathname](data);

          return sendJSON(
            res,
            200,
            result
          );
        }

        /* UNKNOWN API */

        if (
          pathname.startsWith(
            "/api/"
          )
        ) {
          return sendJSON(
            res,
            404,
            {
              error:
                "RIZORA API endpoint not found."
            }
          );
        }

        /* STATIC */

        if (
          req.method === "GET"
        ) {
          return serveStatic(
            res,
            pathname
          );
        }

        return sendText(
          res,
          405,
          "Method not allowed."
        );

      } catch (error) {
        console.error(
          "RIZORA SERVER ERROR:",
          error
        );

        return sendJSON(
          res,
          500,
          {
            error:
              error.message ||
              "Internal server error."
          }
        );
      }
    }
  );

/* =========================================================
   ERROR HANDLING
   ========================================================= */

server.on(
  "error",
  error => {
    if (
      error.code ===
      "EADDRINUSE"
    ) {
      console.log(
        `RIZORA is already running on port ${PORT}.`
      );

      return;
    }

    console.error(
      "RIZORA SERVER ERROR:",
      error
    );
  }
);

/* =========================================================
   START
   ========================================================= */

server.listen(
  PORT,
  HOST,
  () => {
    console.log(
      "======================================"
    );

    console.log(
      "           RIZORA IS ONLINE"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Local: http://${HOST}:${PORT}`
    );

    console.log(
      `PORT: ${PORT}`
    );

    console.log(
      `HOST: ${HOST}`
    );

    console.log(
      "Organic Growth Engine: READY"
    );

    console.log(
      "Smart Boost Engine: READY"
    );

    console.log(
      "Performance Analytics: READY"
    );

    console.log(
      "Content Intelligence: READY"
    );

    console.log(
      "Creator Intelligence 2.0: READY"
    );

    console.log(
      "A/B Hook Tester: READY"
    );

    console.log(
      "Experiment Lab: READY"
    );

    console.log(
      "Creator Profile: READY"
    );

    console.log(
      "Saved History: READY"
    );

    console.log(
      "Community Hub: READY"
    );

    console.log(
      "Community Rewards: READY"
    );

    console.log(
      "Version: 6.0"
    );

    console.log(
      "======================================"
    );
  }
);

/* =========================================================
   CLEAN SHUTDOWN
   ========================================================= */

function shutdown() {
  server.close(
    () => process.exit(0)
  );
}

process.on(
  "SIGINT",
  shutdown
);

process.on(
  "SIGTERM",
  shutdown
);

