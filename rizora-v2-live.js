"use strict";

function ensureLive(db){
  db.liveSessions = db.liveSessions || [];
  db.creatorCoins = db.creatorCoins || [];
  db.walletTransactions = db.walletTransactions || [];
  db.gifts = db.gifts || [];
}

function uid(prefix){
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2,8);
}

function safeString(v,max){
  return String(v || "").trim().slice(0,max || 200);
}

function coinAccount(db,userId){
  let account=db.creatorCoins.find(x=>x.userId===userId);

  if(!account){
    account={
      userId,
      coins:0,
      updatedAt:new Date().toISOString()
    };

    db.creatorCoins.push(account);
  }

  return account;
}

function addCoins(db,userId,amount,type){
  const account=coinAccount(db,userId);

  account.coins+=Number(amount);
  account.updatedAt=new Date().toISOString();

  db.walletTransactions.push({
    id:uid("wallet"),
    userId,
    amount:Number(amount),
    type,
    createdAt:new Date().toISOString()
  });

  return account;
}

async function handleRizoraLive(ctx){

  const {
    req,
    res,
    db,
    saveDB,
    getCurrentUser,
    sendJSON,
    sendError
  }=ctx;


  ensureLive(db);

  const url=new URL(req.url,"http://localhost");
  const path=url.pathname;
  const method=req.method;

  const user=getCurrentUser(db,req);


  if(path==="/api/v2/live/status" && method==="GET"){

    const liveUsers=db.liveSessions.filter(x=>x.active).map(x=>({
      userId:x.userId,
      username:x.username
    }));

    return sendJSON(res,200,{
      success:true,
      online:true,
      liveCount:liveUsers.length,
      liveUsers
    });

  }


  if(path==="/api/v2/live/start" && method==="POST"){

    if(!user){
      return sendError(res,401,"Authentication required.");
    }

    const live={
      id:uid("live"),
      userId:user.id,
      username:user.username,
      startedAt:new Date().toISOString(),
      active:true,
      viewers:0
    };


    db.liveSessions.push(live);

    saveDB(db);


    return sendJSON(res,200,{
      success:true,
      live
    });

  }



  if(path==="/api/v2/live/end" && method==="POST"){

    if(!user){
      return sendError(res,401,"Authentication required.");
    }


    const live=db.liveSessions.find(
      x=>x.userId===user.id && x.active
    );


    if(live){

      live.active=false;
      live.endedAt=new Date().toISOString();


      const minutes=Math.max(
        1,
        Math.floor(
          (Date.now()-new Date(live.startedAt))/60000
        )
      );


      addCoins(
        db,
        user.id,
        minutes,
        "live_time_reward"
      );

    }


    saveDB(db);


    return sendJSON(res,200,{
      success:true
    });

  }



  if(path==="/api/v2/live/gift" && method==="POST"){

    if(!user){
      return sendError(res,401,"Authentication required.");
    }


    let body="";

    for await(const chunk of req){
      body+=chunk;
    }


    const data=JSON.parse(body || "{}");


    const creatorId=safeString(data.creatorId,100);
    const amount=Number(data.amount || 0);


    if(!creatorId || amount<=0){
      return sendError(res,400,"Invalid gift.");
    }


    const gift={
      id:uid("gift"),
      from:user.id,
      to:creatorId,
      amount,
      createdAt:new Date().toISOString()
    };


    db.gifts.push(gift);


    addCoins(
      db,
      creatorId,
      amount,
      "gift_received"
    );


    saveDB(db);


    return sendJSON(res,200,{
      success:true,
      gift
    });

  }



  if(path==="/api/v2/wallet" && method==="GET"){

    if(!user){
      return sendError(res,401,"Authentication required.");
    }


    const account=coinAccount(db,user.id);


    return sendJSON(res,200,{
      success:true,
      coins:account.coins,
      transactions:
        db.walletTransactions.filter(
          x=>x.userId===user.id
        )
    });

  }



  if(path==="/api/v2/live/leaderboard" && method==="GET"){

    const leaderboard=
      db.creatorCoins
      .sort((a,b)=>b.coins-a.coins)
      .slice(0,50);


    return sendJSON(res,200,{
      success:true,
      leaderboard
    });

  }


  return false;
}


module.exports={
  handleRizoraLive
};



