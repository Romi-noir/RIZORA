"use strict";
(function(){
  var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
  var mounted=false, user=null, modal=null;

  function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  async function api(path,opt){
    opt=opt||{};
    var r=await fetch(API+path,{credentials:"include",method:opt.method||"GET",headers:Object.assign({"Content-Type":"application/json"},opt.headers||{}),body:opt.body});
    var txt=await r.text(), d={};
    try{d=txt?JSON.parse(txt):{};}catch(_){d={message:txt};}
    if(!r.ok)throw new Error(d.message||d.error||"Request failed.");
    return d;
  }
  function close(){
    if(modal){modal.remove();modal=null;}
  }
  function shell(title,body){
    close();
    modal=document.createElement("div");
    modal.className="rz-global-modal";
    modal.innerHTML='<div class="rz-global-backdrop"></div><section class="rz-global-panel"><div class="rz-global-head"><div><div class="rz-kicker">CREATOR DESK</div><h2>'+esc(title)+'</h2></div><button id="rzGlobalClose" class="rz-btn">Close</button></div><div id="rzGlobalBody">'+body+'</div></section>';
    document.body.appendChild(modal);
    modal.querySelector(".rz-global-backdrop").onclick=close;
    modal.querySelector("#rzGlobalClose").onclick=close;
  }
  function notify(t){if(window.RIZORA_CONTROL_CENTER&&window.RIZORA_CONTROL_CENTER.preferences){/* keep existing control surface intact */}var n=document.createElement("div");n.className="rz-global-toast";n.textContent=t;document.body.appendChild(n);setTimeout(function(){n.remove();},2200);}
  function tabs(active){
    return '<div class="rz-global-tabs"><button class="rz-btn '+(active==="assistant"?"primary":"")+'" data-global-tab="assistant">Assistant</button><button class="rz-btn '+(active==="channels"?"primary":"")+'" data-global-tab="channels">Broadcast</button><button class="rz-btn '+(active==="feeds"?"primary":"")+'" data-global-tab="feeds">Custom feeds</button></div>';
  }
  async function assistant(){
    try{
      var d=await api("/api/v2/assistant/brief"), b=d.brief, metrics=b.metrics;
      shell("Your next moves",tabs("assistant")+
        '<div class="rz-global-grid">'+
        '<div class="rz-global-stat"><span>Posts</span><strong>'+Number(metrics.posts||0)+'</strong></div>'+
        '<div class="rz-global-stat"><span>Followers</span><strong>'+Number(metrics.followers||0)+'</strong></div>'+
        '<div class="rz-global-stat"><span>Engagement / post</span><strong>'+Number(metrics.engagementPerPost||0)+'</strong></div>'+
        '<div class="rz-global-stat"><span>Saves</span><strong>'+Number(metrics.saves||0)+'</strong></div></div>'+
        '<div class="rz-global-card"><div class="rz-kicker">NEXT MOVE</div><h3>'+esc(b.nextMove.title)+'</h3><p>'+esc(b.nextMove.action)+'</p></div>'+
        '<div class="rz-global-card"><div class="rz-kicker">CREATOR BRIEF</div>'+b.actions.map(function(a){return '<button class="rz-global-action" data-global-action="'+esc(a.type)+'"><strong>'+esc(a.title)+'</strong><span>'+esc(a.action)+'</span></button>';}).join("")+'</div>');
      bindTabs();
    }catch(e){notify(e.message);}
  }
  async function channels(){
    try{
      var d=await api("/api/v2/channels");
      var channelCards=(d.channels||[]).map(function(c){return '<div class="rz-global-card"><div class="rz-global-row"><div><h3>'+esc(c.name)+'</h3><p>'+esc(c.description||"")+'</p><span class="rz-mini">'+Number(c.memberCount||0)+' members · @'+esc((c.owner&& (c.owner.publicUsername||c.owner.username))||"creator")+'</span></div><button class="rz-btn" data-global-channel="'+esc(c.id)+'">'+(c.joined?"Open":"Join")+'</button></div></div>';}).join("");
      shell("Broadcast channels",tabs("channels")+
        '<div class="rz-global-card"><form id="rzChannelForm"><input id="rzChannelName" class="rz-input" placeholder="Channel name" maxlength="80" required><textarea id="rzChannelDesc" class="rz-textarea" placeholder="What will this channel be about?" maxlength="500"></textarea><button class="rz-btn primary">Create channel</button></form><p class="rz-mini">Up to 3 channels per creator.</p></div>'+
        '<div class="rz-global-list">'+(channelCards||'<div class="rz-empty">No creator channels yet.</div>')+'</div>');
      bindTabs();
      var f=document.getElementById("rzChannelForm");
      if(f)f.onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/channels",{method:"POST",body:JSON.stringify({name:document.getElementById("rzChannelName").value,description:document.getElementById("rzChannelDesc").value})});notify("Channel created.");channels();}catch(err){notify(err.message);}};
      document.querySelectorAll("[data-global-channel]").forEach(function(btn){btn.onclick=function(){openChannel(btn.getAttribute("data-global-channel"));};});
    }catch(e){notify(e.message);}
  }
  async function openChannel(id){
    try{
      var d=await api("/api/v2/channels/"+encodeURIComponent(id));
      var c=d.channel;
      var messageCards=(d.messages||[]).map(function(m){return '<article class="rz-global-card"><div class="rz-global-row"><strong>@'+esc((m.user&&(m.user.publicUsername||m.user.username))||"creator")+'</strong><span class="rz-mini">'+esc(m.createdAt||"")+'</span></div><p>'+esc(m.text||"")+'</p><div class="rz-global-reactions"><button class="rz-btn" data-global-react="'+esc(m.id)+'">♥ '+Number((m.reactions||{}).heart||0)+'</button><button class="rz-btn" data-global-react-value="fire" data-global-react="'+esc(m.id)+'">🔥 '+Number((m.reactions||{}).fire||0)+'</button></div></article>';}).join("");
      shell(c.name,
        '<div class="rz-global-row"><div><span class="rz-mini">'+Number(c.memberCount||0)+' members</span><p>'+esc(c.description||"")+'</p></div><button id="rzChannelMembership" class="rz-btn">'+(c.joined?"Leave":"Join")+'</button></div>'+
        '<div id="rzChannelMessages" class="rz-global-list">'+(messageCards||'<div class="rz-empty">No messages yet.</div>')+'</div>'+
        '<form id="rzChannelPost" class="rz-global-compose"><textarea id="rzChannelText" class="rz-textarea" placeholder="Share an update with your channel"></textarea><button class="rz-btn primary">Broadcast</button></form>');
      document.getElementById("rzChannelMembership").onclick=async function(){
        try{await api("/api/v2/channels/"+encodeURIComponent(id)+(c.joined?"/leave":"/join"),{method:"POST"});openChannel(id);}catch(e){notify(e.message);}
      };
      var pf=document.getElementById("rzChannelPost");
      pf.onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/channels/"+encodeURIComponent(id)+"/messages",{method:"POST",body:JSON.stringify({text:document.getElementById("rzChannelText").value})});openChannel(id);}catch(err){notify(err.message);}};
      document.querySelectorAll("[data-global-react]").forEach(function(btn){btn.onclick=async function(){try{await api("/api/v2/channels/"+encodeURIComponent(id)+"/messages/"+encodeURIComponent(btn.getAttribute("data-global-react"))+"/react",{method:"POST",body:JSON.stringify({reaction:btn.getAttribute("data-global-react-value")||"heart"})});openChannel(id);}catch(e){notify(e.message);}};});
    }catch(e){notify(e.message);}
  }
  async function feeds(){
    try{
      var d=await api("/api/v2/feeds");
      var feedCards=(d.feeds||[]).map(function(f){return '<div class="rz-global-card"><div class="rz-global-row"><div><h3>'+esc(f.name)+'</h3><div class="rz-mini">'+(f.hashtags||[]).map(function(t){return "#"+esc(t);}).join(" ")+'</div></div><div class="rz-actions"><button class="rz-btn" data-global-open-feed="'+esc(f.id)+'">Open</button><button class="rz-btn" data-global-delete-feed="'+esc(f.id)+'">Delete</button></div></div></div>';}).join("");
      shell("Custom feeds",tabs("feeds")+
        '<div class="rz-global-card"><form id="rzFeedForm"><input id="rzFeedName" class="rz-input" placeholder="Feed name" maxlength="80" required><input id="rzFeedTags" class="rz-input" placeholder="Hashtags, e.g. music,dev,football"><input id="rzFeedCreators" class="rz-input" placeholder="Creator username(s), comma separated"><button class="rz-btn primary">Save feed</button></form><p class="rz-mini">Make personal front pages around niches, creators or topics.</p></div>'+
        '<div class="rz-global-list">'+(feedCards||'<div class="rz-empty">No custom feeds yet.</div>')+'</div>');
      bindTabs();
      var f=document.getElementById("rzFeedForm");
      if(f)f.onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/feeds",{method:"POST",body:JSON.stringify({name:document.getElementById("rzFeedName").value,hashtags:document.getElementById("rzFeedTags").value.split(",").map(function(x){return x.trim();}).filter(Boolean),creatorIds:document.getElementById("rzFeedCreators").value.split(",").map(function(x){return x.trim();}).filter(Boolean)})});notify("Feed saved.");feeds();}catch(err){notify(err.message);}};
      document.querySelectorAll("[data-global-delete-feed]").forEach(function(btn){btn.onclick=async function(){try{await api("/api/v2/feeds/"+encodeURIComponent(btn.getAttribute("data-global-delete-feed")),{method:"DELETE"});feeds();}catch(e){notify(e.message);}};});
      document.querySelectorAll("[data-global-open-feed]").forEach(function(btn){btn.onclick=function(){openFeed(btn.getAttribute("data-global-open-feed"));};});
    }catch(e){notify(e.message);}
  }
  async function openFeed(id){
    try{
      var d=await api("/api/v2/feeds/"+encodeURIComponent(id)+"/items");
      var postCards=(d.posts||[]).map(function(p){return '<article class="rz-global-card"><div class="rz-global-row"><strong>@'+esc((p.author&&(p.author.publicUsername||p.author.username))||"creator")+'</strong><span class="rz-mini">'+esc(p.createdAt||"")+'</span></div><p>'+esc(p.text||"")+'</p><div class="rz-mini">'+Number(p.likes||0)+' likes · '+Number(p.comments||0)+' comments</div></article>';}).join("");
      shell(d.feed.name,tabs("feeds")+'<div class="rz-global-list">'+(postCards||'<div class="rz-empty">No posts match this feed yet.</div>')+'</div>');
      bindTabs();
    }catch(e){notify(e.message);}
  }
  function bindTabs(){
    document.querySelectorAll("[data-global-tab]").forEach(function(btn){btn.onclick=function(){var t=btn.getAttribute("data-global-tab");if(t==="assistant")assistant();if(t==="channels")channels();if(t==="feeds")feeds();};});
  }
  async function mount(){
    if(mounted||document.getElementById("rzCreatorDesk"))return;
    try{var me=await api("/api/auth/me");user=me.user;}catch(_){return;}
    mounted=true;
    var b=document.createElement("button");
    b.id="rzCreatorDesk";b.className="rz-global-fab";b.textContent="Creator Desk";
    b.title="RIZORA Creator Desk";
    b.onclick=assistant;
    document.body.appendChild(b);
  }
  function boot(){setTimeout(mount,700);setInterval(mount,2000);}
  window.RIZORA_GLOBAL={assistant:assistant,channels:channels,feeds:feeds};
  boot();
})();