const API = "";

/* =========================================================
   CORE API
   ========================================================= */

async function postJSON(url, data) {
  const response = await fetch(API + url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  let result = {};

  try {
    result = await response.json();
  } catch {
    throw new Error("Server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(
      result.error || "Request failed."
    );
  }

  return result;
}

function outputText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function escapeRizora(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function showSection(id, button) {
  document
    .querySelectorAll(".section")
    .forEach(section => {
      section.classList.remove("active");
    });

  const target = document.getElementById(id);

  if (target) {
    target.classList.add("active");
  }

  document
    .querySelectorAll(".nav button")
    .forEach(btn => {
      btn.classList.remove("active");
    });

  if (button) {
    button.classList.add("active");
  }

  const sidebar =
    document.getElementById("sidebar");

  if (sidebar) {
    sidebar.classList.remove("open");
  }

  if (id === "overview") {
    refreshDashboard();
  }

  if (id === "analytics") {
    loadAnalytics();
    loadAnalyticsInsights();
  }

  if (id === "leaderboard") {
    loadLeaderboard();
  }

  if (id === "community") {
    loadCommunity();
  }

  if (id === "history") {
    loadHistory();
  }

  if (id === "experiments") {
    loadExperiments();
  }

  if (id === "profile") {
    renderProfile();
  }
}

function toggleMobileMenu() {
  const sidebar =
    document.getElementById("sidebar");

  if (sidebar) {
    sidebar.classList.toggle("open");
  }
}

/* =========================================================
   HISTORY
   ========================================================= */

function getHistory() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "rizoraHistory"
      ) || "[]"
    );
  } catch {
    return [];
  }
}

function saveRizoraResult(type, data) {
  const history = getHistory();

  history.unshift({
    id: Date.now(),
    type,
    data,
    date: new Date().toLocaleString()
  });

  localStorage.setItem(
    "rizoraHistory",
    JSON.stringify(
      history.slice(0, 50)
    )
  );
}

