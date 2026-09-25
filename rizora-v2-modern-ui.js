(function(){
"use strict";
var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
async function api(path,opt){opt=opt||{};var r=await fetch(API+path,{credentials:"include",method:opt.method||"GET",headers:Object.assign({"Content-Type":"application/json"},opt.headers||{}),body:opt.body});var t=await r.text(),d={};try{d=t?JSON.parse(t):{};}catch(_){d={error:t};}if(!r.ok)throw new Error(d.message||d.error||"Request failed.");return d;}
function close(){var x=document.getElementById("rzModernOverlay");if(x)x.remove();}
function modal(title,sub,body){close();var m=document.createElement("div");m.id="rzModernOverlay";m.className="rz-modern-overlay";m.innerHTML='<div class="rz-modern-panel"><div class="rz-modern-head"><div><div class="rz-kicker">RIZORA CONTROL CENTER</div><h2>'+esc(title)+'</h2><p>'+esc(sub||"")+'</p></div><button class="rz-btn" id="rzModernClose">Close</button></div><div id="rzModernBody">'+body+'</div></div>';document.body.appendChild(m);document.getElementById("rzModernClose").onclick=close;m.addEventListener("click",function(e){if(e.target===m)close();});return m;}
function notify(s){if(window.RIZORA_ENTERPRISE&&window.RIZORA_ENTERPRISE.toast)return window.RIZORA_ENTERPRISE.toast(s);alert(s);}
async function loadPreferences(){return (await api("/api/v2/preferences")).preferences||{};}
async function preferences(){
  var s=await loadPreferences(),n=s.notifications||{};
  var body='<div class="rz-modern-grid rz-modern-grid-2">'+
    '<section class="rz-modern-card"><div class="rz-kicker">NOTIFICATIONS</div><h3>Choose what reaches you</h3>'+
    ['all','likes','comments','follows','mentions','messages','collaboration','support','verification','moderation'].map(function(k){return '<label class="rz-modern-check"><input type="checkbox" data-pref-notify="'+k+'" '+(n[k]!==false?"checked":"")+'><span>'+k.charAt(0).toUpperCase()+k.slice(1)+'</span></label>';}).join("")+
    '</section><section class="rz-modern-card"><div class="rz-kicker">DISCOVERY</div><h3>Control your feed</h3>'+
    '<label class="rz-modern-check"><input id="rzPrefPersonalized" type="checkbox" '+(s.personalizedFeed!==false?"checked":"")+'><span>Personalized For You feed</span></label>'+
    '<label class="rz-modern-check"><input id="rzPrefDiscoverable" type="checkbox" '+(s.discoverable!==false?"checked":"")+'><span>Allow your profile to be recommended</span></label>'+
    '<label class="rz-modern-check"><input id="rzPrefActivity" type="checkbox" '+(s.showActivityStatus!==false?"checked":"")+'><span>Show activity status</span></label>'+
    '<p class="rz-modern-note">For You now uses recent activity, creator relationships, engagement and category signals. Mutes and blocks are removed from the feed.</p></section></div>'+
    '<div class="rz-modern-actions"><button class="rz-btn primary" id="rzPrefSave">Save preferences</button></div>';
  var m=modal("Preferences","Personalize how RIZORA reaches and recommends you.",body);
  m.querySelector("#rzPrefSave").onclick=async function(){try{
    var updates={notifications:{}};m.querySelectorAll("[data-pref-notify]").forEach(function(x){updates.notifications[x.getAttribute("data-pref-notify")]=x.checked;});
    updates.personalizedFeed=m.querySelector("#rzPrefPersonalized").checked;updates.discoverable=m.querySelector("#rzPrefDiscoverable").checked;updates.showActivityStatus=m.querySelector("#rzPrefActivity").checked;
    await api("/api/v2/preferences",{method:"PATCH",body:JSON.stringify(updates)});notify("Preferences saved.");close();
  }catch(e){notify(e.message);}};
}
async function security(){
  var s=await api("/api/v2/security/sessions"),sessions=s.sessions||[];
  var body='<div class="rz-modern-card"><div class="rz-kicker">PASSWORD</div><h3>Change your password</h3><form id="rzPasswordForm" class="rz-modern-form"><input name="currentPassword" type="password" class="rz-input" placeholder="Current password" required><input name="newPassword" type="password" class="rz-input" placeholder="New password" required><button class="rz-btn primary">Update password</button><div id="rzPasswordStatus"></div></form></div>'+
    '<div class="rz-modern-card"><div class="rz-kicker">SESSIONS</div><h3>Where your RIZORA account is signed in</h3><p class="rz-modern-note">Revoke old sessions after using a shared computer or changing your password.</p>'+
    sessions.map(function(x){return '<div class="rz-modern-row"><div><strong>'+(x.current?"Current session":"RIZORA session")+'</strong><span>Started '+new Date(x.createdAt).toLocaleString()+' · Expires '+new Date(x.expiresAt).toLocaleString()+'</span></div>'+(x.current?'':'<button class="rz-btn" data-rz-revoke="'+esc(x.id)+'">Revoke</button>')+'</div>';}).join("")+
    '<div class="rz-modern-actions"><button class="rz-btn" id="rzRevokeOthers">Revoke all other sessions</button></div></div>';
  var m=modal("Security","Password and active-session controls.",body);
  m.querySelector("#rzPasswordForm").onsubmit=async function(e){e.preventDefault();var f=e.target;var o=m.querySelector("#rzPasswordStatus");try{await api("/api/v2/security/password",{method:"POST",body:JSON.stringify({currentPassword:f.currentPassword.value,newPassword:f.newPassword.value})});f.reset();o.textContent="Password updated. Other sessions were signed out.";}catch(err){o.textContent=err.message;}};
  m.querySelectorAll("[data-rz-revoke]").forEach(function(b){b.onclick=async function(){try{await api("/api/v2/security/sessions/revoke",{method:"POST",body:JSON.stringify({sessionId:b.getAttribute("data-rz-revoke")})});security();}catch(e){notify(e.message);}};});
  m.querySelector("#rzRevokeOthers").onclick=async function(){try{await api("/api/v2/security/sessions/revoke",{method:"POST",body:JSON.stringify({allOther:true})});security();}catch(e){notify(e.message);}};
}
async function safety(){
  var b=await Promise.all([api("/api/v2/blocks"),api("/api/v2/mutes")]),blocks=b[0].users||[],mutes=b[1].users||[];
  var body='<div class="rz-modern-card"><div class="rz-kicker">SAFETY</div><h3>Block or mute a creator</h3><form id="rzRelationForm" class="rz-modern-actions"><input class="rz-input" id="rzRelationUser" placeholder="@username" required><select class="rz-input" id="rzRelationType"><option value="mutes">Mute</option><option value="blocks">Block</option></select><button class="rz-btn primary">Apply</button></form><p class="rz-modern-note">Blocked and muted creators are removed from your For You feed. Blocking also cancels the mute relationship.</p></div>'+
    '<div class="rz-modern-grid rz-modern-grid-2"><section class="rz-modern-card"><div class="rz-kicker">BLOCKED</div>'+(blocks.length?blocks.map(function(u){return '<div class="rz-modern-row"><div><strong>@'+esc(u.publicUsername||u.username)+'</strong><span>'+esc(u.displayName)+'</span></div><button class="rz-btn" data-rz-unblock="'+esc(u.publicUsername||u.username)+'">Unblock</button></div>';}).join(""):'<div class="rz-modern-note">No blocked creators.</div>')+'</section>'+
    '<section class="rz-modern-card"><div class="rz-kicker">MUTED</div>'+(mutes.length?mutes.map(function(u){return '<div class="rz-modern-row"><div><strong>@'+esc(u.publicUsername||u.username)+'</strong><span>'+esc(u.displayName)+'</span></div><button class="rz-btn" data-rz-unmute="'+esc(u.publicUsername||u.username)+'">Unmute</button></div>';}).join(""):'<div class="rz-modern-note">No muted creators.</div>')+'</section></div>';
  var m=modal("Safety Controls","Keep your feed useful and your space comfortable.",body);
  m.querySelector("#rzRelationForm").onsubmit=async function(e){e.preventDefault();var key=m.querySelector("#rzRelationUser").value.trim().replace(/^@/,""),type=m.querySelector("#rzRelationType").value;try{await api("/api/v2/"+type+"/"+encodeURIComponent(key),{method:"POST",body:"{}"});safety();}catch(err){notify(err.message);}};
  m.querySelectorAll("[data-rz-unblock]").forEach(function(b){b.onclick=async function(){try{await api("/api/v2/blocks/"+encodeURIComponent(b.getAttribute("data-rz-unblock")),{method:"DELETE"});safety();}catch(e){notify(e.message);}};});
  m.querySelectorAll("[data-rz-unmute]").forEach(function(b){b.onclick=async function(){try{await api("/api/v2/mutes/"+encodeURIComponent(b.getAttribute("data-rz-unmute")),{method:"DELETE"});safety();}catch(e){notify(e.message);}};});
}
async function exportData(){
  try{var d=await api("/api/v2/data/export"),blob=new Blob([JSON.stringify(d.data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="rizora-data-export-"+new Date().toISOString().slice(0,10)+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);notify("Your RIZORA data export is ready.");}catch(e){notify(e.message);}
}
function inject(){
  var aside=document.querySelector(".rz-sidebar"),nav=aside&&aside.querySelector(".rz-nav");
  if(aside&&nav&&!document.getElementById("rzModernControls")){
    var box=document.createElement("div");box.id="rzModernControls";box.className="rz-modern-tools";
    box.innerHTML='<div class="rz-enterprise-heading">ACCOUNT CONTROLS</div><button class="rz-btn" data-modern="preferences">Preferences</button><button class="rz-btn" data-modern="security">Security</button><button class="rz-btn" data-modern="safety">Safety & Privacy</button><button class="rz-btn" data-modern="export">Export my data</button>';
    aside.appendChild(box);
    box.querySelector('[data-modern="preferences"]').onclick=preferences;
    box.querySelector('[data-modern="security"]').onclick=security;
    box.querySelector('[data-modern="safety"]').onclick=safety;
    box.querySelector('[data-modern="export"]').onclick=exportData;
  }
  if(!document.getElementById("rzModernFloat")){
    var f=document.createElement("button");f.id="rzModernFloat";f.className="rz-modern-float";f.textContent="Controls";f.onclick=preferences;document.body.appendChild(f);
  }
}
window.RIZORA_CONTROL_CENTER={preferences:preferences,security:security,safety:safety,exportData:exportData};
setTimeout(inject,300);setInterval(inject,1400);
})();