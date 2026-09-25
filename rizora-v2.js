(function(){
"use strict";
var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
window.RIZORA_CURRENT_USER=null;
var state={user:null,profile:null,view:"home",authMode:"login",feedTab:"for-you",feed:[],tasks:[],socialTasks:[],notifications:[],verification:null,safety:null,points:0,query:"",search:null,aiMessages:[],stories:[],communities:[],conversations:[],opportunities:[],analytics:null,boosts:[],official:[],admin:null,adminVerification:[],onboarding:[]};

function $(id){return document.getElementById(id);}
function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function avatar(u){return u&&u.avatarUrl?'<img class="rz-avatar" src="'+esc(u.avatarUrl)+'">':'<div class="rz-avatar">'+esc((u&&(u.displayName||u.username)||"R").slice(0,2).toUpperCase())+"</div>";}
function verified(u){return u&&u.verified?'<span class="rz-badge ok">✓ Verified</span>':"";}
function toast(s){var t=$("toast");if(!t)return;t.textContent=s;t.classList.add("show");clearTimeout(window.__rt);window.__rt=setTimeout(function(){t.classList.remove("show");},2400);}
async function api(path,opt){opt=opt||{};var r=await fetch(API+path,{credentials:"include",method:opt.method||"GET",headers:Object.assign({"Content-Type":"application/json"},opt.headers||{}),body:opt.body});var x=await r.text(),d={};try{d=x?JSON.parse(x):{};}catch(e){d={error:x};}if(!r.ok){var err=new Error(d.message||d.error||"Request failed.");err.code=d.code||"";throw err;}return d;}

function landing(){
  document.body.innerHTML='<div class="rz-auth rz-landing"><div class="rz-shell rz-landing-shell"><div class="rz-brand"><img src="/rizora-cover.png"><div>RIZORA<small>CREATOR OS</small></div></div><section class="rz-landing-hero"><div class="rz-kicker">CREATOR GROWTH STUDIO</div><h1>Make your presence move.</h1><p class="rz-muted">RIZORA brings creator social, growth missions, AI, analytics, opportunities and community into one platform.</p><div class="rz-actions"><button id="landingSignup" class="rz-btn primary">Start creating</button><button id="landingLogin" class="rz-btn">Log in</button><button id="landingInstall" class="rz-btn">Install RIZORA</button></div></section><section class="rz-grid rz-landing-grid"><div class="rz-card rz-span-6"><div class="rz-kicker">VERIFIED</div><h3>RIZORA · @rizora</h3><p class="rz-muted">Official verified platform account.</p></div><div class="rz-card rz-span-6"><div class="rz-kicker">OFFICIAL CREATOR</div><h3>RoMi · @romi.noir</h3><p class="rz-muted">Artist. Developer. Creator. Builder. Creator of RIZORA.</p></div><div class="rz-card rz-span-4"><div class="rz-kicker">FLOW</div><h3>Social creator platform</h3><p class="rz-muted">Post, discover, follow, message and build community.</p></div><div class="rz-card rz-span-4"><div class="rz-kicker">GROW</div><h3>Creator growth</h3><p class="rz-muted">Missions, referrals, Boosts and creator campaigns.</p></div><div class="rz-card rz-span-4"><div class="rz-kicker">AI</div><h3>RIZORA intelligence</h3><p class="rz-muted">Ideas, analysis, strategy, hooks and creator tools.</p></div></section><footer class="rz-mini rz-landing-footer">RIZORA · Web-first creator platform · rizora.com.ng</footer></div></div>';
  $("landingSignup").onclick=function(){state.authMode="signup";auth();};
  $("landingLogin").onclick=function(){state.authMode="login";auth();};
  $("landingInstall").onclick=function(){if(window.RIZORA_SUITE&&window.RIZORA_SUITE.install){window.RIZORA_SUITE.install();}else if(window.RIZORA_SUITE_PROMPT){window.RIZORA_SUITE_PROMPT.prompt();window.RIZORA_SUITE_PROMPT=null;}else{toast("Use your browser menu to install RIZORA.");}};
}

function auth(){
  document.body.innerHTML='<div class="rz-auth"><div class="rz-auth-card"><button id="backLanding" class="rz-btn">Back to RIZORA</button><div class="rz-brand"><img src="/rizora-cover.png"><div>RIZORA<small>CREATOR OS</small></div></div><h1>Everything for creators.</h1><p class="rz-muted">Social. Growth. AI. Community.</p><div class="rz-tabs"><button id="tabLogin">Log in</button><button id="tabSignup">Create account</button></div><form id="authForm"><div id="signupBox"></div><div class="rz-field"><label class="rz-label">Username or email</label><input id="identifier" class="rz-input" required></div><div class="rz-field"><label class="rz-label">Password</label><input id="password" class="rz-input" type="password" required></div><button id="authSubmit" class="rz-btn primary" style="width:100%">Log in</button><div class="rz-divider">OR</div><div id="googleButton"></div><div id="authError" class="rz-error"></div></form></div></div>';
  $("backLanding").onclick=function(){landing();};
  $("tabLogin").onclick=function(){state.authMode="login";auth();};
  $("tabSignup").onclick=function(){state.authMode="signup";auth();};
  $("tabLogin").className=state.authMode==="login"?"active":"";
  $("tabSignup").className=state.authMode==="signup"?"active":"";
  if(state.authMode==="signup"){
    $("identifier").required=false;
    $("identifier").parentElement.style.display="none";
    $("signupBox").innerHTML='<div class="rz-field"><label class="rz-label">Username</label><input id="username" class="rz-input" required></div><div class="rz-field"><label class="rz-label">Display name</label><input id="displayName" class="rz-input"></div><div class="rz-field"><label class="rz-label">Email</label><input id="email" class="rz-input" type="email" required></div><div class="rz-field"><label class="rz-label">Confirm password</label><input id="confirmPassword" class="rz-input" type="password" required></div>';
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
      state.user=d.user;window.RIZORA_CURRENT_USER=state.user;await load();toast("Welcome to RIZORA.");
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
          api("/api/auth/google",{method:"POST",body:JSON.stringify({credential:r.credential})}).then(function(d){state.user=d.user;window.RIZORA_CURRENT_USER=state.user;load();}).catch(function(e){$("authError").textContent=e.message;});
        }});
        google.accounts.id.renderButton($("googleButton"),{theme:"outline",size:"large",width:380,text:"continue_with",shape:"rectangular"});
      }
      if(n>80)clearInterval(tm);
    },100);
  }).catch(function(){});
}
function shell(){
  var items=["home","flow","stories","grow","boosts","communities","studio","ai","discover","official","messages","opportunities","analytics","notifications","profile","safety"];
  var side=items.map(function(id){return '<button class="'+(state.view===id?"active":"")+'" data-nav="'+id+'">'+id.charAt(0).toUpperCase()+id.slice(1)+"</button>";}).join("");
  document.body.innerHTML='<div class="rz-top"><div class="rz-shell rz-top-inner"><button class="rz-btn rz-brand" id="brand"><img src="/rizora-cover.png" style="width:36px;height:36px;border-radius:11px">RIZORA</button><div class="rz-actions"><button class="rz-btn" id="refresh">Refresh</button>'+avatar(state.user)+'</div></div></div><main class="rz-shell rz-main"><aside class="rz-sidebar"><div class="rz-nav">'+side+'</div><div class="rz-mini" style="padding:12px;border-top:1px solid var(--line);margin-top:10px">POINTS<br><strong>'+state.points+'</strong><br>7-minute cycle</div></aside><section class="rz-content" id="content"></section></main><nav class="rz-mobile-nav">'+items.slice(0,5).map(function(id){return '<button data-nav="'+id+'">'+id+"</button>";}).join("")+'</nav>';
  document.querySelectorAll("[data-nav]").forEach(function(b){b.onclick=function(){state.view=b.getAttribute("data-nav");shell();load();};});
  $("refresh").onclick=load;
  $("brand").onclick=function(){state.view="home";shell();load();};
  view();
}
function card(title,body){return '<section class="rz-card"><div class="rz-kicker">'+title+'</div>'+body+'</section>';}
function view(){
  var c=$("content");
  if(state.view==="home")c.innerHTML=card("RIZORA RADAR","<h2>What should you do now?</h2><p class='rz-muted'>Content, growth, AI and community in one place.</p><div class='rz-actions'><button class='rz-btn primary' data-go='flow'>Create a post</button><button class='rz-btn' data-go='grow'>Open Grow</button><button class='rz-btn' data-go='ai'>Ask AI</button></div>")+((state.onboarding||[]).some(function(t){return !t.completed;})?card("START HERE","<h3>Follow the verified RIZORA accounts</h3><p class='rz-muted'>Follow them on RIZORA and earn your first creator points.</p><div class='rz-feed'>"+(state.onboarding||[]).filter(function(t){return !t.completed;}).map(function(t){return "<div class='rz-card rz-task'><strong>"+esc(t.title)+"</strong><div>"+esc(t.description)+"</div><span class='rz-points'>+"+Number(t.points||0)+" pts</span><button class='rz-btn primary' data-onboarding-follow='"+esc(t.username)+"'>Follow + earn</button></div>";}).join("")+"</div>"): "")+card("ACCOUNT","<div class='rz-stat'>"+state.points+"</div><div class='rz-mini'>points</div><div>"+verified(state.user)+" <span class='rz-badge'>"+Number(state.user.warningCount||0)+"/3 warnings</span></div>");
  if(state.view==="flow")c.innerHTML=card("FLOW","<h2>Social platform</h2><div class='rz-actions'><button class='rz-btn' data-tab='for-you'>For You</button><button class='rz-btn' data-tab='following'>Following</button><button class='rz-btn' data-tab='trending'>Trending</button></div><form id='postForm' style='margin-top:14px'><textarea id='postText' class='rz-textarea' placeholder='Post something. Use #hashtags and @mentions.'></textarea><input id='postMedia' class='rz-input' placeholder='Optional media URL'><button class='rz-btn primary'>Post</button><div id='postError' class='rz-error'></div></form>")+('<div class="rz-feed">'+state.feed.map(post).join("")+"</div>");
  if(state.view==="grow")c.innerHTML=card("GROW","<h2>Build momentum</h2><p class='rz-muted'>7-minute cooldown.</p><div class='rz-feed'>"+state.tasks.map(task).join("")+state.socialTasks.map(socialTask).join("")+"</div>");
  if(state.view==="studio")c.innerHTML=card("STUDIO","<h2>Create smarter</h2><div class='rz-actions'><button id='hooks' class='rz-btn primary'>Hooks</button><button id='hash' class='rz-btn'>Hashtags</button><button id='captions' class='rz-btn'>Captions</button></div><pre id='studioOut'></pre>");
  if(state.view==="ai")c.innerHTML=card("RIZORA AI","<h2>Creator copilot</h2><div class='rz-feed'>"+state.aiMessages.map(function(m){return '<div class="rz-card"><strong>'+m.role+'</strong><div>'+esc(m.text)+"</div></div>";}).join("")+"</div><form id='aiForm' class='rz-actions'><input id='aiInput' class='rz-input' placeholder='Ask about content or growth'><button class='rz-btn primary'>Ask</button></form>");
  if(state.view==="discover")c.innerHTML=card("DISCOVER","<h2>Search</h2><div class='rz-actions'><input id='q' class='rz-input' value='"+esc(state.query)+"' placeholder='creator or #hashtag'><button id='doSearch' class='rz-btn primary'>Search</button></div><div class='rz-feed'>"+((state.search&&state.search.users)||[]).map(function(u){return '<div class="rz-card">'+avatar(u)+" <strong>"+esc(u.displayName)+"</strong> @"+esc(u.publicUsername||u.username)+"</div>";}).join("")+"</div>");
  if(state.view==="notifications")c.innerHTML=card("ALERTS","<h2>Notifications</h2><button id='readAll' class='rz-btn'>Mark read</button><div class='rz-feed'>"+state.notifications.map(function(n){return '<div class="rz-card"><strong>'+esc(n.title)+"</strong><div>"+esc(n.message)+"</div></div>";}).join("")+"</div>");
  if(state.view==="profile")c.innerHTML=card("PROFILE","<div class='rz-profile'>"+avatar(state.user)+"<div><h2>"+esc(state.user.displayName||state.user.username)+"</h2><div>@"+esc(state.user.publicUsername||state.user.username)+"</div>"+verified(state.user)+"</div></div><p class='rz-muted'>No banner. PFP + bio + links.</p><form id='profileForm'><input id='pfAvatar' class='rz-input' placeholder='PFP URL' value='"+esc((state.profile&&state.profile.avatarUrl)||"")+"'><textarea id='pfBio' class='rz-textarea' placeholder='Bio'>"+esc((state.profile&&state.profile.bio)||"")+"</textarea><input id='pfCategory' class='rz-input' placeholder='Category' value='"+esc((state.profile&&state.profile.category)||"")+"'><button class='rz-btn primary'>Save profile</button></form><div style='margin-top:14px'>"+card("VERIFICATION","<button id='verify' class='rz-btn'>Open verification</button>")+"</div>");
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
  var groups=(state.stories||[]).map(function(g){return '<div class="rz-card"><div class="rz-post-head">'+avatar(g.user)+'<div><strong>'+esc(g.user.displayName)+'</strong> '+verified(g.user)+'<div class="rz-mini">@'+esc(g.user.publicUsername||g.user.username)+'</div></div></div>'+g.stories.map(function(s){return '<div class="rz-card"><div class="rz-post-body">'+esc(s.text||"")+'</div>'+(s.mediaUrl?'<a class="rz-btn" href="'+esc(s.mediaUrl)+'" target="_blank" rel="noopener">Open media</a>':'')+'</div>';}).join("")+'</div>';}).join("");
  return card("STORIES","<h2>Creator stories</h2><p class='rz-muted'>Stories expire after 24 hours.</p><form id='storyForm'><textarea id='storyText' class='rz-textarea' placeholder='Add a story'></textarea><input id='storyMedia' class='rz-input' placeholder='Optional media URL'><button class='rz-btn primary'>Publish story</button><div id='storyError' class='rz-error'></div></form><div class='rz-feed'>"+(groups||"<div class='rz-empty'>No active stories yet.</div>")+"</div>");
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
  $("storyForm").onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/stories",{method:"POST",body:JSON.stringify({text:$("storyText").value,mediaUrl:$("storyMedia").value})});toast("Story published.");load();}catch(err){$("storyError").textContent=err.message;}};
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
    $("chatBox").innerHTML='<div class="rz-card" style="margin-top:14px"><h3>'+esc(d.user.displayName)+'</h3><div class="rz-mini">@'+esc(d.user.publicUsername||d.user.username)+'</div><div class="rz-feed">'+d.messages.map(function(m){return '<div class="rz-card"><div class="rz-mini">'+(m.fromUserId===state.user.id?"You":"Creator")+'</div>'+esc(m.text)+"</div>";}).join("")+'</div><form id="messageForm" class="rz-actions"><input id="messageText" class="rz-input" placeholder="Write a message" required><button class="rz-btn primary">Send</button></form></div>';
    $("messageForm").onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/messages/"+encodeURIComponent(target),{method:"POST",body:JSON.stringify({text:$("messageText").value})});openChat(target);}catch(err){toast(err.message);}};
  }catch(err){toast(err.message);}
}

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
    var links="";
    if(p.website)links+='<a class="rz-btn" href="'+esc(p.website)+'" target="_blank" rel="noopener">Website</a>';
    if(p.tiktok)links+='<a class="rz-btn" href="'+esc(p.tiktok)+'" target="_blank" rel="noopener">TikTok</a>';
    if(p.instagram)links+='<a class="rz-btn" href="'+esc(p.instagram)+'" target="_blank" rel="noopener">Instagram</a>';
    if(p.x)links+='<a class="rz-btn" href="'+esc(p.x)+'" target="_blank" rel="noopener">X</a>';
    return '<div class="rz-card"><div class="rz-post-head">'+avatar(p)+'<div><strong>'+esc(p.displayName||p.username)+'</strong> <span class="rz-badge ok">✓ Verified</span><div class="rz-mini">@'+esc(p.publicUsername||p.username)+'</div></div></div><div class="rz-actions">'+links+"</div></div>";
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
    var id=(r.user&&r.user.id)||r.userId;
    return '<div class="rz-card"><strong>'+esc((r.user&&r.user.displayName)||"Creator")+'</strong><div class="rz-mini">@'+esc((r.user&&r.user.username)||"unknown")+'</div><button class="rz-btn primary" data-grant="'+esc(id)+'">Grant verification</button></div>';
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
        await api("/api/superadmin/verification/grant",{method:"POST",body:JSON.stringify({userId:b.getAttribute("data-grant")})});
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
  return '<article class="rz-card"><div class="rz-post-head">'+avatar(p.author)+'<div><strong>'+esc(p.author.displayName)+'</strong> '+verified(p.author)+'<div class="rz-mini">@'+esc(p.author.publicUsername||p.author.username)+"</div>"+collabHtml+"</div></div><div class='rz-post-body'>"+esc(p.text||"")+"</div>"+pollHtml+"<div class='rz-tags'>"+(p.hashtags||[]).map(function(t){return '<span class="rz-tag">#'+esc(t)+"</span>";}).join("")+"</div><div class='rz-post-actions'><button data-like='"+p.id+"'>Like "+Number((p.metrics||{}).likes||0)+"</button><button data-comment='"+p.id+"'>Comment "+Number((p.metrics||{}).comments||0)+"</button><button data-save='"+p.id+"'>Save "+Number((p.metrics||{}).saves||0)+"</button><button data-share-post='"+p.id+"'>Share</button></div></article>";
}
function task(t){return '<div class="rz-card rz-task"><strong>'+esc(t.title)+"</strong><div>"+esc(t.description||"")+"</div><span class='rz-points'>+"+Number(t.points||t.reward||0)+" pts</span><button class='rz-btn primary' data-task='"+esc(t.id)+"'>Complete</button></div>";}
function socialTask(t){return '<div class="rz-card rz-task"><strong>'+esc(t.title)+"</strong><div>"+esc(t.description||"")+"</div><span class='rz-points'>+"+Number(t.reward||0)+" pts</span><button class='rz-btn primary' data-social='"+esc(t.id)+"'>Complete</button></div>";}
function wire(){
  document.querySelectorAll("[data-onboarding-follow]").forEach(function(b){b.onclick=function(){var username=b.getAttribute("data-onboarding-follow");api("/api/v2/onboarding/follow",{method:"POST",body:JSON.stringify({username:username})}).then(function(d){toast("Followed @"+d.username+" · +"+d.awarded+" pts");load();}).catch(function(e){toast(e.message);});};});
  document.querySelectorAll("[data-go]").forEach(function(b){b.onclick=function(){state.view=b.getAttribute("data-go");shell();load();};});
  if(state.view==="flow"){
    document.querySelectorAll("[data-tab]").forEach(function(b){b.onclick=function(){state.feedTab=b.getAttribute("data-tab");load();};});
    $("postForm").onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/posts",{method:"POST",body:JSON.stringify({text:$("postText").value,mediaUrl:$("postMedia").value})});$("postText").value="";load();}catch(err){$("postError").textContent=err.message;}};
    document.querySelectorAll("[data-like]").forEach(function(b){b.onclick=function(){api("/api/v2/posts/"+b.getAttribute("data-like")+"/like",{method:"POST"}).then(load).catch(function(e){toast(e.message);});}});
    document.querySelectorAll("[data-save]").forEach(function(b){b.onclick=function(){api("/api/v2/posts/"+b.getAttribute("data-save")+"/save",{method:"POST"}).then(load).catch(function(e){toast(e.message);});}});
    document.querySelectorAll("[data-poll-vote]").forEach(function(b){b.onclick=function(){api("/api/v2/polls/"+encodeURIComponent(b.getAttribute("data-poll-vote"))+"/vote",{method:"POST",body:JSON.stringify({optionId:b.getAttribute("data-poll-option")})}).then(load).catch(function(e){toast(e.message);});}});
    document.querySelectorAll("[data-share-post]").forEach(function(b){b.onclick=async function(){var target=window.prompt("Send this post to which RIZORA username?");if(!target)return;try{await api("/api/v2/messages/share",{method:"POST",body:JSON.stringify({recipientUsername:target,postId:b.getAttribute("data-share-post")})});toast("Post shared in DMs.");}catch(e){toast(e.message);}};});
  }
  if(state.view==="grow"){document.querySelectorAll("[data-task]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-task");api("/api/tasks/start",{method:"POST",body:JSON.stringify({taskId:id})}).then(function(){return api("/api/tasks/complete",{method:"POST",body:JSON.stringify({taskId:id})});}).then(load).catch(function(e){toast(e.message);});};});document.querySelectorAll("[data-social]").forEach(function(b){b.onclick=function(){api("/api/social/tasks/complete",{method:"POST",body:JSON.stringify({taskId:b.getAttribute("data-social")})}).then(load).catch(function(e){toast(e.message);});};});}
  if(state.view==="studio"){$("hooks").onclick=async function(){var d=await api("/api/generate/hooks",{method:"POST",body:"{}"});$("studioOut").textContent=(d.hooks||[]).join("\n");};$("hash").onclick=async function(){var d=await api("/api/generate/hashtags",{method:"POST",body:"{}"});$("studioOut").textContent=(d.hashtags||[]).join(" ");};$("captions").onclick=async function(){var d=await api("/api/generate/captions",{method:"POST",body:"{}"});$("studioOut").textContent=(d.captions||[]).join("\n");};}
  if(state.view==="ai")$("aiForm").onsubmit=async function(e){e.preventDefault();var q=$("aiInput").value.trim();if(!q)return;state.aiMessages.push({role:"you",text:q});renderView();try{var d=await api("/api/ai/chat",{method:"POST",body:JSON.stringify({message:q})});state.aiMessages.push({role:"ai",text:d.reply||"No response."});}catch(err){state.aiMessages.push({role:"ai",text:err.message});}renderView();};
  if(state.view==="discover")$("doSearch").onclick=async function(){state.query=$("q").value;state.search=await api("/api/v2/search?q="+encodeURIComponent(state.query));view();};
  if(state.view==="notifications")$("readAll").onclick=function(){api("/api/v2/notifications/read",{method:"POST"}).then(load);};
  if(state.view==="stories")wireStories();
  if(state.view==="communities")wireCommunities();
  if(state.view==="messages")wireMessages();
  if(state.view==="opportunities")wireOpportunities();
  if(state.view==="boosts")wireBoosts();
  if(state.view==="admin")wireAdmin();
  if(state.view==="profile"){$("profileForm").onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/profile",{method:"PATCH",body:JSON.stringify({avatarUrl:$("pfAvatar").value,bio:$("pfBio").value,category:$("pfCategory").value})});load();}catch(err){toast(err.message);}};$("verify").onclick=verification;}
}
function renderView(){view();}
async function load(){
  try{if(!state.user){var me=await api("/api/auth/me");state.user=me.user;}var x=await api("/api/v2/me");state.user=x.user;state.profile=x.profile;window.RIZORA_CURRENT_USER=state.user;state.points=Number(x.user.points||0);}catch(e){state.user=null;window.RIZORA_CURRENT_USER=null;auth();return;}
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
  try{if(state.view==="admin"&&state.user.role==="super_admin"){state.admin=await api("/api/superadmin/dashboard");}}catch(e){} try{if(state.view==="admin"&&state.user.role==="super_admin"){var vr=await api("/api/superadmin/verification");state.adminVerification=vr.requests||[];}}catch(e){}
  shell();
}
async function verification(){
  var overlay=document.createElement("div");overlay.className="rz-overlay";
  overlay.innerHTML='<div class="rz-modal"><h2>Creator verification</h2><p class="rz-muted">Status: '+esc(state.verification&&state.verification.status||"not_submitted")+'</p><textarea id="verifyReason" class="rz-textarea" placeholder="Why should we verify you?"></textarea><input id="verifyUrl" class="rz-input" placeholder="Public proof URL"><button id="sendVerify" class="rz-btn primary">Submit</button><button id="closeVerify" class="rz-btn">Close</button></div>';
  document.body.appendChild(overlay);$("closeVerify").onclick=function(){overlay.remove();};$("sendVerify").onclick=async function(){try{await api("/api/verification/apply",{method:"POST",body:JSON.stringify({reason:$("verifyReason").value,proofUrl:$("verifyUrl").value})});overlay.remove();toast("Verification submitted.");load();}catch(err){toast(err.message);}};
}
boot();
async function boot(){if(navigator.serviceWorker)navigator.serviceWorker.register("/service-worker.js").catch(function(){});try{var m=await api("/api/auth/me");state.user=m.user;load();}catch(e){landing();}}
})();