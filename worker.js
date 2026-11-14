const TARGET = 70000;
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status, headers:{"Content-Type":"application/json; charset=utf-8", ...headers}});
function cors(request, env) {
  const origin=request.headers.get("Origin")||"";
  const allowed=(env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);
  const ok=allowed.includes(origin);
  return {"Access-Control-Allow-Origin":ok?origin:"null","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
}
function validId(v){return typeof v==="string" && /^[a-zA-Z0-9-]{8,80}$/.test(v)}
function cityFromRequest(request){
 const cf=request.cf||{};
 return [cf.city,cf.region,cf.country].filter(Boolean).join(", ").slice(0,100)||null;
}
async function touchPresence(env,visitorId,request,name=null){
 const city=cityFromRequest(request);
 const displayName=typeof name==="string"?name.trim().replace(/\\s+/g," ").slice(0,40):"";
 if(city) await env.DB.prepare("INSERT INTO salawath_presence(visitor_id,display_name,city,last_seen) VALUES(?,?,?,datetime('now')) ON CONFLICT(visitor_id) DO UPDATE SET display_name=COALESCE(NULLIF(excluded.display_name,''),salawath_presence.display_name),city=COALESCE(excluded.city,salawath_presence.city),last_seen=datetime('now')").bind(visitorId,displayName||null,city).run();
 else await env.DB.prepare("INSERT INTO salawath_presence(visitor_id,display_name,last_seen) VALUES(?,?,datetime('now')) ON CONFLICT(visitor_id) DO UPDATE SET display_name=COALESCE(NULLIF(excluded.display_name,''),salawath_presence.display_name),last_seen=datetime('now')").bind(visitorId,displayName||null).run();
}
export default {
 async fetch(request,env){
  const h=cors(request,env);
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:h});
  const url=new URL(request.url), path=url.pathname;
  try {
   if(path==="/api/health") return json({ok:true,target:TARGET},200,h);
   if(path==="/api/tap" && request.method==="POST"){
    const b=await request.json(); if(!validId(b.visitorId)||!Number.isInteger(b.amount)||b.amount<1||b.amount>10000)return json({error:"invalid_input"},400,h);
    await env.DB.prepare("INSERT INTO salawath_events(visitor_id,amount) VALUES(?,?)").bind(b.visitorId,b.amount).run();
    await env.DB.prepare("UPDATE salawath_totals SET total=total+? WHERE id=1").bind(b.amount).run();
    const row=await env.DB.prepare("SELECT total FROM salawath_totals WHERE id=1").first();
    await touchPresence(env,b.visitorId,request,b.name);
    return json({ok:true,total:row?.total||0,target:TARGET},200,h);
   }
   if(path==="/api/heartbeat" && request.method==="POST"){
    const b=await request.json();if(!validId(b.visitorId))return json({error:"invalid_input"},400,h);
    await touchPresence(env,b.visitorId,request,b.name);
    return json({ok:true,city:cityFromRequest(request)},200,h);
   }
   if(path==="/api/location" && request.method==="POST"){
    const b=await request.json();if(!validId(b.visitorId)||!Number.isFinite(b.lat)||!Number.isFinite(b.lon)||Math.abs(b.lat)>90||Math.abs(b.lon)>180)return json({error:"invalid_input"},400,h);
    const geo=await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat="+encodeURIComponent(b.lat)+"&lon="+encodeURIComponent(b.lon),{headers:{"User-Agent":"YaseenisSalawath/1.0 contact: admin@yaseenis.com","Accept-Language":"en"}});
    if(!geo.ok)return json({error:"geocoding_failed"},502,h);
    const g=await geo.json(), a=g.address||{}, city=a.city||a.town||a.village||a.municipality||a.county||"Unknown city", region=a.state||a.region||"";
    const label=[city,region].filter(Boolean).join(", ").slice(0,100);
    await env.DB.prepare("INSERT INTO salawath_presence(visitor_id,city,last_seen) VALUES(?,?,datetime('now')) ON CONFLICT(visitor_id) DO UPDATE SET city=excluded.city,last_seen=datetime('now')").bind(b.visitorId,label).run();
    return json({ok:true,city:label},200,h);
   }
   if(path==="/api/public/report" && request.method==="GET"){
    const total=await env.DB.prepare("SELECT total FROM salawath_totals WHERE id=1").first();
    const daily=await env.DB.prepare("SELECT COALESCE(SUM(amount),0) n,COUNT(*) events,COUNT(DISTINCT visitor_id) visitors FROM salawath_events WHERE date(created_at)=date('now')").first();
    const online=await env.DB.prepare("SELECT COUNT(*) n FROM salawath_presence WHERE last_seen>=datetime('now','-2 minutes')").first();
    const onlineVisitors=await env.DB.prepare("SELECT COALESCE(display_name,'பெயர் பதிவு செய்யவில்லை') name,COALESCE(city,'இடம் பகிரப்படவில்லை') city,last_seen lastSeen FROM salawath_presence WHERE last_seen>=datetime('now','-2 minutes') ORDER BY last_seen DESC LIMIT 20").all();
    const recentVisitors=await env.DB.prepare("SELECT COALESCE(display_name,'பெயர் பதிவு செய்யவில்லை') name,COALESCE(city,'இடம் பகிரப்படவில்லை') city,last_seen lastSeen FROM salawath_presence WHERE last_seen>=datetime('now','-1 day') ORDER BY last_seen DESC LIMIT 30").all();
    const cities=await env.DB.prepare("SELECT city,COUNT(*) count FROM salawath_presence WHERE city IS NOT NULL AND last_seen>=datetime('now','-1 day') GROUP BY city ORDER BY count DESC LIMIT 15").all();
    const topUsers=await env.DB.prepare("SELECT COALESCE(p.display_name,'பெயர் பதிவு செய்யவில்லை') name,SUM(e.amount) count FROM salawath_events e LEFT JOIN salawath_presence p ON p.visitor_id=e.visitor_id WHERE date(e.created_at)=date('now') GROUP BY e.visitor_id ORDER BY count DESC LIMIT 10").all();
    return json({total:total?.total||0,target:TARGET,daily:daily?.n||0,events:daily?.events||0,visitors:daily?.visitors||0,online:online?.n||0,onlineVisitors:onlineVisitors.results||[],recentVisitors:recentVisitors.results||[],cities:cities.results||[],topUsers:topUsers.results||[]},200,h);
   }
   return json({error:"not_found"},404,h);
  } catch(e){return json({error:"server_error",message:env.ENVIRONMENT==="development"?String(e):"Request failed"},500,h)}
 }
};
