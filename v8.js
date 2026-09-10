(() => {
  "use strict";

  if (document.getElementById("rizora-v8")) return;

  const style = document.createElement("style");
  style.id = "rizora-v8";
  style.textContent = `
    :root{
      --rz8-bg:#08090f;
      --rz8-panel:rgba(17,18,29,.82);
      --rz8-panel-2:rgba(25,26,42,.72);
      --rz8-line:rgba(255,255,255,.08);
      --rz8-text:#f7f7fb;
      --rz8-muted:#9699aa;
      --rz8-purple:#8b5cf6;
      --rz8-purple-2:#a855f7;
      --rz8-green:#31d48c;
      --rz8-blue:#5ea7ff;
    }

    .rz8-brand{
      display:flex;
      align-items:center;
      gap:11px;
      padding:6px 2px 18px;
      margin-bottom:10px;
    }

    .rz8-logo{
      width:42px;
      height:42px;
      border-radius:13px;
      display:grid;
      place-items:center;
      font-size:22px;
      font-weight:900;
      color:#fff;
      background:
        radial-gradient(circle at 30% 25%,rgba(255,255,255,.22),transparent 28%),
        linear-gradient(135deg,#7c3aed,#a855f7 55%,#4f46e5);
      box-shadow:
        0 0 0 1px rgba(255,255,255,.08),
        0 10px 35px rgba(124,58,237,.35);
    }

    .rz8-brand-name{
      font-size:18px;
      font-weight:900;
      letter-spacing:.16em;
      color:#fff;
    }

    .rz8-brand-sub{
      font-size:10px;
      margin-top:2px;
      color:var(--rz8-muted);
      letter-spacing:.08em;
      text-transform:uppercase;
    }

    .rz8-premium{
      position:relative;
      overflow:hidden;
      margin:0 0 22px;
      padding:22px;
      border:1px solid rgba(139,92,246,.25);
      border-radius:22px;
      background:
        radial-gradient(circle at 90% 10%,rgba(168,85,247,.20),transparent 32%),
        radial-gradient(circle at 0% 100%,rgba(79,70,229,.16),transparent 34%),
        linear-gradient(145deg,rgba(19,20,34,.97),rgba(11,12,20,.98));
      box-shadow:0 18px 55px rgba(0,0,0,.25);
    }

    .rz8-premium::after{
      content:"";
      position:absolute;
      inset:-45%;
      background:linear-gradient(120deg,transparent 35%,rgba(255,255,255,.035) 50%,transparent 65%);
      transform:rotate(8deg);
      pointer-events:none;
    }

    .rz8-kicker{
      display:inline-flex;
      align-items:center;
      gap:7px;
      font-size:10px;
      font-weight:800;
      letter-spacing:.13em;
      text-transform:uppercase;
      color:#c4b5fd;
      margin-bottom:8px;
    }

    .rz8-kicker-dot{
      width:7px;
      height:7px;
      border-radius:999px;
      background:var(--rz8-green);
      box-shadow:0 0 13px rgba(49,212,140,.65);
    }

    .rz8-title{
      margin:0;
      color:#fff;
      font-size:25px;
      line-height:1.05;
      font-weight:900;
    }

    .rz8-copy{
      margin:9px 0 0;
      max-width:720px;
      color:var(--rz8-muted);
      font-size:13px;
      line-height:1.6;
    }

    .rz8-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:12px;
      margin-top:18px;
    }

    .rz8-card{
      position:relative;
      padding:16px;
      border-radius:17px;
      border:1px solid var(--rz8-line);
      background:rgba(255,255,255,.025);
    }

    .rz8-card-label{
      color:var(--rz8-muted);
      font-size:11px;
      text-transform:uppercase;
      letter-spacing:.09em;
    }

    .rz8-card-value{
      margin-top:7px;
      color:#fff;
      font-size:22px;
      font-weight:900;
    }

    .rz8-card-note{
      margin-top:5px;
      color:#aaaabd;
      font-size:11px;
      line-height:1.45;
    }

    .rz8-actions{
      display:flex;
      flex-wrap:wrap;
      gap:9px;
      margin-top:18px;
    }

    .rz8-action{
      border:0;
      border-radius:12px;
      padding:10px 14px;
      font-size:12px;
      font-weight:800;
      cursor:pointer;
      color:#fff;
      background:linear-gradient(135deg,var(--rz8-purple),var(--rz8-purple-2));
      box-shadow:0 8px 24px rgba(139,92,246,.18);
    }

    .rz8-action.secondary{
      background:rgba(255,255,255,.05);
      border:1px solid var(--rz8-line);
      box-shadow:none;
    }

    .rz8-intel{
      display:grid;
      grid-template-columns:1.2fr .8fr;
      gap:14px;
      margin:0 0 22px;
    }

    .rz8-intel-box{
      border:1px solid var(--rz8-line);
      background:linear-gradient(145deg,rgba(19,20,32,.9),rgba(12,13,22,.96));
      border-radius:20px;
      padding:20px;
    }

    .rz8-intel-head{
      display:flex;
      justify-content:space-between;
      gap:15px;
      align-items:flex-start;
    }

    .rz8-mini-badge{
      padding:6px 9px;
      border-radius:999px;
      background:rgba(49,212,140,.08);
      color:#78efb7;
      border:1px solid rgba(49,212,140,.16);
      font-size:10px;
      font-weight:900;
      text-transform:uppercase;
      letter-spacing:.08em;
    }

    .rz8-intel-list{
      display:grid;
      gap:9px;
      margin-top:15px;
    }

    .rz8-insight{
      padding:12px 13px;
      border-radius:13px;
      border:1px solid rgba(255,255,255,.06);
      background:rgba(255,255,255,.025);
      color:#d8d8e4;
      font-size:12px;
      line-height:1.5;
    }

    .rz8-insight strong{
      color:#fff;
    }

    .rz8-signal{
      display:flex;
      align-items:center;
      justify-content:center;
      min-height:170px;
      text-align:center;
      padding:20px;
      border-radius:18px;
      background:
        radial-gradient(circle at center,rgba(139,92,246,.19),transparent 58%),
        rgba(255,255,255,.02);
    }

    .rz8-signal-ring{
      width:108px;
      height:108px;
      border-radius:50%;
      display:grid;
      place-items:center;
      margin:auto;
      border:1px solid rgba(139,92,246,.32);
      box-shadow:0 0 55px rgba(139,92,246,.17);
      background:conic-gradient(var(--rz8-purple) var(--rz8-score,0%),rgba(255,255,255,.07) 0);
      position:relative;
    }

    .rz8-signal-ring::before{
      content:"";
      position:absolute;
      inset:9px;
      border-radius:50%;
      background:#0d0e17;
    }

    .rz8-signal-number{
      position:relative;
      z-index:2;
      color:#fff;
      font-size:28px;
      font-weight:900;
    }

    .rz8-signal-label{
      margin-top:10px;
      font-size:11px;
      color:var(--rz8-muted);
      text-transform:uppercase;
      letter-spacing:.08em;
    }

    .rz8-community-grid{
      display:grid;
      grid-template-columns:1.15fr .85fr;
      gap:14px;
      margin-bottom:22px;
    }

    .rz8-community-card{
      border:1px solid var(--rz8-line);
      border-radius:20px;
      background:rgba(13,14,23,.92);
      padding:20px;
    }

    .rz8-community-row{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:12px 0;
      border-bottom:1px solid rgba(255,255,255,.06);
    }

    .rz8-community-row:last-child{
      border-bottom:0;
      padding-bottom:0;
    }

    .rz8-person{
      display:flex;
      align-items:center;
      gap:11px;
      min-width:0;
    }

    .rz8-avatar{
      width:36px;
      height:36px;
      border-radius:12px;
      display:grid;
      place-items:center;
      font-weight:900;
      background:linear-gradient(135deg,#312e81,#7c3aed);
      color:#fff;
      flex:0 0 auto;
    }

    .rz8-person strong{
      display:block;
      color:#fff;
      font-size:12px;
    }

    .rz8-person span{
      display:block;
      margin-top:2px;
      color:var(--rz8-muted);
      font-size:10px;
    }

    .rz8-pill{
      padding:6px 9px;
      border-radius:999px;
      font-size:10px;
      font-weight:900;
      background:rgba(139,92,246,.10);
      border:1px solid rgba(139,92,246,.18);
      color:#c4b5fd;
    }

    @media(max-width:900px){
      .rz8-grid,
      .rz8-intel,
      .rz8-community-grid{
        grid-template-columns:1fr;
      }
    }

    @media(max-width:620px){
      .rz8-premium,
      .rz8-intel-box,
      .rz8-community-card{
        padding:16px;
      }

      .rz8-title{
        font-size:21px;
      }
    }
  `;

  document.head.appendChild(style);

  function getJSON(key, fallback){
    try{
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    }catch{
      return fallback;
    }
  }

  function boostHistory(){
    const a = getJSON("rizoraHistory", []);
    return Array.isArray(a) ? a : [];
  }

  function profile(){
    return getJSON("rizoraProfile", {});
  }

  function ideas(){
    const a = getJSON("rizoraIdeas", []);
    return Array.isArray(a) ? a : [];
  }

  function experiments(){
    const a = getJSON("rizoraExperiments", []);
    return Array.isArray(a) ? a : [];
  }

  function averageScore(list){
    const scores = list
      .map(x => Number(x?.score))
      .filter(Number.isFinite);

    if (!scores.length) return null;

    return Math.round(
      scores.reduce((a,b)=>a+b,0) / scores.length
    );
  }

  function latestScore(list){
    for(let i=list.length-1;i>=0;i--){
      const n=Number(list[i]?.score);
      if(Number.isFinite(n)) return n;
    }
    return null;
  }

  function bestScore(list){
    const scores=list
      .map(x=>Number(x?.score))
      .filter(Number.isFinite);

    return scores.length ? Math.max(...scores) : null;
  }

  function navTo(id){
    const btn = document.querySelector(
      `[data-section="${id}"], [data-target="${id}"], [href="#${id}"]`
    );

    if (typeof window.showSection === "function"){
      const section = document.getElementById(id);
      if(section){
        window.showSection(id, btn || null);
        return;
      }
    }

    const section=document.getElementById(id);
    if(section){
      document.querySelectorAll("section").forEach(s=>s.style.display="none");
      section.style.display="block";
      window.scrollTo({top:0,behavior:"smooth"});
    }
  }

  function createBrand(){
    if(document.getElementById("rz8-brand")) return;

    const host =
      document.querySelector(".sidebar") ||
      document.querySelector("aside") ||
      document.querySelector("nav");

    if(!host) return;

    const brand=document.createElement("div");
    brand.id="rz8-brand";
    brand.className="rz8-brand";
    brand.innerHTML=`
      <div class="rz8-logo">R</div>
      <div>
        <div class="rz8-brand-name">RIZORA</div>
        <div class="rz8-brand-sub">Creator Growth Studio</div>
      </div>
    `;

    host.prepend(brand);
  }

  function createPulse(){
    const overview=document.getElementById("overview");
    if(!overview || document.getElementById("rz8-overview")) return;

    const history=boostHistory();
    const avg=averageScore(history);
    const best=bestScore(history);
    const latest=latestScore(history);
    const profileData=profile();
    const ideaCount=ideas().length;

    const pulse=document.createElement("div");
    pulse.id="rz8-overview";
    pulse.className="rz8-premium";

    pulse.innerHTML=`
      <div class="rz8-kicker">
        <span class="rz8-kicker-dot"></span>
        RIZORA intelligence layer
      </div>

      <h2 class="rz8-title">Your content. Your patterns. Your next move.</h2>

      <p class="rz8-copy">
        RIZORA now connects your boost results, saved ideas, experiments and creator profile
        into one clearer growth snapshot.
      </p>

      <div class="rz8-grid">
        <div class="rz8-card">
          <div class="rz8-card-label">Latest boost</div>
          <div class="rz8-card-value">${latest ?? "—"}</div>
          <div class="rz8-card-note">${latest == null ? "Run Boost Studio to create a signal." : "Your most recent performance signal."}</div>
        </div>

        <div class="rz8-card">
          <div class="rz8-card-label">Average</div>
          <div class="rz8-card-value">${avg ?? "—"}</div>
          <div class="rz8-card-note">${avg == null ? "Build your first result history." : "Across your saved boost results."}</div>
        </div>

        <div class="rz8-card">
          <div class="rz8-card-label">Ideas saved</div>
          <div class="rz8-card-value">${ideaCount}</div>
          <div class="rz8-card-note">${profileData?.username ? "Personalized around @" + profileData.username : "Add your creator profile for deeper personalization."}</div>
        </div>
      </div>

      <div class="rz8-actions">
        <button class="rz8-action" id="rz8Boost">Open Boost Studio</button>
        <button class="rz8-action secondary" id="rz8Intel">Open Personalized Intelligence</button>
        <button class="rz8-action secondary" id="rz8Community">Open Community Hub</button>
      </div>
    `;

    const firstChild=overview.firstElementChild;
    if(firstChild) overview.insertBefore(pulse,firstChild);
    else overview.appendChild(pulse);

    document.getElementById("rz8Boost")?.addEventListener("click",()=>navTo("boost"));
    document.getElementById("rz8Intel")?.addEventListener("click",()=>navTo("intelligence"));
    document.getElementById("rz8Community")?.addEventListener("click",()=>navTo("community"));
  }

  function createIntelligence(){
    let section=document.getElementById("intelligence");

    if(!section){
      const existing=[...document.querySelectorAll("section")].find(s =>
        /intelligence/i.test(s.textContent || "")
      );

      if(existing) section=existing;
    }

    if(!section){
      section=document.createElement("section");
      section.id="intelligence";
      section.className="page-section";
      section.innerHTML=`<div></div>`;

      const settings=document.getElementById("settings");
      if(settings && settings.parentNode){
        settings.parentNode.insertBefore(section,settings);
      }else{
        document.body.appendChild(section);
      }

      const nav=document.querySelector(".sidebar nav, aside nav, nav");
      if(nav){
        const item=document.createElement("button");
        item.className="nav-btn";
        item.innerHTML="Personalized Intelligence";
        item.addEventListener("click",()=>navTo("intelligence"));
        nav.appendChild(item);
      }
    }

    if(document.getElementById("rz8-intelligence")) return;

    const history=boostHistory();
    const avg=averageScore(history);
    const best=bestScore(history);
    const latest=latestScore(history);
    const p=profile();
    const exp=experiments();

    let direction="Build your first performance history.";
    if(latest !== null){
      if(latest >= 85) direction="Your recent content is showing strong performance signals.";
      else if(latest >= 70) direction="You have a workable base. Sharpen hooks and packaging.";
      else direction="Focus on stronger hooks, clearer structure and tighter packaging.";
    }

    const profileSignal =
      p?.username || p?.niche || p?.platform
        ? `Profile-aware mode is active${p.username ? " for @" + p.username : ""}.`
        : "Complete Creator Profile to unlock stronger personalization.";

    const panel=document.createElement("div");
    panel.id="rz8-intelligence";
    panel.className="rz8-intel";

    const left=document.createElement("div");
    left.className="rz8-intel-box";
    left.innerHTML=`
      <div class="rz8-intel-head">
        <div>
          <div class="rz8-kicker">Personalized Intelligence</div>
          <h2 class="rz8-title" style="font-size:22px">RIZORA reads your signals</h2>
        </div>
        
      </div>

      <div class="rz8-intel-list">
        <div class="rz8-insight"><strong>Current direction:</strong> ${direction}</div>
        <div class="rz8-insight"><strong>Performance memory:</strong> ${avg === null ? "No average yet." : "Average boost score is " + avg + "."} ${best === null ? "" : "Best recorded score: " + best + "."}</div>
        <div class="rz8-insight"><strong>Creator profile:</strong> ${profileSignal}</div>
        <div class="rz8-insight"><strong>Experiment signal:</strong> ${exp.length ? exp.length + " saved experiment" + (exp.length===1?"":"s") + " available for comparison." : "No experiments saved yet."}</div>
      </div>
    `;

    const right=document.createElement("div");
    right.className="rz8-intel-box";

    const signal=latest ?? 0;
    right.innerHTML=`
      <div class="rz8-signal">
        <div>
          <div class="rz8-signal-ring" style="--rz8-score:${Math.max(0,Math.min(100,signal))}%">
            <div class="rz8-signal-number">${latest ?? "—"}</div>
          </div>
          <div class="rz8-signal-label">${latest === null ? "No performance signal" : "Latest creator signal"}</div>
        </div>
      </div>
    `;

    panel.appendChild(left);
    panel.appendChild(right);

    const children=[...section.children];
    const heading=children[0];

    if(heading && heading.tagName === "DIV"){
      section.insertBefore(panel,heading);
    }else{
      section.prepend(panel);
    }
  }

  function createCommunityUpgrade(){
    const section=document.getElementById("community");
    if(!section || document.getElementById("rz8-community")) return;

    const community=getJSON("rizoraCommunity", []);
    const list=Array.isArray(community) ? community : [];

    const card=document.createElement("div");
    card.id="rz8-community";
    card.className="rz8-community-grid";

    const activity=document.createElement("div");
    activity.className="rz8-community-card";

    const shown=list.slice(-4).reverse();

    activity.innerHTML=`
      <div class="rz8-kicker">Community signal</div>
      <h2 class="rz8-title" style="font-size:22px">Creator activity</h2>
      <p class="rz8-copy">A cleaner view of the people, missions and activity around your RIZORA workspace.</p>
      <div style="margin-top:12px">
        ${
          shown.length
          ? shown.map((x,i)=>`
            <div class="rz8-community-row">
              <div class="rz8-person">
                <div class="rz8-avatar">${String(x?.username || x?.name || "C").replace("@","").charAt(0).toUpperCase()}</div>
                <div>
                  <strong>${x?.username || x?.name || "Creator"}</strong>
                  <span>${x?.points ?? x?.score ?? 0} points</span>
                </div>
              </div>
              <span class="rz8-pill">CREATOR</span>
            </div>
          `).join("")
          : `
            <div class="rz8-insight">
              <strong>Your hub is ready.</strong><br>
              Start missions, build points and connect your creator profile.
            </div>
          `
        }
      </div>
    `;

    const rank=document.createElement("div");
    rank.className="rz8-community-card";
    rank.innerHTML=`
      <div class="rz8-kicker">Your position</div>
      <h2 class="rz8-title" style="font-size:22px">Build your creator presence.</h2>
      <p class="rz8-copy">Community rewards become more useful when your profile and activity stay connected.</p>

      <div class="rz8-grid" style="grid-template-columns:1fr 1fr;margin-top:16px">
        <div class="rz8-card">
          <div class="rz8-card-label">Community entries</div>
          <div class="rz8-card-value">${list.length}</div>
        </div>
        <div class="rz8-card">
          <div class="rz8-card-label">Ideas</div>
          <div class="rz8-card-value">${ideas().length}</div>
        </div>
      </div>

      <div class="rz8-actions">
        <button class="rz8-action" id="rz8ProfileBtn">Tune Creator Profile</button>
        <button class="rz8-action secondary" id="rz8ExpBtn">Open Experiment Lab</button>
      </div>
    `;

    card.appendChild(activity);
    card.appendChild(rank);

    const first=section.firstElementChild;
    if(first) section.insertBefore(card,first);
    else section.appendChild(card);

    document.getElementById("rz8ProfileBtn")?.addEventListener("click",()=>navTo("profile"));
    document.getElementById("rz8ExpBtn")?.addEventListener("click",()=>navTo("experiments"));
  }

  function renameLabels(){
    document.querySelectorAll(".nav-btn, nav button, aside button").forEach(btn=>{
      const text=(btn.textContent || "").trim().toLowerCase();

      if(text.includes("community hub")){
        const icon=btn.querySelector("i,span");
        if(icon) return;
        btn.innerHTML="&#129309; Community Hub";
      }

      if(text.includes("personalized intelligence") || text.includes("personalised intelligence")){
        const icon=btn.querySelector("i,span");
        if(icon) return;
        btn.innerHTML="&#129504; Personalized Intelligence";
      }
    });
  }

  function run(){
    createBrand();
    renameLabels();
    createPulse();
    createIntelligence();
    createCommunityUpgrade();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",run,{once:true});
  }else{
    run();
  }

  window.addEventListener("storage",()=>{
    setTimeout(run,50);
  });
})();
