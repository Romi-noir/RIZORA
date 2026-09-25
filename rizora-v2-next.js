(function(){
"use strict";
var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");

function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
async function api(path,opt){
  opt=opt||{};
  var r=await fetch(API+path,{credentials:"include",method:opt.method||"GET",headers:Object.assign({"Content-Type":"application/json"},opt.headers||{}),body:opt.body});
  var t=await r.text(),d={};
  try{d=t?JSON.parse(t):{};}catch(_){d={error:t};}
  if(!r.ok)throw new Error(d.message||d.error||"Request failed.");
  return d;
}
function closeModal(){var m=document.getElementById("rzNextModal");if(m)m.remove();}
function modal(title,kicker,body){
  closeModal();
  var m=document.createElement("div");m.id="rzNextModal";m.className="rz-next-overlay";
  m.innerHTML='<div class="rz-next-panel"><div class="rz-next-head"><div><div class="rz-kicker">'+esc(kicker||"RIZORA")+'</div><h2>'+esc(title)+'</h2></div><button class="rz-btn" id="rzNextClose">Close</button></div><div id="rzNextBody">'+body+'</div></div>';
  document.body.appendChild(m);
  document.getElementById("rzNextClose").onclick=closeModal;
  m.addEventListener("click",function(e){if(e.target===m)closeModal();});
  return m;
}
function stat(label,value,note){
  return '<div class="rz-next-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note||"")+'</small></div>';
}
function metricRows(a,c){
  a=a||{};c=c||{};
  return stat("Followers",a.followers||0,"Audience size")+
    stat("Following",a.following||0,"Creator network")+
    stat("Posts",a.posts||0,"Published RIZORA posts")+
    stat("Likes",a.likes||0,"Total post likes")+
    stat("Views",c.profileViews||a.profileViews||0,"Tracked profile views")+
    stat("Points",a.points||0,"Growth activity");
}
function fallbackBrief(a,c){
  a=a||{};c=c||{};
  var f=Number(a.followers||0),p=Number(a.posts||0),l=Number(a.likes||0);
  var ratio=p?Math.round((l/p)*10)/10:0;
  var lines=[];
  lines.push("Your current RIZORA snapshot: "+f+" followers, "+p+" posts and "+l+" likes.");
  if(p===0)lines.push("Next move: publish your first strong post and complete your creator profile.");
  else if(f<100)lines.push("Next move: turn your strongest post into a repeatable series and invite relevant creators into your network.");
  else lines.push("Next move: double down on the format that already gets the most response, then test one new angle.");
  if(ratio>=10)lines.push("Your average-like signal is healthy enough to test stronger distribution through Stories, Channels and Boosts.");
  else lines.push("Use a stronger opening line, clearer topic and a single call-to-action before increasing posting volume.");
  if(Number(c.profileViews||0)>0)lines.push("Profile views are an opportunity: keep the first screen focused on who you are, what you make and what to do next.");
  return lines.join("\n\n");
}
async function loadSnapshot(){
  var out={};
  var calls=await Promise.allSettled([
    api("/api/v2/analytics/overview"),
    api("/api/creator/analytics"),
    api("/api/v2/opportunities"),
    api("/api/v2/channels"),
    api("/api/v2/products"),
    api("/api/v2/premium/status"),
    api("/api/v2/memberships/me"),
    api("/api/v2/tips/mine")
  ]);
  out.analytics=calls[0].status==="fulfilled"?calls[0].value:{};
  out.creator=calls[1].status==="fulfilled"?calls[1].value:{};
  out.opportunities=calls[2].status==="fulfilled"?calls[2].value:{opportunities:[]};
  out.channels=calls[3].status==="fulfilled"?calls[3].value:{channels:[]};
  out.products=calls[4].status==="fulfilled"?calls[4].value:{products:[]};
  out.premium=calls[5].status==="fulfilled"?calls[5].value:{active:false};
  out.memberships=calls[6].status==="fulfilled"?calls[6].value:{owned:[],joined:[]};
  out.tips=calls[7].status==="fulfilled"?calls[7].value:{summary:{sentTotalNaira:0,receivedTotalNaira:0,sentCount:0,receivedCount:0,recent:[]}};
  return out;
}
async function assistant(prefill){
  var s=await loadSnapshot(),a=s.analytics||{},c=s.creator||{};
  var prompts=prefill?[]:["What should I do next?","Analyze my growth","Give me 7 content ideas","How can I build a stronger creator routine?"];
  var body='<div class="rz-next-grid rz-next-grid-6">'+metricRows(a,c)+'</div>'+
    '<div class="rz-next-card"><div class="rz-next-card-head"><div><strong>Creator Assistant</strong><p>Personalized guidance built from your current RIZORA activity.</p></div></div>'+
    '<div class="rz-next-prompts">'+(prompts.map(function(p){return '<button class="rz-next-chip" data-next-prompt="'+esc(p)+'">'+esc(p)+'</button>';}).join(""))+'</div>'+
    '<form id="rzNextAiForm"><textarea id="rzNextAiInput" class="rz-input rz-next-textarea" placeholder="Ask about content, growth, community or monetization…">'+esc(prefill||"")+'</textarea><button class="rz-btn primary" type="submit">Ask RIZORA AI</button></form><pre id="rzNextAiOut" class="rz-next-output">'+esc(fallbackBrief(a,c))+'</pre></div>';
  var m=modal("Creator Assistant","PERSONALIZED INTELLIGENCE",body);
  function ask(q){
    var input=document.getElementById("rzNextAiInput"),out=document.getElementById("rzNextAiOut");
    if(input)input.value=q;
    if(out)out.textContent="Thinking…";
    api("/api/ai/chat",{method:"POST",body:JSON.stringify({message:
      "Act as the RIZORA Creator Assistant. Give concise, practical creator advice using this live account context. Do not invent metrics. Context: "+
      JSON.stringify({analytics:a,creatorAnalytics:c,openOpportunities:(s.opportunities.opportunities||[]).slice(0,8).map(function(x){return {title:x.title,type:x.type};}),
      channels:(s.channels.channels||[]).slice(0,8).map(function(x){return {name:x.name,members:x.memberCount};}),
      products:(s.products.products||[]).slice(0,8).map(function(x){return {title:x.title,priceNaira:x.priceNaira};}),
      premium:Boolean(s.premium.active)})+
      "\nUser request: "+q
    })}).then(function(d){if(out)out.textContent=d.reply||d.message||JSON.stringify(d,null,2);}).catch(function(){if(out)out.textContent=fallbackBrief(a,c)+"\n\nAI is unavailable right now, so this guidance is based on your current metrics.";});
  }
  m.querySelectorAll("[data-next-prompt]").forEach(function(b){b.onclick=function(){ask(b.getAttribute("data-next-prompt"));};});
  document.getElementById("rzNextAiForm").onsubmit=function(e){e.preventDefault();var q=document.getElementById("rzNextAiInput").value.trim();if(q)ask(q);};
}
async function supportCreator(preferredCreator){
  var body='<div class="rz-next-card"><div class="rz-next-card-head"><div><strong>Support a creator</strong><p>Send a one-time thank-you through RIZORA.</p></div></div>'+
    '<form id="rzSupportForm" class="rz-next-form">'+
    '<input class="rz-input" name="creator" value="'+esc(preferredCreator||"")+'" placeholder="@creator username" required>'+
    '<input class="rz-input" name="amount" type="number" min="100" max="1000000" step="100" placeholder="Amount in NGN" required>'+
    '<textarea class="rz-input rz-next-textarea" name="note" maxlength="240" placeholder="Optional note"></textarea>'+
    '<button class="rz-btn primary" type="submit">Continue to Paystack</button><div id="rzSupportStatus" class="rz-muted"></div></form>'+
    '<p class="rz-muted">Creator Support uses Paystack. Until creator payout configuration is enabled, successful payments settle to the RIZORA merchant account.</p></div>'+
    '<div class="rz-next-card"><div class="rz-next-card-head"><div><strong>Your support activity</strong><p>Confirmed support you sent and support recorded for your creator account.</p></div></div><div id="rzSupportSummary">Loading…</div></div>';
  var m=modal("Creator Support","FAN SUPPORT • ONE-TIME",body);
  m.querySelector("#rzSupportForm").onsubmit=async function(e){
    e.preventDefault();var f=e.target,status=m.querySelector("#rzSupportStatus");
    status.textContent="Starting secure Paystack checkout…";
    try{var d=await api("/api/v2/tips/initialize",{method:"POST",body:JSON.stringify({creator:f.creator.value.trim(),amountNaira:Number(f.amount.value),note:f.note.value.trim()})});
      status.textContent="Opening Paystack…";
      location.href=d.authorizationUrl;
    }catch(err){status.textContent=err.message;}
  };
  try{
    var d=await api("/api/v2/tips/mine"),s=d.summary||{};
    m.querySelector("#rzSupportSummary").innerHTML='<div class="rz-next-grid rz-next-grid-2"><div class="rz-next-stat"><span>Sent</span><strong>₦'+esc(Number(s.sentTotalNaira||0).toLocaleString())+'</strong><small>'+esc(s.sentCount||0)+' confirmed payment(s)</small></div><div class="rz-next-stat"><span>Received</span><strong>₦'+esc(Number(s.receivedTotalNaira||0).toLocaleString())+'</strong><small>'+esc(s.receivedCount||0)+' confirmed support payment(s)</small></div></div>';
  }catch(err){m.querySelector("#rzSupportSummary").textContent=err.message;}
}
async function business(){
  var s=await loadSnapshot(),a=s.analytics||{},c=s.creator||{},ops=s.opportunities.opportunities||[],chs=s.channels.channels||[],p=s.premium||{};
  var openOps=ops.filter(function(x){return !x.applied;}).slice(0,6);
  var body='<div class="rz-next-grid rz-next-grid-6">'+metricRows(a,c)+'</div>'+
    '<div class="rz-next-grid rz-next-grid-3">'+
      '<div class="rz-next-card"><div class="rz-kicker">COMMUNITY</div><h3>'+esc(chs.length)+'</h3><p>creator channels available now</p><button class="rz-btn" data-next-nav="channels">Open Channels</button></div>'+
      '<div class="rz-next-card"><div class="rz-kicker">OPPORTUNITIES</div><h3>'+esc(openOps.length)+'</h3><p>creator opportunities ready to explore</p><button class="rz-btn" data-next-nav="opportunities">Open Opportunities</button></div>'+
      '<div class="rz-next-card"><div class="rz-kicker">INTELLIGENCE</div><h3>'+esc(p.active?"ACTIVE":"READY")+'</h3><p>creator strategy, analytics and AI tools</p><button class="rz-btn" data-next-nav="premium">Open Creator Tools</button></div>'+
      '<div class="rz-next-card"><div class="rz-kicker">PLANNING</div><h3>Creator Lab</h3><p>draft, schedule, test and protect your content</p><button class="rz-btn" data-next-nav="lab">Open Creator Lab</button></div>'+
    '</div>'+
    '<div class="rz-next-card"><div class="rz-next-card-head"><div><strong>Opportunity Radar</strong><p>Current creator opportunities already available inside RIZORA.</p></div></div>'+
      (openOps.length?openOps.map(function(o){return '<div class="rz-next-list-row"><div><strong>'+esc(o.title)+'</strong><span>'+esc(o.type||"opportunity")+'</span></div><button class="rz-btn" data-next-opp="'+esc(o.id)+'">Apply</button></div>';}).join(""):'<div class="rz-next-empty">No new opportunities right now.</div>')+
    '</div>'+
    '<div class="rz-next-card"><div class="rz-next-card-head"><div><strong>Creator workflow</strong><p>Build a repeatable system around your content and audience.</p></div></div>'+
      '<div class="rz-next-checklist"><label><span>✓</span><b>Creator profile</b><small>Identity, bio and links</small></label><label><span>✓</span><b>Content planning</b><small>Draft and schedule ideas</small></label><label><span>✓</span><b>Community</b><small>Own a direct audience space</small></label><label><span>✓</span><b>Opportunities</b><small>Apply to creator opportunities</small></label><label><span>✓</span><b>Content safety</b><small>Run checks before publishing</small></label></div>'+
    '</div>';
  var m=modal("Creator Workspace","BUILD • GROW • CREATE",body);
  m.querySelectorAll("[data-next-nav]").forEach(function(b){b.onclick=function(){
    var x=b.getAttribute("data-next-nav");closeModal();
    if(x==="channels"&&window.RIZORA_ENTERPRISE&&window.RIZORA_ENTERPRISE.showChannels)return window.RIZORA_ENTERPRISE.showChannels();
    if(x==="opportunities"){var n=document.querySelector('[data-nav="opportunities"]');if(n)n.click();return;}
    if(x==="premium"&&window.RIZORA_ENTERPRISE&&window.RIZORA_ENTERPRISE.showPremium)return window.RIZORA_ENTERPRISE.showPremium();
    if(x==="lab"&&window.RIZORA_UPGRADES&&window.RIZORA_UPGRADES.open)return window.RIZORA_UPGRADES.open();
  };});
  m.querySelectorAll("[data-next-opp]").forEach(function(b){b.onclick=async function(){
    try{await api("/api/v2/opportunities/"+encodeURIComponent(b.getAttribute("data-next-opp"))+"/apply",{method:"POST",body:"{}"});b.disabled=true;b.textContent="Applied";}catch(e){alert(e.message);}
  };});
}
async function memberships(){
  var d=await api("/api/v2/memberships/me"),owned=d.owned||[],joined=d.joined||[];
  var body='<div class="rz-next-grid rz-next-grid-2">'+
    '<div class="rz-next-card"><div class="rz-kicker">CREATOR MEMBERSHIP</div><h3>Create a monthly fan tier</h3><p>Give supporters a recurring way to back your work. Paystack handles the billing cycle after checkout.</p><form id="rzMembershipTierForm">'+
    '<input name="name" class="rz-input" placeholder="Tier name" required>'+
    '<input name="priceNaira" class="rz-input" type="number" min="100" max="1000000" placeholder="Monthly price in Naira" required>'+
    '<input name="perks" class="rz-input" placeholder="Perks, separated by commas">'+
    '<textarea name="description" class="rz-input rz-next-textarea" placeholder="What members get"></textarea>'+
    '<button class="rz-btn primary" type="submit">Create monthly tier</button></form><div id="rzMembershipTierStatus" class="rz-muted"></div></div>'+
    '<div class="rz-next-card"><div class="rz-kicker">JOIN A CREATOR</div><h3>Support a creator you follow</h3><p>Enter a RIZORA username to see any public membership tiers.</p><form id="rzMembershipDiscoverForm"><input name="creator" class="rz-input" placeholder="@creator" required><button class="rz-btn" type="submit">Find tiers</button></form><div id="rzMembershipDiscover"></div></div>'+
  '</div>'+
  '<div class="rz-next-card"><div class="rz-next-card-head"><div><strong>Your tiers</strong><p>'+owned.length+' tier(s) created</p></div></div>'+
    (owned.length?owned.map(function(t){return '<div class="rz-next-list-row"><div><strong>'+esc(t.name)+'</strong><span>₦'+esc(Number(t.priceNaira||0).toLocaleString())+'/month · '+esc(t.memberCount||0)+' active member(s)</span></div></div>';}).join(""):'<div class="rz-next-empty">You have not created a membership tier yet.</div>')+
  '</div>'+
  '<div class="rz-next-card"><div class="rz-next-card-head"><div><strong>Your memberships</strong><p>'+joined.length+' subscription(s)</p></div></div>'+
    (joined.length?joined.map(function(m){return '<div class="rz-next-list-row"><div><strong>'+esc((m.tier&&m.tier.name)||"Membership")+'</strong><span>@'+esc((m.creator&&m.creator.username)||"creator")+' · '+esc(m.status)+'</span></div>'+((["active","attention","non-renewing"].indexOf(m.status)>=0)?'<button class="rz-btn" data-next-membership-cancel="'+esc(m.id)+'">Cancel</button>':"")+'</div>';}).join(""):'<div class="rz-next-empty">You have not joined a creator membership yet.</div>')+
  '</div>';

  var m=modal("Creator Memberships","RECURRING SUPPORT",body);
  m.querySelector("#rzMembershipTierForm").onsubmit=async function(e){
    e.preventDefault();var f=e.target;
    try{
      var x=await api("/api/v2/memberships/tiers",{method:"POST",body:JSON.stringify({name:f.name.value,priceNaira:Number(f.priceNaira.value),description:f.description.value,perks:f.perks.value.split(",").map(function(v){return v.trim();}).filter(Boolean)})});
      m.querySelector("#rzMembershipTierStatus").textContent="Tier created: "+x.tier.name+".";
      setTimeout(function(){memberships();},700);
    }catch(err){m.querySelector("#rzMembershipTierStatus").textContent=err.message;}
  };
  m.querySelector("#rzMembershipDiscoverForm").onsubmit=async function(e){
    e.preventDefault();var creator=e.target.creator.value.trim().replace(/^@/,""),box=m.querySelector("#rzMembershipDiscover");
    box.innerHTML='<div class="rz-next-empty">Loading…</div>';
    try{
      var x=await api("/api/v2/memberships/tiers?creator="+encodeURIComponent(creator));
      box.innerHTML=(x.tiers||[]).length?(x.tiers||[]).map(function(t){
        return '<div class="rz-next-list-row"><div><strong>'+esc(t.name)+'</strong><span>₦'+esc(Number(t.priceNaira||0).toLocaleString())+'/month · '+esc(t.memberCount||0)+' member(s)</span><small>'+esc(t.description||"")+'</small></div><button class="rz-btn primary" data-next-membership-join="'+esc(t.id)+'">'+(t.joined?"Joined":"Join")+'</button></div>';
      }).join(""):'<div class="rz-next-empty">That creator has no public membership tiers.</div>';
      box.querySelectorAll("[data-next-membership-join]").forEach(function(b){b.onclick=async function(){
        try{var y=await api("/api/v2/memberships/tiers/"+encodeURIComponent(b.getAttribute("data-next-membership-join"))+"/join",{method:"POST",body:"{}"});if(y.authorizationUrl)location.href=y.authorizationUrl;}
        catch(err){b.textContent=err.message;}
      };});
    }catch(err){box.innerHTML='<div class="rz-error">'+esc(err.message)+'</div>';}
  };
  m.querySelectorAll("[data-next-membership-cancel]").forEach(function(b){b.onclick=async function(){
    if(!confirm("Cancel this recurring membership?"))return;
    try{await api("/api/v2/memberships/"+encodeURIComponent(b.getAttribute("data-next-membership-cancel"))+"/cancel",{method:"POST",body:"{}"});memberships();}
    catch(err){alert(err.message);}
  };});
}
function integrity(){
  var body='<div class="rz-next-card"><div class="rz-next-card-head"><div><strong>Pre-publish Integrity Check</strong><p>A fast creator checklist before you publish. This is not a copyright fingerprinting service.</p></div></div>'+
    '<form id="rzIntegrityForm"><input id="rzIntegrityTitle" class="rz-input" placeholder="Post title / topic"><textarea id="rzIntegrityCaption" class="rz-input rz-next-textarea" placeholder="Paste the caption or script"></textarea><input id="rzIntegrityUrl" class="rz-input" placeholder="Media URL (optional)"><label class="rz-next-check"><input type="checkbox" id="rzIntegrityReuse"> This is adapted or reposted content</label><input id="rzIntegritySource" class="rz-input" placeholder="Source / permission / attribution (required when adapted)" style="display:none"><button class="rz-btn primary" type="submit">Run check</button></form><div id="rzIntegrityOut"></div></div>';
  var m=modal("Content Integrity","SAFETY • ORIGINALITY • QUALITY",body);
  var reuse=m.querySelector("#rzIntegrityReuse"),source=m.querySelector("#rzIntegritySource");
  reuse.onchange=function(){source.style.display=reuse.checked?"block":"none";};
  m.querySelector("#rzIntegrityForm").onsubmit=function(e){
    e.preventDefault();
    var title=m.querySelector("#rzIntegrityTitle").value.trim(),caption=m.querySelector("#rzIntegrityCaption").value.trim(),url=m.querySelector("#rzIntegrityUrl").value.trim(),adapted=reuse.checked,src=source.value.trim();
    var checks=[
      ["Topic is clear",title.length>=3,"Use a clear topic so viewers know why they should stop."],
      ["Caption has enough context",caption.length>=20,"Add enough context for a viewer to understand the post without guessing."],
      ["No obvious spam pattern",!/^(.)\\1{7,}$/.test(caption)&&!/(.)\\1{5,}/.test(caption),"Avoid repeated characters, empty engagement bait or copy-paste spam."],
      ["Adapted content is attributed",!adapted||src.length>=3,"Add the original source or permission when you are adapting someone else's work."],
      ["Media reference is valid",!url||url.indexOf("https://")===0||url.indexOf("http://")===0,"Use a normal HTTP(S) media URL when attaching remote media."]
    ];
    var passed=checks.filter(function(x){return x[1];}).length;
    m.querySelector("#rzIntegrityOut").innerHTML='<div class="rz-next-result"><strong>'+passed+"/"+checks.length+' checks passed</strong>'+checks.map(function(x){return '<div class="rz-next-result-row"><span class="'+(x[1]?"good":"warn")+'">'+(x[1]?"✓":"!")+'</span><div><b>'+esc(x[0])+'</b><small>'+esc(x[2])+'</small></div></div>';}).join("")+
      '<p class="rz-muted">RIZORA still applies its platform safety rules at publish time. This tool helps you catch avoidable quality and attribution problems before submission.</p></div>';
  };
}
function inject(){
  if(document.getElementById("rzNextTools"))return;
  var aside=document.querySelector(".rz-sidebar");if(!aside)return;
  var box=document.createElement("div");box.id="rzNextTools";box.className="rz-next-tools";
  box.innerHTML='<div class="rz-enterprise-heading">NEXT-GEN TOOLS</div><button class="rz-btn" data-next-open="assistant">Creator Assistant</button><button class="rz-btn" data-next-open="business">Business Hub</button><button class="rz-btn" data-next-open="integrity">Content Integrity</button><button class="rz-btn" data-next-open="integrity">Pre-publish Check</button>';
  aside.appendChild(box);
  box.querySelectorAll("[data-next-open]").forEach(function(b){b.onclick=function(){var x=b.getAttribute("data-next-open");if(x==="assistant")assistant();if(x==="business")business();if(x==="memberships")memberships();if(x==="integrity")integrity();};});
}
async function verifyTipCallback(){
  var ref=new URLSearchParams(location.search).get("reference");
  if(!ref||ref.indexOf("tip_")!==0)return;
  try{await api("/api/v2/tips/verify/"+encodeURIComponent(ref));history.replaceState({},document.title,location.pathname+location.hash);}catch(_){ }
}
function boot(){
  verifyTipCallback();
  inject();
  var mo=new MutationObserver(function(){inject();});
  mo.observe(document.body,{childList:true,subtree:true});
}
window.RIZORA_NEXT={assistant:assistant,business:business,memberships:memberships,integrity:integrity,supportCreator:supportCreator};
setTimeout(boot,140);
})();