function getBoostResults() {
  return getHistory()
    .filter(
      item => item.type === "boost"
    )
    .map(item => item.data)
    .filter(Boolean);
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function refreshDashboard() {
  const boosts =
    getBoostResults();

  const totalPosts =
    document.getElementById(
      "totalPosts"
    );

  const averageScore =
    document.getElementById(
      "averageScore"
    );

  const bestScore =
    document.getElementById(
      "bestScore"
    );

  const ideasGenerated =
    document.getElementById(
      "ideasGenerated"
    );

  if (totalPosts) {
    totalPosts.textContent =
      boosts.length;
  }

  if (boosts.length) {
    const scores =
      boosts.map(
        item =>
          Number(item.score) || 0
      );

    const average =
      Math.round(
        (
          scores.reduce(
            (a, b) => a + b,
            0
          ) / scores.length
        ) * 10
      ) / 10;

    if (averageScore) {
      averageScore.textContent =
        average;
    }

    if (bestScore) {
      bestScore.textContent =
        Math.max(...scores);
    }
  } else {
    if (averageScore) {
      averageScore.textContent =
        "—";
    }

    if (bestScore) {
      bestScore.textContent =
        "—";
    }
  }

  if (ideasGenerated) {
    ideasGenerated.textContent =
      localStorage.getItem(
        "rizoraIdeas"
      ) || "0";
  }

  loadOverviewChart();
  renderIntelligence(
    "overviewIntelligence"
  );
}

function renderChart(
  elementId,
  scores
) {
  const element =
    document.getElementById(
      elementId
    );

  if (!element) {
    return;
  }

  if (!scores.length) {
    element.innerHTML =
      '<div class="empty">No score data yet.</div>';
    return;
  }

  const max =
    Math.max(
      ...scores,
      100
    );

  element.innerHTML =
    scores
      .slice(-12)
      .map(score => {
        const height =
          Math.max(
            5,
            (score / max) * 100
          );

        return `
          <div class="bar-wrap">
            <div
              class="bar"
              style="height:${height}%"
            >
              <span>${score}</span>
            </div>
          </div>
        `;
      })
      .join("");
}

function loadOverviewChart() {
  renderChart(
    "overviewChart",
    getBoostResults().map(
      item =>
        Number(item.score) || 0
    )
  );
}

function loadAnalytics() {
  renderChart(
    "analyticsChart",
    getBoostResults().map(
      item =>
        Number(item.score) || 0
    )
  );
}

/* =========================================================
   BOOST STUDIO
   ========================================================= */

async function runBoost() {
  const topic =
    document.getElementById(
      "boostTopic"
    )?.value || "";

  const hook =
    document.getElementById(
      "boostHook"
    )?.value || "";

  const caption =
    document.getElementById(
      "boostCaption"
    )?.value || "";

  const hashtags =
    document.getElementById(
      "boostHashtags"
    )?.value || "";

  const length =
    document.getElementById(
      "boostLength"
    )?.value || "";

  const output =
    document.getElementById(
      "boostOutput"
    );

  if (!output) {
    return;
  }

  output.textContent =
    "Analyzing your content...";

  try {
    const result =
      await postJSON(
        "/api/boost",
        {
          topic,
          hook,
          caption,
          hashtags,
          length,
          format: "video",
          goal: "reach",
          category: "general"
        }
      );

    saveRizoraResult(
      "boost",
      result
    );

    const components =
      result.componentScores ||
      result.breakdown ||
      {};

    const hookScore =
      Number(
        components.hook
      ) || 0;

    const captionScore =
      Number(
        components.caption
      ) || 0;

    const hashtagScore =
      Number(
        components.hashtags
      ) || 0;

    const retentionScore =
      Number(
        components.retention ??
        components.clarity ??
        0
      ) || 0;

    const engagementScore =
      Number(
        components.engagement
      ) || 0;

    const hashtagsResult =
      safeArray(
        result.hashtags ||
        result.optimizedHashtags
      );

    const topFixes =
      safeArray(
        result.topFixes ||
        result.improvements
      );

    const optimizedHook =
      result.optimizedHook ||
      (
        hook.trim()
          ? hook.trim()
          : `You need to see this before you try ${topic || "this"}.`
      );

    const optimizedCaption =
      result.optimizedCaption ||
      (
        caption.trim()
          ? caption.trim()
          : `${length || "Short video"} — what do you think?`
      );

    const postingPlan =
      typeof result.postingPlan ===
      "string"
        ? result.postingPlan
        : result.strategy ||
          "Lead with the strongest visual or statement immediately. Avoid long introductions.";

    output.innerHTML = `
      <div class="score ${
        result.score >= 80
          ? "good"
          : result.score >= 60
            ? "warn"
            : "bad"
      }">
        ${Number(result.score) || 0}/100
      </div>

      <strong>
        ${escapeRizora(
          result.verdict ||
          "Needs stronger packaging"
        )}
      </strong>

      <div class="metric-grid">

        <div class="metric">
          Hook
          <strong>${hookScore}</strong>
        </div>

        <div class="metric">
          Caption
          <strong>${captionScore}</strong>
        </div>

        <div class="metric">
          Hashtags
          <strong>${hashtagScore}</strong>
        </div>

        <div class="metric">
          Retention
          <strong>${retentionScore}</strong>
        </div>

        <div class="metric">
          Engagement
          <strong>${engagementScore}</strong>
        </div>

      </div>

      <div class="recommendation">

        <strong>
          Top fixes
        </strong>

        <br>

        ${
          topFixes.length
            ? topFixes
                .slice(0, 4)
                .map(
                  item =>
                    "• " +
                    escapeRizora(item)
                )
                .join("<br>")
            : "• Keep testing creative variations."
        }

      </div>

      <div class="recommendation">

        <strong>
          Optimized hook
        </strong>

        <br>

        ${escapeRizora(
          optimizedHook
        )}

      </div>

      <div class="recommendation">

        <strong>
          Optimized caption
        </strong>

        <br>

        ${escapeRizora(
          optimizedCaption
        )}

      </div>

      <div class="recommendation">

        <strong>
          Recommended hashtags
        </strong>

        <br>

        ${
          hashtagsResult.length
            ? hashtagsResult
                .map(
                  tag =>
                    `<span class="tag">${escapeRizora(tag)}</span>`
                )
                .join("")
            : '<span class="muted">No hashtags generated.</span>'
        }

      </div>

      <div class="recommendation">

        <strong>
          CTA
        </strong>

        <br>

        ${escapeRizora(
          result.cta ||
          "End with one natural question or action that gives viewers a reason to respond."
        )}

      </div>

      <div class="recommendation">

        <strong>
          Posting plan
        </strong>

        <br>

        ${escapeRizora(
          postingPlan
        )}

      </div>
    `;

    refreshDashboard();
    loadAnalytics();
    loadAnalyticsInsights();

  } catch (error) {
    output.textContent =
      error.message;
  }
}

/* =========================================================
   CONTENT TOOLS
   ========================================================= */

async function generateHooks() {
  const topic =
    document.getElementById(
      "hookTopic"
    )?.value || "";

  const category =
    document.getElementById(
      "hookCategory"
    )?.value || "";

  outputText(
    "hookOutput",
    "Generating..."
  );

  try {
    const result =
      await postJSON(
        "/api/generate/hooks",
        {
          topic,
          category
        }
      );

    outputText(
      "hookOutput",
      safeArray(
        result.hooks ||
        result.items
      )
        .map(
          (item, index) =>
            `${index + 1}. ${item}`
        )
        .join("\n")
    );

  } catch (error) {
    outputText(
      "hookOutput",
      error.message
    );
  }
}

async function generateHashtags() {
  const topic =
    document.getElementById(
      "hashtagTopic"
    )?.value || "";

  const category =
    document.getElementById(
      "hashtagCategory"
    )?.value || "";

  outputText(
    "hashtagOutput",
    "Generating..."
  );

  try {
    const result =
      await postJSON(
        "/api/generate/hashtags",
        {
          topic,
          category
        }
      );

    outputText(
      "hashtagOutput",
      safeArray(
        result.hashtags ||
        result.items
      ).join(" ")
    );

  } catch (error) {
    outputText(
      "hashtagOutput",
      error.message
    );
  }
}

async function generateCaptions() {
  const topic =
    document.getElementById(
      "captionTopic"
    )?.value || "";

  const vibe =
    document.getElementById(
      "captionVibe"
    )?.value || "";

  outputText(
    "captionOutput",
    "Generating..."
  );

  try {
    const result =
      await postJSON(
        "/api/generate/captions",
        {
          topic,
          vibe
        }
      );

    outputText(
      "captionOutput",
      safeArray(
        result.captions ||
        result.items
      )
        .map(
          (item, index) =>
            `${index + 1}. ${item}`
        )
        .join("\n")
    );

  } catch (error) {
    outputText(
      "captionOutput",
      error.message
    );
  }
}

async function generateIdeas() {
  const niche =
    document.getElementById(
      "ideaNiche"
    )?.value || "";

  outputText(
    "ideaOutput",
    "Generating..."
  );

  try {
    const result =
      await postJSON(
        "/api/generate/ideas",
        {
          niche
        }
      );

    const ideas =
      safeArray(
        result.ideas ||
        result.items
      );

    outputText(
      "ideaOutput",
      ideas
        .map(
          (item, index) =>
            `${index + 1}. ${item}`
        )
        .join("\n")
    );

    const current =
      Number(
        localStorage.getItem(
          "rizoraIdeas"
        ) || 0
      );

    localStorage.setItem(
      "rizoraIdeas",
      String(
        current + ideas.length
      )
    );

    refreshDashboard();

  } catch (error) {
    outputText(
      "ideaOutput",
      error.message
    );
  }
}

async function analyzePost() {
  const hook =
    document.getElementById(
      "analyzeHook"
    )?.value || "";

  const caption =
    document.getElementById(
      "analyzeCaption"
    )?.value || "";

  const hashtags =
    document.getElementById(
      "analyzeHashtags"
    )?.value || "";

  outputText(
    "analyzeOutput",
    "Analyzing..."
  );

  try {
    const result =
      await postJSON(
        "/api/analyze",
        {
          hook,
          caption,
          hashtags
        }
      );

    outputText(
      "analyzeOutput",
      [
        `Score: ${result.score}/100`,
        `Rating: ${result.rating}`,
        "",
        "Strengths:",
        ...safeArray(
          result.strengths
        ).map(
          item =>
            `• ${item}`
        ),
        "",
        "Improvements:",
        ...safeArray(
          result.improvements
        ).map(
          item =>
            `• ${item}`
        ),
        "",
        result.feedback || ""
      ].join("\n")
    );

    saveRizoraResult(
      "analyze",
      result
    );

  } catch (error) {
    outputText(
      "analyzeOutput",
      error.message
    );
  }
}

/* =========================================================
   PERFORMANCE ANALYZER
   ========================================================= */

async function runPerformance() {
  const data = {
    views:
      document.getElementById(
        "perfViews"
      )?.value || 0,

    likes:
      document.getElementById(
        "perfLikes"
      )?.value || 0,

    comments:
      document.getElementById(
        "perfComments"
      )?.value || 0,

    shares:
      document.getElementById(
        "perfShares"
      )?.value || 0,

    saves:
      document.getElementById(
        "perfSaves"
      )?.value || 0,

    followers:
      document.getElementById(
        "perfFollowers"
      )?.value || 0
  };

  const output =
    document.getElementById(
      "performanceOutput"
    );

  if (!output) {
    return;
  }

  output.textContent =
    "Analyzing performance...";

  try {
    const result =
      await postJSON(
        "/api/performance",
        data
      );

    output.innerHTML = `
      <div class="metric-grid">

        <div class="metric">
          Like rate
          <strong>
            ${Number(result.likeRate) || 0}%
          </strong>
        </div>

        <div class="metric">
          Comment rate
          <strong>
            ${Number(result.commentRate) || 0}%
          </strong>
        </div>

        <div class="metric">
          Share rate
          <strong>
            ${Number(result.shareRate) || 0}%
          </strong>
        </div>

        <div class="metric">
          Save rate
          <strong>
            ${Number(result.saveRate) || 0}%
          </strong>
        </div>

        <div class="metric">
          Follower rate
          <strong>
            ${Number(result.followerRate) || 0}%
          </strong>
        </div>

        <div class="metric">
          Engagement
          <strong>
            ${Number(result.engagementRate) || 0}%
          </strong>
        </div>

      </div>

      <div class="recommendation">

        <strong>
          Diagnosis
        </strong>

        <br>

        ${escapeRizora(
          result.diagnosis || ""
        )}

      </div>

      <div class="recommendation">

        <strong>
          Recommendations
        </strong>

        <br>

        ${safeArray(
          result.recommendations
        )
          .map(
            item =>
              "• " +
              escapeRizora(
                item
              )
          )
          .join("<br>")}

      </div>
    `;

  } catch (error) {
    output.textContent =
      error.message;
  }
}

/* =========================================================
   A/B TEST
   ========================================================= */

async function runABTest() {
  const hookA =
    document.getElementById(
      "hookA"
    )?.value || "";

  const hookB =
    document.getElementById(
      "hookB"
    )?.value || "";

  const output =
    document.getElementById(
      "abOutput"
    );

  if (!output) {
    return;
  }

  output.textContent =
    "Comparing hooks...";

  try {
    const result =
      await postJSON(
        "/api/ab-test",
        {
          hookA,
          hookB
        }
      );

    const scoreA =
      Number(
        result.hookAScore ??
        result.scoreA
      ) || 0;

    const scoreB =
      Number(
        result.hookBScore ??
        result.scoreB
      ) || 0;

    const winner =
      result.winner ||
      result.recommendation ||
      "Test both";

    output.innerHTML = `
      <div class="metric-grid">

        <div class="metric">
          Hook A
          <strong>
            ${scoreA}
          </strong>
        </div>

        <div class="metric">
          Hook B
          <strong>
            ${scoreB}
          </strong>
        </div>

      </div>

      <div class="recommendation">

        <strong>
          Winner:
          ${escapeRizora(
            winner
          )}
        </strong>

        <br><br>

        ${escapeRizora(
          result.reason || ""
        )}

      </div>
    `;

  } catch (error) {
    output.textContent =
      error.message;
  }
}

/* =========================================================
   LEADERBOARD
   ========================================================= */

function loadLeaderboard() {
  const list =
    document.getElementById(
      "leaderboardList"
    );

  if (!list) {
    return;
  }

  const boosts =
    getBoostResults()
      .sort(
        (a, b) =>
          (Number(b.score) || 0) -
          (Number(a.score) || 0)
      )
      .slice(0, 10);

  if (!boosts.length) {
    list.innerHTML =
      '<div class="empty">No boosted posts yet.</div>';

    return;
  }

  list.innerHTML =
    boosts
      .map(
        (item, index) => `
          <div class="leader-item">

            <div class="leader-head">

              <div>

                <div class="rank">
                  #${index + 1}
                </div>

                <strong>
                  ${escapeRizora(
                    item.optimizedHook ||
                    item.topic ||
                    "Untitled post"
                  )}
                </strong>

              </div>

              <div class="score ${
                Number(item.score) >= 80
                  ? "good"
                  : Number(item.score) >= 60
                    ? "warn"
                    : "bad"
              }">

                ${
                  Number(
                    item.score
                  ) || 0
                }

              </div>

            </div>

            <p class="muted">
              ${escapeRizora(
                item.verdict || ""
              )}
            </p>

          </div>
        `
      )
      .join("");
}

/* =========================================================
   HISTORY
   ========================================================= */

function loadHistory() {
  const list =
    document.getElementById(
      "historyList"
    );

  if (!list) {
    return;
  }

  const history =
    getHistory();

  if (!history.length) {
    list.innerHTML =
      '<div class="empty">No activity yet.</div>';

    return;
  }

  list.innerHTML =
    history
      .map(
        item => {
          let title =
            item.type;

          if (
            item.type ===
            "boost"
          ) {
            title =
              "🚀 Boost";
          }

          if (
            item.type ===
            "idea"
          ) {
            title =
              "✨ Ideas";
          }

          if (
            item.type ===
            "analyze"
          ) {
            title =
              "📊 Analysis";
          }

          return `
            <div class="history-item">

              <div class="history-head">

                <strong>
                  ${title}
                </strong>

                <span class="muted">
                  ${escapeRizora(
                    item.date
                  )}
                </span>

              </div>

              ${
                item.data?.score !==
                undefined
                  ? `
                    <div
                      style="margin-top:8px;"
                    >
                      Score:
                      <strong>
                        ${escapeRizora(
                          item.data.score
                        )}/100
                      </strong>
                    </div>
                  `
                  : ""
              }

            </div>
          `;
        }
      )
      .join("");
}

/* =========================================================
   COMMUNITY HUB
   ONLY YOUR TWO ACCOUNTS ARE LISTED
   ========================================================= */

const COMMUNITY_CREATORS = [
  {
    name: "Romi Eeh",
    handle: "@romi.eeh",
    niche: "Music",
    style: "Afro / Aesthetic",
    bio:
      "RIZORA demo creator profile for music, visuals and creator discovery.",
    url:
      "https://www.tiktok.com/@romi.eeh",
    demo: true
  },

  {
    name: "Romi Noir",
    handle: "@romi.noir",
    niche: "Music",
    style: "Aesthetic",
    bio:
      "RIZORA demo creator profile for music, visuals and creator discovery.",
    url:
      "https://www.tiktok.com/@romi.noir",
    demo: true
  }
];

/* =========================================================
   COMMUNITY STORAGE
   ========================================================= */

function getCommunity() {
  try {
    const saved =
      JSON.parse(
        localStorage.getItem(
          "rizoraCommunity"
        ) || "null"
      );

    if (
      saved &&
      typeof saved === "object"
    ) {
      if (
        !Array.isArray(
          saved.ledger
        )
      ) {
        saved.ledger = [];
      }

      if (
        !Array.isArray(
          saved.following
        )
      ) {
        saved.following = [];
      }

      if (
        typeof saved.points !==
        "number"
      ) {
        saved.points = 20;
      }

      if (
        typeof saved.earned !==
        "number"
      ) {
        saved.earned = 0;
      }

      if (
        typeof saved.spent !==
        "number"
      ) {
        saved.spent = 0;
      }

      if (
        typeof saved.actions !==
        "number"
      ) {
        saved.actions = 0;
      }

      if (
        typeof saved.signedUp !==
        "boolean"
      ) {
        saved.signedUp = false;
      }

      if (
        typeof saved.creatorName !==
        "string"
      ) {
        saved.creatorName = "";
      }

      if (
        typeof saved.creatorHandle !==
        "string"
      ) {
        saved.creatorHandle = "";
      }

      return saved;
    }

  } catch {
    /* Continue with defaults. */
  }

  return {
    points: 20,
    earned: 0,
    spent: 0,
    actions: 0,
    ledger: [],
    following: [],
    signedUp: false,
    creatorName: "",
    creatorHandle: ""
  };
}

function saveCommunity(data) {
  localStorage.setItem(
    "rizoraCommunity",
    JSON.stringify(data)
  );
}

/* =========================================================
   COMMUNITY SIGNUP
   ========================================================= */

function renderCommunitySignup() {
  const data =
    getCommunity();

  const name =
    document.getElementById(
      "communityName"
    );

  const handle =
    document.getElementById(
      "communityHandle"
    );

  const button =
    document.getElementById(
      "communitySignupBtn"
    );

  const status =
    document.getElementById(
      "communitySignupStatus"
    );

  if (!status) {
    return;
  }

  if (data.signedUp) {
    if (name) {
      name.value =
        data.creatorName || "";
    }

    if (handle) {
      handle.value =
        data.creatorHandle || "";
    }

    if (button) {
      button.textContent =
        "Joined ✓";

      button.disabled =
        true;
    }

    status.textContent =
      `Welcome, ${
        data.creatorName ||
        "creator"
      }. Your 40-point welcome bonus is already active on this device.`;

  } else {
    if (button) {
      button.textContent =
        "Join Community +40 pts";

      button.disabled =
        false;
    }

    status.textContent =
      "Create your local profile to unlock the 40-point welcome bonus.";
  }
}

function completeCommunitySignup() {
  const data =
    getCommunity();

  if (data.signedUp) {
    return;
  }

  const name =
    document
      .getElementById(
        "communityName"
      )
      ?.value
      .trim() || "";

  let handle =
    document
      .getElementById(
        "communityHandle"
      )
      ?.value
      .trim() || "";

  if (!name) {
    return alert(
      "Enter your creator name first."
    );
  }

  if (
    handle &&
    !handle.startsWith("@")
  ) {
    handle =
      "@" + handle;
  }

  data.signedUp =
    true;

  data.creatorName =
    name;

  data.creatorHandle =
    handle;

  /* 40-point welcome bonus */

  data.points += 40;
  data.earned += 40;

  data.ledger.unshift({
    label:
      "RIZORA Community welcome bonus",

    amount: 40,

    date:
      new Date().toLocaleString()
  });

  data.ledger =
    data.ledger.slice(
      0,
      30
    );

  saveCommunity(data);

  loadCommunity();

  alert(
    "Welcome to RIZORA Community — +40 points added."
  );
}

/* =========================================================
   COMMUNITY STATS
   ========================================================= */

function renderCommunityStats() {
  const data =
    getCommunity();

  const points =
    document.getElementById(
      "communityPoints"
    );

  const earned =
    document.getElementById(
      "communityEarned"
    );

  const spent =
    document.getElementById(
      "communitySpent"
    );

  const actions =
    document.getElementById(
      "communityActions"
    );

  if (points) {
    points.textContent =
      data.points;
  }

  if (earned) {
    earned.textContent =
      data.earned;
  }

  if (spent) {
    spent.textContent =
      data.spent;
  }

  if (actions) {
    actions.textContent =
      data.actions;
  }
}

/* =========================================================
   COMMUNITY DIRECTORY
   ========================================================= */

function openCreatorProfile(index) {
  const creator =
    COMMUNITY_CREATORS[index];

  if (!creator?.url) {
    return;
  }

  window.open(
    creator.url,
    "_blank",
    "noopener,noreferrer"
  );
}

function renderCreatorDirectory() {
  const target =
    document.getElementById(
      "creatorDirectory"
    );

  if (!target) {
    return;
  }

  /*
    IMPORTANT:
    COMMUNITY_CREATORS contains only:
      @romi.eeh
      @romi.noir
  */

  target.innerHTML =
    COMMUNITY_CREATORS
      .map(
        (creator, index) => `
          <div
            class="creator-card ${
              creator.demo
                ? "featured"
                : ""
            }"
          >

            <div class="creator-head">

              <div>

                <div class="creator-name-row">

                  <strong>
                    ${escapeRizora(
                      creator.name
                    )}
                  </strong>

                  ${
                    creator.demo
                      ? `
                        <span class="demo-label">
                          RIZORA Demo
                        </span>
                      `
                      : ""
                  }

                </div>

                <div class="creator-meta">

                  ${escapeRizora(
                    creator.handle
                  )}

                  ·

                  ${escapeRizora(
                    creator.niche
                  )}

                  ·

                  ${escapeRizora(
                    creator.style
                  )}

                </div>

              </div>


              <div class="creator-actions">

                <button
                  class="btn secondary small"
                  type="button"
                  onclick="openCreatorProfile(${index})"
                >
                  Open TikTok
                </button>

              </div>

            </div>


            <div class="pill-row">

              <span class="tag">
                ${escapeRizora(
                  creator.niche
                )}
              </span>

              <span class="tag">
                ${escapeRizora(
                  creator.style
                )}
              </span>

            </div>


            <p class="creator-description">

              ${escapeRizora(
                creator.bio
              )}

            </p>


            ${
              creator.demo
                ? `
                  <div class="demo-support">

                    <div class="demo-support-title">
                      ⭐ Support this RIZORA demo creator
                    </div>

                    <div class="demo-support-text">
                      Visit the TikTok profile and choose
                      how you want to support the creator.
                      Following, watching and liking remain
                      voluntary.
                    </div>

                    <div class="support-links">

                      <a
                        class="support-link"
                        href="${escapeRizora(
                          creator.url
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        🎵 ${escapeRizora(
                          creator.handle
                        )}
                      </a>

                    </div>

                  </div>
                `
                : ""
            }

          </div>
        `
      )
      .join("");
}

/* =========================================================
   COMMUNITY LEDGER
   ========================================================= */

function renderCommunityLedger() {
  const target =
    document.getElementById(
      "communityLedger"
    );

  if (!target) {
    return;
  }

  const ledger =
    getCommunity().ledger ||
    [];

  if (!ledger.length) {
    target.innerHTML =
      '<div class="empty">No point activity yet. Start by helping a creator.</div>';

    return;
  }

  target.innerHTML =
    ledger
      .slice(0, 8)
      .map(
        item => `
          <div class="history-item">

            <div class="history-head">

              <strong>
                ${escapeRizora(
                  item.label
                )}
              </strong>

              <span
                class="${
                  Number(
                    item.amount
                  ) >= 0
                    ? "points-positive"
                    : "points-negative"
                }"
              >

                ${
                  Number(
                    item.amount
                  ) >= 0
                    ? "+"
                    : ""
                }

                ${Number(
                  item.amount
                )}

                pts

              </span>

            </div>

            <p class="muted">
              ${escapeRizora(
                item.date
              )}
            </p>

          </div>
        `
      )
      .join("");
}

/* =========================================================
   COMMUNITY MISSIONS
   ========================================================= */

function completeCommunityMission(
  type,
  reward
) {
  const labels = {
    "hook-review":
      "Completed hook review",

    "content-feedback":
      "Gave content feedback",

    "idea-share":
      "Shared a creator idea",

    "collab":
      "Joined a collaboration"
  };

  const data =
    getCommunity();

  const amount =
    Number(reward) || 0;

  if (amount <= 0) {
    return;
  }

  data.points += amount;
  data.earned += amount;
  data.actions += 1;

  data.ledger.unshift({
    label:
      labels[type] ||
      "Completed community mission",

    amount,

    date:
      new Date().toLocaleString()
  });

  data.ledger =
    data.ledger.slice(
      0,
      30
    );

  saveCommunity(data);

  loadCommunity();

  alert(
    `+${amount} RIZORA points earned. Keep growing with real creators.`
  );
}

function spendCommunityPoints(
  label,
  cost
) {
  const data =
    getCommunity();

  const amount =
    Number(cost) || 0;

  if (amount <= 0) {
    return;
  }

  if (
    data.points <
    amount
  ) {
    alert(
      `You need ${amount} points for this request. Earn more by helping other creators.`
    );

    return;
  }

  data.points -= amount;
  data.spent += amount;
  data.actions += 1;

  data.ledger.unshift({
    label,

    amount:
      -amount,

    date:
      new Date().toLocaleString()
  });

  data.ledger =
    data.ledger.slice(
      0,
      30
    );

  saveCommunity(data);

  loadCommunity();

  alert(
    `${label} created for ${amount} points.`
  );
}

/* =========================================================
   COMMUNITY LOADER
   ========================================================= */

function loadCommunity() {
  renderCommunitySignup();
  renderCommunityStats();
  renderCreatorDirectory();
  renderCommunityLedger();
}

/* =========================================================
   EXPERIMENTS
   ========================================================= */

function getExperiments() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "rizoraExperiments"
      ) || "[]"
    );
  } catch {
    return [];
  }
}

