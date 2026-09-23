$ErrorActionPreference = "Stop"

$Root = "C:\Users\USER\OneDrive\Desktop\vs code\RIZORA"
Set-Location $Root

$IndexPath = ".\index.html"

if (!(Test-Path $IndexPath)) {
    throw "index.html was not found."
}

function Save-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Text
    )

    $enc = New-Object System.Text.UTF8Encoding($false)

    [System.IO.File]::WriteAllText(
        [System.IO.Path]::GetFullPath($Path),
        $Text,
        $enc
    )
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"

$BackupDir =
    Join-Path `
        $Root `
        "RIZORA-FRONTEND-FIX-BACKUP-$Stamp"

New-Item `
    -ItemType Directory `
    -Path $BackupDir `
    -Force |
    Out-Null

Copy-Item `
    $IndexPath `
    (Join-Path $BackupDir "index.html") `
    -Force

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " RIZORA FRONTEND REAL FIX" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backup:" -ForegroundColor Green
Write-Host $BackupDir
Write-Host ""

$Index =
    Get-Content `
        $IndexPath `
        -Raw

$NL =
    if($Index.Contains("`r`n")){
        "`r`n"
    }else{
        "`n"
    }

$Marker = "RIZORA_LIVE_PRODUCT_HUB_V2"

if(
    $Index -match
    [regex]::Escape($Marker)
){

    Write-Host "RIZORA Product Hub is already installed." -ForegroundColor Yellow
    Write-Host "Nothing else was changed." -ForegroundColor Yellow
    exit 0

}

# ============================================================
# API BOOTSTRAP
# ============================================================

$ApiBootstrap = @'
<script id="RIZORA_API_BOOTSTRAP_V2">
window.RIZORA_API_BASE =
  "https://rizora-guse.onrender.com";
</script>
'@

$ApiBootstrap =
    $ApiBootstrap -replace "`r?`n", $NL

if(
    $Index.Contains("</head>")
){

    if(
        $Index -notmatch
        "RIZORA_API_BOOTSTRAP_V2"
    ){

        $Index =
            $Index.Replace(
                "</head>",
                $ApiBootstrap +
                $NL +
                "</head>"
            )

    }

}

# ============================================================
# PRODUCT HUB
# ============================================================

$Hub = @'
<!-- ============================================================
     RIZORA LIVE PRODUCT HUB V2
     ============================================================ -->

<style id="RIZORA_LIVE_PRODUCT_HUB_V2">

.rz-product-hub{
  position:fixed;
  right:16px;
  bottom:16px;
  z-index:999999;
  display:flex;
  gap:7px;
  align-items:center;
  padding:7px;
  border-radius:18px;
  border:1px solid rgba(167,139,250,.28);
  background:rgba(8,6,16,.92);
  backdrop-filter:blur(18px);
  box-shadow:
    0 22px 70px rgba(0,0,0,.48),
    0 0 30px rgba(124,58,237,.13);
}

.rz-product-hub button{
  border:1px solid rgba(255,255,255,.09);
  background:rgba(255,255,255,.045);
  color:#fff;
  border-radius:12px;
  padding:10px 12px;
  font-size:10px;
  font-weight:900;
  letter-spacing:.04em;
  cursor:pointer;
}

.rz-product-hub button:hover{
  background:rgba(124,58,237,.22);
  border-color:rgba(167,139,250,.46);
  transform:translateY(-1px);
}

.rz-product-overlay{
  position:fixed;
  inset:0;
  z-index:1000000;
  display:none;
  align-items:center;
  justify-content:center;
  padding:16px;
  background:rgba(3,2,8,.84);
  backdrop-filter:blur(18px);
}

.rz-product-overlay.open{
  display:flex;
}

.rz-product-panel{
  width:min(720px,100%);
  max-height:92vh;
  overflow:auto;
  border-radius:24px;
  border:1px solid rgba(167,139,250,.24);
  background:
    linear-gradient(
      180deg,
      rgba(25,17,42,.98),
      rgba(7,5,13,.99)
    );
  padding:20px;
  box-shadow:0 35px 120px rgba(0,0,0,.58);
}

