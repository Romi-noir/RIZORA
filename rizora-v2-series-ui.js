"use strict";
(function(){
  var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
  var overlay=null;

  function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  async function api(path,opt){
    opt=opt||{};
    var r=await fetch(API+path,{credentials:"include",method:opt.method||"GET",headers:Object.assign({"Content-Type":"application/json"},opt.headers||{}),body:opt.body});
    var t=await r.text(),d={}; try{d=t?JSON.parse(t):{};}catch(_){d={error:t};}
    if(!r.ok)throw new Error(d.message||d.error||"Request failed.");
    return d;
  }
  function close(){if(overlay){overlay.remove();overlay=null;}}
  function modal(title,body){
    close();
    overlay=document.createElement("div"); overlay.className="rz-series-overlay";
    overlay.innerHTML='<div class="rz-series-backdrop"></div><section class="rz-series-panel"><div class="rz-series-head"><div><div class="rz-kicker">RIZORA SERIES</div><h2>'+esc(title)+'</h2><p class="rz-muted">Turn connected posts into an episodic creator format.</p></div><button class="rz-btn" id="rzSeriesClose">Close</button></div><div id="rzSeriesBody">'+body+'</div></section>';
    document.body.appendChild(overlay);
    overlay.querySelector(".rz-series-backdrop").onclick=close;
    overlay.querySelector("#rzSeriesClose").onclick=close;
    return overlay;
  }
  function card(title,body){return '<section class="rz-series-card"><div class="rz-kicker">'+esc(title)+'</div>'+body+'</section>';}

  async function open(){
    var m=modal("Series & Episodes",card("CREATE SERIES",'<form id="rzSeriesCreate" class="rz-series-form"><input class="rz-input" name="title" maxlength="100" placeholder="Series title" required><textarea class="rz-textarea" name="description" maxlength="600" placeholder="What is this series about?"></textarea><input class="rz-input" name="coverUrl" maxlength="1200" placeholder="Cover image URL (optional)"><button class="rz-btn primary">Create series</button><div id="rzSeriesCreateStatus" class="rz-muted"></div></form>')+
      card("ADD AN EPISODE",'<form id="rzSeriesEpisode" class="rz-series-form"><select class="rz-input" name="series" required><option value="">Choose a series…</option></select><select class="rz-input" name="post" required><option value="">Choose one of your posts…</option></select><div class="rz-series-grid"><input class="rz-input" name="episodeNumber" type="number" min="1" max="9999" value="1" placeholder="Episode #"><input class="rz-input" name="episodeTitle" maxlength="140" placeholder="Episode title"></div><button class="rz-btn primary">Add episode</button><div id="rzSeriesEpisodeStatus" class="rz-muted"></div></form>')+
      card("YOUR SERIES",'<div id="rzSeriesList">Loading…</div>')+
      card("DISCOVER A CREATOR",'<form id="rzSeriesFind" class="rz-series-form"><input class="rz-input" name="creator" placeholder="@creator username"><button class="rz-btn">Find public series</button></form><div id="rzSeriesDiscover"></div>'));
    await load(m);
  }

  async function load(m){
    try{
      var data=await api("/api/v2/series"), posts=await api("/api/v2/series/posts/mine");
      var sf=m.querySelector('[name="series"]'),pf=m.querySelector('[name="post"]');
      (data.series||[]).forEach(function(s){sf.insertAdjacentHTML("beforeend",'<option value="'+esc(s.id)+'">'+esc(s.title)+' · '+Number(s.episodeCount||0)+' episodes</option>');});
      (posts.posts||[]).forEach(function(p){
        var label=(p.text||p.mediaUrl||"Media post").slice(0,70);
        if(p.seriesId) label="✓ "+label+" · E"+Number(p.seriesEpisodeNumber||0);
        pf.insertAdjacentHTML("beforeend",'<option value="'+esc(p.id)+'">'+esc(label)+"</option>");
      });
      m.querySelector("#rzSeriesList").innerHTML=(data.series||[]).map(renderSeries).join("")||'<div class="rz-series-empty">No series yet. Create your first one above.</div>';
      bindSeries(m);
    }catch(e){m.querySelector("#rzSeriesList").innerHTML='<div class="rz-error">'+esc(e.message)+'</div>';}

    m.querySelector("#rzSeriesCreate").onsubmit=async function(e){
      e.preventDefault();var f=e.target,st=m.querySelector("#rzSeriesCreateStatus");
      try{var d=await api("/api/v2/series",{method:"POST",body:JSON.stringify({title:f.title.value,description:f.description.value,coverUrl:f.coverUrl.value})});st.textContent="Created: "+d.series.title;m.querySelector("#rzSeriesCreate").reset();await load(m);}
      catch(err){st.textContent=err.message;}
    };
    m.querySelector("#rzSeriesEpisode").onsubmit=async function(e){
      e.preventDefault();var f=e.target,st=m.querySelector("#rzSeriesEpisodeStatus");
      try{var d=await api("/api/v2/series/"+encodeURIComponent(f.series.value)+"/episodes",{method:"POST",body:JSON.stringify({postId:f.post.value,episodeNumber:Number(f.episodeNumber.value),episodeTitle:f.episodeTitle.value})});st.textContent="Added to "+d.series.title+".";await open();}
      catch(err){st.textContent=err.message;}
    };
    m.querySelector("#rzSeriesFind").onsubmit=async function(e){
      e.preventDefault();var f=e.target,box=m.querySelector("#rzSeriesDiscover");box.innerHTML="Loading…";
      try{var d=await api("/api/v2/series?creator="+encodeURIComponent(f.creator.value.trim()));box.innerHTML=(d.series||[]).map(renderSeries).join("")||'<div class="rz-series-empty">No public series found.</div>';}
      catch(err){box.innerHTML='<div class="rz-error">'+esc(err.message)+'</div>';}
    };
  }

  function renderSeries(s){
    var creator=s.creator?('@'+(s.creator.publicUsername||s.creator.username)):"";
    var eps=(s.episodes||[]).map(function(e){return '<div class="rz-series-episode"><span>E'+Number(e.episodeNumber||0)+'</span><div><strong>'+esc(e.title||"Untitled episode")+'</strong><p>'+esc((e.text||"").slice(0,180))+'</p><small>'+new Date(e.createdAt).toLocaleDateString()+'</small></div></div>';}).join("");
    return '<article class="rz-series-item"><div class="rz-series-row"><div><h3>'+esc(s.title)+'</h3><p>'+esc(s.description||"")+'</p><small>'+esc(creator)+' · '+Number(s.episodeCount||0)+' episode(s)</small></div><button class="rz-btn" data-series-delete="'+esc(s.id)+'">Delete</button></div><div class="rz-series-episodes">'+(eps||'<div class="rz-series-empty">No episodes yet.</div>')+'</div></article>';
  }
  function bindSeries(root){
    root.querySelectorAll("[data-series-delete]").forEach(function(b){b.onclick=async function(){if(!confirm("Delete this series? Episodes stay as normal posts but are removed from the series."))return;try{await api("/api/v2/series/"+encodeURIComponent(b.getAttribute("data-series-delete")),{method:"DELETE"});open();}catch(e){alert(e.message);}};});
  }
  function inject(){
    var aside=document.querySelector(".rz-sidebar");if(!aside||document.getElementById("rzSeriesTool"))return;
    var box=document.createElement("div");box.id="rzSeriesTool";box.className="rz-series-tools";
    box.innerHTML='<div class="rz-enterprise-heading">FORMAT TOOLS</div><button class="rz-btn" id="rzOpenSeries">Series & Episodes</button>';
    aside.appendChild(box);
    document.getElementById("rzOpenSeries").onclick=open;
  }
  function boot(){inject();new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});}
  window.RIZORA_SERIES={open:open};
  setTimeout(boot,180);
})();