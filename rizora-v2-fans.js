"use strict";

function ensureFans(db){
  db.rzV2 = db.rzV2 || {};
  db.rzV2.tips = db.rzV2.tips || [];
  db.notifications = db.notifications || [];
  db.rzV2.transactions = db.rzV2.transactions || [];
}

function clean(ctx,value,max){
  return ctx.cleanString(value == null ? "" : value, max);
}

function currentUser(ctx,db,req){
  return ctx.getCurrentUser(db,req);
}

function findCreator(db,key){
  const q=String(key||"").trim().replace(/^@/,"").toLowerCase();
  if(!q) return null;
  return (db.users||[]).find(function(u){
    return String(u.id||"").toLowerCase()===q ||
      String(u.username||"").toLowerCase()===q ||
      String(u.publicUsername||"").toLowerCase()===q;
  }) || null;
}

function paystackConfigured(){
  return !!String(process.env.PAYSTACK_SECRET_KEY||"").trim();
}

async function paystackRequest(path,body){
  const secret=String(process.env.PAYSTACK_SECRET_KEY||"").trim();
  if(!secret) throw new Error("Paystack is not configured on the RIZORA server yet.");
  const response=await fetch("https://api.paystack.co"+path,{
    method:"POST",
    headers:{
      Authorization:"Bearer "+secret,
      "Content-Type":"application/json"
    },
    body:body ? JSON.stringify(body) : undefined
  });
  let data={};
  try{ data=await response.json(); }catch(_){}
  return {response,data};
}

async function readBody(req){
  let raw="";
  for await(const chunk of req){
    raw += chunk.toString();
    if(raw.length>500000) throw new Error("Request body too large.");
  }
  return raw ? JSON.parse(raw) : {};
}

function creatorView(db,user){
  const p=(db.creatorProfiles&&db.creatorProfiles[user.id])||{};
  return {
    id:user.id,
    username:user.username,
    publicUsername:user.publicUsername||user.username,
    displayName:user.displayName||user.username,
    avatarUrl:p.avatarUrl||user.avatarUrl||"/rizora-cover.png",
    verified:user.verified===true||user.verificationStatus==="verified",
    official:user.official===true
  };
}

function notify(db,userId,title,message){
  if(!userId) return;
  db.notifications.push({
    id:"notif_"+Date.now().toString(36)+Math.random().toString(36).slice(2,8),
    userId:userId,
    title:title,
    message:message,
    type:"support",
    read:false,
    createdAt:new Date().toISOString()
  });
}

function tipStatusView(tip,db){
  const sender=(db.users||[]).find(function(u){return u.id===tip.senderId;});
  const creator=(db.users||[]).find(function(u){return u.id===tip.creatorId;});
  return {
    id:tip.id,
    reference:tip.reference,
    amountNaira:Number(tip.amountNaira||0),
    currency:tip.currency||"NGN",
    note:tip.note||"",
    status:tip.status||"pending",
    settlementStatus:tip.settlementStatus||"platform_settlement_pending",
    createdAt:tip.createdAt,
    updatedAt:tip.updatedAt||tip.createdAt,
    sender:sender?creatorView(db,sender):null,
    creator:creator?creatorView(db,creator):null
  };
}

function summaryFor(db,user){
  const mine=(db.rzV2.tips||[]).filter(function(t){
    return t.senderId===user.id || t.creatorId===user.id;
  }).slice().sort(function(a,b){
    return new Date(b.createdAt)-new Date(a.createdAt);
  });
  let sentTotal=0,receivedTotal=0,sentCount=0,receivedCount=0;
  mine.forEach(function(t){
    if(t.status!=="success") return;
    if(t.senderId===user.id){sentTotal+=Number(t.amountNaira||0);sentCount++;}
    if(t.creatorId===user.id){receivedTotal+=Number(t.amountNaira||0);receivedCount++;}
  });
  return {
    sentTotalNaira:Math.round(sentTotal*100)/100,
    receivedTotalNaira:Math.round(receivedTotal*100)/100,
    sentCount,
    receivedCount,
    recent:mine.slice(0,30).map(function(t){return tipStatusView(t,db);})
  };
}

function blockedNote(value){
  const patterns=[
    /\bporn(?:ography)?\b/i,/\bxxx\b/i,/\bnudes?\b/i,/\berotic\b/i,
    /\bsex(?:ual)?\s*(?:work|service|services)\b/i,/\bonlyfans\b/i,
    /\bescort\b/i
  ];
  return patterns.some(function(re){return re.test(String(value||"").normalize("NFKC"));});
}

