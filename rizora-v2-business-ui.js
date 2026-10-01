(function(){
"use strict";
var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
async function api(path,opt){return window.RIZORA_API_CALL(path,opt||{});}
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
function naira(v){return "NGN"+Number(v||0).toLocaleString();}
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
      '<div class="rz-business-table">'+(rows.length?rows.map(function(r){return '<div class="rz-business-row"><div><strong>'+esc(r.description||r.kind)+'</strong><small>'+esc(r.kind||"transaction")+' - '+esc(r.status||"")+'</small></div><strong>'+naira(r.grossNaira)+'</strong><small>'+esc(r.createdAt?new Date(r.createdAt).toLocaleString():"")+'</small></div>';}).join(""):'<div class="rz-business-empty">No confirmed creator transactions yet.</div>')+'</div></section>';
    var m=modal("Creator Earnings","BUSINESS â€¢ TRANSPARENCY",body);
    m.querySelector("#rzBusinessExport").onclick=async function(){try{var rr=await fetch(API+"/api/v2/business/export",{credentials:"include",headers:window.RIZORA_AUTH_HEADERS?window.RIZORA_AUTH_HEADERS():{}});if(!rr.ok)throw new Error("Export failed.");var blob=await rr.blob(),name="rizora-business-ledger.csv";if(window.RIZORA_DOWNLOAD&&window.RIZORA_DOWNLOAD.blob)window.RIZORA_DOWNLOAD.blob(blob,name,"business-ledger");else{var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);}}catch(e){var n=document.getElementById("toast");if(n){n.textContent=String(e.message||"Export failed.");n.classList.add("show");setTimeout(function(){n.classList.remove("show");},2600);}}};
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
  var m=modal("Free Community Membership","AUDIENCE â€¢ COMMUNITY",body);
  m.querySelector("#rzFreeTierForm").onsubmit=async function(e){
    e.preventDefault();var f=e.target,s=m.querySelector("#rzFreeTierStatus");
    try{
      var d=await api("/api/v2/memberships/free-tiers",{method:"POST",body:JSON.stringify({
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
  var m=modal("Gift Community Access","AUDIENCE â€¢ GIFTING",body);
  m.querySelector("#rzGiftForm").onsubmit=async function(e){
    e.preventDefault();var f=e.target,s=m.querySelector("#rzGiftStatus");
    try{
      await api("/api/v2/memberships/free-tiers/"+encodeURIComponent(f.tier.value.trim())+"/gift",{method:"POST",body:JSON.stringify({username:f.username.value.trim(),days:Number(f.days.value)})});
      s.textContent="Gift access created.";
    }catch(err){s.textContent=err.message;}
  };
}
async function adsManager(){
  var access;
  try{access=await api("/api/v2/ads/access");}catch(e){access={registered:false};}
  var registered=!!access.registered;
  var plus=!!access.rizoraPlus;
  var min=Number(access.externalMinimumNaira||1000),max=Number(access.externalMaximumNaira||10000000);
  var body;
  if(registered&&plus){
    body='<section class="rz-business-card"><div class="rz-kicker">RIZORA+</div><h3>Business advertising is unlocked</h3><p class="rz-muted">Your RIZORA+ subscription lets this registered business run ads without a separate ad payment.</p>'+
      '<form id="rzInternalAdForm" class="rz-business-form">'+
      '<input class="rz-input" name="businessName" maxlength="120" placeholder="Business name" required>'+
      '<input class="rz-input" name="title" maxlength="120" placeholder="Ad headline" required>'+
      '<textarea class="rz-input" name="description" maxlength="500" placeholder="Short ad description"></textarea>'+
      '<input class="rz-input" name="destinationUrl" type="url" placeholder="https://yourwebsite.com" required>'+
      '<input class="rz-input" name="imageUrl" type="url" placeholder="Optional image URL">'+
      '<select class="rz-input" name="durationDays"><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select>'+
      '<button class="rz-btn primary" type="submit">Launch ad</button><div id="rzAdStatus" class="rz-muted"></div></form></section>'+
      '<section class="rz-business-card"><div class="rz-kicker">YOUR CAMPAIGNS</div><div id="rzMyAds" class="rz-business-table">Loading...</div></section>';
  }else if(registered){
    body='<section class="rz-business-card"><div class="rz-kicker">RIZORA+ REQUIRED</div><h3>Upgrade this registered business to advertise</h3><p class="rz-muted">Registered RIZORA businesses run ads through RIZORA+.</p><button class="rz-btn primary" id="rzOpenRizoraPlus">Open RIZORA+</button></section>'+
      '<section class="rz-business-card"><div class="rz-kicker">EXTERNAL BUSINESS</div><p class="rz-muted">Need to advertise without a RIZORA account? Use the external Paystack route below.</p><button class="rz-btn" id="rzExternalMode">Pay with Paystack</button></section>';
  }else{
    body='<section class="rz-business-card"><div class="rz-kicker">EXTERNAL ADVERTISER</div><h3>Pay to advertise on RIZORA</h3><p class="rz-muted">No RIZORA account is required. Your campaign goes live after Paystack confirms the payment.</p>'+
      '<form id="rzExternalAdForm" class="rz-business-form">'+
      '<input class="rz-input" name="businessName" maxlength="120" placeholder="Business / company name" required>'+
      '<input class="rz-input" name="email" type="email" maxlength="180" placeholder="Business email" required>'+
      '<input class="rz-input" name="title" maxlength="120" placeholder="Ad headline" required>'+
      '<textarea class="rz-input" name="description" maxlength="500" placeholder="Short ad description"></textarea>'+
      '<input class="rz-input" name="destinationUrl" type="url" placeholder="https://yourwebsite.com" required>'+
      '<input class="rz-input" name="imageUrl" type="url" placeholder="Optional image URL">'+
      '<input class="rz-input" name="amountNaira" type="number" min="'+min+'" max="'+max+'" step="100" placeholder="Ad budget (NGN)" required>'+
      '<select class="rz-input" name="durationDays"><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select>'+
      '<button class="rz-btn primary" type="submit">Continue to Paystack</button><div id="rzAdStatus" class="rz-muted">Minimum NGN'+min.toLocaleString()+' - maximum NGN'+max.toLocaleString()+'</div></form></section>';
  }
  var m=modal("RIZORA Ads","BUSINESS â€¢ ADVERTISING",body);
  var plusBtn=m.querySelector("#rzOpenRizoraPlus");
  if(plusBtn)plusBtn.onclick=function(){if(window.RIZORA_ENTERPRISE&&window.RIZORA_ENTERPRISE.showPremium)window.RIZORA_ENTERPRISE.showPremium();};
  var externalBtn=m.querySelector("#rzExternalMode");
  if(externalBtn)externalBtn.onclick=function(){renderExternalAdForm();};
  var form=m.querySelector("#rzInternalAdForm");
  if(form)form.onsubmit=async function(e){
    e.preventDefault();
    var f=e.target,s=m.querySelector("#rzAdStatus");
    try{
      var d=await api("/api/v2/ads",{method:"POST",body:JSON.stringify({
        businessName:f.businessName.value,title:f.title.value,description:f.description.value,
        destinationUrl:f.destinationUrl.value,imageUrl:f.imageUrl.value,durationDays:Number(f.durationDays.value)
      })});
      s.textContent="Ad is live until "+new Date(d.ad.expiresAt).toLocaleDateString()+".";
      loadMine(m);
    }catch(err){s.textContent=err.message;}
  };
  var xform=m.querySelector("#rzExternalAdForm");
  if(xform)xform.onsubmit=async function(e){
    e.preventDefault();
    var f=e.target,s=m.querySelector("#rzAdStatus");
    s.textContent="Opening secure Paystack checkout...";
    try{
      var d=await api("/api/v2/ads/external/initialize",{method:"POST",body:JSON.stringify({
        businessName:f.businessName.value,email:f.email.value,title:f.title.value,description:f.description.value,
        destinationUrl:f.destinationUrl.value,imageUrl:f.imageUrl.value,amountNaira:Number(f.amountNaira.value),
        durationDays:Number(f.durationDays.value)
      })});
      if(d.authorizationUrl){location.href=d.authorizationUrl;return;}
      s.textContent="Payment initialized.";
    }catch(err){s.textContent=err.message;}
  };
  if(form)loadMine(m);
}
function renderExternalAdForm(){
  var m=document.getElementById("rzBusinessModal");
  if(!m)return;
  var min=1000,max=10000000;
  m.querySelector("#rzBusinessBody").innerHTML='<section class="rz-business-card"><div class="rz-kicker">EXTERNAL ADVERTISER</div><h3>Pay to advertise on RIZORA</h3><p class="rz-muted">No RIZORA account is required. Your campaign goes live after Paystack confirms the payment.</p>'+
    '<form id="rzExternalAdForm" class="rz-business-form">'+
    '<input class="rz-input" name="businessName" maxlength="120" placeholder="Business / company name" required>'+
    '<input class="rz-input" name="email" type="email" maxlength="180" placeholder="Business email" required>'+
    '<input class="rz-input" name="title" maxlength="120" placeholder="Ad headline" required>'+
    '<textarea class="rz-input" name="description" maxlength="500" placeholder="Short ad description"></textarea>'+
    '<input class="rz-input" name="destinationUrl" type="url" placeholder="https://yourwebsite.com" required>'+
    '<input class="rz-input" name="imageUrl" type="url" placeholder="Optional image URL">'+
    '<input class="rz-input" name="amountNaira" type="number" min="'+min+'" max="'+max+'" step="100" placeholder="Ad budget (NGN)" required>'+
    '<select class="rz-input" name="durationDays"><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select>'+
    '<button class="rz-btn primary" type="submit">Continue to Paystack</button><div id="rzAdStatus" class="rz-muted">Your payment is processed by Paystack.</div></form></section>';
  var f=m.querySelector("#rzExternalAdForm");
  f.onsubmit=async function(e){
    e.preventDefault();var s=m.querySelector("#rzAdStatus");s.textContent="Opening secure Paystack checkout...";
    try{var d=await api("/api/v2/ads/external/initialize",{method:"POST",body:JSON.stringify({
      businessName:f.businessName.value,email:f.email.value,title:f.title.value,description:f.description.value,
      destinationUrl:f.destinationUrl.value,imageUrl:f.imageUrl.value,amountNaira:Number(f.amountNaira.value),durationDays:Number(f.durationDays.value)
    })});if(d.authorizationUrl){location.href=d.authorizationUrl;return;}s.textContent="Payment initialized.";}catch(err){s.textContent=err.message;}
  };
}
async function loadMine(m){
  if(!m)return;
  var host=m.querySelector("#rzMyAds");if(!host)return;
  try{
    var d=await api("/api/v2/ads/mine");
    var rows=d.ads||[];
    host.innerHTML=rows.length?rows.map(function(ad){
      return '<div class="rz-business-row"><div><strong>'+esc(ad.title)+'</strong><small>'+esc(ad.businessName)+' - '+esc(ad.status)+'</small></div><strong>'+esc(ad.billingType==="rizora_plus"?"RIZORA+":"Paystack")+'</strong><small>'+esc(ad.expiresAt?new Date(ad.expiresAt).toLocaleDateString():"")+'</small></div>';
    }).join(""):'<div class="rz-business-empty">No ad campaigns yet.</div>';
  }catch(e){host.textContent=e.message;}
}

function inject(){
  var aside=document.querySelector(".rz-sidebar");
  if(!aside||document.getElementById("rzBusinessTools"))return;
  var box=document.createElement("div");box.id="rzBusinessTools";box.className="rz-business-tools";
  box.innerHTML='<div class="rz-enterprise-heading">BUSINESS TOOLS</div>'+
    '<button class="rz-btn" data-business="ads">Ads Manager</button>'+
    '<button class="rz-btn" data-business="free">Free Membership</button>'+
    '<button class="rz-btn" data-business="gift">Gift Access</button>';
  aside.appendChild(box);
  box.querySelector('[data-business="ads"]').onclick=adsManager;
  box.querySelector('[data-business="free"]').onclick=freeMembership;
  box.querySelector('[data-business="gift"]').onclick=membershipGift;
}
window.RIZORA_BUSINESS={earnings:earnings,freeMembership:freeMembership,membershipGift:membershipGift,ads:adsManager,externalAds:renderExternalAdForm};
setTimeout(inject,260);
var mo=new MutationObserver(inject);
setTimeout(function(){if(document.body)mo.observe(document.body,{childList:true,subtree:true});},500);
})();

