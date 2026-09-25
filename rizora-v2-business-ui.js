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
function close(){var x=document.getElementById("rzBusinessModal");if(x)x.remove();}
function modal(title,kicker,body){
  close();
  var x=document.createElement("div");x.id="rzBusinessModal";x.className="rz-business-overlay";
  x.innerHTML='<div class="rz-business-panel"><div class="rz-business-head"><div><div class="rz-kicker">'+esc(kicker||"RIZORA")+'</div><h2>'+esc(title)+'</h2></div><button class="rz-btn" id="rzBusinessClose">Close</button></div><div id="rzBusinessBody">'+body+'</div></div>';
  document.body.appendChild(x);
  document.getElementById("rzBusinessClose").onclick=close;
  x.addEventListener("click",function(e){if(e.target===x)close();});
  return x;
}
function stat(label,value,note){
  return '<div class="rz-business-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note||"")+'</small></div>';
}
function naira(v){return "₦"+Number(v||0).toLocaleString();}
async function earnings(){
  try{
    var d=await api("/api/v2/business/summary"),b=d.business||{},t=b.totals||{},a=b.audience||{},rows=b.ledger||[];
    var body='<div class="rz-business-grid">'+
      stat("Gross confirmed",naira(t.grossConfirmedNaira),"Tips + digital product sales")+
      stat("Pending",naira(t.pendingNaira),"Awaiting payment confirmation")+
      stat("Monthly member gross",naira(t.recurringMonthlyGrossNaira),"Active paid memberships")+
      stat("Members",a.paidAndFreeMembers,"Paid + free community members")+
      stat("Products sold",a.confirmedProductSales,"Confirmed digital sales")+
      stat("Support received",naira(t.tipsConfirmedNaira),"Confirmed Creator Support")+
      '</div>'+
      '<section class="rz-business-card"><div class="rz-kicker">SETTLEMENT STATUS</div><h3>Gross ledger, not a payout statement</h3><p>'+esc((b.settlement&&b.settlement.note)||"")+'</p><div class="rz-business-actions"><button class="rz-btn primary" id="rzBusinessExport">Export ledger</button><button class="rz-btn" id="rzBusinessRefresh">Refresh</button></div></section>'+
      '<section class="rz-business-card"><div class="rz-business-card-head"><div><strong>Confirmed transactions</strong><span>Recent gross creator revenue recorded by RIZORA.</span></div></div>'+
      '<div class="rz-business-table">'+(rows.length?rows.map(function(r){return '<div class="rz-business-row"><div><strong>'+esc(r.description||r.kind)+'</strong><small>'+esc(r.kind||"transaction")+' · '+esc(r.status||"")+'</small></div><strong>'+naira(r.grossNaira)+'</strong><small>'+esc(r.createdAt?new Date(r.createdAt).toLocaleString():"")+'</small></div>';}).join(""):'<div class="rz-business-empty">No confirmed creator transactions yet.</div>')+'</div></section>';
    var m=modal("Creator Earnings","BUSINESS • TRANSPARENCY",body);
    m.querySelector("#rzBusinessExport").onclick=function(){location.href=API+"/api/v2/business/export";};
    m.querySelector("#rzBusinessRefresh").onclick=earnings;
  }catch(e){
    modal("Creator Earnings","BUSINESS",'<div class="rz-error">'+esc(e.message)+'</div>');
  }
}
async function freeMembership(){
  var body='<section class="rz-business-card"><div class="rz-kicker">FREE COMMUNITY</div><h3>Let people join before they pay</h3><p>Give your audience a free community tier with optional perks. Paid memberships remain separate.</p><form id="rzFreeTierForm" class="rz-business-form">'+
    '<input class="rz-input" name="name" maxlength="100" placeholder="Free tier name" value="Community" required>'+
    '<textarea class="rz-input" name="description" maxlength="600" placeholder="What free members get">Follow the creator community and receive public updates.</textarea>'+
    '<input class="rz-input" name="perks" placeholder="Perks, separated by commas" value="Community access, creator updates">'+
    '<button class="rz-btn primary" type="submit">Create free membership</button><div id="rzFreeTierStatus" class="rz-muted"></div></form></section>';
  var m=modal("Free Community Membership","AUDIENCE • COMMUNITY",body);
  m.querySelector("#rzFreeTierForm").onsubmit=async function(e){
    e.preventDefault();var f=e.target,s=m.querySelector("#rzFreeTierStatus");
    try{
      var d=await api("/api/v2/memberships/tiers",{method:"POST",body:JSON.stringify({
        name:f.name.value,description:f.description.value,perks:f.perks.value.split(",").map(function(x){return x.trim();}).filter(Boolean),priceNaira:0
      })});
      s.textContent=d.existing?"This free tier already exists.":"Free membership tier created.";
      setTimeout(function(){memberships();},600);
    }catch(err){s.textContent=err.message;}
  };
}
function membershipGift(){
  var body='<section class="rz-business-card"><div class="rz-kicker">CREATOR GIFT</div><h3>Gift free community access</h3><p>Enter the recipient and the active free tier. This grants non-cash community access for a set number of days.</p><form id="rzGiftForm" class="rz-business-form">'+
    '<input class="rz-input" name="tier" placeholder="Free tier ID" required>'+
    '<input class="rz-input" name="username" placeholder="@username" required>'+
    '<input class="rz-input" name="days" type="number" min="1" max="365" value="30" required>'+
    '<button class="rz-btn primary">Gift access</button><div id="rzGiftStatus" class="rz-muted"></div></form></section>';
  var m=modal("Gift Community Access","AUDIENCE • GIFTING",body);
  m.querySelector("#rzGiftForm").onsubmit=async function(e){
    e.preventDefault();var f=e.target,s=m.querySelector("#rzGiftStatus");
    try{
      await api("/api/v2/memberships/tiers/"+encodeURIComponent(f.tier.value.trim())+"/gift",{method:"POST",body:JSON.stringify({username:f.username.value.trim(),days:Number(f.days.value)})});
      s.textContent="Gift access created.";
    }catch(err){s.textContent=err.message;}
  };
}
function inject(){
  var aside=document.querySelector(".rz-sidebar");
  if(!aside||document.getElementById("rzBusinessTools"))return;
  var box=document.createElement("div");box.id="rzBusinessTools";box.className="rz-business-tools";
  box.innerHTML='<div class="rz-enterprise-heading">BUSINESS TOOLS</div>'+
    '<button class="rz-btn" data-business="earnings">Creator Earnings</button>'+
    '<button class="rz-btn" data-business="free">Free Membership</button>'+
    '<button class="rz-btn" data-business="gift">Gift Access</button>';
  aside.appendChild(box);
  box.querySelector('[data-business="earnings"]').onclick=earnings;
  box.querySelector('[data-business="free"]').onclick=freeMembership;
  box.querySelector('[data-business="gift"]').onclick=membershipGift;
}
window.RIZORA_BUSINESS={earnings:earnings,freeMembership:freeMembership,membershipGift:membershipGift};
setTimeout(inject,260);
var mo=new MutationObserver(inject);
setTimeout(function(){if(document.body)mo.observe(document.body,{childList:true,subtree:true});},500);
})();