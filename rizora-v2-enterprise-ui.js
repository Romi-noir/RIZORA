(function(){
"use strict";

var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
var activeEnterpriseView=null;

function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
async function api(path,opt){
  opt=opt||{};
  var r=await fetch(API+path,{credentials:"include",method:opt.method||"GET",headers:Object.assign({"Content-Type":"application/json"},opt.headers||{}),body:opt.body});
  var t=await r.text(),d={}; try{d=t?JSON.parse(t):{};}catch(_){d={error:t};}
  if(!r.ok)throw new Error(d.message||d.error||"Request failed."); return d;
}
function toast(s){var t=document.getElementById("toast");if(!t)return;t.textContent=s;t.classList.add("show");clearTimeout(window.__rzxToast);window.__rzxToast=setTimeout(function(){t.classList.remove("show");},2600);}
function backHome(){var b=document.querySelector('[data-nav="home"]');if(b)b.click();else activeEnterpriseView=null;}
function renderInto(html){var c=document.getElementById("content");if(!c)return;activeEnterpriseView=html;c.innerHTML=html;bindView();}
function btn(label,action,cls){return '<button class="rz-btn '+(cls||"")+'" data-rzx-action="'+esc(action)+'">'+esc(label)+'</button>';}
function header(kicker,title,sub){return '<section class="rz-card rz-enterprise-card"><div class="rz-kicker">'+esc(kicker)+'</div><div class="rz-section-title"><div><h2>'+esc(title)+'</h2><p class="rz-muted">'+esc(sub||"")+'</p></div>'+btn("Back","back")+'</div></section>';}

async function showSupport(){
  renderInto(header("SUPPORT","RIZORA Help Center","Get help, track tickets and continue conversations.")+
  '<section class="rz-card"><form id="rzSupportForm"><div class="rz-field"><label class="rz-label">Subject</label><input id="rzSupportSubject" class="rz-input" maxlength="120" required></div><div class="rz-field"><label class="rz-label">Category</label><select id="rzSupportCategory" class="rz-input"><option>account</option><option>verification</option><option>payments</option><option>creator</option><option>bug</option><option>general</option></select></div><div class="rz-field"><label class="rz-label">Message</label><textarea id="rzSupportMessage" class="rz-textarea" maxlength="3000" required></textarea></div><button class="rz-btn primary">Send support request</button><div id="rzSupportError" class="rz-error"></div></form></section><section class="rz-card"><div class="rz-section-title"><h3>Your tickets</h3>'+btn("Refresh","refresh-support")+'</div><div id="rzSupportList" class="rz-feed"><div class="rz-empty">Loading…</div></div></section>');
  document.getElementById("rzSupportForm").onsubmit=async function(e){
    e.preventDefault();var err=document.getElementById("rzSupportError");err.textContent="";
    try{await api("/api/v2/support/tickets",{method:"POST",body:JSON.stringify({subject:document.getElementById("rzSupportSubject").value,category:document.getElementById("rzSupportCategory").value,message:document.getElementById("rzSupportMessage").value})});e.target.reset();toast("Support ticket created.");loadSupport();}
    catch(x){err.textContent=x.message;}
  }; loadSupport();
}
async function loadSupport(){
  var list=document.getElementById("rzSupportList");if(!list)return;
  try{
    var d=await api("/api/v2/support/tickets");
    list.innerHTML=(d.tickets||[]).map(function(t){
      var replies=(t.replies||[]).map(function(r){return '<div class="rz-enterprise-reply"><strong>'+esc(r.fromAdmin?"RIZORA Support":"You")+'</strong><div>'+esc(r.message)+'</div><span class="rz-mini">'+new Date(r.createdAt).toLocaleString()+'</span></div>';}).join("");
      return '<article class="rz-card rz-enterprise-ticket"><strong>'+esc(t.subject)+'</strong><div class="rz-mini">'+esc(t.category)+' · '+esc(t.status)+'</div><p>'+esc(t.message)+'</p>'+replies+'<form data-ticket-reply="'+esc(t.id)+'" class="rz-actions"><input name="message" class="rz-input" placeholder="Reply to this ticket" maxlength="3000" required><button class="rz-btn">Reply</button></form></article>';
    }).join("")||'<div class="rz-empty">You have no support tickets yet.</div>';
    list.querySelectorAll("[data-ticket-reply]").forEach(function(f){f.onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/support/tickets/"+encodeURIComponent(f.getAttribute("data-ticket-reply")),{method:"POST",body:JSON.stringify({message:f.message.value})});toast("Reply sent.");loadSupport();}catch(x){toast(x.message);}};});
  }catch(x){list.innerHTML='<div class="rz-error">'+esc(x.message)+'</div>';}
}
async function showWallet(){
  renderInto(header("WALLET","Payments & transaction history","Paystack stays server-side; your secret key never belongs in the browser.")+
  '<section class="rz-card"><div id="rzPayStatus" class="rz-mini">Checking payment configuration…</div><form id="rzPayForm"><div class="rz-enterprise-grid"><div class="rz-field"><label class="rz-label">Amount (NGN)</label><input id="rzPayAmount" class="rz-input" type="number" min="1" max="10000000" step="1" placeholder="5000" required></div><div class="rz-field"><label class="rz-label">Email</label><input id="rzPayEmail" class="rz-input" type="email" placeholder="your@email.com" required></div><div class="rz-field"><label class="rz-label">Purpose</label><select id="rzPayPurpose" class="rz-input"><option value="creator_boost">Creator Boost</option><option value="opportunity">Opportunity</option><option value="creator_service">Creator Service</option><option value="rizora_creator">RIZORA Creator</option></select></div><div class="rz-field"><label class="rz-label">Campaign ID (optional)</label><input id="rzPayCampaign" class="rz-input" maxlength="120" placeholder="Campaign ID"></div></div><div class="rz-actions">'+btn("Start secure payment","pay","primary")+'</div><div id="rzPayError" class="rz-error"></div></form></section><section class="rz-card"><div class="rz-section-title"><h3>Transactions</h3>'+btn("Refresh","refresh-wallet")+'</div><div id="rzTxList" class="rz-feed"><div class="rz-empty">Loading…</div></div></section>');
  document.getElementById("rzPayForm").onsubmit=async function(e){
    e.preventDefault();var er=document.getElementById("rzPayError");er.textContent="";
    try{var d=await api("/api/v2/payments/initialize",{method:"POST",body:JSON.stringify({amountNaira:Number(document.getElementById("rzPayAmount").value),email:document.getElementById("rzPayEmail").value,purpose:document.getElementById("rzPayPurpose").value,campaignId:document.getElementById("rzPayCampaign").value})});if(d.authorizationUrl)window.location.href=d.authorizationUrl;else toast("Payment initialized.");}
    catch(x){er.textContent=x.message;}
  };loadWallet();
}
async function loadWallet(){
  try{var s=await api("/api/v2/payments/status"),el=document.getElementById("rzPayStatus");if(el)el.innerHTML=s.configured?'<span class="rz-badge ok">Paystack connected</span> · '+esc(s.currency)+' · '+esc(s.mode):'<span class="rz-badge">Paystack setup pending</span> · Add PAYSTACK_SECRET_KEY on the backend before collecting payments.';}catch(_){}
  var list=document.getElementById("rzTxList");if(!list)return;
  try{var d=await api("/api/v2/payments/transactions");list.innerHTML=(d.transactions||[]).map(function(t){return '<div class="rz-card"><strong>'+esc(t.reference)+'</strong><div>'+esc(t.amountNaira)+' '+esc(t.currency)+' · '+esc(t.status)+'</div><div class="rz-mini">'+esc(t.purpose)+' · '+new Date(t.createdAt).toLocaleString()+'</div>'+(t.status!=="success"?btn("Verify","verify-payment:"+t.reference):"")+'</div>';}).join("")||'<div class="rz-empty">No transactions yet.</div>';}catch(x){list.innerHTML='<div class="rz-error">'+esc(x.message)+'</div>';}
}
async function showCreatorLookup(){
  renderInto(header("CREATOR IDENTITY","Creator profiles","Open a public creator profile with live metrics and recent posts.")+
  '<section class="rz-card"><form id="rzProfileLookup" class="rz-actions"><input id="rzProfileKey" class="rz-input" placeholder="@username or creator username" required><button class="rz-btn primary">Open profile</button></form><div id="rzProfileError" class="rz-error"></div></section><div id="rzProfileResult"></div>');
  document.getElementById("rzProfileLookup").onsubmit=async function(e){
    e.preventDefault();var key=document.getElementById("rzProfileKey").value.replace(/^@/,"").trim(),er=document.getElementById("rzProfileError");er.textContent="";
    try{var d=await api("/api/v2/profiles/"+encodeURIComponent(key));renderProfile(d);}catch(x){er.textContent=x.message;}
  };
}
function renderProfile(d){
  var p=d.profile||{},result=document.getElementById("rzProfileResult");if(!result)return;
  result.innerHTML='<section class="rz-card"><div class="rz-profile"><img class="rz-avatar" src="'+esc(p.avatarUrl)+'"><div><h2>'+esc(p.displayName)+' '+(p.verified?'<span class="rz-badge ok">✓ Verified</span>':"")+'</h2><div>@'+esc(p.publicUsername||p.username)+'</div><p class="rz-muted">'+esc(p.bio||"No bio yet.")+'</p></div></div><div class="rz-enterprise-stats">'+stat("Posts",p.posts)+stat("Followers",p.followers)+stat("Following",p.following)+stat("Likes",p.likes)+'</div></section><section class="rz-card"><h3>Recent content</h3><div class="rz-feed">'+(d.posts||[]).map(function(post){return '<article class="rz-card"><div class="rz-post-body">'+esc(post.text||post.content||"")+'</div><div class="rz-mini">'+new Date(post.createdAt).toLocaleString()+'</div></article>';}).join("")||'<div class="rz-empty">No public posts yet.</div>'+'</div></section>';
}
function showReport(){
  renderInto(header("SAFETY","Report content or an account","Use reports for spam, impersonation, abuse or policy violations.")+
  '<section class="rz-card"><form id="rzReportForm"><div class="rz-enterprise-grid"><div class="rz-field"><label class="rz-label">Target type</label><select id="rzReportType" class="rz-input"><option value="post">Post</option><option value="user">User</option><option value="community">Community</option><option value="message">Message</option></select></div><div class="rz-field"><label class="rz-label">Target ID</label><input id="rzReportTarget" class="rz-input" required placeholder="Paste the content/user ID"></div></div><div class="rz-field"><label class="rz-label">Reason</label><select id="rzReportReason" class="rz-input"><option>spam</option><option>harassment</option><option>impersonation</option><option>adult_or_explicit</option><option>fraud</option><option>other</option></select></div><div class="rz-field"><label class="rz-label">Details</label><textarea id="rzReportDetails" class="rz-textarea" maxlength="1500"></textarea></div><button class="rz-btn primary">Submit report</button><div id="rzReportError" class="rz-error"></div></form></section>');
  document.getElementById("rzReportForm").onsubmit=async function(e){e.preventDefault();var er=document.getElementById("rzReportError");er.textContent="";try{await api("/api/v2/reports",{method:"POST",body:JSON.stringify({targetType:document.getElementById("rzReportType").value,targetId:document.getElementById("rzReportTarget").value,reason:document.getElementById("rzReportReason").value,details:document.getElementById("rzReportDetails").value})});e.target.reset();toast("Report submitted to RIZORA moderation.");}catch(x){er.textContent=x.message;}};
}
async function showAdmin(){
  renderInto(header("SUPER ADMIN","Command Center","Platform operations, support, moderation and payments.")+'<div id="rzAdminPanel"><div class="rz-empty">Loading live platform data…</div></div>');
  try{
    var d=await api("/api/v2/admin/overview"),s=d.stats||{};
    document.getElementById("rzAdminPanel").innerHTML='<section class="rz-enterprise-stats rz-card">'+stat("Users",s.totalUsers)+stat("Active",s.activeUsers)+stat("Suspended",s.suspendedUsers)+stat("Verified",s.verifiedUsers)+stat("Posts",s.totalPosts)+stat("Communities",s.totalCommunities)+stat("Reports",s.openReports)+stat("Tickets",s.openTickets)+stat("Payments",s.successfulPayments)+stat("Pending",s.pendingPayments)+stat("Referrals",s.totalReferrals)+stat("Referral pts",s.referralPoints)+stat("Audits",s.totalAudits)+'</section><section class="rz-card"><h3>Account password reset</h3><p class="rz-muted">Super Admin only. Resets the selected account password and revokes its active sessions.</p><form id="rzPasswordResetForm" class="rz-actions"><select id="rzResetUsername" class="rz-input"><option value="romi">romi / @romi.noir</option><option value="rizora">@rizora</option></select><input id="rzResetPassword" class="rz-input" type="password" minlength="8" placeholder="New password" required><button class="rz-btn primary">Reset password</button></form><div id="rzPasswordResetError" class="rz-error"></div></section><section class="rz-card"><h3>Official @rizora account</h3><p class="rz-muted">Set a separate login password for the verified official platform account.</p><form id="rzOfficialPasswordForm" class="rz-actions"><input id="rzOfficialPassword" class="rz-input" type="password" minlength="8" placeholder="New official password" required><button class="rz-btn primary">Set password</button></form><div id="rzOfficialPasswordError" class="rz-error"></div></section><section class="rz-card"><div class="rz-section-title"><h3>User management</h3><span class="rz-mini">Status + role controls</span></div><div class="rz-feed">'+(d.users||[]).slice(0,100).map(adminUser).join("")+'</div></section><section class="rz-card"><div class="rz-section-title"><h3>Mission controls</h3><span class="rz-mini">Activate or disable growth tasks</span></div><div class="rz-feed">'+(d.tasks||[]).slice(0,100).map(adminTask).join("")+'</div></section><section class="rz-card"><div class="rz-section-title"><h3>Support queue</h3>'+btn("Refresh","refresh-admin")+'</div><div class="rz-feed">'+(d.latestTickets||[]).map(adminTicket).join("")+'</div></section><section class="rz-card"><div class="rz-section-title"><h3>Moderation queue</h3></div><div class="rz-feed">'+(d.latestReports||[]).map(adminReport).join("")+'</div></section><section class="rz-card"><h3>Payment ledger</h3><div class="rz-feed">'+(d.latestTransactions||[]).map(function(t){return '<div class="rz-card"><strong>'+esc(t.reference)+'</strong><div>'+esc(t.amountNaira)+' '+esc(t.currency)+' · '+esc(t.status)+'</div></div>';}).join("")+'</div></section>';
    bindAdmin();
    var prf=document.getElementById("rzPasswordResetForm");
    if(prf)prf.onsubmit=async function(e){
      e.preventDefault();
      var err=document.getElementById("rzPasswordResetError");if(err)err.textContent="";
      try{
        await api("/api/v2/admin/users/password",{method:"POST",body:JSON.stringify({username:document.getElementById("rzResetUsername").value,password:document.getElementById("rzResetPassword").value})});
        e.target.reset();toast("Password reset and active sessions revoked.");
      }catch(x){if(err)err.textContent=x.message;}
    };
    var opf=document.getElementById("rzOfficialPasswordForm");
    if(opf)opf.onsubmit=async function(e){
      e.preventDefault();
      var err=document.getElementById("rzOfficialPasswordError");
      if(err)err.textContent="";
      try{
        await api("/api/v2/admin/official/rizora/password",{method:"POST",body:JSON.stringify({password:document.getElementById("rzOfficialPassword").value})});
        e.target.reset();toast("@rizora login password set.");
      }catch(x){if(err)err.textContent=x.message;}
    };
  }catch(x){document.getElementById("rzAdminPanel").innerHTML='<div class="rz-error">'+esc(x.message)+'</div>';}
}
function adminUser(u){return '<article class="rz-card"><strong>'+esc(u.displayName||u.username)+'</strong><div class="rz-mini">@'+esc(u.publicUsername||u.username)+' · '+esc(u.status)+' · '+esc(u.role)+'</div><div class="rz-actions"><select class="rz-input" data-user-status="'+esc(u.id)+'"><option value="active" '+(u.status==="active"?"selected":"")+' >active</option><option value="blocked" '+(u.status==="blocked"?"selected":"")+' >blocked</option></select><select class="rz-input" data-user-role="'+esc(u.id)+'"><option value="user" '+(u.role==="user"?"selected":"")+' >user</option><option value="admin" '+(u.role==="admin"?"selected":"")+' >admin</option><option value="super_admin" '+(u.role==="super_admin"?"selected":"")+' >super_admin</option></select><button class="rz-btn" data-user-save="'+esc(u.id)+'">Save</button></div></article>';}
function adminTask(t){return '<article class="rz-card"><strong>'+esc(t.title||t.name||"Task")+'</strong><div class="rz-mini">+'+Number(t.points||t.reward||0)+' pts · '+(t.active===false?"disabled":"active")+'</div><button class="rz-btn '+(t.active===false?"":"primary")+'" data-task-toggle="'+esc(t.id)+'">'+(t.active===false?"Activate":"Disable")+'</button></article>';}
function stat(k,v){return '<div><strong>'+esc(v)+'</strong><span>'+esc(k)+'</span></div>';}
function adminTicket(t){return '<article class="rz-card"><strong>'+esc(t.subject)+'</strong><div class="rz-mini">'+esc(t.status)+' · '+esc(t.category)+'</div><p>'+esc(t.message)+'</p><form data-admin-ticket="'+esc(t.id)+'" class="rz-actions"><select name="status" class="rz-input"><option value="open">open</option><option value="in_progress">in_progress</option><option value="resolved">resolved</option></select><input name="message" class="rz-input" placeholder="Optional reply"><button class="rz-btn">Update</button></form></article>';}
function adminReport(r){return '<article class="rz-card"><strong>'+esc(r.targetType)+' · '+esc(r.targetId)+'</strong><div class="rz-mini">'+esc(r.reason)+' · '+esc(r.status)+'</div><p>'+esc(r.details||"")+'</p><form data-admin-report="'+esc(r.id)+'" class="rz-actions"><select name="action" class="rz-input"><option value="dismiss">dismiss</option><option value="remove_post">remove post</option><option value="warn_user">warn user</option><option value="suspend_user">suspend user</option></select><button class="rz-btn primary">Apply</button></form></article>';}
function bindAdmin(){
  document.querySelectorAll("[data-admin-ticket]").forEach(function(f){f.onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/admin/support/"+encodeURIComponent(f.getAttribute("data-admin-ticket")),{method:"POST",body:JSON.stringify({status:f.status.value,message:f.message.value})});toast("Support ticket updated.");showAdmin();}catch(x){toast(x.message);}};});
  document.querySelectorAll("[data-admin-report]").forEach(function(f){f.onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/admin/reports/"+encodeURIComponent(f.getAttribute("data-admin-report")),{method:"POST",body:JSON.stringify({action:f.action.value})});toast("Moderation action applied.");showAdmin();}catch(x){toast(x.message);}};});
}
async function verifyPayment(ref){try{var d=await api("/api/v2/payments/verify/"+encodeURIComponent(ref));toast("Payment status: "+d.status);loadWallet();}catch(x){toast(x.message);}}
function bindView(){
  document.querySelectorAll("[data-rzx-action]").forEach(function(b){b.onclick=async function(){var a=b.getAttribute("data-rzx-action");if(a==="support")return showSupport();if(a==="wallet")return showWallet();if(a==="creator")return showCreatorLookup();if(a==="report")return showReport();if(a==="admin")return showAdmin();if(a==="boosts"){var n=document.querySelector('[data-nav="boosts"]');if(n)n.click();return;}if(a==="back")return backHome();if(a==="refresh-support")return loadSupport();if(a==="refresh-wallet")return loadWallet();if(a==="refresh-admin")return showAdmin();if(a.indexOf("verify-payment:")===0)return verifyPayment(a.slice(15));};});
}

function injectPasswordToggles(){
  ["password","confirmPassword"].forEach(function(id){
    var input=document.getElementById(id);
    if(!input || input.parentElement.getAttribute("data-rz-password"))return;
    var wrap=document.createElement("div");
    wrap.className="rz-password-wrap";
    wrap.setAttribute("data-rz-password","1");
    input.parentNode.insertBefore(wrap,input);
    wrap.appendChild(input);
    var b=document.createElement("button");
    b.type="button";b.className="rz-btn rz-password-toggle";b.textContent="Show";
    b.onclick=function(){var hidden=input.type==="password";input.type=hidden?"text":"password";b.textContent=hidden?"Hide":"Show";};
    wrap.appendChild(b);
  });
}

function injectTools(){
  if(document.body.classList.contains("rz-auth")||!document.querySelector(".rz-sidebar")||document.getElementById("rzEnterpriseTools"))return;
  var aside=document.querySelector(".rz-sidebar");if(!aside)return;
  var box=document.createElement("div");box.id="rzEnterpriseTools";box.className="rz-enterprise-tools";
  box.innerHTML='<div class="rz-enterprise-heading">PLATFORM</div>'+btn("Help Center","support")+btn("Wallet & Payments","wallet")+btn("Creator Profiles","creator")+btn("Report & Safety","report")+btn("Boost Network","boosts")+btn("Super Admin","admin");
  aside.appendChild(box);bindView();
}
function boot(){
  injectTools();
  injectPasswordToggles();
  var mo=new MutationObserver(function(){injectTools();injectPasswordToggles();});
  mo.observe(document.body,{childList:true,subtree:true});
  window.RIZORA_ENTERPRISE={support:showSupport,wallet:showWallet,profiles:showCreatorLookup,report:showReport,admin:showAdmin};
  bindView();
}
setTimeout(boot,60);
})();