function saveExperiment() {
  const name =
    document
      .getElementById(
        "experimentName"
      )
      ?.value
      .trim() || "";

  const variable =
    document.getElementById(
      "experimentVariable"
    )?.value || "";

  const a =
    Number(
      document.getElementById(
        "experimentA"
      )?.value
    ) || 0;

  const b =
    Number(
      document.getElementById(
        "experimentB"
      )?.value
    ) || 0;

  if (!name) {
    return alert(
      "Enter an experiment name."
    );
  }

  if (
    a <= 0 ||
    b <= 0
  ) {
    return alert(
      "Enter both results."
    );
  }

  const experiments =
    getExperiments();

  experiments.unshift({
    name,
    variable,
    a,
    b,

    winner:
      a > b
        ? "A"
        : b > a
          ? "B"
          : "Tie",

    date:
      new Date().toLocaleString()
  });

  localStorage.setItem(
    "rizoraExperiments",
    JSON.stringify(
      experiments.slice(
        0,
        50
      )
    )
  );

  const nameInput =
    document.getElementById(
      "experimentName"
    );

  const aInput =
    document.getElementById(
      "experimentA"
    );

  const bInput =
    document.getElementById(
      "experimentB"
    );

  if (nameInput) {
    nameInput.value = "";
  }

  if (aInput) {
    aInput.value = "";
  }

  if (bInput) {
    bInput.value = "";
  }

  loadExperiments();
}

