(function(){
"use strict";
var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");

function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
async function api(path,opt){
  opt=opt||{};
  var r=await fetch(API+path,{credentials:"include",method:opt.method||"GET",headers:Object.assign({"Content-Type":"application/json"},opt.headers||{}),body:opt.body});
  var t=await r.text(),d={}; try{d=t?JSON.parse(t):{};}catch(_){d={error:t};}
  if(!r.ok)throw new Error(d.message||d.error||"Request failed.");
  return d;
}
function toast(s){
  if(window.RIZORA_ENTERPRISE&&typeof window.RIZORA_ENTERPRISE.toast==="function"){window.RIZORA_ENTERPRISE.toast(s);return;}
  var t=document.getElementById("toast");if(!t)return;
  t.textContent=s;t.classList.add("show");clearTimeout(window.__rzHubToast);
  window.__rzHubToast=setTimeout(function(){t.classList.remove("show");},2400);
}
function close(){var x=document.getElementById("rzCreatorHub");if(x)x.remove();}
function style(){
  if(document.getElementById("rzHubStyle"))return;
  var s=document.createElement("style");s.id="rzHubStyle";
  s.textContent=".rz-hub-overlay{position:fixed;inset:0;z-index:190;background:rgba(0,0,0,.74);backdrop-filter:blur(14px);display:grid;place-items:center;padding:18px}.rz-hub-panel{width:min(1120px,100%);max-height:calc(100vh - 36px);overflow:auto;background:#0f0b1a;border:1px solid var(--line);border-radius:26px;padding:22px;box-shadow:var(--shadow,0 20px 80px rgba(0,0,0,.4))}.rz-hub-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}.rz-hub-head h2{margin:4px 0 4px}.rz-hub-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.rz-hub-card{padding:15px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025);text-align:left}.rz-hub-card strong{display:block;font-size:14px}.rz-hub-card span{display:block;color:var(--muted);font-size:12px;line-height:1.45;margin-top:5px}.rz-hub-section{margin-top:18px}.rz-hub-section h3{margin:0 0 10px}.rz-hub-toolbar{display:flex;gap:8px;flex-wrap:wrap}.rz-hub-media{display:grid;gap:8px}.rz-hub-media-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.02)}.rz-hub-media-meta{display:grid;gap:3px}.rz-hub-media-meta small{color:var(--muted)}.rz-hub-empty{padding:20px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px}@media(max-width:800px){.rz-hub-grid{grid-template-columns:1fr}.rz-hub-panel{padding:16px;max-height:calc(100vh - 20px)}.rz-hub-media-row{grid-template-columns:1fr}.rz-hub-media-row .rz-actions{justify-content:flex-start}}";
  document.head.appendChild(s);
}
function modal(title,sub,body){
  style();close();
  var m=document.createElement("div");m.id="rzCreatorHub";m.className="rz-hub-overlay";
  m.innerHTML='<section class="rz-hub-panel"><div class="rz-hub-head"><div><div class="rz-kicker">RIZORA CREATOR HUB</div><h2>'+esc(title)+'</h2><p class="rz-muted">'+esc(sub||"")+'</p></div><button class="rz-btn" id="rzHubClose">Close</button></div>'+body+'</section>';
  document.body.appendChild(m);m.querySelector("#rzHubClose").onclick=close;m.onclick=function(e){if(e.target===m)close();};return m;
}
function suiteGo(key){
  var b=document.querySelector('[data-suite-go="'+key+'"]');
  if(b){b.click();return true;}
  if(window.RIZORA_SUITE&&window.RIZORA_SUITE.open){window.RIZORA_SUITE.open();return true;}
  return false;
}
function openExisting(name,fallback){
  if(window[name]&&typeof window[name][fallback==="open"?"open":fallback]==="function"){window[name][fallback==="open"?"open":fallback]();return true;}
  return false;
}
async function mediaLibrary(){
  var m=modal("Media Library","Reuse, copy or remove files you have uploaded to RIZORA.",'<div class="rz-hub-toolbar"><button class="rz-btn" id="rzHubMediaRefresh">Refresh</button><span id="rzHubMediaUsage" class="rz-badge">Checking storage…</span></div><div id="rzHubMediaList" class="rz-hub-media rz-hub-section"><div class="rz-hub-empty">Loading media…</div></div>');
  async function load(){
    var box=m.querySelector("#rzHubMediaList"),usage=m.querySelector("#rzHubMediaUsage");
    box.innerHTML='<div class="rz-hub-empty">Loading media…</div>';
    try{
      var d=await api("/api/v2/media/mine");
      var rows=d.media||[],u=d.usage||{};
      usage.textContent=(Number(u.bytes||0)/1024/1024).toFixed(1)+" MB used";
      box.innerHTML=rows.map(function(x){
        var size=Number(x.bytes||0)>=1024*1024?(Number(x.bytes||0)/1024/1024).toFixed(1)+" MB":Math.max(1,Math.round(Number(x.bytes||0)/1024))+" KB";
        return '<div class="rz-hub-media-row"><div class="rz-hub-media-meta"><strong>'+esc(x.filename||"Untitled")+'</strong><span class="rz-mini">'+esc(x.mimeType||"media")+' · '+size+'</span><small>'+new Date(x.createdAt).toLocaleString()+'</small><code>'+esc(location.origin+x.url)+'</code></div><div class="rz-actions"><button class="rz-btn" data-copy-media="'+esc(x.url)+'">Copy URL</button><button class="rz-btn" data-delete-media="'+esc(x.id)+'">Delete</button></div></div>';
      }).join("")||'<div class="rz-hub-empty">No uploads yet. Use the media picker in Flow or Stories.</div>';
      box.querySelectorAll("[data-copy-media]").forEach(function(b){b.onclick=async function(){var u=b.getAttribute("data-copy-media"),full=location.origin+u;try{await navigator.clipboard.writeText(full);toast("Media URL copied.");}catch(_){toast(full);}};});
      box.querySelectorAll("[data-delete-media]").forEach(function(b){b.onclick=async function(){if(!confirm("Delete this uploaded media file? Posts that reference the URL may stop displaying it."))return;try{await api("/api/v2/media/"+encodeURIComponent(b.getAttribute("data-delete-media")),{method:"DELETE",body:"{}"});toast("Media deleted.");load();}catch(e){toast(e.message);}};});
    }catch(e){box.innerHTML='<div class="rz-hub-empty">'+esc(e.message)+'</div>';}
  }
  m.querySelector("#rzHubMediaRefresh").onclick=load;load();
}
function open(){
  var body=
    '<div class="rz-hub-section"><h3>Create</h3><div class="rz-hub-grid">'+
      '<button class="rz-hub-card" data-hub-action="flow"><strong>Flow</strong><span>Publish posts, polls, collaborations and media.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="ai"><strong>RIZORA AI</strong><span>Ideas, strategy, hooks and creator intelligence.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="series"><strong>Series & Episodes</strong><span>Turn posts into connected episodic formats.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="events"><strong>Events & Live</strong><span>Schedule premieres, live sessions and community events.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="media"><strong>Media Library</strong><span>Manage uploaded images, video and audio assets.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="studio"><strong>Creator Studio</strong><span>Draft, schedule and build creator work.</span></button>'+
    '</div></div>'+
    '<div class="rz-hub-section"><h3>Grow & Discover</h3><div class="rz-hub-grid">'+
      '<button class="rz-hub-card" data-hub-action="global"><strong>Creator Desk</strong><span>Search Insights, Broadcast Channels, custom feeds and creator assistant.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="labs"><strong>Creator Lab</strong><span>Custom feeds, A/B experiments and collaboration Deal Room.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="boosts"><strong>Boost Network</strong><span>Funded discovery and creator growth campaigns.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="business"><strong>Earn & Memberships</strong><span>Tips, products, memberships and creator earnings.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="analytics"><strong>Analytics</strong><span>Audience, content and growth performance.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="opportunities"><strong>Opportunities</strong><span>Creator briefs, applications and collaboration opportunities.</span></button>'+
    '</div></div>'+
    '<div class="rz-hub-section"><h3>Creator Control</h3><div class="rz-hub-grid">'+
      '<button class="rz-hub-card" data-hub-action="premium"><strong>Premium</strong><span>Premium entitlement, billing and advanced creator tools.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="comments"><strong>Comment Studio</strong><span>Moderate replies, filters and conversation controls.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="safety"><strong>Safety</strong><span>Verification, warnings, reports and account controls.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="portfolio"><strong>Portfolio + Planner</strong><span>Creator identity, portfolio and planning.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="settings"><strong>Settings & Security</strong><span>Preferences, sessions and two-factor protection.</span></button>'+
      '<button class="rz-hub-card" data-hub-action="suite"><strong>Full Creator Suite</strong><span>Open the complete RIZORA control surface.</span></button>'+
    '</div></div>';
  var m=modal("Everything in one place","RIZORA's major creator, growth, monetization and control systems.",body);
  m.querySelectorAll("[data-hub-action]").forEach(function(b){
    b.onclick=function(){
      var a=b.getAttribute("data-hub-action");
      if(a==="media")return mediaLibrary();
      close();
      if(a==="global"&&window.RIZORA_GLOBAL){window.RIZORA_GLOBAL.assistant();return;}
      if(a==="labs"&&window.RIZORA_LABS){window.RIZORA_LABS.deals();return;}
      if(a==="business"&&window.RIZORA_BUSINESS){window.RIZORA_BUSINESS.earnings();return;}
      if(a==="comments"&&window.RIZORA_COMMENTS){window.RIZORA_COMMENTS.open();return;}
      if(a==="events"&&window.RIZORA_EVENTS){window.RIZORA_EVENTS.open();return;}
      if(a==="series"&&window.RIZORA_SERIES){window.RIZORA_SERIES.open();return;}
      if(a==="premium")return suiteGo("premium");
      if(a==="portfolio")return suiteGo("portfolio");
      if(a==="settings")return suiteGo("settings");
      if(a==="analytics")return suiteGo("analytics");
      var nav=document.querySelector('[data-nav="'+a+'"]');
      if(nav){nav.click();return;}
      if(a==="suite")return window.RIZORA_SUITE&&window.RIZORA_SUITE.open?window.RIZORA_SUITE.open():void 0;
    };
  });
}
function inject(){
  style();
  var aside=document.querySelector(".rz-sidebar");
  if(aside&&!document.getElementById("rzCreatorHubTool")){
    var box=document.createElement("div");box.id="rzCreatorHubTool";box.className="rz-hub-tools";
    box.innerHTML='<div class="rz-enterprise-heading">CREATOR HUB</div><button class="rz-btn" id="rzOpenCreatorHub">Open Creator Hub</button>';
    aside.appendChild(box);box.querySelector("#rzOpenCreatorHub").onclick=open;
  }
  var actions=document.querySelector(".rz-top-inner .rz-actions");
  if(actions&&!document.getElementById("rzCreatorHubTop")){
    var b=document.createElement("button");b.id="rzCreatorHubTop";b.className="rz-btn";b.textContent="Hub";b.onclick=open;actions.insertBefore(b,actions.firstChild);
  }
}
function boot(){setTimeout(inject,350);setInterval(inject,2000);}
window.RIZORA_HUB={open:open,mediaLibrary:mediaLibrary};
boot();
})();