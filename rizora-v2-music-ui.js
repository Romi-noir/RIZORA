"use strict";
(function(){
  var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");

  function esc(value){
    return String(value==null?"":value)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  async function api(path,opt){
    opt=opt||{};
    if(typeof window.RIZORA_API_CALL==="function"){
      return window.RIZORA_API_CALL(path,opt);
    }
    var headers=Object.assign({"Content-Type":"application/json"},opt.headers||{});
    var token="";
    try{token=String(localStorage.getItem("rizora_auth_token")||"").trim();}catch(_){}
    if(token&&!headers.Authorization)headers.Authorization="Bearer "+token;
    var response=await fetch(API+path,{
      method:opt.method||"GET",
      headers:headers,
      credentials:"include",
      body:opt.body
    });
    var text=await response.text(),data={};
    try{data=text?JSON.parse(text):{};}catch(_){data={error:text};}
    if(!response.ok)throw new Error(data.message||data.error||"Request failed.");
    return data;
  }

  function toast(message){
    if(window.RIZORA_ENTERPRISE&&typeof window.RIZORA_ENTERPRISE.toast==="function"){
      window.RIZORA_ENTERPRISE.toast(message);
      return;
    }
    var target=document.getElementById("toast");
    if(!target)return;
    target.textContent=message;
    target.classList.add("show");
    clearTimeout(window.__rzMusicToast);
    window.__rzMusicToast=setTimeout(function(){target.classList.remove("show");},2600);
  }

  function close(){
    var existing=document.getElementById("rzMusicOverlay");
    if(existing)existing.remove();
  }

  function style(){
    if(document.getElementById("rzMusicStyle"))return;
    var style=document.createElement("style");
    style.id="rzMusicStyle";
    style.textContent=
      ".rz-music-overlay{position:fixed;inset:0;z-index:210;background:rgba(4,2,10,.78);backdrop-filter:blur(15px);display:grid;place-items:center;padding:18px}"+
      ".rz-music-panel{width:min(1120px,100%);max-height:calc(100vh - 36px);overflow:auto;background:#100b1b;color:#f8f6ff;border:1px solid var(--line,rgba(255,255,255,.12));border-radius:26px;padding:22px;box-shadow:0 24px 90px rgba(0,0,0,.5)}"+
      ".rz-music-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.rz-music-head h2{margin:5px 0}.rz-music-muted{color:var(--muted,#aaa1b8);line-height:1.5}.rz-music-grid{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(360px,1.1fr);gap:14px}.rz-music-card{border:1px solid var(--line,rgba(255,255,255,.12));border-radius:18px;padding:17px;background:rgba(255,255,255,.035)}"+
      ".rz-music-form{display:grid;gap:11px}.rz-music-form label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#d9d2e7}.rz-music-form input,.rz-music-form select{width:100%;box-sizing:border-box;border:1px solid var(--line,rgba(255,255,255,.14));border-radius:11px;padding:11px 12px;background:rgba(0,0,0,.2);color:inherit;font:inherit}.rz-music-form input:focus{outline:2px solid rgba(158,105,255,.35);border-color:#9e69ff}.rz-music-platforms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.rz-music-platform{display:flex!important;grid-template-columns:none!important;align-items:center;gap:8px;border:1px solid var(--line,rgba(255,255,255,.12));border-radius:11px;padding:9px 10px;color:#eee7fb!important}.rz-music-platform input{width:auto}.rz-music-rizora{border-color:rgba(158,105,255,.55);background:rgba(158,105,255,.12)}.rz-music-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.rz-music-message{min-height:18px;color:#ffb8ca;font-size:12px}.rz-music-catalog{display:grid;gap:9px}.rz-music-release{border:1px solid var(--line,rgba(255,255,255,.12));border-radius:14px;padding:13px;background:rgba(255,255,255,.025);display:grid;gap:9px}.rz-music-release-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.rz-music-release h3{margin:0;font-size:15px}.rz-music-meta{display:flex;gap:6px;flex-wrap:wrap;color:var(--muted,#aaa1b8);font-size:12px}.rz-music-pill{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;background:rgba(158,105,255,.14);color:#e8dcff;font-size:11px}.rz-music-empty{border:1px dashed var(--line,rgba(255,255,255,.16));border-radius:14px;padding:22px;text-align:center;color:var(--muted,#aaa1b8)}.rz-music-error{color:#ffb8ca;border:1px solid rgba(255,110,145,.35);border-radius:12px;padding:12px}.rz-music-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.rz-music-sidebar{margin-top:12px;padding-top:12px;border-top:1px solid var(--line,rgba(255,255,255,.12))}.rz-music-sidebar .rz-enterprise-heading{margin-bottom:7px}@media(max-width:780px){.rz-music-panel{padding:16px;max-height:calc(100vh - 20px)}.rz-music-grid{grid-template-columns:1fr}.rz-music-platforms{grid-template-columns:1fr}.rz-music-release-top{display:grid;gap:9px}}";
    document.head.appendChild(style);
  }

  function modal(){
    style();
    close();
    var overlay=document.createElement("div");
    overlay.id="rzMusicOverlay";
    overlay.className="rz-music-overlay";
    overlay.innerHTML=
      '<section class="rz-music-panel" role="dialog" aria-modal="true" aria-labelledby="rzMusicTitle">'+
        '<div class="rz-music-head">'+
          '<div><div class="rz-kicker">RIZORA MUSIC</div><h2 id="rzMusicTitle">Music Studio</h2><p class="rz-music-muted">Distribute your release to RIZORA and selected external platforms, then track it from your catalog.</p></div>'+
          '<button type="button" class="rz-btn" id="rzMusicClose">Close</button>'+
        '</div>'+
        '<div class="rz-music-grid">'+
          '<section class="rz-music-card">'+
            '<div class="rz-kicker">DISTRIBUTE A RELEASE</div>'+
            '<form id="rzMusicReleaseForm" class="rz-music-form">'+
              '<label>Release title<input name="title" maxlength="160" placeholder="e.g. Midnight in Lagos" required></label>'+
              '<label>Artist name<input name="artist" maxlength="120" placeholder="Artist or stage name" required></label>'+
              '<label>Existing release ID <span class="rz-music-muted">optional</span><input name="releaseId" maxlength="120" placeholder="Use this to update an existing release"></label>'+
              '<label>Distributor choice <span class="rz-music-muted">optional</span><input name="distributorChoice" maxlength="120" placeholder="Owner-only override"></label>'+
              '<label>Label <span class="rz-music-muted">optional</span><input name="labelChoice" maxlength="120" placeholder="Owner-only override"></label>'+
              '<div><div class="rz-music-muted" style="margin-bottom:7px">Destinations</div><div class="rz-music-platforms">'+
                '<label class="rz-music-platform rz-music-rizora"><input type="checkbox" checked disabled> RIZORA (included)</label>'+
                '<label class="rz-music-platform"><input type="checkbox" name="platforms" value="spotify" checked> Spotify</label>'+
                '<label class="rz-music-platform"><input type="checkbox" name="platforms" value="apple_music" checked> Apple Music</label>'+
                '<label class="rz-music-platform"><input type="checkbox" name="platforms" value="youtube_music" checked> YouTube Music</label>'+
                '<label class="rz-music-platform"><input type="checkbox" name="platforms" value="tiktok_music" checked> TikTok Music</label>'+
              '</div></div>'+
              '<div class="rz-music-actions"><button class="rz-btn primary" type="submit" id="rzMusicSubmit">Submit distribution</button><button class="rz-btn" type="button" id="rzMusicReset">Reset</button></div>'+
              '<div id="rzMusicFormMessage" class="rz-music-message" role="status"></div>'+
            '</form>'+
          '</section>'+
          '<section class="rz-music-card">'+
            '<div class="rz-music-toolbar"><div><div class="rz-kicker">RIZORA CATALOG</div><strong>Your distributed releases</strong></div><button type="button" class="rz-btn" id="rzMusicRefresh">Refresh</button></div>'+
            '<div id="rzMusicCatalog" class="rz-music-catalog"><div class="rz-music-empty">Loading your catalog...</div></div>'+
          '</section>'+
        '</div>'+
      '</section>';
    document.body.appendChild(overlay);
    overlay.querySelector("#rzMusicClose").onclick=close;
    overlay.addEventListener("click",function(event){if(event.target===overlay)close();});
    document.addEventListener("keydown",function onKey(event){if(event.key==="Escape"){close();document.removeEventListener("keydown",onKey);}});
    return overlay;
  }

  function date(value){
    if(!value)return "Date unavailable";
    try{return new Date(value).toLocaleString();}catch(_){return String(value);}
  }

  function platforms(items){
    return (Array.isArray(items)?items:[]).map(function(item){
      return '<span class="rz-music-pill">'+esc(String(item).replace(/_/g," "))+'</span>';
    }).join("");
  }

  function releaseCard(item){
    var title=item.title||"Untitled Release";
    var id=item.releaseId||item.id||"";
    return '<article class="rz-music-release">'+
      '<div class="rz-music-release-top"><div><h3>'+esc(title)+'</h3><div class="rz-music-meta"><span>'+esc(item.artist||"Unknown artist")+'</span><span>'+esc(item.label||"RIZORA")+'</span><span>'+esc(date(item.createdAt))+'</span></div></div><span class="rz-music-pill">'+esc(item.status||"pending")+'</span></div>'+
      '<div class="rz-music-meta">'+platforms(item.platforms)+'</div>'+
      '<div class="rz-music-actions"><button type="button" class="rz-btn small" data-rz-music-status="'+esc(id)+'">View status</button></div>'+
    '</article>';
  }

  async function loadCatalog(root){
    var target=root&&root.querySelector("#rzMusicCatalog");
    if(!target)return;
    target.innerHTML='<div class="rz-music-empty">Loading your catalog...</div>';
    try{
      var data=await api("/api/music/catalog");
      var rows=Array.isArray(data.catalog)?data.catalog:[];
      target.innerHTML=rows.map(releaseCard).join("")||'<div class="rz-music-empty">No releases yet. Submit your first distribution package.</div>';
      target.querySelectorAll("[data-rz-music-status]").forEach(function(button){
        button.onclick=async function(){
          var id=button.getAttribute("data-rz-music-status");
          if(!id)return;
          button.disabled=true;
          try{
            var status=await api("/api/music/distribution-status/"+encodeURIComponent(id));
            toast((status.release&&status.release.title)||"Release status: "+((status.release&&status.release.status)||"available"));
          }catch(error){toast(error.message||"Unable to load release status.");}
          finally{button.disabled=false;}
        };
      });
    }catch(error){
      target.innerHTML='<div class="rz-music-error">'+esc(error.message||"Unable to load your catalog.")+'</div>';
    }
  }

  function resetPlatforms(root){
    root.querySelectorAll('input[name="platforms"]').forEach(function(input){input.checked=true;});
  }

  function open(){
    var root=modal();
    var form=root.querySelector("#rzMusicReleaseForm");
    var message=root.querySelector("#rzMusicFormMessage");
    var submit=root.querySelector("#rzMusicSubmit");
    resetPlatforms(root);
    root.querySelector("#rzMusicRefresh").onclick=function(){loadCatalog(root);};
    root.querySelector("#rzMusicReset").onclick=function(){form.reset();resetPlatforms(root);message.textContent="";};
    form.onsubmit=async function(event){
      event.preventDefault();
      message.textContent="";
      submit.disabled=true;
      submit.textContent="Submitting...";
      var selected=[];
      form.querySelectorAll('input[name="platforms"]:checked').forEach(function(input){selected.push(input.value);});
      try{
        var result=await api("/api/music/distribute",{
          method:"POST",
          body:JSON.stringify({
            title:form.title.value.trim(),
            artist:form.artist.value.trim(),
            releaseId:form.releaseId.value.trim()||null,
            platforms:selected,
            distributorChoice:form.distributorChoice.value.trim()||null,
            labelChoice:form.labelChoice.value.trim()||null
          })
        });
        message.style.color="#b9f6d0";
        message.textContent="Distribution saved in your RIZORA catalog.";
        form.reset();
        resetPlatforms(root);
        await loadCatalog(root);
        toast(result.distribution&&result.distribution.title||"Release distributed.");
      }catch(error){
        message.style.color="";
        message.textContent=error.message||"Distribution failed.";
      }finally{
        submit.disabled=false;
        submit.textContent="Submit distribution";
      }
    };
    loadCatalog(root);
    setTimeout(function(){var first=root.querySelector('input[name="title"]');if(first)first.focus();},50);
  }

  function inject(){
    var aside=document.querySelector(".rz-sidebar");
    if(aside&&!document.getElementById("rzMusicSidebar")){
      var box=document.createElement("div");
      box.id="rzMusicSidebar";
      box.className="rz-music-sidebar";
      box.innerHTML='<div class="rz-enterprise-heading">RIZORA MUSIC</div><button type="button" class="rz-btn" id="rzMusicOpenSidebar">Open Music Studio</button>';
      aside.appendChild(box);
      box.querySelector("#rzMusicOpenSidebar").onclick=open;
    }
  }

  window.RIZORA_MUSIC={open:open,loadCatalog:function(){var root=document.getElementById("rzMusicOverlay");if(root)loadCatalog(root);else open();}};
  setTimeout(function(){inject();if(document.body)new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});},260);
})();