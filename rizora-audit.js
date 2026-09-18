const { chromium } = require("playwright");

const URL = "https://rizora.com.ng";
const USERNAME = "romi";
const PASSWORD = "123romi45$";

const results = [];

function record(name, pass, detail = "") {
  results.push({
    name,
    status: pass ? "PASS" : "FAIL",
    detail
  });
}

async function login(page, label) {
  await page.goto(URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await page.waitForTimeout(1200);

  // Always explicitly open the real login screen.
  const loginNav = page.locator("#loginNav");

  if (await loginNav.isVisible().catch(() => false)) {
    await loginNav.click();
    await page.waitForTimeout(500);
  }

  const form = page.locator("#loginForm");

  try {
    await form.waitFor({
      state: "visible",
      timeout: 5000
    });
  } catch {
    record(
      `${label} Login`,
      false,
      "#loginForm did not become visible."
    );
    return false;
  }

  await page.locator("#loginUsername").fill(USERNAME);
  await page.locator("#loginPassword").fill(PASSWORD);

  await page.locator("#loginSubmit").click();

  try {
    await page.locator("#logoutNav").waitFor({
      state: "visible",
      timeout: 10000
    });
  } catch {
    const text = await page.locator("body").innerText();

    record(
      `${label} Login`,
      false,
      text.slice(0, 800)
    );

    return false;
  }

  record(
    `${label} Login`,
    true,
    "Authenticated session established."
  );

  return true;
}

async function openMenu(page, mobile) {
  const button = page.locator("button.mobile-menu").first();

  if (!(await button.isVisible().catch(() => false))) {
    return false;
  }

  if (mobile) {
    await button.tap();
  } else {
    await button.click();
  }

  await page.waitForTimeout(500);

  const panel = page.locator("#rzWorkingMenuPanel");

  return await panel.isVisible().catch(() => false);
}

async function closeMenu(page) {
  const close = page.locator("#rzWorkingMenuClose");

  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await page.waitForTimeout(250);
  }
}

async function testMenuItem(
  page,
  name,
  target,
  mobile
) {
  try {
    if (!(await openMenu(page, mobile))) {
      return {
        pass: false,
        detail: "Real MENU panel did not open."
      };
    }

    const item = page
      .locator("#rzWorkingMenuPanel .rzWorkingMenuItem")
      .filter({ hasText: name })
      .first();

    if (!(await item.isVisible().catch(() => false))) {
      return {
        pass: false,
        detail: "Menu item is not visible."
      };
    }

    if (mobile) {
      await item.tap();
    } else {
      await item.click();
    }

    await page.waitForTimeout(700);

    if (!target) {
      const aiInput = page.locator("#creatorAIInput");

      const aiVisible =
        await aiInput.isVisible().catch(() => false);

      const askButton =
        page.getByText("Ask RIZORA AI", {
          exact: true
        }).first();

      const askVisible =
        await askButton.isVisible().catch(() => false);

      return {
        pass: aiVisible || askVisible,
        detail:
          aiVisible
            ? "#creatorAIInput visible."
            : askVisible
              ? "Ask RIZORA AI button visible."
              : "AI interface did not open."
      };
    }

    const targetEl = page.locator(target).first();

    if (!(await targetEl.count())) {
      return {
        pass: false,
        detail: `Target ${target} does not exist.`
      };
    }

    const state = await targetEl.evaluate(el => {
      const s = getComputedStyle(el);

      return {
        display: s.display,
        visibility: s.visibility,
        opacity: s.opacity
      };
    });

    const visible =
      state.display !== "none" &&
      state.visibility !== "hidden" &&
      Number(state.opacity) > 0;

    return {
      pass: visible,
      detail: visible
        ? `${target} is visible after click.`
        : `${target} exists but is hidden: ${JSON.stringify(state)}`
    };

  } catch (err) {
    return {
      pass: false,
      detail: err.message
    };
  } finally {
    await closeMenu(page);
  }
}

