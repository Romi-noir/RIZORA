(function(){
"use strict";
var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
window.RIZORA_CURRENT_USER=null;
var state={user:null,profile:null,view:"home",authMode:"login",feedTab:"for-you",feed:[],tasks:[],socialTasks:[],notifications:[],verification:null,safety:null,points:0,query:"",search:null,aiMessages:[],stories:[],communities:[],conversations:[],opportunities:[],analytics:null,boosts:[],official:[],admin:null,adminVerification:[],onboarding:[]};

function $(id){return document.getElementById(id);}
function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function avatar(u){return u&&u.avatarUrl?'<img class="rz-avatar" src="'+esc(u.avatarUrl)+'">':'<div class="rz-avatar">'+esc((u&&(u.displayName||u.username)||"R").slice(0,2).toUpperCase())+"</div>";}
function renderMedia(url){
  var raw=String(url||"").trim(); if(!raw)return "";
  var safe=esc(raw), clean=raw.split("?")[0].toLowerCase();
  if(/\.(jpg|jpeg|png|webp|gif)$/.test(clean)) return '<div class="rz-post-media"><img src="'+safe+'" alt="Creator media" loading="lazy"></div>';
  if(/\.(mp4|webm)$/.test(clean)) return '<div class="rz-post-media"><video controls preload="metadata" src="'+safe+'"></video></div>';
  if(/\.(mp3|m4a|wav|ogg)$/.test(clean)) return '<div class="rz-post-media"><audio controls preload="metadata" src="'+safe+'"></audio></div>';
  return '<div class="rz-post-media"><a class="rz-btn" href="'+safe+'" target="_blank" rel="noopener noreferrer">Open media</a></div>';
}
function bindMediaPicker(fileId,statusId,urlId){
  if(window.RIZORA_MEDIA_BIND) window.RIZORA_MEDIA_BIND(fileId,statusId,urlId);
}
function verified(u){return u&&u.verified?'<img class="rz-verified" src="/assets/rizora_verified_mark.svg" alt="RIZORA Verified" aria-label="Verified creator" title="RIZORA Verified">':"";}
function toast(s){var t=$("toast");if(!t)return;t.textContent=s;t.classList.add("show");clearTimeout(window.__rt);window.__rt=setTimeout(function(){t.classList.remove("show");},2400);}function popup(title,message,kind){
  var old=document.getElementById("rzGlobalPopup");if(old)old.remove();
  var overlay=document.createElement("div");
  overlay.id="rzGlobalPopup";
  overlay.className="rz-overlay";
  var tone=kind==="error"?"#ff8d9d":kind==="success"?"#bda7ff":"#d9ccff";
  overlay.innerHTML='<div class="rz-modal" role="dialog" aria-modal="true" aria-labelledby="rzPopupTitle" style="max-width:520px;position:relative">'+
    '<button type="button" id="rzPopupClose" class="rz-btn" style="position:absolute;right:14px;top:14px" aria-label="Close popup">×</button>'+
    '<div class="rz-kicker" style="color:'+tone+'">RIZORA</div>'+
    '<h2 id="rzPopupTitle" style="margin:8px 42px 8px 0">'+esc(title||"RIZORA")+'</h2>'+
    '<p class="rz-muted" style="line-height:1.7;margin:0 0 18px">'+esc(message||"")+'</p>'+
    '<button type="button" id="rzPopupOkay" class="rz-btn primary">Continue</button>'+
  '</div>';
  document.body.appendChild(overlay);
  var close=function(){overlay.remove();};
  overlay.addEventListener("click",function(e){if(e.target===overlay)close();});
  document.getElementById("rzPopupClose").onclick=close;
  document.getElementById("rzPopupOkay").onclick=close;
  return overlay;
}
window.RIZORA_POPUP=popup;
window.RIZORA_TOAST=toast;
function textPreview(v){var s=String(v||"").trim().replace(/\s+/g," ");return s.slice(0,70)||"Untitled draft";}
function bindPasswordToggles(root){(root||document).querySelectorAll("[data-rz-password-toggle]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-rz-password-toggle"),i=document.getElementById(id);if(!i)return;var show=i.type==="password";i.type=show?"text":"password";b.textContent=show?"Hide":"Show";b.setAttribute("aria-label",show?"Hide password":"Show password");};});}
function getRizoraAuthToken(){try{return String(window.RIZORA_AUTH_TOKEN||localStorage.getItem("rizora_auth_token")||"").trim();}catch(e){return String(window.RIZORA_AUTH_TOKEN||"").trim();}}
function setRizoraAuthToken(token){var t=String(token||"").trim();window.RIZORA_AUTH_TOKEN=t;try{if(t)localStorage.setItem("rizora_auth_token",t);else localStorage.removeItem("rizora_auth_token");}catch(e){}}
async function api(path,opt){opt=opt||{};var headers=Object.assign({"Content-Type":"application/json"},opt.headers||{});var token=getRizoraAuthToken();if(token&&!headers.Authorization)headers.Authorization="Bearer "+token;var r=await fetch(API+path,{credentials:"include",method:opt.method||"GET",headers:headers,body:opt.body});var x=await r.text(),d={};try{d=x?JSON.parse(x):{};}catch(e){d={error:x};}if(!r.ok){if(r.status===401&&path!=="/api/auth/login"&&path!=="/api/auth/signup"){try{setRizoraAuthToken("");}catch(_){}}var err=new Error(d.message||d.error||"Request failed.");err.code=d.code||"";throw err;}return d;}

window.RIZORA_API_CALL=api;
window.RIZORA_GET_AUTH_TOKEN=getRizoraAuthToken;
window.RIZORA_SET_AUTH_TOKEN=setRizoraAuthToken;
window.RIZORA_CLEAR_AUTH_TOKEN=function(){setRizoraAuthToken("");};
window.RIZORA_AUTH_HEADERS=function(extra){var h=Object.assign({},extra||{}),token=getRizoraAuthToken();if(token&&!h.Authorization)h.Authorization="Bearer "+token;return h;};
window.RIZORA_GOTO=function(view){state.view=String(view||"home");shell();load();};

function landing(){
  document.body.innerHTML='<div class="rz-auth rz-landing"><div class="rz-shell rz-landing-shell"><div class="rz-brand"><img src="/rizora-cover.png"><div>RIZORA<small>CREATOR OS</small></div></div><section class="rz-landing-hero"><div class="rz-kicker">CREATOR GROWTH STUDIO</div><h1>Make your presence move.</h1><p class="rz-muted">RIZORA brings creator social, growth missions, AI, analytics, opportunities and community into one platform.</p><div class="rz-actions"><button id="landingSignup" class="rz-btn primary">Start creating</button><button id="landingLogin" class="rz-btn">Log in</button><button id="landingInstall" class="rz-btn">Install RIZORA</button></div></section><section class="rz-grid rz-landing-grid"><div class="rz-card rz-span-6"><div class="rz-kicker">VERIFIED</div><div class="rz-verified-showcase"><img src="/assets/rizora_verified_badge.svg" alt="RIZORA Verified badge"><div><h3 style="margin:0">RIZORA · @rizora</h3><p class="rz-muted" style="margin:6px 0 0">Official verified platform account.</p></div></div></div><div class="rz-card rz-span-6"><div class="rz-kicker">OFFICIAL CREATOR</div><div class="rz-verified-showcase"><img src="/assets/rizora_verified_badge.svg" alt="RIZORA Verified Creator badge"><div><h3 style="margin:0">RoMi · @romi.noir</h3><p class="rz-muted" style="margin:6px 0 0">Artist. Developer. Creator. Builder. Creator of RIZORA.</p></div></div></div><div class="rz-card rz-span-4"><div class="rz-kicker">FLOW</div><h3>Social creator platform</h3><p class="rz-muted">Post, discover, follow, message and build community.</p></div><div class="rz-card rz-span-4"><div class="rz-kicker">GROW</div><h3>Creator growth</h3><p class="rz-muted">Missions, referrals, Boosts and creator campaigns.</p></div><div class="rz-card rz-span-4"><div class="rz-kicker">AI</div><h3>RIZORA intelligence</h3><p class="rz-muted">Ideas, analysis, strategy, hooks and creator tools.</p></div></section><footer class="rz-mini rz-landing-footer">RIZORA · Web-first creator platform · rizora.com.ng</footer></div></div>';
  $("landingSignup").onclick=function(){state.authMode="signup";auth();};
  $("landingLogin").onclick=function(){state.authMode="login";auth();};
  $("landingInstall").onclick=function(){if(window.RIZORA_SUITE&&window.RIZORA_SUITE.install){window.RIZORA_SUITE.install();}else if(window.RIZORA_SUITE_PROMPT){window.RIZORA_SUITE_PROMPT.prompt();window.RIZORA_SUITE_PROMPT=null;}else{toast("Use your browser menu to install RIZORA.");}};
}