function loadExperiments() {
  const list =
    document.getElementById(
      "experimentList"
    );

  if (!list) {
    return;
  }

  const experiments =
    getExperiments();

  if (!experiments.length) {
    list.innerHTML =
      '<div class="empty">No experiments saved.</div>';

    return;
  }

  list.innerHTML =
    experiments
      .map(
        item => `
          <div class="experiment-item">

            <strong>
              ${escapeRizora(
                item.name
              )}
            </strong>

            <p class="muted">
              Variable:
              ${escapeRizora(
                item.variable
              )}
            </p>

            <p
              style="margin-top:6px;"
            >

              A:
              <strong>
                ${escapeRizora(
                  item.a
                )}
              </strong>

              &nbsp;|&nbsp;

              B:
              <strong>
                ${escapeRizora(
                  item.b
                )}
              </strong>

            </p>

            <p
              class="good"
              style="margin-top:6px;"
            >

              Winner:
              ${escapeRizora(
                item.winner
              )}

            </p>

            <small class="muted">
              ${escapeRizora(
                item.date
              )}
            </small>

          </div>
        `
      )
      .join("");
}

/* =========================================================
   PROFILE
   ========================================================= */

function getProfile() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "rizoraProfile"
      ) || "null"
    );
  } catch {
    return null;
  }
}

