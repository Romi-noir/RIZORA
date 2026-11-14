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
function safeUrl(value){try{var u=new URL(String(value||"/"),location.origin);return u.origin===location.origin||u.protocol==="https:"?u.href:"/";}catch(_){return "/";}}
function houseVideoAd(){return {advertiserName:"RIZORA",title:"RIZORA Media Ad",description:"A short message from RIZORA.",videoUrl:"/assets/ads/rizora-video-ad.mp4",destinationUrl:"/"};}
var busy=false;
async function renderAd(){
  if(busy)return;
  var postForm=document.getElementById("postForm");
  if(!postForm)return;
  var host=postForm.parentElement&&postForm.parentElement.querySelector(".rz-feed");
  if(!host||host.getAttribute("data-rz-ads-rendered")==="1")return;
  busy=true;
  try{
    var d={};try{d=await adApi("/api/v2/ads");}catch(_){}
    var ad=(d.ads||[])[0]||houseVideoAd();
    host.setAttribute("data-rz-ads-rendered","1");
    var box=document.createElement("article");
    box.className="rz-card rz-rizora-ad";
    box.style.cssText="margin-bottom:14px;border:1px solid rgba(199,166,90,.24);background:linear-gradient(135deg,rgba(199,166,90,.08),rgba(255,255,255,.02));";
    var media="";
    if(ad.videoUrl)media='<div class="rz-rizora-ad-video-wrap"><video class="rz-rizora-ad-video" controls playsinline preload="metadata" poster="/rizora-cover.png" aria-label="RIZORA sponsored video"><source src="'+esc(safeUrl(ad.videoUrl))+'" type="video/mp4"></video><span aria-hidden="true">© RIZORA</span></div>';
    else if(ad.imageUrl)media='<img src="'+esc(safeUrl(ad.imageUrl))+'" alt="" loading="lazy" style="width:100%;max-height:280px;object-fit:cover;border-radius:14px;margin:10px 0">';
    box.innerHTML='<div class="rz-kicker">ADVERTISEMENT</div><div class="rz-post-head"><div><strong>'+esc(ad.advertiserName||"Business")+'</strong><div class="rz-mini">Sponsored on RIZORA</div></div></div>'+
      media+
      '<div class="rz-post-body"><strong>'+esc(ad.title||"Sponsored")+'</strong><div class="rz-muted" style="margin-top:5px">'+esc(ad.description||"")+'</div></div>'+
      '<div class="rz-actions"><a class="rz-btn primary" href="'+esc(safeUrl(ad.destinationUrl||"/"))+'" target="_blank" rel="noopener noreferrer sponsored">'+(ad.destinationUrl?"Visit business":"Explore RIZORA")+'</a></div>';
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