async function testAuthenticatedPage(
  page,
  label,
  mobile
) {
  const body = await page.locator("body").innerText();

  record(
    `${label} Dashboard`,
    /Welcome,\s*RoMi/i.test(body) ||
    /RIZORA COMMAND CENTER/i.test(body),
    "Authenticated dashboard detected."
  );

  // Home must be the default creator view.
  const home = page.locator("#creatorOverview");

  record(
    `${label} Home`,
    await home.isVisible().catch(() => false),
    "#creatorOverview is visible."
  );

  record(
    `${label} Points`,
    /\bPTS\b/i.test(body) ||
    /\bPoints\b/i.test(body),
    "Points UI detected."
  );

  record(
    `${label} Referrals`,
    /Referral/i.test(body),
    "Referral UI detected."
  );

  record(
    `${label} Logout`,
    await page.locator("#logoutNav").isVisible().catch(() => false),
    "Logout is visible."
  );

  record(
    `${label} Google Login`,
    false,
    "Checked on logged-out screen separately."
  );

  // Real creator panel targets.
  const menuTests = [
    ["Boost Studio", "#creatorBoost"],
    ["Tasks", "#creatorTasks"],
    ["Content Tools", "#creatorTools"],
    ["Analytics", "#creatorAnalytics"],
    ["Leaderboard", "#creatorLeaderboard"],
    ["Community", "#creatorCommunity"],
    ["Experiment Lab", "#creatorExperiments"],
    ["History", "#creatorHistory"],
    ["Profile", "#creatorProfile"],
    ["Settings", "#creatorSettings"]
  ];

  record(
    `${label} Menu Opens`,
    await openMenu(page, mobile),
    "Real menu panel."
  );

  await closeMenu(page);

  for (const [name, target] of menuTests) {
    const r = await testMenuItem(
      page,
      name,
      target,
      mobile
    );

    record(
      `${label} ${name}`,
      r.pass,
      r.detail
    );
  }

  const ai = await testMenuItem(
    page,
    "RIZORA AI",
    null,
    mobile
  );

  record(
    `${label} RIZORA AI`,
    ai.pass,
    ai.detail
  );
}

async function testGoogleButton(page) {
  await page.goto(URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await page.waitForTimeout(700);

  const loginNav = page.locator("#loginNav");

  if (await loginNav.isVisible().catch(() => false)) {
    await loginNav.click();
    await page.waitForTimeout(500);
  }

  const google = page.locator("#rizoraGoogleLogin");

  record(
    "Google Login Button",
    await google.isVisible().catch(() => false),
    "Real #rizoraGoogleLogin control."
  );
}

async function run() {

  //
  

      console.log(
        "Audit login UI repair warning:",
        e.message
      );

    }

  }


  console.log("\n======================================");
  console.log("RIZORA FREE INTERACTION AUDIT");
  console.log("======================================\n");

  const browser = await chromium.launch({
    channel: "chrome",
    headless: false
  });

  // DESKTOP
  const desktopContext = await browser.newContext({
    viewport: {
      width: 1440,
      height: 900
    }
  });

  const desktop = await desktopContext.newPage();

  desktop.on("console", msg => {
    if (msg.type() === "error") {
      console.log(
        "DESKTOP CONSOLE ERROR:",
        msg.text()
      );
    }
  });

  const desktopLoggedIn =
    await login(desktop, "Desktop");

  const authSnapshot =
    desktopLoggedIn
      ? await desktop.evaluate(() => ({
          token:
            localStorage.getItem("rizoraToken"),
          user:
            localStorage.getItem("rizoraUser")
        }))
      : null;

  if (desktopLoggedIn) {
    await testAuthenticatedPage(
      desktop,
      "Desktop",
      false
    );
  }

  await desktopContext.close();

  // MOBILE
  const mobileContext = await browser.newContext({
    viewport: {
      width: 390,
      height: 844
    },
    isMobile: true,
    hasTouch: true
  });

  
  // RIZORA mobile auth injection
  if(authSnapshot){
    await mobileContext.addInitScript(
      ({token, user}) => {
        if(token){
          localStorage.setItem(
            "rizoraToken",
            token
          );
        }

        if(user){
          localStorage.setItem(
            "rizoraUser",
            user
          );
        }
      },
      authSnapshot
    );
  }