function saveProfile() {
  const profile = {
    name:
      document
        .getElementById(
          "profileName"
        )
        ?.value
        .trim() || "",

    niche:
      document.getElementById(
        "profileNiche"
      )?.value ||
      "fashion",

    style:
      document.getElementById(
        "profileStyle"
      )?.value ||
      "aesthetic",

    goal:
      document.getElementById(
        "profileGoal"
      )?.value ||
      "views"
  };

  localStorage.setItem(
    "rizoraProfile",
    JSON.stringify(profile)
  );

  renderProfile();

  alert(
    "Creator profile saved."
  );
}

function renderProfile() {
  const profile =
    getProfile();

  if (!profile) {
    renderIntelligence(
      "profileIntelligence"
    );

    return;
  }

  const nameEl =
    document.getElementById(
      "profileName"
    );

  const nicheEl =
    document.getElementById(
      "profileNiche"
    );

  const styleEl =
    document.getElementById(
      "profileStyle"
    );

  const goalEl =
    document.getElementById(
      "profileGoal"
    );

  if (nameEl) {
    nameEl.value =
      profile.name || "";
  }

  if (nicheEl) {
    nicheEl.value =
      profile.niche ||
      "fashion";
  }

  if (styleEl) {
    styleEl.value =
      profile.style ||
      "aesthetic";
  }

  if (goalEl) {
    goalEl.value =
      profile.goal ||
      "views";
  }

  renderIntelligence(
    "profileIntelligence"
  );

  renderIntelligence(
    "overviewIntelligence"
  );

  const greeting =
    document.getElementById(
      "overviewGreeting"
    );

  if (
    greeting &&
    profile.name
  ) {
    greeting.textContent =
      `Let's build better ${profile.niche} content, ${profile.name}.`;
  }
}