.rz-product-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:14px;
  margin-bottom:15px;
}

.rz-product-eyebrow{
  font-size:10px;
  font-weight:1000;
  letter-spacing:.17em;
  color:#a78bfa;
}

.rz-product-title{
  margin:5px 0 0;
  color:#fff;
  font-size:28px;
}

.rz-product-copy{
  margin:8px 0 0;
  color:rgba(255,255,255,.58);
  line-height:1.6;
}

.rz-product-close{
  border:1px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.05);
  color:#fff;
  border-radius:12px;
  padding:9px 12px;
  cursor:pointer;
}

.rz-product-input,
.rz-product-textarea{
  width:100%;
  box-sizing:border-box;
  margin-top:10px;
  padding:12px 13px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.1);
  outline:none;
  background:rgba(0,0,0,.24);
  color:#fff;
}

.rz-product-textarea{
  min-height:130px;
  resize:vertical;
}

.rz-product-input:focus,
.rz-product-textarea:focus{
  border-color:rgba(167,139,250,.7);
}

.rz-product-primary{
  border:1px solid rgba(167,139,250,.42);
  background:linear-gradient(135deg,#7c3aed,#5b21b6);
  color:#fff;
  border-radius:13px;
  padding:11px 15px;
  margin-top:11px;
  font-weight:900;
  cursor:pointer;
}

.rz-product-status{
  min-height:20px;
  margin-top:10px;
  color:#c4b5fd;
  font-size:13px;
}

.rz-product-reply{
  margin-top:12px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:15px;
  padding:14px;
  background:rgba(0,0,0,.2);
  color:rgba(255,255,255,.82);
  line-height:1.7;
  white-space:pre-wrap;
}

.rz-product-ticket{
  margin-top:12px;
  padding:13px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.07);
  background:rgba(255,255,255,.025);
}

.rz-product-ticket-top{
  display:flex;
  justify-content:space-between;
  gap:10px;
}

.rz-product-ticket-status{
  color:#c4b5fd;
  font-size:10px;
  font-weight:900;
  text-transform:uppercase;
}

.rz-product-msg{
  margin-top:9px;
  padding:10px;
  border-radius:12px;
  background:rgba(255,255,255,.035);
  color:rgba(255,255,255,.73);
}

.rz-product-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px;
  margin-top:15px;
}

.rz-product-card{
  padding:14px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:16px;
  background:rgba(255,255,255,.025);
}

.rz-product-card strong{
  color:#fff;
}

.rz-product-card span{
  display:block;
  margin-top:5px;
  color:rgba(255,255,255,.5);
  line-height:1.5;
  font-size:12px;
}

@media(max-width:700px){

  .rz-product-hub{
    left:9px;
    right:9px;
    bottom:9px;
    justify-content:space-between;
  }

  .rz-product-hub button{
    flex:1;
    padding:10px 4px;
    font-size:9px;
  }

  .rz-product-grid{
    grid-template-columns:1fr;
  }

  .rz-product-panel{
    border-radius:20px;
    padding:15px;
  }

}

</style>

<div
  id="rzProductHub"
  class="rz-product-hub"
>

  <button type="button" data-rz-product="ai">
    AI
  </button>

  <button type="button" data-rz-product="growth">
    GROWTH
  </button>

  <button type="button" data-rz-product="help">
    HELP
  </button>

  <button type="button" data-rz-product="verify">
    VERIFY
  </button>

  <button type="button" data-rz-product="install">
    INSTALL
  </button>

</div>

<div
  id="rzProductAI"
  class="rz-product-overlay"
  aria-hidden="true"
