(function(){
"use strict";
var ADS_API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
async function adApi(path){
  if(window.RIZORA_API_CALL)return window.RIZORA_API_CALL(path,{});
  var r=await fetch(ADS_API+path,{credentials:"include"});
  var d={};try{d=await r.json();}catch(_){}
  if(!r.ok)throw new Error(d.message||"Unable to load ads.");
  return d;
}
function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
var busy=false;
async function renderAd(){
  if(busy)return;
  var postForm=document.getElementById("postForm");
  if(!postForm)return;
  var host=postForm.parentElement&&postForm.parentElement.querySelector(".rz-feed");
  if(!host||host.getAttribute("data-rz-ads-rendered")==="1")return;
  busy=true;
  try{
    var d=await adApi("/api/v2/ads");
    var ad=(d.ads||[])[0];
    host.setAttribute("data-rz-ads-rendered","1");
    if(!ad)return;
    var box=document.createElement("article");
    box.className="rz-card rz-rizora-ad";
    box.style.cssText="margin-bottom:14px;border:1px solid rgba(167,110,255,.28);background:linear-gradient(135deg,rgba(97,43,173,.18),rgba(255,255,255,.03));";
    box.innerHTML='<div class="rz-kicker">ADVERTISEMENT</div><div class="rz-post-head"><div><strong>'+esc(ad.advertiserName||"Business")+'</strong><div class="rz-mini">Sponsored on RIZORA</div></div></div>'+
      (ad.imageUrl?'<img src="'+esc(ad.imageUrl)+'" alt="" loading="lazy" style="width:100%;max-height:280px;object-fit:cover;border-radius:14px;margin:10px 0">':"")+
      '<div class="rz-post-body"><strong>'+esc(ad.title||"Sponsored")+'</strong><div class="rz-muted" style="margin-top:5px">'+esc(ad.description||"")+'</div></div>'+
      '<div class="rz-actions"><a class="rz-btn primary" href="'+esc(ad.destinationUrl)+'" target="_blank" rel="noopener noreferrer sponsored">Visit business</a></div>';
    host.prepend(box);
  }catch(_){ }
  finally{busy=false;}
}
function watch(){
  renderAd();
  if(document.body&&!window.RIZORA_ADS_OBSERVER){
    var mo=new MutationObserver(function(){renderAd();});
    mo.observe(document.body,{childList:true,subtree:true});
    window.RIZORA_ADS_OBSERVER=mo;
  }
}
window.RIZORA_ADS={render:renderAd};
setTimeout(watch,900);
})();