/* =========================================================
   LOCAL INTELLIGENCE
   ========================================================= */

function renderIntelligence(
  elementId
) {
  const target =
    document.getElementById(
      elementId
    );

  if (!target) {
    return;
  }

  const profile =
    getProfile();

  const boosts =
    getBoostResults();

  if (!profile) {
    target.innerHTML =
      `
        <div class="recommendation">
          Create your Creator Profile so RIZORA can personalize your workflow.
        </div>
      `;

    return;
  }

  const recommendations = [];

  if (
    profile.goal ===
    "views"
  ) {
    recommendations.push(
      "Prioritize stronger first-second hooks and faster openings."
    );
  }

  if (
    profile.goal ===
    "engagement"
  ) {
    recommendations.push(
      "Use specific questions and opinion-based captions."
    );
  }

  if (
    profile.goal ===
    "followers"
  ) {
    recommendations.push(
      "Make your creator identity clear and give viewers a reason to follow."
    );
  }

  if (
    profile.goal ===
    "consistency"
  ) {
    recommendations.push(
      "Build repeatable content formats instead of reinventing every post."
    );
  }

  if (
    profile.style ===
    "aesthetic"
  ) {
    recommendations.push(
      "Keep the visual style consistent while making the opening instantly clear."
    );
  }

  if (
    profile.style ===
    "street"
  ) {
    recommendations.push(
      "Keep the language natural and direct; avoid forcing engagement bait."
    );
  }

  if (boosts.length) {
    const scores =
      boosts.map(
        item =>
          Number(item.score) ||
          0
      );

    const average =
      scores.reduce(
        (a, b) =>
          a + b,
        0
      ) / scores.length;

    recommendations.push(
      average < 70
        ? "Your current average boost score is below 70. Work on hooks first."
        : "Your content fundamentals are healthy. Start testing variations."
    );
  }

  target.innerHTML =
    `
      <div class="recommendation">

        <strong>
          Profile
        </strong>

        <br>

        ${escapeRizora(
          profile.niche
        )}

        •

        ${escapeRizora(
          profile.style
        )}

        •

        Goal:

        ${escapeRizora(
          profile.goal
        )}

      </div>

      ${recommendations
        .slice(0, 5)
        .map(
          item =>
            `
              <div class="recommendation">
                ${escapeRizora(
                  item
                )}
              </div>
            `
        )
        .join("")}
    `;
}