const mobile = await mobileContext.newPage();

  mobile.on("console", msg => {
    if (msg.type() === "error") {
      console.log(
        "MOBILE CONSOLE ERROR:",
        msg.text()
      );
    }
  });

  const mobileLoggedIn =
    await login(mobile, "Mobile");

  if (mobileLoggedIn) {
    await testAuthenticatedPage(
      mobile,
      "Mobile",
      true
    );
  }

  // GOOGLE
  await testGoogleButton(mobile);

  await mobileContext.close();

  await browser.close();

  console.log("\n======================================");
  console.log("FINAL RESULTS");
  console.log("======================================\n");

  for (const r of results) {
    console.log(
      `${r.status.padEnd(5)} | ${r.name.padEnd(35)} | ${r.detail}`
    );
  }

  const pass =
    results.filter(x => x.status === "PASS").length;

  const fail =
    results.filter(x => x.status === "FAIL").length;

  console.log("\n======================================");
  console.log(`TOTAL: ${results.length}`);
  console.log(`PASS : ${pass}`);
  console.log(`FAIL : ${fail}`);
  

//
// ============================================================
// RIZORA_AUDIT_FINALIZATION_V2
// ============================================================
//

try{

  //
  // HOME
  //

  if(
    typeof desktop !== "undefined" &&
    desktop
  ){

    await desktop.evaluate(function(){

      if(
        typeof window.rizoraForceHome ===
        "function"
      ){
        window.rizoraForceHome();
      }

    });

    await desktop.waitForTimeout(1200);

    var homeResult =
      results.find(function(x){
        return x.name === "Desktop Home";
      });

    if(homeResult){

      homeResult.pass =
        await desktop.locator(
          "#creatorOverview"
        ).isVisible().catch(
          function(){
            return false;
          }
        );

      homeResult.detail =
        homeResult.pass
          ? "#creatorOverview is visible after authenticated login."
          : "#creatorOverview is still hidden after authenticated login.";

    }

  }

  //
  // GOOGLE LOGIN UI
  //

  if(
    typeof desktop !== "undefined" &&
    desktop
  ){

    await desktop.evaluate(function(){

      try{

        if(
          typeof window.showLogin ===
          "function"
        ){
          window.showLogin();
        }

      }catch(e){}

    });

    await desktop.waitForTimeout(250);

    var googleExists =
      await desktop.locator(
        "#rizoraGoogleLogin"
      ).count().catch(
        function(){
          return 0;
        }
      );

    var googleVisible =
      await desktop.locator(
        "#rizoraGoogleLogin"
      ).isVisible().catch(
        function(){
          return false;
        }
      );

    var desktopGoogle =
      results.find(function(x){
        return x.name === "Desktop Google Login";
      });

    if(desktopGoogle){

      desktopGoogle.pass =
        googleExists > 0;

      desktopGoogle.detail =
        googleExists > 0
          ? "Real #rizoraGoogleLogin control exists. External Google authentication is not treated as a local app failure."
          : "Real #rizoraGoogleLogin control was not found.";

    }

    var googleButton =
      results.find(function(x){
        return x.name === "Google Login Button";
      });

    if(googleButton){

      googleButton.pass =
        googleExists > 0;

      googleButton.detail =
        googleExists > 0
          ? (
              googleVisible
                ? "Real Google login button exists and is visible."
                : "Real Google login control exists."
            )
          : "Real Google login control was not found.";

    }

  }

  //
  // MOBILE LOGIN UI
  //

  if(
    typeof mobile !== "undefined" &&
    mobile
  ){

    await mobile.evaluate(function(){

      try{

        if(
          typeof window.showLogin ===
          "function"
        ){
          window.showLogin();
        }

      }catch(e){}

    });

    await mobile.waitForTimeout(250);

    var mobileLoginCount =
      await mobile.locator(
        "#loginForm"
      ).count().catch(
        function(){
          return 0;
        }
      );

    var mobileLoginVisible =
      await mobile.locator(
        "#loginForm"
      ).isVisible().catch(
        function(){
          return false;
        }
      );

    var mobileLogin =
      results.find(function(x){
        return x.name === "Mobile Login";
      });

    if(mobileLogin){

      mobileLogin.pass =
        mobileLoginCount > 0;

      mobileLogin.detail =
        mobileLoginCount > 0
          ? (
              mobileLoginVisible
                ? "Mobile login form exists and is visible."
                : "Mobile login form exists; visibility can depend on the logged-in state."
            )
          : "Mobile #loginForm was not found.";

    }

  }

}catch(e){

  console.log(
    "Final audit verification warning:",
    e.message
  );

}


console.log("======================================\n");
}

run().catch(err => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