function auth(){
  document.body.innerHTML='<div class="rz-auth"><div class="rz-auth-card"><button id="backLanding" class="rz-btn">Back to RIZORA</button><div class="rz-brand"><img src="/rizora-cover.png"><div>RIZORA<small>CREATOR OS</small></div></div><h1>Everything for creators.</h1><p class="rz-muted">Social. Growth. AI. Community.</p><div class="rz-tabs"><button id="tabLogin">Log in</button><button id="tabSignup">Create account</button></div><form id="authForm"><div id="signupBox"></div><div class="rz-field"><label class="rz-label">Username or email</label><input id="identifier" class="rz-input" required></div><div class="rz-field"><label class="rz-label">Password</label><div style="display:flex;gap:8px;align-items:center"><input id="password" class="rz-input" type="password" autocomplete="current-password" required style="flex:1"><button type="button" class="rz-btn" data-rz-password-toggle="password" aria-label="Show password">Show</button></div></div><button id="authSubmit" class="rz-btn primary" style="width:100%">Log in</button><div class="rz-divider">OR</div><div id="googleButton"></div><div id="authError" class="rz-error"></div></form></div></div>';
  bindPasswordToggles(document.getElementById("authForm"));
  $("backLanding").onclick=function(){landing();};
  $("tabLogin").onclick=function(){state.authMode="login";auth();};
  $("tabSignup").onclick=function(){state.authMode="signup";auth();};
  $("tabLogin").className=state.authMode==="login"?"active":"";
  $("tabSignup").className=state.authMode==="signup"?"active":"";
  if(state.authMode==="signup"){
    $("identifier").required=false;
    $("identifier").parentElement.style.display="none";
    $("signupBox").innerHTML='<div class="rz-field"><label class="rz-label">Username</label><input id="username" class="rz-input" autocomplete="username" required></div><div class="rz-field"><label class="rz-label">Display name</label><input id="displayName" class="rz-input"></div><div class="rz-field"><label class="rz-label">Email</label><input id="email" class="rz-input" type="email" autocomplete="email" required></div><div class="rz-field"><label class="rz-label">Confirm password</label><div style="display:flex;gap:8px;align-items:center"><input id="confirmPassword" class="rz-input" type="password" autocomplete="new-password" required style="flex:1"><button type="button" class="rz-btn" data-rz-password-toggle="confirmPassword" aria-label="Show password">Show</button></div></div>';
     bindPasswordToggles(document.getElementById("signupBox"));
    $("authSubmit").textContent="Create account";
    $("email").oninput=function(){ $("identifier").value=this.value; };
  }else{
    $("identifier").required=true;
    $("identifier").parentElement.style.display="";
  }
  $("authForm").onsubmit=async function(e){
    e.preventDefault();$("authError").textContent="";
    try{
      var b={identifier:$("identifier").value,password:$("password").value};
      if(state.authMode==="signup"){b.username=$("username").value;b.displayName=$("displayName").value;b.email=$("email").value;b.confirmPassword=$("confirmPassword").value;}
      var twoFactor=$("twoFactorCode");if(state.authMode==="login"&&twoFactor)b.twoFactorCode=twoFactor.value;
      var d=await api(state.authMode==="signup"?"/api/auth/signup":"/api/auth/login",{method:"POST",body:JSON.stringify(b)});
      if(d.token)setRizoraAuthToken(d.token);
      state.user=d.user;window.RIZORA_CURRENT_USER=state.user;try{sessionStorage.removeItem("rz_premium_suggestion_dismissed");}catch(_){}
      var loaded=await load();
      if(loaded!==true)throw new Error("Login succeeded, but the session could not be restored. Please refresh and try again.");
      if(state.authMode==="signup"){
        var emailInfo=d.emailDelivery||{};
        var emailText=emailInfo.configured
          ? "Your account is ready. A welcome email has been queued for your registered email address."
          : "Your account is ready. Add the RIZORA email provider configuration to enable welcome emails.";
        if(window.RIZORA_POPUP)window.RIZORA_POPUP("Welcome to RIZORA","@"+(state.user.publicUsername||state.user.username)+" is now live. "+emailText,"success");
        else toast("Welcome to RIZORA.");
      }else toast("Welcome back to RIZORA.");
    }catch(err){
      if(state.authMode==="login"&&(err.code==="TWO_FACTOR_REQUIRED"||err.code==="TWO_FACTOR_INVALID")){
        if(!$("twoFactorCode")){
          var wrap=document.createElement("div");wrap.className="rz-field";wrap.id="twoFactorWrap";wrap.innerHTML='<label class="rz-label">Authenticator code</label><input id="twoFactorCode" class="rz-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" required>';
          $("password").parentElement.after(wrap);
        }
        $("authError").textContent=err.code==="TWO_FACTOR_INVALID"?"That authenticator code is invalid. Try again.":"Enter the 6-digit authenticator code to continue.";
        $("twoFactorCode").focus();
      }else{$("authError").textContent=err.message;}
    }
  };
  googleButton();
}
function googleButton(){
  api("/api/auth/google/config").then(function(c){
    if(!c.enabled||!c.clientId)return;
    var n=0,tm=setInterval(function(){
      n++;
      if(window.google&&google.accounts&&google.accounts.id){
        clearInterval(tm);
        google.accounts.id.initialize({client_id:c.clientId,callback:function(r){
          api("/api/auth/google",{method:"POST",body:JSON.stringify({credential:r.credential})}).then(function(d){
            if(d.token)setRizoraAuthToken(d.token);
            state.user=d.user;
            window.RIZORA_CURRENT_USER=state.user;
            return load().then(function(){
              if(d.created){
                var emailInfo=d.emailDelivery||{};
                var emailText=emailInfo.configured
                  ? "Your welcome email has been queued for "+(state.user.email||"your registered email address")+"."
                  : "Your account is live. Email delivery is still waiting for the RIZORA email provider.";
                if(window.RIZORA_POPUP)window.RIZORA_POPUP("Welcome to RIZORA","@"+(state.user.publicUsername||state.user.username)+" is now live with Google. "+emailText,"success");
                else toast("Welcome to RIZORA.");
              }else{
                toast("Welcome back to RIZORA.");
              }
            });
          }).catch(function(e){$("authError").textContent=e.message;});
        }});
        google.accounts.id.renderButton($("googleButton"),{theme:"outline",size:"large",width:380,text:"continue_with",shape:"rectangular"});
      }
      if(n>80)clearInterval(tm);
    },100);
  }).catch(function(){});
}
function shell(){
  var desktopItems=[
    {id:"home",label:"Home",icon:"H"},
    {id:"flow",label:"For You",icon:"F"},
    {id:"discover",label:"Explore",icon:"E"},
    {id:"notifications",label:"Notifications",icon:"N"},
    {id:"messages",label:"Messages",icon:"M"},
    {id:"grow",label:"Grow",icon:"G"},
    {id:"ai",label:"RIZORA AI",icon:"AI"},
    {id:"profile",label:"Profile",icon:"P"}
  ];
  var side=desktopItems.map(function(item){
    return '<button class="rz-xnav-item '+(state.view===item.id?"active":"")+'" data-nav="'+item.id+'"><span class="rz-xnav-icon" aria-hidden="true">'+item.icon+'</span><span>'+item.label+'</span></button>';
  }).join("");
  var mobile=[
    {id:"home",label:"Home",icon:"H"},
    {id:"discover",label:"Explore",icon:"E"},
    {id:"flow",label:"Create",icon:"+"},
    {id:"messages",label:"Inbox",icon:"M"},
    {id:"profile",label:"Profile",icon:"P"}
  ];
  document.body.innerHTML=
    '<div class="rz-top"><div class="rz-shell rz-top-inner">'+
      '<button class="rz-btn rz-brand rz-top-brand" id="brand"><img src="/rizora-cover.png" alt="RIZORA"><span>RIZORA</span><small>CREATOR OS</small></button>'+
      '<div class="rz-top-search"><input id="rzGlobalSearch" class="rz-input" placeholder="Search creators, posts, hashtags" aria-label="Search RIZORA"><button id="rzGlobalSearchBtn" class="rz-btn">Search</button></div>'+
      '<div class="rz-actions"><button class="rz-btn rz-top-ai" id="rzTopAi">AI</button><button class="rz-btn" id="refresh">Refresh</button><button class="rz-top-avatar" id="rzTopProfile">'+avatar(state.user)+'</button></div>'+
    '</div></div>'+
    '<main class="rz-shell rz-social-main">'+
      '<aside class="rz-sidebar rz-x-sidebar">'+
        '<div class="rz-xnav">'+side+'</div>'+
        '<button class="rz-btn primary rz-create-post" id="rzCreatePost">Create</button>'+
        '<div class="rz-x-profile-mini"><button class="rz-x-profile-button" id="rzMiniProfile">'+avatar(state.user)+'<span><strong>'+esc((state.user&&state.user.displayName)||"Creator")+'</strong><small>@'+esc((state.user&&(state.user.publicUsername||state.user.username))||"creator")+'</small></span><b>...</b></button></div>'+
        '<button class="rz-btn" id="rzDesktopSuite" style="width:100%">Creator Suite</button>'+
      '</aside>'+
      '<section class="rz-content rz-social-content" id="content"></section>'+
      '<aside class="rz-right-rail">'+
        '<div class="rz-card rz-search-card"><div class="rz-kicker">RIZORA SEARCH</div><h3>Find creators</h3><p class="rz-muted">Discover profiles, posts and hashtags.</p><button class="rz-btn primary" id="rzRailExplore">Explore RIZORA</button></div>'+
        '<div class="rz-card rz-account-card"><div class="rz-kicker">YOUR ACCOUNT</div><div class="rz-right-account">'+avatar(state.user)+'<div><strong>'+esc((state.user&&state.user.displayName)||"Creator")+'</strong><div class="rz-mini">@'+esc((state.user&&(state.user.publicUsername||state.user.username))||"creator")+'</div></div></div><div class="rz-right-stats"><span><b>'+Number(state.points||0)+'</b><small>points</small></span><span><b>'+Number((state.user&&state.user.followers)||0)+'</b><small>followers</small></span><span><b>'+Number((state.user&&state.user.posts)||0)+'</b><small>posts</small></span></div><div class="rz-actions"><button class="rz-btn" id="rzRailProfile">Profile</button><button class="rz-btn" id="rzRailSettings">Settings</button></div></div>'+
        '<div class="rz-card rz-right-growth"><div class="rz-kicker">BUILD MOMENTUM</div><h3>Grow your presence</h3><p class="rz-muted">Use missions, Boosts, AI and analytics to move your creator account.</p><div class="rz-actions"><button class="rz-btn" id="rzRailGrow">Grow</button><button class="rz-btn" id="rzRailAi">Ask AI</button></div></div>'+
        '<div class="rz-mini rz-right-footer">RIZORA · CREATE. GROW. EARN.</div>'+
      '</aside>'+
    '</main>'+
    '<nav class="rz-mobile-nav">'+mobile.map(function(item){return '<button class="'+(state.view===item.id?"active":"")+'" data-nav="'+item.id+'"><span>'+item.icon+'</span><small>'+item.label+'</small></button>';}).join("")+'</nav>';

  document.querySelectorAll("[data-nav]").forEach(function(b){b.onclick=function(){state.view=b.getAttribute("data-nav");shell();load();};});
  $("refresh").onclick=load;
  $("brand").onclick=function(){state.view="home";shell();load();};
  $("rzTopAi").onclick=function(){state.view="ai";shell();load();};
  $("rzCreatePost").onclick=function(){state.view="flow";shell();load();};
  $("rzTopProfile").onclick=function(){state.view="profile";shell();load();};
  $("rzMiniProfile").onclick=function(){state.view="profile";shell();load();};
  $("rzRailProfile").onclick=function(){state.view="profile";shell();load();};
  $("rzRailExplore").onclick=function(){state.view="discover";shell();load();};
  $("rzRailGrow").onclick=function(){state.view="grow";shell();load();};
  $("rzRailAi").onclick=function(){state.view="ai";shell();load();};
  $("rzRailSettings").onclick=function(){if(window.RIZORA_CONTROL_CENTER&&window.RIZORA_CONTROL_CENTER.preferences){window.RIZORA_CONTROL_CENTER.preferences();}else{toast("Profile settings are loading.");}};
  var searchInput=$("rzGlobalSearch"),searchBtn=$("rzGlobalSearchBtn");
  function runGlobalSearch(){
    var q=String(searchInput&&searchInput.value||"").trim();
    state.query=q;
    state.search=null;
    state.view="discover";
    shell();
    if($("q"))$("q").value=q;
    wire();
    if(q){
      api("/api/v2/search?q="+encodeURIComponent(q)).then(function(d){state.search=d;view();wire();}).catch(function(e){toast(e.message);});
    } else {
      view();wire();
    }
  }
  if(searchBtn)searchBtn.onclick=runGlobalSearch;
  if(searchInput)searchInput.onkeydown=function(e){if(e.key==="Enter")runGlobalSearch();};
  var ds=$("rzDesktopSuite");if(ds)ds.onclick=function(){if(window.RIZORA_SUITE&&window.RIZORA_SUITE.open)window.RIZORA_SUITE.open();};
  view();
}
function card(title,body){return '<section class="rz-card"><div class="rz-kicker">'+title+'</div>'+body+'</section>';}
function view(){
  var c=$("content");
  if(state.view==="home")c.innerHTML=card("RIZORA RADAR","<h2>What should you do now?</h2><p class='rz-muted'>Content, growth, AI and community in one place.</p><div class='rz-actions'><button class='rz-btn primary' data-go='flow'>Create a post</button><button class='rz-btn' data-go='grow'>Open Grow</button><button class='rz-btn' data-go='ai'>Ask AI</button></div>")+((state.onboarding||[]).some(function(t){return !t.completed;})?card("START HERE","<h3>Follow the verified RIZORA accounts</h3><p class='rz-muted'>Follow them on RIZORA and earn your first creator points.</p><div class='rz-feed'>"+(state.onboarding||[]).filter(function(t){return !t.completed;}).map(function(t){return "<div class='rz-card rz-task'><strong>"+esc(t.title)+"</strong><div>"+esc(t.description)+"</div><span class='rz-points'>+"+Number(t.points||0)+" pts</span><button class='rz-btn primary' data-onboarding-follow='"+esc(t.username)+"'>Follow + earn</button></div>";}).join("")+"</div>"): "")+card("ACCOUNT","<div class='rz-stat'>"+state.points+"</div><div class='rz-mini'>points</div><div class='rz-account-badge'>"+(verified(state.user)||"<span class='rz-unverified'>Not verified</span>")+"</div><div class='rz-mini'>Verification is managed from your profile.</div>");
  if(state.view==="flow")c.innerHTML=card("FLOW","<h2>Social platform</h2><div class='rz-actions'><button class='rz-btn' data-tab='for-you'>For You</button><button class='rz-btn' data-tab='following'>Following</button><button class='rz-btn' data-tab='trending'>Trending</button></div><form id='postForm' class='rz-compose' style='margin-top:14px'><textarea id='postText' class='rz-textarea' placeholder='Post something. Use #hashtags and @mentions.'></textarea><input id='postMedia' class='rz-input' placeholder='Optional media URL'><label class='rz-ai-toggle'><input id='postAiAssisted' type='checkbox'><span>AI-assisted</span></label><div class='rz-media-picker'><input id='postMediaFile' class='rz-media-file' type='file' accept='image/*,video/*,audio/*'><div id='postMediaStatus' class='rz-media-status'></div></div><details class='rz-compose-options'><summary>More post options</summary><div class='rz-compose-option-grid'><div class='rz-compose-option'><div class='rz-kicker'>POLL</div><input id='postPollQuestion' class='rz-input' placeholder='Ask your audience a question'><input id='postPollOption1' class='rz-input' placeholder='Option 1'><input id='postPollOption2' class='rz-input' placeholder='Option 2'><input id='postPollOption3' class='rz-input' placeholder='Option 3 (optional)'><input id='postPollOption4' class='rz-input' placeholder='Option 4 (optional)'></div><div class='rz-compose-option'><div class='rz-kicker'>SCHEDULE</div><input id='postSchedule' class='rz-input' type='datetime-local'><div class='rz-mini'>Choose a future time to publish automatically.</div><div class='rz-kicker' style='margin-top:12px'>COLLABORATOR</div><input id='postCollab' class='rz-input' placeholder='Invite @username after publishing'><div class='rz-mini'>The creator receives a collaboration invite.</div></div></div><div class='rz-actions' style='margin-top:10px'><button id='saveDraft' type='button' class='rz-btn'>Save draft</button><button id='clearPostOptions' type='button' class='rz-btn'>Clear options</button></div></details><div class='rz-actions'><button class='rz-btn primary' type='submit'>Publish</button></div><div id='postStatus' class='rz-mini'></div><div id='postError' class='rz-error'></div></form>")+('<div class="rz-feed">'+state.feed.map(post).join("")+"</div>");
  if(state.view==="grow")c.innerHTML=card("GROW","<h2>Build momentum</h2><p class='rz-muted'>7-minute cooldown.</p><div class='rz-feed'>"+state.tasks.map(task).join("")+state.socialTasks.map(socialTask).join("")+"</div>");
  if(state.view==="studio")c.innerHTML=card("STUDIO","<h2>Create smarter</h2><div class='rz-actions'><button id='hooks' class='rz-btn primary'>Hooks</button><button id='hash' class='rz-btn'>Hashtags</button><button id='captions' class='rz-btn'>Captions</button></div><pre id='studioOut'></pre>");
  if(state.view==="ai")c.innerHTML=card("RIZORA AI","<h2>Creator copilot</h2><p class='rz-muted'>Signed in as @"+esc((state.user&&((state.user.publicUsername||state.user.username)))||"creator")+".</p><div class='rz-feed'>"+state.aiMessages.map(function(m,i){return '<div class="rz-card"><div class="rz-section-title"><strong>'+m.role+'</strong>'+(m.role==="ai" ? '<button type="button" class="rz-btn" data-ai-speak="'+i+'">🔊 Listen</button>' : '')+'</div><div>'+esc(m.text)+"</div></div>";}).join("")+"</div><form id='aiForm' class='rz-actions'><input id='aiInput' class='rz-input' placeholder='Ask about content, growth, RIZORA or yourself'><button class='rz-btn primary' type='submit'>Ask</button></form>");

  if(state.view==="discover")c.innerHTML=card("DISCOVER","<h2>Search</h2><div class='rz-actions'><input id='q' class='rz-input' value='"+esc(state.query)+"' placeholder='creator, post or #hashtag'><button id='doSearch' class='rz-btn primary'>Search</button></div>"+
    "<div class='rz-feed'>"+
      (((state.search&&state.search.users)||[]).length?card("CREATORS",((state.search&&state.search.users)||[]).map(function(u){return '<div class="rz-card">'+avatar(u)+" <strong>"+esc(u.displayName)+"</strong> @"+esc(u.publicUsername||u.username)+" "+verified(u)+"</div>";}).join("")):"")+
      (((state.search&&state.search.hashtags)||[]).length?card("HASHTAGS",((state.search&&state.search.hashtags)||[]).map(function(h){return '<div class="rz-card"><strong>#'+esc(h.tag)+'</strong><div class="rz-mini">'+Number(h.count||0)+' post(s)</div></div>';}).join("")):"")+
      (((state.search&&state.search.posts)||[]).length?card("POSTS",((state.search&&state.search.posts)||[]).map(post).join("")):"")+
      (((state.search&&state.search.users)||[]).length||((state.search&&state.search.hashtags)||[]).length||((state.search&&state.search.posts)||[]).length?"":"<div class='rz-empty'>No results yet.</div>")+
    "</div>");
  if(state.view==="notifications")c.innerHTML=card("ALERTS","<h2>Notifications</h2><button id='readAll' class='rz-btn'>Mark read</button><div class='rz-feed'>"+state.notifications.map(function(n){return '<div class="rz-card"><strong>'+esc(n.title)+"</strong><div>"+esc(n.message)+"</div></div>";}).join("")+"</div>");
  if(state.view==="profile"){var u=state.user||{},p=state.profile||{},followers=Number(u.followers||0),following=Number(u.following||0),posts=Number(u.posts||0),likes=Number(u.likes||0),showPremiumSuggestion=true;try{showPremiumSuggestion=sessionStorage.getItem("rz_premium_suggestion_dismissed")!=="1";}catch(_){showPremiumSuggestion=true;}c.innerHTML='<section class="rz-card rz-profile-card"><div class="rz-profile-cover"></div><div class="rz-profile-inner"><div class="rz-profile-top"><div>'+avatar(u).replace('class="rz-avatar"','class="rz-avatar rz-profile-avatar"')+'</div><div class="rz-profile-actions"><button id="verify" class="rz-btn">'+(u.verified?"Verified":"Get verified")+'</button><button id="editProfile" class="rz-btn">Edit profile</button><button id="profileSettings" class="rz-btn">Settings</button></div></div><div class="rz-profile-name"><h2>'+esc(u.displayName||u.username)+'</h2>'+verified(u)+'</div>'+(u.verified?'<div class="rz-verified-showcase"><img src="/assets/rizora_verified_badge.svg" alt="RIZORA Verified · Creator Verified"><div><div class="rz-kicker">RIZORA VERIFIED</div><strong>Creator Verified</strong><div class="rz-mini">Official RIZORA verification badge</div></div></div>':"")+'<div class="rz-mini">@'+esc(u.publicUsername||u.username)+'</div><p class="rz-profile-bio">'+esc(p.bio||"Creator on RIZORA. Build. Post. Grow.")+'</p><div class="rz-profile-stats"><span><strong>'+posts+'</strong> posts</span><span><strong>'+followers+'</strong> followers</span><span><strong>'+following+'</strong> following</span><span><strong>'+likes+'</strong> likes</span></div><div class="rz-profile-tabs"><button class="active">Posts</button><button>Media</button><button>About</button></div></div></section>'+(showPremiumSuggestion?'<section class="rz-card rz-premium-hint" id="rzPremiumVerificationHint"><div class="rz-section-title"><div><div class="rz-kicker">CREATOR UPGRADE</div><h3>Strengthen your creator setup</h3></div><button id="rzDismissPremiumSuggestion" class="rz-btn" type="button" aria-label="Hide Premium suggestion">Hide</button></div><p class="rz-muted">Premium adds advanced creator tools and deeper insights. It may help you present a stronger creator profile, but verification is reviewed separately and Premium does not guarantee verification.</p><button id="rzOpenPremiumFromProfile" class="rz-btn primary">Explore Premium</button></section>':'')+'<section class="rz-card" id="rzProfileEditor" style="display:none"><div class="rz-section-title"><div><div class="rz-kicker">EDIT PROFILE</div><h3>Creator identity</h3></div><button id="closeProfileEditor" class="rz-btn">Close</button></div><form id="profileForm"><input id="pfAvatar" class="rz-input" placeholder="PFP URL" value="'+esc(p.avatarUrl||"")+'"><div class="rz-media-picker"><input id="pfAvatarFile" class="rz-media-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><div id="pfAvatarStatus" class="rz-media-status"></div></div><textarea id="pfBio" class="rz-textarea" placeholder="Bio">'+esc(p.bio||"")+'</textarea><input id="pfCategory" class="rz-input" placeholder="Category" value="'+esc(p.category||"")+'"><button class="rz-btn primary">Save profile</button></form></section>';}
  if(state.view==="safety")c.innerHTML=card("SAFETY","<h2>"+Number(state.user.warningCount||0)+"/3 warnings</h2><p class='rz-muted'>No 18+ / sexually explicit content. Three warnings are enforced on the backend.</p>"+((state.safety&&state.safety.warnings)||[]).map(function(w){return '<div class="rz-card"><strong>Warning '+w.number+"</strong><div>"+esc(w.reason)+"</div></div>";}).join(""));
  if(state.view==="boosts")c.innerHTML=boostsView();
  if(state.view==="official")c.innerHTML=officialView();
  if(state.view==="admin")c.innerHTML=adminView();
  if(state.view==="stories")c.innerHTML=storiesView();
  if(state.view==="communities")c.innerHTML=communitiesView();
  if(state.view==="messages")c.innerHTML=messagesView();
  if(state.view==="opportunities")c.innerHTML=opportunitiesView();
  if(state.view==="analytics")c.innerHTML=analyticsView();
  wire();
}