>

  <div class="rz-product-panel">

    <div class="rz-product-head">

      <div>

        <div class="rz-product-eyebrow">
          RIZORA CREATOR INTELLIGENCE
        </div>

        <h2 class="rz-product-title">
          RIZORA AI
        </h2>

        <p class="rz-product-copy">
          Get hooks, captions, creator strategy, profile ideas,
          content ideas and growth plans.
        </p>

      </div>

      <button
        type="button"
        class="rz-product-close"
        data-rz-close="ai"
      >
        Close
      </button>

    </div>

    <textarea
      id="rzProductAIPrompt"
      class="rz-product-textarea"
      maxlength="4000"
      placeholder="Ask RIZORA AI..."
    ></textarea>

    <button
      id="rzProductAISend"
      type="button"
      class="rz-product-primary"
    >
      Ask RIZORA AI
    </button>

    <div
      id="rzProductAIStatus"
      class="rz-product-status"
    ></div>

    <div
      id="rzProductAIReply"
      class="rz-product-reply"
    >
      Your response will appear here.
    </div>

  </div>

</div>

<div
  id="rzProductHelp"
  class="rz-product-overlay"
  aria-hidden="true"
>

  <div class="rz-product-panel">

    <div class="rz-product-head">

      <div>

        <div class="rz-product-eyebrow">
          RIZORA SUPPORT
        </div>

        <h2 class="rz-product-title">
          Help Center
        </h2>

        <p class="rz-product-copy">
          Message the RIZORA Command Center and track your support
          conversations.
        </p>

      </div>

      <button
        type="button"
        class="rz-product-close"
        data-rz-close="help"
      >
        Close
      </button>

    </div>

    <input
      id="rzProductSupportSubject"
      class="rz-product-input"
      maxlength="160"
      placeholder="What do you need help with?"
    >

    <textarea
      id="rzProductSupportMessage"
      class="rz-product-textarea"
      maxlength="5000"
      placeholder="Tell us what happened..."
    ></textarea>

    <button
      id="rzProductSupportSend"
      type="button"
      class="rz-product-primary"
    >
      Send to RIZORA Support
    </button>

    <div
      id="rzProductSupportStatus"
      class="rz-product-status"
    ></div>

    <div
      id="rzProductTickets"
    ></div>

  </div>

</div>

<div
  id="rzProductGrowth"
  class="rz-product-overlay"
  aria-hidden="true"
>

  <div class="rz-product-panel">

    <div class="rz-product-head">

      <div>

        <div class="rz-product-eyebrow">
          RIZORA CREATOR GROWTH
        </div>

        <h2 class="rz-product-title">
          Growth Center
        </h2>

        <p class="rz-product-copy">
          Build your creator momentum with RIZORA missions,
          campaigns and rewards.
        </p>

      </div>

      <button
        type="button"
        class="rz-product-close"
        data-rz-close="growth"
      >
        Close
      </button>

    </div>

    <div class="rz-product-grid">

      <div class="rz-product-card">

        <strong>
          Official Missions
        </strong>

        <span>
          Complete RIZORA missions and earn points.
        </span>

        <button
          type="button"
          class="rz-product-primary"
          data-rz-growth-action="missions"
        >
          Open Missions
        </button>

      </div>

      <div class="rz-product-card">

        <strong>
          Creator Campaigns
        </strong>

        <span>
          Launch or complete creator growth campaigns.
        </span>

        <button
          type="button"
          class="rz-product-primary"
          data-rz-growth-action="campaigns"
        >
          Open Campaigns
        </button>

      </div>

    </div>

  </div>

</div>