async function handleRizoraFans(ctx){
  const db=ctx.db,req=ctx.req,res=ctx.res;
  const method=String(req.method||"GET").toUpperCase();
  const url=new URL(req.url,"http://rizora.local");
  const path=url.pathname;
  ensureFans(db);

  if(path==="/api/v2/tips/mine"&&method==="GET"){
    const user=currentUser(ctx,db,req);
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    ctx.sendJSON(res,200,{success:true,summary:summaryFor(db,user)});
    return true;
  }

  if(path==="/api/v2/tips/creator"&&method==="GET"){
    const user=currentUser(ctx,db,req);
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const creator=findCreator(db,url.searchParams.get("username")||url.searchParams.get("creator"));
    if(!creator){ctx.sendError(res,404,"Creator not found.");return true;}
    const total=(db.rzV2.tips||[]).filter(function(t){return t.creatorId===creator.id&&t.status==="success";}).reduce(function(sum,t){return sum+Number(t.amountNaira||0);},0);
    const count=(db.rzV2.tips||[]).filter(function(t){return t.creatorId===creator.id&&t.status==="success";}).length;
    ctx.sendJSON(res,200,{success:true,creator:creatorView(db,creator),support:{totalNaira:Math.round(total*100)/100,count:count}});
    return true;
  }

  if(path==="/api/v2/tips/initialize"&&method==="POST"){
    const user=currentUser(ctx,db,req);
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    let body;
    try{body=await readBody(req);}catch(e){ctx.sendError(res,400,e.message);return true;}

    const creator=findCreator(db,body.creator||body.username);
    if(!creator){ctx.sendError(res,404,"Creator not found.");return true;}
    if(creator.id===user.id){ctx.sendError(res,400,"You cannot support your own creator account.");return true;}
    if(creator.status&&creator.status!=="active"){ctx.sendError(res,400,"That creator account is not available for support.");return true;}

    const amount=Number(body.amountNaira);
    if(!Number.isFinite(amount)||amount<100||amount>1000000){
      ctx.sendError(res,400,"Support amount must be between ₦100 and ₦1,000,000.");
      return true;
    }
    const note=clean(ctx,body.note,240);
    if(blockedNote(note)){ctx.sendError(res,422,"That support note is not allowed.");return true;}
    if(!paystackConfigured()){ctx.sendError(res,503,"Creator Support is not configured yet.");return true;}
    const email=String(user.email||"").trim();
    if(!email||email.indexOf("@")<1){ctx.sendError(res,400,"Add a valid email to your RIZORA account before sending support.");return true;}

    const reference=ctx.uid("tip_");
    let ps;
    try{
      ps=await paystackRequest("/transaction/initialize",{
        email:email,
        amount:String(Math.round(amount*100)),
        currency:"NGN",
        reference:reference,
        metadata:JSON.stringify({
          type:"creator_tip",
          senderId:user.id,
          creatorId:creator.id,
          note:note
        }),
        callback_url:String(process.env.RIZORA_PAYMENT_CALLBACK||"https://rizora.com.ng/")
      });
    }catch(e){
      ctx.sendError(res,502,e.message);
      return true;
    }
    if(!ps.response.ok||!ps.data.status){
      ctx.sendError(res,502,ps.data.message||"Unable to initialize Creator Support payment.");
      return true;
    }

    const now=new Date().toISOString();
    const tip={
      id:ctx.uid("tip_record_"),
      reference:String(ps.data.data.reference||reference),
      senderId:user.id,
      creatorId:creator.id,
      amountNaira:amount,
      currency:"NGN",
      note:note,
      status:"pending",
      settlementStatus:"platform_settlement_pending",
      authorizationUrl:ps.data.data.authorization_url||"",
      paystackAccessCode:ps.data.data.access_code||"",
      paystackId:null,
      createdAt:now,
      updatedAt:now
    };
    db.rzV2.tips.push(tip);
    db.rzV2.transactions.push({
      id:ctx.uid("tx_"),
      userId:user.id,
      type:"creator_tip",
      reference:tip.reference,
      amountNaira:amount,
      currency:"NGN",
      status:"pending",
      creatorId:creator.id,
      description:"Creator Support for @"+String(creator.publicUsername||creator.username),
      createdAt:now,
      updatedAt:now
    });
    ctx.saveDB(db);
    ctx.sendJSON(res,201,{
      success:true,
      authorizationUrl:tip.authorizationUrl,
      reference:tip.reference,
      tip:tipStatusView(tip,db),
      settlementNotice:"Creator Support payments currently settle to the RIZORA merchant account. Automatic creator payouts require separate payout configuration."
    });
    return true;
  }

  const verify=path.match(/^\/api\/v2\/tips\/verify\/([^/]+)$/);
  if(verify&&method==="GET"){
    const user=currentUser(ctx,db,req);
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const reference=decodeURIComponent(verify[1]);
    const tip=db.rzV2.tips.find(function(t){return t.reference===reference&&t.senderId===user.id;});
    if(!tip){ctx.sendError(res,404,"Support payment reference not found.");return true;}
    if(!paystackConfigured()){ctx.sendError(res,503,"Creator Support is not configured yet.");return true;}
    let ps;
    try{ps=await paystackRequest("/transaction/verify/"+encodeURIComponent(reference),null);}catch(e){ctx.sendError(res,502,e.message);return true;}
    if(!ps.response.ok||!ps.data.status){ctx.sendError(res,502,ps.data.message||"Unable to verify Creator Support payment.");return true;}
    const data=ps.data.data||{};
    const status=String(data.status||"").toLowerCase();
    tip.status=status==="success"?"success":status==="failed"?"failed":"pending";
    tip.paystackId=data.id||tip.paystackId||null;
    tip.updatedAt=new Date().toISOString();
    const tx=db.rzV2.transactions.find(function(t){return t.reference===tip.reference;});
    if(tx){tx.status=tip.status;tx.paystackId=tip.paystackId;tx.updatedAt=tip.updatedAt;}
    if(tip.status==="success"&&!tip.notified){
      notify(db,tip.senderId,"Creator Support sent","Your ₦"+Number(tip.amountNaira).toLocaleString()+" support payment was confirmed.");
      notify(db,tip.creatorId,"You received Creator Support","A creator supporter sent ₦"+Number(tip.amountNaira).toLocaleString()+" to your RIZORA creator account.");
      tip.notified=true;
    }
    ctx.saveDB(db);
    ctx.sendJSON(res,200,{success:true,status:tip.status,tip:tipStatusView(tip,db),settlementNotice:"Payment settlement remains on the RIZORA merchant account until creator payout configuration is enabled."});
    return true;
  }

  return false;
}

module.exports={handleRizoraFans};