/* =========================================================
   CREATOR INTELLIGENCE
   ========================================================= */

async function loadCreatorIntelligence() {
  try {
    const result =
      await postJSON(
        "/api/intelligence",
        {
          boosts:
            getBoostResults()
        }
      );

    const averageEl =
      document.getElementById(
        "insightAverage"
      );

    const bestEl =
      document.getElementById(
        "insightBest"
      );

    const lowestEl =
      document.getElementById(
        "insightLowest"
      );

    const trendEl =
      document.getElementById(
        "insightTrend"
      );

    const topicEl =
      document.getElementById(
        "insightTopic"
      );

    const weakestEl =
      document.getElementById(
        "insightWeakest"
      );

    const nextActionEl =
      document.getElementById(
        "insightNextAction"
      );

    const confidenceEl =
      document.getElementById(
        "insightConfidence"
      );

    if (!result.hasData) {
      if (averageEl) {
        averageEl.textContent =
          "—";
      }

      if (bestEl) {
        bestEl.textContent =
          "—";
      }

      if (lowestEl) {
        lowestEl.textContent =
          "—";
      }

      if (trendEl) {
        trendEl.textContent =
          "—";
      }

      if (topicEl) {
        topicEl.textContent =
          "—";
      }

      if (weakestEl) {
        weakestEl.textContent =
          "—";
      }

      if (nextActionEl) {
        nextActionEl.textContent =
          result.nextAction;
      }

      if (confidenceEl) {
        confidenceEl.textContent =
          result.confidence;
      }

      return;
    }

    if (averageEl) {
      averageEl.textContent =
        result.averageScore;
    }

    if (bestEl) {
      bestEl.textContent =
        result.bestScore;
    }

    if (lowestEl) {
      lowestEl.textContent =
        result.lowestScore;
    }

    if (trendEl) {
      trendEl.textContent =
        result.trend;
    }

    if (topicEl) {
      topicEl.textContent =
        result.strongestTopic;
    }

    if (weakestEl) {
      weakestEl.textContent =
        result.weakestArea;
    }

    if (nextActionEl) {
      nextActionEl.innerHTML =
        `
          <strong>
            Next move
          </strong>

          <br>

          ${escapeRizora(
            result.nextAction
          )}

          ${
            safeArray(
              result.insights
            ).length
              ? `
                <div class="mini-note">

                  ${safeArray(
                    result.insights
                  )
                    .map(
                      item =>
                        "• " +
                        escapeRizora(
                          item
                        )
                    )
                    .join("<br>")}

                </div>
              `
              : ""
          }
        `;
    }

    if (confidenceEl) {
      confidenceEl.textContent =
        `${result.confidence} Sample size: ${result.sampleSize}.`;
    }

  } catch (error) {
    console.error(
      "Creator Intelligence error:",
      error
    );
  }
}