<script id="RIZORA_LIVE_PRODUCT_HUB_V2">
(function(){

  if(
    window.__RIZORA_LIVE_PRODUCT_HUB_V2__
  ){
    return;
  }

  window.__RIZORA_LIVE_PRODUCT_HUB_V2__ =
    true;

  var API =
    window.RIZORA_API_BASE ||
    "https://rizora-guse.onrender.com";

  var deferredInstallPrompt =
    null;

  function byId(id){
    return document.getElementById(id);
  }

  function getToken(){
    return (
      localStorage.getItem("rizoraToken") ||
      localStorage.getItem("rizora_token") ||
      ""
    );
  }

  function loggedIn(){
    return !!getToken();
  }

  function needLogin(){

    if(loggedIn()){
      return true;
    }

    if(
      typeof window.showLogin ===
      "function"
    ){

      window.showLogin();

    }else{

      alert(
        "Please log in to use this RIZORA feature."
      );

    }

    return false;

  }

  function openPanel(id){

    var node =
      byId(id);

    if(!node){
      return;
    }

    node.classList.add("open");

    node.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.style.overflow =
      "hidden";

  }

  function closePanel(id){

    var node =
      byId(id);

    if(!node){
      return;
    }

    node.classList.remove("open");

    node.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.style.overflow =
      "";

  }

  async function api(
    path,
    options
  ){

    var headers =
      Object.assign(
        {
          "Content-Type":
            "application/json"
        },
        (
          options &&
          options.headers
        ) || {}
      );

    var token =
      getToken();

    if(token){

      headers.Authorization =
        "Bearer " + token;

    }

    var response =
      await fetch(
        API + path,
        Object.assign(
          {
            credentials:
              "include",
            headers:
              headers
          },
          options || {},
          {
            headers:
              headers
          }
        )
      );

    var data = {};

    try{

      data =
        await response.json();

    }catch(_){

      data = {};

    }

    if(
      !response.ok
    ){

      throw new Error(
        data.error ||
        data.message ||
        (
          "RIZORA request failed (" +
          response.status +
          ")."
        )
      );

    }

    return data;

  }

  function escapeHTML(value){

    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  }

  async function askAI(){

    if(
      !needLogin()
    ){
      return;
    }

    var prompt =
      (
        byId(
          "rzProductAIPrompt"
        ).value ||
        ""
      ).trim();

    var status =
      byId(
        "rzProductAIStatus"
      );

    var reply =
      byId(
        "rzProductAIReply"
      );

    if(!prompt){

      reply.textContent =
        "Type something first.";

      return;

    }

    status.textContent =
      "Connecting to RIZORA AI...";

    reply.textContent =
      "";

    try{

      var result =
        await api(
          "/api/ai/chat",
          {
            method:"POST",

            body:
              JSON.stringify({
                message:
                  prompt
              })
          }
        );

      reply.textContent =
        result.reply ||
        "RIZORA AI returned no response.";

      status.textContent =
        (
          result.provider
            ? "Connected · " +
              result.provider +
              " · " +
              (
                result.model ||
                ""
              )
            : "RIZORA AI connected."
        );

    }catch(error){

      status.textContent =
        "RIZORA AI request failed.";

      reply.textContent =
        error.message;

    }

  }

  async function loadSupport(){

    if(
      !needLogin()
    ){
      return;
    }

    var box =
      byId(
        "rzProductTickets"
      );

    try{

      var result =
        await api(
          "/api/support/tickets"
        );

      var tickets =
        Array.isArray(
          result.tickets
        )
          ? result.tickets
          : [];

      if(!tickets.length){

        box.innerHTML =
          '<div class="rz-product-ticket">No support conversations yet.</div>';

        return;

      }

      box.innerHTML =
        tickets
          .slice(
            0,
            20
          )
          .map(
            function(ticket){

              var messages =
                Array.isArray(
                  ticket.messages
                )
                  ? ticket.messages
                  : [];

              return `
                <div class="rz-product-ticket">

                  <div class="rz-product-ticket-top">

                    <strong>
                      ${escapeHTML(
                        ticket.subject ||
                        "RIZORA Support"
                      )}
                    </strong>

                    <span class="rz-product-ticket-status">
                      ${escapeHTML(
                        ticket.status ||
                        "open"
                      )}
                    </span>

                  </div>

                  ${
                    messages
                      .slice(-5)
                      .map(
                        function(message){

                          return `
                            <div class="rz-product-msg">

                              <strong>
                                ${escapeHTML(
                                  message.senderName ||
                                  "RIZORA"
                                )}
                              </strong>

                              <div>
                                ${escapeHTML(
                                  message.message ||
                                  ""
                                )}
                              </div>

                            </div>
                          `;

                        }
                      )
                      .join("")
                  }

                </div>
              `;

            }
          )
          .join("");

    }catch(error){

      box.innerHTML =
        '<div class="rz-product-ticket">' +
        escapeHTML(
          error.message
        ) +
        '</div>';

    }

  }

  async function sendSupport(){

    if(
      !needLogin()
    ){
      return;
    }

    var subject =
      (
        byId(
          "rzProductSupportSubject"
        ).value ||
        ""
      ).trim();

    var message =
      (
        byId(
          "rzProductSupportMessage"
        ).value ||
        ""
      ).trim();

    var status =
      byId(
        "rzProductSupportStatus"
      );

    if(!message){

      status.textContent =
        "Enter your support message.";

      return;

    }

    status.textContent =
      "Sending to Command Center...";

    try{

      await api(
        "/api/support/tickets",
        {
          method:"POST",

          body:
            JSON.stringify({
              subject:
                subject ||
                "RIZORA Help Request",

              message
            })
        }
      );

      byId(
        "rzProductSupportSubject"
      ).value =
        "";

      byId(
        "rzProductSupportMessage"
      ).value =
        "";

      status.textContent =
        "Support request sent.";

      await loadSupport();

    }catch(error){

      status.textContent =
        error.message;

    }

  }

  function openAI(){

    if(
      !needLogin()
    ){
      return;
    }

    openPanel(
      "rzProductAI"
    );

    setTimeout(
      function(){

        byId(
          "rzProductAIPrompt"
        )?.focus();

      },
      50
    );

  }

  function openHelp(){

    if(
      !needLogin()
    ){
      return;
    }

    openPanel(
      "rzProductHelp"
    );

    loadSupport();

  }

  function openGrowth(){

    if(
      !needLogin()
    ){
      return;
    }

    openPanel(
      "rzProductGrowth"
    );

  }

  function openVerification(){

    if(
      !needLogin()
    ){
      return;
    }

    if(
      typeof window.rizoraOpenVerification ===
      "function"
    ){

      window.rizoraOpenVerification();

      return;

    }

    if(
      typeof window.navigate ===
      "function"
    ){

      window.navigate(
        "verification"
      );

      return;

    }

    var launcher =
      byId(
        "rzVerificationLauncher"
      );

    if(
      launcher
    ){

      launcher.click();

    }else{

      alert(
        "Verification is unavailable on this build."
      );

    }

  }

  function openMissions(){

    closePanel(
      "rzProductGrowth"
    );

    if(
      typeof window.navigate ===
      "function"
    ){

      window.navigate(
        "dashboard"
      );

      return;

    }

    var fab =
      byId(
        "rzCompleteFab"
      );

    if(
      fab
    ){
      fab.click();
    }

  }

  function openCampaigns(){

    closePanel(
      "rzProductGrowth"
    );

    if(
      typeof window.rzOpenCompleteUpgrade ===
      "function"
    ){

      window.rzOpenCompleteUpgrade();

      return;

    }

    var fab =
      byId(
        "rzCompleteFab"
      );

    if(
      fab
    ){
      fab.click();
    }

  }

  function installRIZORA(){

    if(
      deferredInstallPrompt
    ){

      deferredInstallPrompt.prompt();

      deferredInstallPrompt
        .userChoice
        .catch(
          function(){}
        );

      deferredInstallPrompt =
        null;

      return;

    }

    alert(
      "Use your browser's Install RIZORA / Add to Home Screen option."
    );

  }

  document.addEventListener(
    "click",
    function(event){

      var tool =
        event.target.closest(
          "[data-rz-product]"
        );

      if(tool){

        var action =
          tool.getAttribute(
            "data-rz-product"
          );

        if(
          action === "ai"
        ){
          openAI();
        }

        if(
          action === "growth"
        ){
          openGrowth();
        }

        if(
          action === "help"
        ){
          openHelp();
        }

        if(
          action === "verify"
        ){
          openVerification();
        }

        if(
          action === "install"
        ){
          installRIZORA();
        }

      }

      var closeButton =
        event.target.closest(
          "[data-rz-close]"
        );

      if(closeButton){

        var closeName =
          closeButton.getAttribute(
            "data-rz-close"
          );

        if(
          closeName === "ai"
        ){
          closePanel("rzProductAI");
        }

        if(
          closeName === "help"
        ){
          closePanel("rzProductHelp");
        }

        if(
          closeName === "growth"
        ){
          closePanel("rzProductGrowth");
        }

      }

      var growthAction =
        event.target.closest(
          "[data-rz-growth-action]"
        );

      if(growthAction){

        var growthType =
          growthAction.getAttribute(
            "data-rz-growth-action"
          );

        if(
          growthType === "missions"
        ){
          openMissions();
        }

        if(
          growthType === "campaigns"
        ){
          openCampaigns();
        }

      }

    }
  );

  byId(
    "rzProductAISend"
  )?.addEventListener(
    "click",
    askAI
  );

  byId(
    "rzProductSupportSend"
  )?.addEventListener(
    "click",
    sendSupport
  );

  document.addEventListener(
    "keydown",
    function(event){

      if(
        event.key ===
        "Escape"
      ){

        closePanel(
          "rzProductAI"
        );

        closePanel(
          "rzProductHelp"
        );

        closePanel(
          "rzProductGrowth"
        );

      }

    }
  );

  window.addEventListener(
    "beforeinstallprompt",
    function(event){

      event.preventDefault();

      deferredInstallPrompt =
        event;

    }
  );

  if(
    "serviceWorker" in navigator
  ){

    window.addEventListener(
      "load",
      function(){

        navigator.serviceWorker
          .register(
            "/service-worker.js"
          )
          .catch(
            function(){}
          );

      }
    );

  }

})();
</script>
'@

