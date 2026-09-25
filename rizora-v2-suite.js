(function(){
"use strict";
var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
async function api(path,opt){opt=opt||{};var r=await fetch(API+path,{credentials:"include",method:opt.method||"GET",headers:Object.assign({"Content-Type":"application/json"},opt.headers||{}),body:opt.body});var t=await r.text(),d={};try{d=t?JSON.parse(t):{};}catch(_){d={error:t};}if(!r.ok)throw new Error(d.message||d.error||"Request failed.");return d;}
function toast(s){if(window.RIZORA_ENTERPRISE&&typeof window.RIZORA_ENTERPRISE.toast==="function")return window.RIZORA_ENTERPRISE.toast(s);var t=document.getElementById("toast");if(!t)return;t.textContent=s;t.classList.add("show");clearTimeout(window.__rzSuiteToast);window.__rzSuiteToast=setTimeout(function(){t.classList.remove("show");},2400);}
function modal(title,sub,body){
 var old=document.getElementById("rzSuiteModal");if(old)old.remove();
 var m=document.createElement("div");m.id="rzSuiteModal";m.className="rz-suite-overlay";
 m.innerHTML='<div class="rz-suite-panel"><div class="rz-suite-head"><div><div class="rz-kicker">RIZORA CREATOR SUITE</div><h2>'+esc(title)+'</h2><p class="rz-muted">'+esc(sub||"")+'</p></div><button class="rz-btn" id="rzSuiteClose">Close</button></div><div id="rzSuiteBody">'+body+'</div></div>';
 document.body.appendChild(m);document.getElementById("rzSuiteClose").onclick=function(){m.remove();};m.addEventListener("click",function(e){if(e.target===m)m.remove();});
 return document.getElementById("rzSuiteBody");
}
function card(title,body){return '<section class="rz-suite-card"><div class="rz-kicker">'+esc(title)+'</div>'+body+'</section>';}
function stat(v,k){return '<div class="rz-suite-stat"><strong>'+esc(v)+'</strong><span>'+esc(k)+'</span></div>';}

async function premium(){
 var b=modal("Premium Suite","The old RIZORA Premium foundation is preserved and connected to real creator tools.",'<div class="rz-suite-grid rz-suite-grid-3"><div>'+card("ADVANCED AI","<h3>Creator intelligence</h3><p class='rz-muted'>Use RIZORA AI for strategy, ideas, hooks and growth planning.</p><button class='rz-btn primary' data-suite-go='intelligence'>Open AI tools</button>")+'</div><div>'+card("ADVANCED ANALYTICS","<h3>Deeper creator insight</h3><p class='rz-muted'>Combine platform analytics with creator scoring and idea history.</p><button class='rz-btn primary' data-suite-go='analytics'>Open analytics</button>")+'</div><div>'+card("PRO CREATOR TOOLS","<h3>Portfolio + planning</h3><p class='rz-muted'>Maintain a creator portfolio, experiments and a publishing plan.</p><button class='rz-btn primary' data-suite-go='portfolio'>Open tools</button>")+'</div></div><div class="rz-suite-grid rz-suite-grid-2"><div id="rzSuitePremiumStats">'+card("LIVE","<div class='rz-empty'>Loading creator data…</div>")+'</div><div>'+card("STATUS","<p class='rz-muted'>The repository contains a Premium feature foundation. It does <b>not</b> currently contain a subscription/membership billing entitlement, so no false paid-plan gate is being introduced.</p>")+'</div></div>');
 try{
   var x=await Promise.all([api("/api/v2/analytics/overview"),api("/api/creator/analytics"),api("/api/referrals/me")]);
   var a=x[0]||{},c=x[1]||{},r=x[2]||{};
   var s=document.getElementById("rzSuitePremiumStats");
   if(s)s.innerHTML=card("LIVE METRICS",'<div class="rz-suite-stats">'+stat(a.posts||0,"Posts")+stat(a.followers||0,"Followers")+stat(a.likes||0,"Likes")+stat(a.points||0,"Points")+stat(c.averageScore||0,"Avg score")+stat(r.count||0,"Referrals")+'</div>');
 }catch(e){}
 bindSuiteButtons(b);return b;
}
async function analytics(){
 var b=modal("Advanced Analytics","Live platform metrics plus the original creator-scoring analytics.",'<div id="rzSuiteAnalytics">'+card("ANALYTICS","<div class='rz-empty'>Loading…</div>")+'</div>');
 try{
  var x=await Promise.all([api("/api/v2/analytics/overview"),api("/api/creator/analytics")]),a=x[0]||{},c=x[1]||{};
  document.getElementById("rzSuiteAnalytics").innerHTML=card("PLATFORM + CREATOR INTELLIGENCE",'<div class="rz-suite-stats">'+stat(a.posts||0,"Posts")+stat(a.followers||0,"Followers")+stat(a.following||0,"Following")+stat(a.likes||0,"Likes")+stat(a.comments||0,"Comments")+stat(a.saves||0,"Saves")+stat(a.reposts||0,"Reposts")+stat(c.ideasGenerated||0,"Ideas generated")+stat(c.averageScore||0,"Average score")+stat(c.bestScore||0,"Best score")+'</div><div class="rz-suite-list">'+(c.scores||[]).slice().reverse().slice(0,10).map(function(x){return "<div><strong>"+esc(x.score)+"</strong> · "+esc(x.rating||"score")+" <span class='rz-mini'>"+new Date(x.createdAt).toLocaleString()+"</span></div>";}).join("")||"<div class='rz-empty'>No creator scores yet.</div>"+'</div>');
 }catch(e){document.getElementById("rzSuiteAnalytics").innerHTML='<div class="rz-error">'+esc(e.message)+'</div>';}
}
async function intelligence(){
 var b=modal("Creator Intelligence","Restore the original creator profile, analysis and idea-generation tools.",'<div class="rz-suite-grid rz-suite-grid-2"><form id="rzCreatorProfileForm">'+card("CREATOR PROFILE",'<div class="rz-field"><label class="rz-label">Niche</label><input class="rz-input" name="niche" maxlength="120" placeholder="Music, gaming, fashion…"></div><div class="rz-field"><label class="rz-label">Platforms</label><input class="rz-input" name="platforms" placeholder="TikTok, Instagram, YouTube"></div><div class="rz-field"><label class="rz-label">Goals</label><input class="rz-input" name="goals" placeholder="Growth, music, brand deals"></div><div class="rz-field"><label class="rz-label">Bio</label><textarea class="rz-textarea" name="bio" maxlength="500"></textarea></div><button class="rz-btn primary">Save creator profile</button></form>')+'</div><div class="rz-suite-grid rz-suite-grid-2"><form id="rzAnalyzeForm">'+card("POST ANALYZER",'<textarea class="rz-textarea" name="text" placeholder="Paste your post/caption here…"></textarea><button class="rz-btn primary">Analyze</button><pre id="rzAnalyzeOut" class="rz-suite-pre"></pre></form><form id="rzIdeasForm">'+card("IDEA GENERATOR",'<input class="rz-input" name="niche" placeholder="Your niche"><button class="rz-btn primary">Generate ideas</button><div id="rzIdeasOut" class="rz-suite-list"></div></form></div>');
 try{
  var p=await api("/api/creator/profile"),x=p.profile||{},f=document.getElementById("rzCreatorProfileForm");f.niche.value=x.niche||"";f.platforms.value=(x.platforms||[]).join(", ");f.goals.value=(x.goals||[]).join(", ");f.bio.value=x.bio||"";
 }catch(e){}
 document.getElementById("rzCreatorProfileForm").onsubmit=async function(e){e.preventDefault();var f=e.target;try{await api("/api/creator/profile",{method:"POST",body:JSON.stringify({niche:f.niche.value,platforms:f.platforms.value.split(",").map(x=>x.trim()).filter(Boolean),goals:f.goals.value.split(",").map(x=>x.trim()).filter(Boolean),bio:f.bio.value})});toast("Creator profile saved.");}catch(x){toast(x.message);}};
 document.getElementById("rzAnalyzeForm").onsubmit=async function(e){e.preventDefault();try{var d=await api("/api/creator/analyze",{method:"POST",body:JSON.stringify({text:e.target.text.value})});document.getElementById("rzAnalyzeOut").textContent=JSON.stringify(d,null,2);}catch(x){document.getElementById("rzAnalyzeOut").textContent=x.message;}};
 document.getElementById("rzIdeasForm").onsubmit=async function(e){e.preventDefault();try{var d=await api("/api/creator/ideas",{method:"POST",body:JSON.stringify({niche:e.target.niche.value})});document.getElementById("rzIdeasOut").innerHTML=(d.ideas||[]).map(x=>"<div class='rz-suite-list-row'>"+esc(typeof x==="string"?x:JSON.stringify(x))+"</div>").join("");}catch(x){toast(x.message);}};
 return b;
}
async function leaderboard(){
 var b=modal("Leaderboard","Points earned across active RIZORA creators.",'<div id="rzSuiteLeaderboard" class="rz-suite-list">Loading…</div>');
 try{var d=await api("/api/leaderboard");document.getElementById("rzSuiteLeaderboard").innerHTML=(d.leaderboard||[]).map(function(x){return '<div class="rz-suite-rank"><strong>#'+x.rank+'</strong><span>'+esc(x.displayName||x.username)+'</span><span>'+Number(x.points||0)+' pts</span></div>';}).join("")||'<div class="rz-empty">No leaderboard data yet.</div>';}catch(e){document.getElementById("rzSuiteLeaderboard").textContent=e.message;}
}
async function referrals(){
 var b=modal("Referrals","Your referral code, link and earned referral points.",'<div id="rzSuiteReferrals" class="rz-suite-list">Loading…</div>');
 try{var d=await api("/api/referrals/me");document.getElementById("rzSuiteReferrals").innerHTML=card("YOUR REFERRAL",'<div class="rz-suite-stats">'+stat(d.count||0,"Referrals")+stat(d.points||0,"Referral points")+'</div><div class="rz-suite-copy"><strong>Code:</strong> '+esc(d.referralCode||"")+'</div><div class="rz-suite-copy"><strong>Link:</strong> '+esc(d.referralLink||"")+'</div>');
 }catch(e){document.getElementById("rzSuiteReferrals").textContent=e.message;}
}
async function history(){
 var b=modal("Activity History","Points, creator scores and account activity.",'<div id="rzSuiteHistory">Loading…</div>');
 try{var d=await api("/api/history");document.getElementById("rzSuiteHistory").innerHTML=card("RECENT ACTIVITY",(d.history||[]).slice(0,50).map(function(x){return '<div class="rz-suite-history-row"><strong>'+esc(x.type)+'</strong><span>'+esc(x.amount==null?"":x.amount)+'</span><time>'+new Date(x.createdAt).toLocaleString()+'</time></div>';}).join("")||'<div class="rz-empty">No activity history yet.</div>');}catch(e){document.getElementById("rzSuiteHistory").textContent=e.message;}
}
async function experiments(){
 var b=modal("Experiment Lab","Save and compare content hypotheses without leaving RIZORA.",card("NEW EXPERIMENT",'<form id="rzExperimentForm"><div class="rz-suite-grid rz-suite-grid-2"><input class="rz-input" name="name" placeholder="Experiment name" required><input class="rz-input" name="hookA" placeholder="Hook A"><input class="rz-input" name="hookB" placeholder="Hook B"><textarea class="rz-textarea" name="notes" placeholder="Notes"></textarea></div><button class="rz-btn primary">Save experiment</button></form>')+card("SAVED EXPERIMENTS",'<div id="rzExperimentList">Loading…</div>'));
 async function load(){try{var d=await api("/api/experiments");document.getElementById("rzExperimentList").innerHTML=(d.experiments||[]).map(x=>"<div class='rz-suite-history-row'><strong>"+esc(x.name)+"</strong><span>"+esc(x.hookA||"")+" / "+esc(x.hookB||"")+"</span><time>"+new Date(x.createdAt).toLocaleDateString()+"</time></div>").join("")||"<div class='rz-empty'>No experiments yet.</div>"}catch(e){}}
 document.getElementById("rzExperimentForm").onsubmit=async function(e){e.preventDefault();var f=e.target;try{await api("/api/experiments",{method:"POST",body:JSON.stringify({name:f.name.value,hookA:f.hookA.value,hookB:f.hookB.value,notes:f.notes.value})});f.reset();toast("Experiment saved.");load();}catch(x){toast(x.message);}};load();
}
async function settings(){
 var b=modal("Settings","Restore the original notification and compact-mode preferences.",'<div id="rzSuiteSettings">Loading…</div>');
 try{var d=await api("/api/settings"),s=d.settings||{};document.getElementById("rzSuiteSettings").innerHTML=card("PREFERENCES",'<label class="rz-suite-check"><input id="rzSetNotify" type="checkbox" '+(s.notifications!==false?"checked":"")+'><span>Notifications</span></label><label class="rz-suite-check"><input id="rzSetCompact" type="checkbox" '+(s.compactMode===true?"checked":"")+'><span>Compact mode</span></label>');["rzSetNotify","rzSetCompact"].forEach(function(id){document.getElementById(id).onchange=async function(){try{await api("/api/settings",{method:"POST",body:JSON.stringify({notifications:document.getElementById("rzSetNotify").checked,compactMode:document.getElementById("rzSetCompact").checked})});toast("Settings saved.");}catch(x){toast(x.message);}};});}catch(e){document.getElementById("rzSuiteSettings").textContent=e.message;}
}
async function portfolio(){
 var b=modal("Pro Creator Tools","Portfolio identity plus creator planning.",card("PORTFOLIO",'<form id="rzPortfolioForm"><input class="rz-input" name="headline" placeholder="Portfolio headline"><textarea class="rz-textarea" name="bio" placeholder="Short creator bio"></textarea><input class="rz-input" name="category" placeholder="Category"><input class="rz-input" name="skills" placeholder="Skills, separated by commas"><input class="rz-input" name="links" placeholder="Public links, separated by commas"><button class="rz-btn primary">Save portfolio</button></form>')+card("CONTENT PLANNER",'<form id="rzPlanForm"><div class="rz-suite-grid rz-suite-grid-2"><input class="rz-input" name="title" placeholder="Planned content title" required><input class="rz-input" name="platform" placeholder="TikTok / Instagram / YouTube"><input class="rz-input" name="scheduledFor" type="datetime-local"><textarea class="rz-textarea" name="notes" placeholder="Notes"></textarea></div><button class="rz-btn primary">Add plan</button></form><div id="rzPlanList">Loading…</div>'));
 try{var p=await api("/api/v2/portfolio"),x=p.portfolio||{},f=document.getElementById("rzPortfolioForm");f.headline.value=x.headline||"";f.bio.value=x.bio||"";f.category.value=x.category||"";f.skills.value=(x.skills||[]).join(", ");f.links.value=(x.links||[]).join(", ");}catch(e){}
 document.getElementById("rzPortfolioForm").onsubmit=async function(e){e.preventDefault();var f=e.target;try{await api("/api/v2/portfolio",{method:"POST",body:JSON.stringify({headline:f.headline.value,bio:f.bio.value,category:f.category.value,skills:f.skills.value.split(",").map(x=>x.trim()).filter(Boolean),links:f.links.value.split(",").map(x=>x.trim()).filter(Boolean)})});toast("Portfolio saved.");}catch(x){toast(x.message);}};
 async function load(){try{var d=await api("/api/v2/plans");document.getElementById("rzPlanList").innerHTML=(d.plans||[]).map(function(x){return '<div class="rz-suite-history-row"><strong>'+esc(x.title)+'</strong><span>'+esc(x.platform||"general")+'</span><time>'+esc(x.scheduledFor||x.status)+'</time></div>';}).join("")||'<div class="rz-empty">No plans yet.</div>';}catch(e){}}
 document.getElementById("rzPlanForm").onsubmit=async function(e){e.preventDefault();var f=e.target;try{await api("/api/v2/plans",{method:"POST",body:JSON.stringify({title:f.title.value,platform:f.platform.value,scheduledFor:f.scheduledFor.value,notes:f.notes.value})});f.reset();toast("Plan added.");load();}catch(x){toast(x.message);}};load();
}
async function campaigns(){
 var b=modal("Creator Campaigns","The original growth-center campaign workflow, restored alongside Creator Boosts.",'<div id="rzCampaignOverview">Loading…</div><form id="rzLegacyCampaignForm">'+card("LAUNCH A CAMPAIGN",'<div class="rz-suite-grid rz-suite-grid-2"><input class="rz-input" name="title" placeholder="Campaign title" required><select class="rz-input" name="platform"><option>tiktok</option><option>instagram</option><option>x</option><option>youtube</option><option>facebook</option><option>website</option></select><select class="rz-input" name="action"><option>follow</option><option>like</option><option>share</option><option>comment</option><option>subscribe</option><option>visit</option></select><input class="rz-input" name="url" placeholder="https://..." required><input class="rz-input" name="reward" type="number" min="5" max="100" value="5"><input class="rz-input" name="quantity" type="number" min="1" max="500" value="10"><textarea class="rz-textarea" name="description" placeholder="Campaign description"></textarea></div><button class="rz-btn primary">Launch funded campaign</button></form><div id="rzMineCampaigns"></div>');
 async function load(){try{var x=await Promise.all([api("/api/social/overview"),api("/api/social/mine")]);var o=x[0]||{},m=x[1]||{};document.getElementById("rzCampaignOverview").innerHTML=card("GROWTH CENTER",'<div class="rz-suite-stats">'+stat(o.points||0,"Points")+stat(o.completed||0,"Completed")+stat(o.earned||0,"Earned")+stat(o.campaigns||0,"My campaigns")+'</div>');var rows=(m.campaigns||[]).map(function(item){return '<div class="rz-suite-history-row"><strong>'+esc(item.title)+'</strong><span>'+esc(item.status)+' · '+esc(item.completedCount||0)+' done</span><time>'+esc(item.platform)+'</time></div>';}).join("");document.getElementById("rzMineCampaigns").innerHTML=card("MY CAMPAIGNS",rows||'<div class="rz-empty">No campaigns created yet.</div>');}catch(e){document.getElementById("rzCampaignOverview").textContent=e.message;}}
 document.getElementById("rzLegacyCampaignForm").onsubmit=async function(e){e.preventDefault();var f=e.target;try{await api("/api/social/tasks/create",{method:"POST",body:JSON.stringify({title:f.title.value,description:f.description.value,platform:f.platform.value,action:f.action.value,url:f.url.value,reward:Number(f.reward.value),quantity:Number(f.quantity.value)})});f.reset();toast("Campaign created.");load();}catch(x){toast(x.message);}};load();
}
async function community(){
 var b=modal("RIZORA Community","Restore the original global community feed alongside modern Communities.",card("POST TO COMMUNITY",'<form id="rzGlobalCommunityForm"><textarea class="rz-textarea" name="text" maxlength="500" placeholder="Share something with the creator community…"></textarea><button class="rz-btn primary">Publish</button></form>')+card("COMMUNITY FEED",'<div id="rzGlobalCommunityList">Loading…</div>'));
 async function load(){try{var d=await api("/api/community");document.getElementById("rzGlobalCommunityList").innerHTML=(d.posts||[]).map(function(p){return '<div class="rz-suite-history-row"><strong>@'+esc(p.username)+'</strong><span>'+esc(p.text)+'</span><time>'+new Date(p.createdAt).toLocaleString()+'</time></div>';}).join("")||'<div class="rz-empty">No community posts yet.</div>';}catch(e){}}
 document.getElementById("rzGlobalCommunityForm").onsubmit=async function(e){e.preventDefault();try{await api("/api/community",{method:"POST",body:JSON.stringify({text:e.target.text.value})});e.target.reset();toast("Published.");load();}catch(x){toast(x.message);}};load();
}
function suiteMenu(){
 var b=modal("RIZORA Suite","Every recovered website feature in one place.",'<div class="rz-suite-grid rz-suite-grid-3">'+[
  ["Premium","premium","Advanced AI, analytics and Pro Creator Tools."],["Verification","verification","Open your RIZORA verification center."],["Creator Intelligence","intelligence","Creator profile, ideas and post analysis."],["Leaderboard","leaderboard","Points rankings."],["Referrals","referrals","Referral code, link and rewards."],["History","history","Points and creator-score history."],["Experiment Lab","experiments","A/B hooks and experiment notes."],["Settings","settings","Notifications and compact mode."],["Portfolio + Planner","portfolio","Portfolio identity and content planning."],["Campaigns","campaigns","Original funded creator campaigns."],["Community Feed","community","Global community feed."],["Install RIZORA","install","Install the PWA."],["Meet RoMi","romi","Creator profile."],["Flow","flow","Modern RIZORA Flow."],["Grow","grow","Official missions and growth tasks."],["Boosts","boosts","Creator Boost Network."]
 ].map(function(x){return '<button class="rz-suite-launch" data-suite-go="'+x[1]+'"><strong>'+esc(x[0])+'</strong><span>'+esc(x[2])+'</span></button>';}).join("")+'</div>');
 bindSuiteButtons(b);
}
async function install(){
 if(window.RIZORA_SUITE_PROMPT){try{window.RIZORA_SUITE_PROMPT.prompt();await window.RIZORA_SUITE_PROMPT.userChoice;}catch(_){ }window.RIZORA_SUITE_PROMPT=null;return;}
 var b=modal("Install RIZORA","RIZORA is a web-first installable PWA.",card("INSTALL",'<p class="rz-muted">Use your browser menu and choose <b>Install RIZORA</b> or <b>Add to Home Screen</b>. The official RIZORA logo is used for the app icon.</p>'));
}
function romi(){
 modal("Meet RoMi","The creator behind RIZORA.",'<div class="rz-suite-romi">'+
 '<img class="rz-suite-romi-avatar" src="/rizora-cover.png"><div><div class="rz-kicker">OFFICIAL CREATOR</div><h2>RoMi · @romi.noir</h2><p class="rz-muted">Artist. Developer. Creator. Builder. Creator of RIZORA.</p><div class="rz-actions"><a class="rz-btn" href="https://www.tiktok.com/@romi.noir" target="_blank" rel="noopener noreferrer">@romi.noir</a><a class="rz-btn primary" href="https://rizora.com.ng/" target="_blank" rel="noopener noreferrer">RIZORA</a></div></div></div>');
}
function bindSuiteButtons(root){
 (root||document).querySelectorAll("[data-suite-go]").forEach(function(el){el.onclick=function(){var a=el.getAttribute("data-suite-go");if(a==="premium")return premium();if(a==="analytics")return analytics();if(a==="intelligence")return intelligence();if(a==="leaderboard")return leaderboard();if(a==="referrals")return referrals();if(a==="history")return history();if(a==="experiments")return experiments();if(a==="settings")return settings();if(a==="portfolio")return portfolio();if(a==="campaigns")return campaigns();if(a==="community")return community();if(a==="install")return install();if(a==="romi")return romi();if(a==="verification"){var pv=document.querySelector('[data-nav="profile"]');if(pv){var mm=document.getElementById("rzSuiteModal");if(mm)mm.remove();pv.click();}}if(a==="flow"||a==="grow"||a==="boosts"){var n=document.querySelector('[data-nav="'+a+'"]');if(n){var m=document.getElementById("rzSuiteModal");if(m)m.remove();n.click();}}};});
}
function logout(){
  fetch(API+"/api/auth/logout",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"}}).catch(function(){});
  try{localStorage.removeItem("rizoraToken");localStorage.removeItem("rizora_token");}catch(_){}
  location.reload();
}
function injectLogout(){
  var actions=document.querySelector(".rz-top-inner .rz-actions");
  if(actions&&!document.getElementById("rzSuiteLogout")){
    var b=document.createElement("button");b.id="rzSuiteLogout";b.className="rz-btn";b.textContent="Log out";b.onclick=logout;actions.appendChild(b);
  }
}
function injectMobileMenu(){
  if(window.innerWidth>980)return;
  if(document.getElementById("rzMobileSuiteButton"))return;
  var top=document.querySelector(".rz-top-inner");if(!top)return;
  var b=document.createElement("button");b.id="rzMobileSuiteButton";b.className="rz-btn rz-mobile-suite-button";b.textContent="Menu";b.onclick=function(){
    var m=modal("RIZORA Menu","Mobile navigation and creator tools.",'<div class="rz-suite-grid rz-suite-grid-2">'+[
      ["Home","home"],["Flow","flow"],["Stories","stories"],["Grow","grow"],["Boosts","boosts"],["Communities","communities"],["Studio","studio"],["AI","ai"],["Discover","discover"],["Official","official"],["Messages","messages"],["Opportunities","opportunities"],["Analytics","analytics"],["Notifications","notifications"],["Profile","profile"],["Safety","safety"],["Creator Suite","suite"],["Log out","logout"]
    ].map(function(x){return '<button class="rz-suite-launch" data-mobile-nav="'+x[1]+'"><strong>'+esc(x[0])+'</strong></button>';}).join("")+'</div>');
    m.querySelectorAll("[data-mobile-nav]").forEach(function(x){x.onclick=function(){var a=x.getAttribute("data-mobile-nav");if(a==="suite"){suiteMenu();return;}if(a==="logout"){logout();return;}var n=document.querySelector('[data-nav="'+a+'"]');var sm=document.getElementById("rzSuiteModal");if(sm)sm.remove();if(n)n.click();};});
  };
  top.insertBefore(b,top.firstChild);
}
function injectSuite(){
 injectLogout();injectMobileMenu();
 if(!document.querySelector(".rz-sidebar"))return;
 if(!document.getElementById("rzSuiteTools")){
   var aside=document.querySelector(".rz-sidebar");if(!aside)return;
   var box=document.createElement("div");box.id="rzSuiteTools";box.className="rz-suite-tools";
   box.innerHTML='<div class="rz-enterprise-heading">CREATOR SUITE</div><button class="rz-btn" id="rzSuiteOpen">Open full Creator Suite</button><button class="rz-btn" data-suite-go="premium">Premium</button><button class="rz-btn" data-suite-go="leaderboard">Leaderboard</button><button class="rz-btn" data-suite-go="referrals">Referrals</button>';
   aside.appendChild(box);document.getElementById("rzSuiteOpen").onclick=suiteMenu;bindSuiteButtons(box);
 }
 var actions=document.querySelector(".rz-top-inner .rz-actions");
 if(actions&&!document.getElementById("rzSuiteTopButton")){
   var b=document.createElement("button");b.id="rzSuiteTopButton";b.className="rz-btn";b.textContent="Suite";b.onclick=suiteMenu;actions.insertBefore(b,actions.firstChild);
 }
 if(!window.__rzSuitePromptListener){window.__rzSuitePromptListener=true;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.RIZORA_SUITE_PROMPT=e;});}
}
function boot(){injectSuite();var mo=new MutationObserver(function(){injectSuite();});mo.observe(document.body,{childList:true,subtree:true});}
setTimeout(boot,90);
})();