function loadAnalyticsInsights() {
  loadCreatorIntelligence();
}

/* =========================================================
   CLEAR DATA
   ========================================================= */

function clearRizoraStats() {
  if (
    !confirm(
      "Clear RIZORA history and experiments?"
    )
  ) {
    return;
  }

  localStorage.removeItem(
    "rizoraHistory"
  );

  localStorage.removeItem(
    "rizoraExperiments"
  );

  localStorage.removeItem(
    "rizoraIdeas"
  );

  refreshDashboard();
  loadHistory();
  loadLeaderboard();
  loadCommunity();
  loadExperiments();
  loadAnalytics();
  loadAnalyticsInsights();
}

/* =========================================================
   BACKEND STATUS
   ========================================================= */

async function checkBackend() {
  const status =
    document.getElementById(
      "backendStatus"
    );

  if (!status) {
    return;
  }

  try {
    const response =
      await fetch(
        "/api/status"
      );

    const data =
      await response.json();

    status.textContent =
      data.status ===
      "online"
        ? "● Engine Online"
        : "● Engine Offline";

  } catch {
    status.textContent =
      "● Backend Offline";
  }
}

/* =========================================================
   STARTUP
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    checkBackend();

    const bindings = {
      boostBtn:
        runBoost,

      performanceBtn:
        runPerformance,

      abTestBtn:
        runABTest,

      saveExperimentBtn:
        saveExperiment,

      generateHookBtn:
        generateHooks,

      generateHashtagBtn:
        generateHashtags,

      generateCaptionBtn:
        generateCaptions,

      generateIdeaBtn:
        generateIdeas,

      analyzeBtn:
        analyzePost
    };

    Object.entries(
      bindings
    ).forEach(
      ([id, handler]) => {
        const element =
          document.getElementById(
            id
          );

        if (element) {
          element.addEventListener(
            "click",
            handler
          );
        }
      }
    );

    refreshDashboard();
    renderProfile();
    loadHistory();
    loadLeaderboard();
    loadCommunity();
    loadExperiments();
    loadAnalyticsInsights();
  }
);

/* =========================================================
   ERROR LOGGING
   ========================================================= */

window.addEventListener(
  "error",
  event => {
    console.error(
      "RIZORA browser error:",
      event.error ||
      event.message
    );
  }
);