$Hub =
    $Hub -replace "`r?`n", $NL

if(
    !$Index.Contains("</body>")
){

    throw "Could not find </body>."

}

$Index =
    $Index.Replace(
        "</body>",
        $Hub +
        $NL +
        "</body>"
    )

Save-Utf8NoBom `
    $IndexPath `
    $Index

# ============================================================
# VALIDATE HTML SCRIPT
# ============================================================

$match =
    [regex]::Match(
        $Index,
        '<script id="RIZORA_LIVE_PRODUCT_HUB_V2">([\s\S]*?)</script>',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

if(
    !$match.Success
){

    throw "Product Hub script was not found."

}

$TempJS =
    Join-Path `
        $env:TEMP `
        "rizora-product-hub-check-$Stamp.js"

Save-Utf8NoBom `
    $TempJS `
    $match.Groups[1].Value

node --check $TempJS

if(
    $LASTEXITCODE -ne 0
){

    Remove-Item `
        $TempJS `
        -Force `
        -ErrorAction SilentlyContinue

    Copy-Item `
        (Join-Path $BackupDir "index.html") `
        $IndexPath `
        -Force

    throw "Product Hub JavaScript failed validation. Original index.html restored."

}

Remove-Item `
    $TempJS `
    -Force `
    -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " RIZORA FRONTEND REAL FIX PASSED" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Visible AI"
Write-Host "[OK] Visible Growth"
Write-Host "[OK] Visible Help Center"
Write-Host "[OK] Visible Verification"
Write-Host "[OK] Visible Install"
Write-Host "[OK] Direct Render API base"
Write-Host "[OK] Frontend JavaScript validation"
Write-Host ""
Write-Host "Backup:" -ForegroundColor Cyan
Write-Host $BackupDir
Write-Host ""
Write-Host "SERVER.JS WAS NOT TOUCHED." -ForegroundColor Yellow
Write-Host "DATABASE WAS NOT TOUCHED." -ForegroundColor Yellow
Write-Host ""