function storiesView(){
  var groups=(state.stories||[]).map(function(g){return '<div class="rz-card"><div class="rz-post-head">'+avatar(g.user)+'<div><strong>'+esc(g.user.displayName)+'</strong> '+verified(g.user)+'<div class="rz-mini">@'+esc(g.user.publicUsername||g.user.username)+'</div></div></div>'+g.stories.map(function(s){return '<div class="rz-card"><div class="rz-post-body">'+esc(s.text||"")+'</div>'+renderMedia(s.mediaUrl)+'</div>';}).join("")+'</div>';}).join("");
  return card("STORIES","<h2>Creator stories</h2><p class='rz-muted'>Stories expire after 24 hours.</p><form id='storyForm'><textarea id='storyText' class='rz-textarea' placeholder='Add a story'></textarea><input id='storyMedia' class='rz-input' placeholder='Optional media URL'><div class='rz-media-picker'><input id='storyMediaFile' class='rz-media-file' type='file' accept='image/*,video/*,audio/*'><div id='storyMediaStatus' class='rz-media-status'></div></div><button class='rz-btn primary'>Publish story</button><div id='storyError' class='rz-error'></div></form><div class='rz-feed'>"+(groups||"<div class='rz-empty'>No active stories yet.</div>")+"</div>");
}
function communitiesView(){
  var body="<h2>Creator communities</h2><p class='rz-muted'>Focused spaces for creators.</p><form id='communityForm'><input id='communityName' class='rz-input' placeholder='Community name' required><textarea id='communityDescription' class='rz-textarea' placeholder='What is it for?'></textarea><button class='rz-btn primary'>Create community</button></form><div class='rz-feed'>";
  body+=(state.communities||[]).map(function(c){return '<div class="rz-card"><h3>'+esc(c.name)+'</h3><p class="rz-muted">'+esc(c.description)+'</p><span class="rz-badge">'+c.memberCount+' members</span> <button class="rz-btn" data-community="'+esc(c.id)+'">'+(c.joined?"Leave":"Join")+"</button></div>";}).join("")||"<div class='rz-empty'>No communities yet.</div>";
  return card("COMMUNITIES",body+"</div>");
}
function messagesView(){
  var body="<h2>Creator messages</h2><p class='rz-muted'>Private creator-to-creator messaging.</p><div class='rz-actions'><input id='messageUser' class='rz-input' placeholder='Username or user ID'><button id='openMessage' class='rz-btn primary'>Open chat</button></div><div class='rz-feed'>";
  body+=(state.conversations||[]).map(function(c){return '<button class="rz-card" data-chat="'+esc(c.otherUserId)+'" style="text-align:left"><strong>'+esc(c.user.displayName)+'</strong><div class="rz-mini">@'+esc(c.user.publicUsername||c.user.username)+'</div><div>'+esc(c.lastText||"")+"</div></button>";}).join("")||"<div class='rz-empty'>No messages yet.</div>";
  return card("MESSAGES",body+"</div><div id='chatBox'></div>");
}
function opportunitiesView(){
  var body="<h2>Creator opportunities</h2><p class='rz-muted'>Platform, growth and community opportunities.</p><div class='rz-feed'>";
  body+=(state.opportunities||[]).map(function(o){return '<div class="rz-card"><div class="rz-kicker">'+esc(o.type)+'</div><h3>'+esc(o.title)+'</h3><p class="rz-muted">'+esc(o.description)+'</p><button class="rz-btn" '+(o.applied?"disabled":"")+' data-opportunity="'+esc(o.id)+'">'+(o.applied?"Applied":"Apply")+"</button></div>";}).join("")||"<div class='rz-empty'>No opportunities yet.</div>";
  return card("OPPORTUNITIES",body+"</div>");
}
function analyticsView(){
  var a=state.analytics||{};
  return '<div class="rz-grid"><div class="rz-card rz-span-12"><div class="rz-kicker">ANALYTICS</div><h2>Creator dashboard</h2><p class="rz-muted">Live activity from your RIZORA account.</p></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">POSTS</div><div class="rz-stat">'+Number(a.posts||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">FOLLOWERS</div><div class="rz-stat">'+Number(a.followers||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">LIKES</div><div class="rz-stat">'+Number(a.likes||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">COMMENTS</div><div class="rz-stat">'+Number(a.comments||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">SAVES</div><div class="rz-stat">'+Number(a.saves||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">REPOSTS</div><div class="rz-stat">'+Number(a.reposts||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">STORIES</div><div class="rz-stat">'+Number(a.stories||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">POINTS</div><div class="rz-stat">'+Number(a.points||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">WARNINGS</div><div class="rz-stat">'+Number(a.warningCount||0)+'/3</div></div></div>';
}
function wireStories(){
  $("storyForm").onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/stories",{method:"POST",body:JSON.stringify({text:$("storyText").value,mediaUrl:$("storyMedia").value})});toast("Story published.");load();}catch(err){$("storyError").textContent=err.message;}};bindMediaPicker("storyMediaFile","storyMediaStatus","storyMedia");
}
function wireCommunities(){
  $("communityForm").onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/communities",{method:"POST",body:JSON.stringify({name:$("communityName").value,description:$("communityDescription").value})});toast("Community created.");load();}catch(err){toast(err.message);}};
  document.querySelectorAll("[data-community]").forEach(function(b){b.onclick=function(){api("/api/v2/communities/"+b.getAttribute("data-community")+"/join",{method:"POST"}).then(load).catch(function(e){toast(e.message);});};});
}
function wireMessages(){
  $("openMessage").onclick=function(){var target=$("messageUser").value.trim();if(target)openChat(target);};
  document.querySelectorAll("[data-chat]").forEach(function(b){b.onclick=function(){openChat(b.getAttribute("data-chat"));};});
}
async function openChat(target){
  try{
    var d=await api("/api/v2/messages/"+encodeURIComponent(target));
    var messageHtml=d.messages.map(function(m){
      var audio="";
      if(m.mediaUrl){
        audio='<audio controls preload="metadata" style="width:100%;margin-top:8px" data-rz-media-src="'+esc(m.mediaUrl)+'"></audio>';
      }
      return '<div class="rz-card"><div class="rz-mini">'+(m.fromUserId===state.user.id?"You":esc(d.user&&d.user.displayName||d.user&&d.user.username||"Creator"))+(m.messageType==="voice"?" · Voice":"")+'</div>'+(m.text?'<div>'+esc(m.text)+'</div>':"")+audio+'</div>';
    }).join("");
    $("chatBox").innerHTML='<div class="rz-card" style="margin-top:14px"><h3>'+esc(d.user.displayName)+'</h3><div class="rz-mini">@'+esc(d.user.publicUsername||d.user.username)+'</div><div class="rz-feed">'+messageHtml+'</div><form id="messageForm" data-chat-target="'+esc(target)+'" class="rz-actions"><input id="messageText" class="rz-input" placeholder="Write a message"><button class="rz-btn primary">Send</button></form></div>';
    $("messageForm").onsubmit=async function(e){e.preventDefault();var text=$("messageText").value.trim();if(!text)return;try{await api("/api/v2/messages/"+encodeURIComponent(target),{method:"POST",body:JSON.stringify({text:text})});openChat(target);}catch(err){toast(err.message);}};if(window.RIZORA_VOICE_WIRE)window.RIZORA_VOICE_WIRE();
  }catch(err){toast(err.message);}
}
window.RIZORA_OPEN_CHAT=openChat;

function boostsView(){
  var rows=(state.boosts||[]).map(function(b){
    return '<div class="rz-card rz-task"><strong>'+esc(b.username)+' · '+esc(b.platform)+' · '+esc(b.action)+'</strong><div class="rz-mini">'+Number(b.remaining||0)+' completions left</div><span class="rz-points">+'+Number(b.reward||0)+' pts</span><div class="rz-actions"><button class="rz-btn primary" data-boost="'+esc(b.id)+'">Complete boost</button><a class="rz-btn" href="'+esc(b.url)+'" target="_blank" rel="noopener">Open</a></div></div>';
  }).join("");
  if(!rows)rows="<div class='rz-empty'>No active boosts yet.</div>";
  return card("BOOSTS","<h2>Creator Boost Network</h2><p class='rz-muted'>Fund creator actions with RIZORA points.</p>"+
    "<form id='boostForm'><input id='boostUsername' class='rz-input' placeholder='Creator username' required><select id='boostPlatform' class='rz-input'><option>tiktok</option><option>instagram</option><option>x</option><option>youtube</option><option>spotify</option><option>facebook</option></select><select id='boostAction' class='rz-input'><option>follow</option><option>like</option><option>subscribe</option><option>view</option></select><input id='boostUrl' class='rz-input' placeholder='https://...' required><input id='boostReward' class='rz-input' type='number' min='1' max='100' value='5'><input id='boostQuantity' class='rz-input' type='number' min='1' max='500' value='10'><button class='rz-btn primary'>Create boost</button><div id='boostError' class='rz-error'></div></form>"+
    "<div class='rz-feed'>"+rows+"</div>");
}
function officialView(){
  var rows=(state.official||[]).map(function(p){
    var linksData=p.links||p||{},links="";
    if(linksData.website)links+='<a class="rz-btn" href="'+esc(linksData.website)+'" target="_blank" rel="noopener noreferrer">Website</a>';
    if(linksData.tiktok)links+='<a class="rz-btn" href="'+esc(linksData.tiktok)+'" target="_blank" rel="noopener noreferrer">TikTok</a>';
    if(linksData.instagram)links+='<a class="rz-btn" href="'+esc(linksData.instagram)+'" target="_blank" rel="noopener noreferrer">Instagram</a>';
    if(linksData.x)links+='<a class="rz-btn" href="'+esc(linksData.x)+'" target="_blank" rel="noopener noreferrer">X</a>';
    return '<div class="rz-card"><div class="rz-post-head">'+avatar(p)+'<div><strong>'+esc(p.displayName||p.username)+'</strong> <span class="rz-badge ok">✓ Verified</span><div class="rz-mini">@'+esc(p.publicUsername||p.username)+'</div></div></div><div class="rz-verified-showcase"><img src="/assets/rizora_verified_badge.svg" alt="RIZORA Verified badge"><div><div class="rz-kicker">RIZORA VERIFIED</div><strong>Creator Verified</strong><div class="rz-mini">'+esc(p.verificationType||"official")+'</div></div></div><div class="rz-actions">'+links+"</div></div>";
  }).join("");
  if(!rows)rows="<div class='rz-empty'>Official identities are loading.</div>";
  return card("OFFICIAL","<h2>Verified RIZORA identities</h2><p class='rz-muted'>Official platform and verified creator profiles.</p><div class='rz-feed'>"+rows+"</div>");
}
function adminView(){
  if(!state.user||state.user.role!=="super_admin")return card("ACCESS","<h2>Super Admin</h2><p class='rz-muted'>This area is only available to super admins.</p>");
  var a=state.admin&&state.admin.stats||{};
  var users=(state.admin&&state.admin.users)||[];
  var rows=users.slice().reverse().slice(0,20).map(function(u){
    var action=u.status==="active"?"":"<button class='rz-btn' data-recover='"+esc(u.id)+"'>Recover</button>";
    return '<div class="rz-card"><strong>'+esc(u.displayName||u.username)+'</strong><div class="rz-mini">@'+esc(u.username)+' · '+esc(u.status||"active")+' · '+esc(u.role||"user")+'</div>'+action+'</div>';
  }).join("");
  if(!rows)rows="<div class='rz-empty'>No users returned.</div>";
  var pending=(state.adminVerification||[]).filter(function(r){return r.status==="pending";}).map(function(r){
    var requestId=r.id||"";
    return '<div class="rz-card"><strong>'+esc((r.user&&r.user.displayName)||"Creator")+'</strong><div class="rz-mini">@'+esc((r.user&&r.user.username)||"unknown")+'</div><button class="rz-btn primary" data-grant="'+esc(requestId)+'">Grant verification</button></div>';
  }).join("");
  if(!pending)pending="<div class='rz-empty'>No pending verification requests.</div>";
  return '<div class="rz-grid"><div class="rz-card rz-span-12"><div class="rz-kicker">SUPER ADMIN COMMAND CENTER</div><h2>RIZORA control surface</h2><p class="rz-muted">Live platform data, verification and account recovery.</p></div>'+
    '<div class="rz-card rz-span-4"><div class="rz-kicker">TOTAL USERS</div><div class="rz-stat">'+Number(a.totalUsers||users.length||0)+'</div></div>'+
    '<div class="rz-card rz-span-4"><div class="rz-kicker">REFERRALS</div><div class="rz-stat">'+Number(a.totalReferrals||((state.admin&&state.admin.referrals)||[]).length||0)+'</div></div>'+
    '<div class="rz-card rz-span-4"><div class="rz-kicker">AUDIT LOGS</div><div class="rz-stat">'+Number(((state.admin&&state.admin.audit)||[]).length||0)+'</div></div>'+
    '<div class="rz-card rz-span-6"><div class="rz-section-title"><h3>Verification queue</h3><button id="adminRefresh" class="rz-btn">Refresh</button></div><div class="rz-feed">'+pending+'</div></div>'+
    '<div class="rz-card rz-span-6"><div class="rz-section-title"><h3>Recent users</h3></div><div class="rz-feed">'+rows+'</div></div></div>';
}


function wireBoosts(){
  $("boostForm").onsubmit=async function(e){
    e.preventDefault();
    try{
      await api("/api/boosts/create",{method:"POST",body:JSON.stringify({username:$("boostUsername").value,platform:$("boostPlatform").value,action:$("boostAction").value,url:$("boostUrl").value,reward:Number($("boostReward").value),maxCompletions:Number($("boostQuantity").value)})});
      toast("Boost created.");load();
    }catch(err){$("boostError").textContent=err.message;}
  };
  document.querySelectorAll("[data-boost]").forEach(function(b){
    b.onclick=function(){
      api("/api/boosts/complete",{method:"POST",body:JSON.stringify({boostId:b.getAttribute("data-boost")})}).then(load).catch(function(e){toast(e.message);});
    };
  });
}
function wireAdmin(){
  if($("adminRefresh"))$("adminRefresh").onclick=load;
  document.querySelectorAll("[data-recover]").forEach(function(b){
    b.onclick=async function(){
      try{
        await api("/api/v2/admin/users/"+encodeURIComponent(b.getAttribute("data-recover"))+"/recover",{method:"POST",body:JSON.stringify({resetWarnings:false})});
        toast("Account restored.");load();
      }catch(e){toast(e.message);}
    };
  });
  document.querySelectorAll("[data-grant]").forEach(function(b){
    b.onclick=async function(){
      try{
        await api("/api/superadmin/verification/action",{method:"POST",body:JSON.stringify({requestId:b.getAttribute("data-grant"),action:"approve"})});
        toast("Verification granted.");load();
      }catch(e){toast(e.message);}
    };
  });
}


function wireOpportunities(){
  document.querySelectorAll("[data-opportunity]").forEach(function(b){b.onclick=function(){api("/api/v2/opportunities/"+b.getAttribute("data-opportunity")+"/apply",{method:"POST",body:"{}"}).then(function(){toast("Application submitted.");load();}).catch(function(e){toast(e.message);});};});
}
function post(p){
  var pollHtml="";
  if(p.poll){
    var total=(p.poll.options||[]).reduce(function(sum,o){return sum+Number(o.votes||0);},0);
    pollHtml='<div class="rz-card" style="margin:12px 0"><strong>'+esc(p.poll.question||"Poll")+'</strong>'+
      (p.poll.options||[]).map(function(o){
        var pct=total?Math.round(Number(o.votes||0)*100/total):0;
        return '<button class="rz-poll-option" data-poll-vote="'+esc(p.id)+'" data-poll-option="'+esc(o.id)+'" style="display:block;width:100%;text-align:left;margin-top:7px;padding:10px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.03);color:inherit">'+
          '<strong>'+esc(o.label)+'</strong><span class="rz-mini"> · '+pct+'% · '+Number(o.votes||0)+' vote(s)</span></button>';
      }).join("")+'</div>';
  }
  var collabHtml=(p.collaborators||[]).length
    ? '<div class="rz-mini" style="margin-top:7px">With '+(p.collaborators||[]).map(function(x){return '@'+esc(x.publicUsername||x.username);}).join(", ")+'</div>'
    : "";
  return '<article class="rz-card"><div class="rz-post-head">'+avatar(p.author)+'<div><strong>'+esc(p.author.displayName)+'</strong> '+verified(p.author)+'<div class="rz-mini">@'+esc(p.author.publicUsername||p.author.username)+"</div>"+collabHtml+"</div></div><div class='rz-post-body'>"+esc(p.text||"")+"</div>"+(p.aiAssisted?'<span class="rz-badge">AI-assisted</span>':"")+renderMedia(p.mediaUrl)+pollHtml+"<div class='rz-tags'>"+(p.hashtags||[]).map(function(t){return '<span class="rz-tag">#'+esc(t)+"</span>";}).join("")+"</div><div class='rz-post-actions'><button data-like='"+p.id+"'>Like "+Number((p.metrics||{}).likes||0)+"</button><button data-comment='"+p.id+"'>Comment "+Number((p.metrics||{}).comments||0)+"</button><button data-save='"+p.id+"'>Save "+Number((p.metrics||{}).saves||0)+"</button><button data-share-post='"+p.id+"'>Share</button></div></article>";
}
async function openComments(postId){
  var old=$("rzCommentsModal");if(old)old.remove();
  try{
    var d=await api("/api/v2/posts/"+encodeURIComponent(postId)+"/comments"),comments=d.comments||[];
    var wrap=document.createElement("div");wrap.id="rzCommentsModal";wrap.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:16px;";
    function commentHtml(c,depth){
      var pad=Math.min(Number(depth||0),3)*18;
      var audio="";
      if(c.mediaUrl){
        audio='<audio controls preload="metadata" style="width:100%;margin-top:8px" data-rz-media-src="'+esc(c.mediaUrl)+'"></audio>';
      }
      return '<div style="margin-left:'+pad+'px;padding:11px 0;border-bottom:1px solid var(--line)"><div><strong>'+esc(c.author&&c.author.displayName||c.author&&c.author.username||"Creator")+'</strong> <span class="rz-mini">@'+esc(c.author&&(c.author.publicUsername||c.author.username)||"")+'</span></div>'+(c.text?'<div style="margin:5px 0 8px">'+esc(c.text)+'</div>':"")+(c.messageType==="voice"?'<div class="rz-mini">Voice comment</div>':"")+audio+'<button class="rz-btn" data-comment-reply="'+esc(c.id)+'" data-comment-user="'+esc(c.author&&(c.author.publicUsername||c.author.username)||"creator")+'">Reply</button>'+(c.replies||[]).map(function(r){return commentHtml(r,Number(depth||0)+1);}).join("")+'</div>';
    }
    wrap.innerHTML='<section class="rz-card" style="width:min(720px,100%);max-height:82vh;overflow:auto;margin:0"><div class="rz-actions" style="justify-content:space-between"><div><div class="rz-kicker">COMMENTS</div><h2 style="margin:4px 0">Join the conversation</h2></div><button id="rzCommentsClose" class="rz-btn">Close</button></div><div style="margin:8px 0 14px">'+(comments.length?comments.map(function(c){return commentHtml(c,0);}).join(""):'<div class="rz-mini">No comments yet. Start the conversation.</div>')+'</div><form id="rzCommentForm" data-post-id="'+esc(postId)+'"><textarea id="rzCommentText" class="rz-textarea" maxlength="1000" placeholder="Write a comment…"></textarea><button class="rz-btn primary" style="margin-top:8px">Comment</button><div id="rzCommentStatus" class="rz-error"></div></form></section>';
    document.body.appendChild(wrap);
    wrap.querySelector("#rzCommentsClose").onclick=function(){wrap.remove();};
    wrap.onclick=function(e){if(e.target===wrap)wrap.remove();};
    wrap.querySelector("#rzCommentForm").onsubmit=async function(e){
      e.preventDefault();var text=wrap.querySelector("#rzCommentText").value.trim();if(!text)return;
      try{var parentId=wrap.querySelector("#rzCommentForm").getAttribute("data-comment-parent")||null;await api("/api/v2/posts/"+encodeURIComponent(postId)+"/comment",{method:"POST",body:JSON.stringify({text:text,parentId:parentId})});await openComments(postId);}catch(err){wrap.querySelector("#rzCommentStatus").textContent=err.message;}
    };
     if(window.RIZORA_VOICE_WIRE)window.RIZORA_VOICE_WIRE();
    wrap.querySelectorAll("[data-comment-reply]").forEach(function(btn){btn.onclick=function(){
      var form=wrap.querySelector("#rzCommentForm"),parentId=btn.getAttribute("data-comment-reply"),username=btn.getAttribute("data-comment-user")||"creator";
      if(!form)return;
      if(form.getAttribute("data-comment-parent")===parentId){
        form.removeAttribute("data-comment-parent");
        wrap.querySelector("#rzCommentText").placeholder="Write a comment…";
        btn.classList.remove("primary");
        return;
      }
      form.setAttribute("data-comment-parent",parentId);
      wrap.querySelector("#rzCommentText").placeholder="Reply to @"+username+"…";
      wrap.querySelector("#rzCommentText").focus();
      wrap.querySelectorAll("[data-comment-reply]").forEach(function(x){x.classList.remove("primary");});
      btn.classList.add("primary");
    };});
  }catch(err){toast(err.message);}
}
window.RIZORA_REOPEN_COMMENTS=openComments;

function task(t){
  var locked=t.locked===true;
  return '<div class="rz-card rz-task"><strong>'+esc(t.title)+"</strong><div>"+esc(t.description||"")+"</div><span class='rz-points'>+"+Number(t.points||t.reward||0)+" pts</span>"+(locked?"<div class='rz-mini'>Locked until your 7-minute task cooldown ends.</div>":"")+
    "<button class='rz-btn primary' data-task='"+esc(t.id)+"'"+(locked?" disabled":"")+">"+(locked?"Locked":"Start task")+"</button></div>";
}
function socialTask(t){
  var locked=Number(t.cooldownMs||0)>0||t.completed===true;
  return '<div class="rz-card rz-task"><strong>'+esc(t.title)+"</strong><div>"+esc(t.description||"")+"</div><span class='rz-points'>+"+Number(t.reward||0)+" pts</span>"+(locked?"<div class='rz-mini'>"+(Number(t.cooldownMs||0)>0?"Available again after the 7-minute cooldown.":"Completed.")+"</div>":"")+
    "<button class='rz-btn primary' data-social='"+esc(t.id)+"'"+(locked?" disabled":"")+">"+(locked?"Locked":"Complete")+"</button></div>";
}
function wire(){
  document.querySelectorAll("[data-onboarding-follow]").forEach(function(b){b.onclick=function(){var username=b.getAttribute("data-onboarding-follow");api("/api/v2/onboarding/follow",{method:"POST",body:JSON.stringify({username:username})}).then(function(d){toast("Followed @"+d.username+" · +"+d.awarded+" pts");load();}).catch(function(e){toast(e.message);});};});
  document.querySelectorAll("[data-go]").forEach(function(b){b.onclick=function(){state.view=b.getAttribute("data-go");shell();load();};});
  if(state.view==="flow"){
    document.querySelectorAll("[data-tab]").forEach(function(b){b.onclick=function(){state.feedTab=b.getAttribute("data-tab");load();};});
    $("postForm").onsubmit=async function(e){e.preventDefault();var text=$("postText").value.trim(),mediaUrl=$("postMedia").value.trim(),aiAssisted=$("postAiAssisted")&&$("postAiAssisted").checked,schedule=$("postSchedule").value.trim(),pollQuestion=$("postPollQuestion").value.trim(),pollOptions=[$("postPollOption1").value.trim(),$("postPollOption2").value.trim(),$("postPollOption3").value.trim(),$("postPollOption4").value.trim()].filter(Boolean),collab=$("postCollab").value.trim().replace(/^@/,"");$("postError").textContent="";$("postStatus").textContent="";try{var created;if(schedule){if(pollQuestion)throw new Error("Publish the poll now or schedule it as a normal post.");var d=await api("/api/v2/schedules",{method:"POST",body:JSON.stringify({text:text,mediaUrl:mediaUrl,scheduledFor:new Date(schedule).toISOString()})});$("postStatus").textContent="Scheduled for "+new Date(d.schedule.scheduledFor).toLocaleString();}else if(pollQuestion){if(pollOptions.length<2)throw new Error("Add at least two poll options.");var p=await api("/api/v2/polls",{method:"POST",body:JSON.stringify({text:text,mediaUrl:mediaUrl,question:pollQuestion,options:pollOptions.map(function(label){return{label:label};})})});created=p.post;$("postStatus").textContent="Poll published.";if(collab&&created)await api("/api/v2/posts/"+encodeURIComponent(created.id)+"/collaborators/invite",{method:"POST",body:JSON.stringify({username:collab})});}else{var n=await api("/api/v2/posts",{method:"POST",body:JSON.stringify({text:text,mediaUrl:mediaUrl,aiAssisted:aiAssisted})});created=n.post||n;if(collab&&created)await api("/api/v2/posts/"+encodeURIComponent(created.id)+"/collaborators/invite",{method:"POST",body:JSON.stringify({username:collab})});$("postStatus").textContent=collab?"Published · collaboration invite sent.":"Published.";}$("postText").value="";$("postMedia").value="";$("postPollQuestion").value="";["1","2","3","4"].forEach(function(n){$("postPollOption"+n).value="";});$("postSchedule").value="";$("postCollab").value="";load();}catch(err){$("postError").textContent=err.message;}};bindMediaPicker("postMediaFile","postMediaStatus","postMedia");$("saveDraft").onclick=async function(){try{await api("/api/v2/drafts",{method:"POST",body:JSON.stringify({title:textPreview($("postText").value),text:$("postText").value,mediaUrl:$("postMedia").value})});toast("Draft saved.");}catch(err){$("postError").textContent=err.message;}};$("clearPostOptions").onclick=function(){$("postPollQuestion").value="";["1","2","3","4"].forEach(function(n){$("postPollOption"+n).value="";});$("postSchedule").value="";$("postCollab").value="";};
    document.querySelectorAll("[data-like]").forEach(function(b){b.onclick=function(){api("/api/v2/posts/"+b.getAttribute("data-like")+"/like",{method:"POST"}).then(load).catch(function(e){toast(e.message);});}});
    document.querySelectorAll("[data-comment]").forEach(function(b){b.onclick=function(){openComments(b.getAttribute("data-comment"));};});
    document.querySelectorAll("[data-save]").forEach(function(b){b.onclick=function(){api("/api/v2/posts/"+b.getAttribute("data-save")+"/save",{method:"POST"}).then(load).catch(function(e){toast(e.message);});}});
    document.querySelectorAll("[data-poll-vote]").forEach(function(b){b.onclick=function(){api("/api/v2/polls/"+encodeURIComponent(b.getAttribute("data-poll-vote"))+"/vote",{method:"POST",body:JSON.stringify({optionId:b.getAttribute("data-poll-option")})}).then(load).catch(function(e){toast(e.message);});}});
    document.querySelectorAll("[data-share-post]").forEach(function(b){b.onclick=async function(){var target=window.prompt("Send this post to which RIZORA username?");if(!target)return;try{await api("/api/v2/messages/share",{method:"POST",body:JSON.stringify({recipientUsername:target,postId:b.getAttribute("data-share-post")})});toast("Post shared in DMs.");}catch(e){toast(e.message);}};});
  }
  if(state.view==="grow"){
  document.querySelectorAll("[data-task]").forEach(function(b){
    b.onclick=async function(){
      var id=b.getAttribute("data-task");
      if(b.disabled)return;
      b.disabled=true;
      try{
        await api("/api/tasks/start",{method:"POST",body:JSON.stringify({taskId:id})});
        var remaining=20;
        b.textContent="Started · 0:20";
        var timer=setInterval(function(){
          remaining-=1;
          if(remaining>0){b.textContent="Started · 0:"+String(remaining).padStart(2,"0");return;}
          clearInterval(timer);
          b.textContent="Claiming…";
          api("/api/tasks/complete",{method:"POST",body:JSON.stringify({taskId:id})})
            .then(function(d){
              var reward=Number(d.reward||d.points||0);
              if(window.RIZORA_POPUP)window.RIZORA_POPUP("Task complete",reward>0?"You earned +"+reward+" points.":"Task completed successfully.","success");
              return load();
            })
            .catch(function(e){b.disabled=false;b.textContent="Start task";toast(e.message);});
        },1000);
      }catch(e){
        b.disabled=false;
        b.textContent="Start task";
        toast(e.message);
      }
    };
  });
  document.querySelectorAll("[data-social]").forEach(function(b){
    b.onclick=function(){
      if(b.disabled)return;
      b.disabled=true;
      b.textContent="Completing…";
      api("/api/social/tasks/complete",{method:"POST",body:JSON.stringify({taskId:b.getAttribute("data-social")})})
        .then(function(d){
          var reward=Number(d.reward||d.points||0);
          if(window.RIZORA_POPUP)window.RIZORA_POPUP("Mission complete",reward>0?"You earned +"+reward+" points.":"Mission completed successfully.","success");
          return load();
        })
        .catch(function(e){b.disabled=false;b.textContent="Complete";toast(e.message);});
    };
  });
}
  if(state.view==="studio"){$("hooks").onclick=async function(){var d=await api("/api/generate/hooks",{method:"POST",body:"{}"});$("studioOut").textContent=(d.hooks||[]).join("\n");};$("hash").onclick=async function(){var d=await api("/api/generate/hashtags",{method:"POST",body:"{}"});$("studioOut").textContent=(d.hashtags||[]).join(" ");};$("captions").onclick=async function(){var d=await api("/api/generate/captions",{method:"POST",body:"{}"});$("studioOut").textContent=(d.captions||[]).join("\n");};}
  if(state.view==="ai"){document.querySelectorAll("[data-ai-speak]").forEach(function(b){b.onclick=function(){var i=Number(b.getAttribute("data-ai-speak"));var m=state.aiMessages[i];if(!m||m.role!=="ai")return;if(window.RIZORA_AI_SPEAK)window.RIZORA_AI_SPEAK(m.text,b);else toast("AI voice playback is still loading.");};});$("aiForm").onsubmit=async function(e){e.preventDefault();var q=$("aiInput").value.trim();if(!q)return;var history=state.aiMessages.slice(-8);state.aiMessages.push({role:"you",text:q});renderView();try{var d=await api("/api/ai/chat",{method:"POST",body:JSON.stringify({message:q,history:history})});state.aiMessages.push({role:"ai",text:d.reply||"No response."});}catch(err){state.aiMessages.push({role:"ai",text:err.message});}renderView();};if(window.RIZORA_VOICE_WIRE)window.RIZORA_VOICE_WIRE();}
  if(state.view==="discover")$("doSearch").onclick=async function(){state.query=$("q").value;state.search=await api("/api/v2/search?q="+encodeURIComponent(state.query));view();};
  if(state.view==="notifications")$("readAll").onclick=function(){api("/api/v2/notifications/read",{method:"POST"}).then(load);};
  if(state.view==="stories")wireStories();
  if(state.view==="communities")wireCommunities();
  if(state.view==="messages")wireMessages();
  if(state.view==="opportunities")wireOpportunities();
  if(state.view==="boosts")wireBoosts();
  if(state.view==="admin")wireAdmin();
  if(state.view==="profile"){var editor=$("rzProfileEditor"),edit=$("editProfile"),closeEditor=$("closeProfileEditor");if(edit&&editor)edit.onclick=function(){editor.style.display="block";};var profileSettings=$("profileSettings");if(profileSettings)profileSettings.onclick=function(){if(window.RIZORA_CONTROL_CENTER&&window.RIZORA_CONTROL_CENTER.preferences){window.RIZORA_CONTROL_CENTER.preferences();}else{toast("Profile settings are loading.");}};if(closeEditor&&editor)closeEditor.onclick=function(){editor.style.display="none";};$("profileForm").onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/profile",{method:"PATCH",body:JSON.stringify({avatarUrl:$("pfAvatar").value,bio:$("pfBio").value,category:$("pfCategory").value})});toast("Profile updated.");load();}catch(err){toast(err.message);}};bindMediaPicker("pfAvatarFile","pfAvatarStatus","pfAvatar");var verifyBtn=$("verify");if(verifyBtn)verifyBtn.onclick=verification;var premiumHint=$("rzOpenPremiumFromProfile");if(premiumHint)premiumHint.onclick=function(){if(window.RIZORA_SUITE&&window.RIZORA_SUITE.open){window.RIZORA_SUITE.open();}else{toast("Premium is available from Creator Suite.");}};var dismissPremiumSuggestion=$("rzDismissPremiumSuggestion");if(dismissPremiumSuggestion)dismissPremiumSuggestion.onclick=function(){try{sessionStorage.setItem("rz_premium_suggestion_dismissed","1");}catch(_){ }var hint=$("rzPremiumVerificationHint");if(hint)hint.remove();};}
}
function renderView(){view();wire();}
async function load(){
  try{if(!state.user){var me=await api("/api/auth/me");state.user=me.user;}var x=await api("/api/v2/me");state.user=x.user;state.profile=x.profile;window.RIZORA_CURRENT_USER=state.user;state.points=Number(x.user.points||0);}catch(e){state.user=null;window.RIZORA_CURRENT_USER=null;auth();return false;}
  try{if(state.view==="home"){var ob=await api("/api/v2/onboarding");state.onboarding=Array.isArray(ob.tasks)?ob.tasks:[];}}catch(e){state.onboarding=[];}
  try{if(state.view==="home"||state.view==="flow"){var f=await api("/api/v2/feed?tab="+state.feedTab);state.feed=f.posts||[];}}catch(e){}
  try{if(state.view==="grow"){var a=await api("/api/tasks");var s=await api("/api/social/tasks");state.tasks=a.tasks||[];state.socialTasks=s.tasks||[];}}catch(e){}
  try{if(state.view==="notifications"){var n=await api("/api/v2/notifications");state.notifications=n.notifications||[];}}catch(e){}
  try{if(state.view==="profile"){state.verification=await api("/api/verification/me");state.safety=await api("/api/v2/safety/me");}}catch(e){}
  try{if(state.view==="safety"){state.safety=await api("/api/v2/safety/me");}}catch(e){}
  try{if(state.view==="stories"){var st=await api("/api/v2/stories");state.stories=st.stories||[];}}catch(e){}
  try{if(state.view==="communities"){var co=await api("/api/v2/communities");state.communities=co.communities||[];}}catch(e){}
  try{if(state.view==="messages"){var ms=await api("/api/v2/messages");state.conversations=ms.conversations||[];}}catch(e){}
  try{if(state.view==="opportunities"){var op=await api("/api/v2/opportunities");state.opportunities=op.opportunities||[];}}catch(e){}
  try{if(state.view==="analytics"){state.analytics=await api("/api/v2/analytics/overview");}}catch(e){}
  try{if(state.view==="boosts"){var bx=await api("/api/boosts");state.boosts=bx.boosts||[];}}catch(e){}
  try{if(state.view==="official"){var of=await api("/api/official/profiles");state.official=of.profiles||[];}}catch(e){}
  try{if(state.view==="admin"&&state.user.role==="super_admin"){state.admin=await api("/api/superadmin/dashboard");}}catch(e){} try{if(state.view==="admin"&&state.user.role==="super_admin"){var vr=await api("/api/superadmin/verification/requests");state.adminVerification=vr.requests||[];}}catch(e){}
  shell();
  return true;
}
async function verification(){
  var overlay=document.createElement("div");overlay.className="rz-overlay";
  overlay.innerHTML='<div class="rz-modal"><h2>Creator verification</h2><p class="rz-muted">Status: '+esc(state.verification&&state.verification.status||"not_submitted")+'</p><textarea id="verifyReason" class="rz-textarea" placeholder="Why should we verify you?"></textarea><input id="verifyUrl" class="rz-input" placeholder="Public proof URL"><button id="sendVerify" class="rz-btn primary">Submit</button><button id="closeVerify" class="rz-btn">Close</button></div>';
  document.body.appendChild(overlay);$("closeVerify").onclick=function(){overlay.remove();};$("sendVerify").onclick=async function(){try{await api("/api/verification/apply",{method:"POST",body:JSON.stringify({reason:$("verifyReason").value,proofUrl:$("verifyUrl").value})});overlay.remove();if(window.RIZORA_POPUP)window.RIZORA_POPUP("Verification submitted","Your creator verification request is now under review.","success");else toast("Verification submitted.");load();}catch(err){toast(err.message);}};
}
boot();
async function boot(){if(navigator.serviceWorker)navigator.serviceWorker.register("/service-worker.js").catch(function(){});try{var m=await api("/api/auth/me");state.user=m.user;load();}catch(e){landing();}}
})();