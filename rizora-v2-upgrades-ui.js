(function(){
"use strict";

function loadPublicCreator(){
  var hash=String(location.hash||"");
  var pathName=String(location.pathname||"");
  var key="";

  if(hash.indexOf("#creator=")===0){
    try{key=decodeURIComponent(hash.slice(9));}
    catch(_){key=hash.slice(9);}
  }else{
    var m=pathName.match(/^\/creator\/([^/]+)\/?$/i);
    if(m){
      try{key=decodeURIComponent(m[1]);}
      catch(_){key=m[1];}
    }
  }

  if(!key || key==="creator") return;

  api("/api/public/creator/"+encodeURIComponent(key))
  .then(function(d){

    var p=d.creator||{};
    var o=document.getElementById("rzPublicCreatorCard");
    if(o)o.remove();

    document.title=(p.displayName||p.username||"Creator")+" on RIZORA";

    var canonical=document.querySelector("link[rel='canonical']");
    if(canonical){
      canonical.href=location.origin+"/creator/"+encodeURIComponent(p.publicUsername||p.username||key);
    }

    var el=document.createElement("div");
    el.id="rzPublicCreatorCard";
    el.className="rz-up-public-overlay";

    el.innerHTML=
    '<div class="rz-up-public-card">'+
    '<button class="rz-btn" id="rzPublicCreatorClose">Close</button>'+
    '<div class="rz-kicker">RIZORA CREATOR</div>'+
    '<h1>'+
    esc(p.displayName||p.username||"Creator")+
    (p.verified?' <span class="rz-badge ok">✓ Verified</span>':"")+
    '</h1>'+
    '<div class="rz-muted">@'+esc(p.publicUsername||p.username||"")+'</div>'+
    '<p>'+esc((p.profile&&p.profile.bio)||p.bio||"")+'</p>'+
    '<div class="rz-up-public-stats">'+
    '<span><b>'+Number(p.followers||0)+'</b> followers</span>'+
    '<span><b>'+Number(p.following||0)+'</b> following</span>'+
    '<span><b>'+Number(p.posts||0)+'</b> posts</span>'+
    '</div>'+
    ((d.posts||[]).slice(0,8).map(function(post){
      return '<article class="rz-up-public-post">'+
      '<p>'+esc(post.text||post.content||"")+'</p>'+
      (post.mediaUrl?
      '<a href="'+esc(post.mediaUrl)+'" target="_blank" rel="noopener noreferrer">Open media</a>'
      :"")+
      '</article>';
    }).join("")||
    '<div class="rz-empty">No public posts yet.</div>')+
    '</div>';

    document.body.appendChild(el);

    document.getElementById("rzPublicCreatorClose").onclick=function(){
      el.remove();
      history.replaceState(null,"",location.origin+"/");
      document.title="RIZORA - Creator OS";
      var canonical=document.querySelector("link[rel='canonical']");
      if(canonical)canonical.href=location.origin+"/";
    };

  })
  .catch(function(err){
    console.log("Public creator load failed:",err);
  });
}

loadPublicCreator();

})();