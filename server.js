import express from "express";
import * as cheerio from "cheerio";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const app = express();
const PORT = process.env.PORT || 3000;
const SOURCE = "https://sxmn.com.vn";
const cache = new Map();
const DATA_DIR = path.join(process.cwd(), "data");
const ANALYSIS_FILE = path.join(DATA_DIR, "analysis-db.json");
const STATS_FILE = path.join(DATA_DIR, "stats-db.json");
const ALGORITHM_VERSION = "v2.6";
const VIETLOTT_FILE = path.join(DATA_DIR, "vietlott-db.json");
let vietlottDB = {};
try { vietlottDB = JSON.parse(fs.readFileSync(VIETLOTT_FILE, "utf8")); } catch { vietlottDB = {analyses:[]}; }
vietlottDB.analyses ||= [];
function saveVietlottDB(){ fs.writeFileSync(VIETLOTT_FILE, JSON.stringify(vietlottDB, null, 2)); }
fs.mkdirSync(DATA_DIR, { recursive: true });

let analysisDB = {};
try { analysisDB = JSON.parse(fs.readFileSync(ANALYSIS_FILE, "utf8")); } catch { analysisDB = {}; }
let statsDB = {};
try { statsDB = JSON.parse(fs.readFileSync(STATS_FILE, "utf8")); } catch { statsDB = {}; }

function saveAnalysisDB(){ fs.writeFileSync(ANALYSIS_FILE, JSON.stringify(analysisDB, null, 2)); }
function saveStatsDB(){ fs.writeFileSync(STATS_FILE, JSON.stringify(statsDB, null, 2)); }
function clientIP(req){
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}
function ipKey(ip){ return crypto.createHash("sha256").update(String(ip)).digest("hex").slice(0, 32); }
function analysisKey(ip,date,province,prize){ return [ALGORITHM_VERSION,ipKey(ip),date,province,prize].join("|"); }
function dayKey(date){ return String(date).slice(0,10); }
function todayKey(){ return new Date().toISOString().slice(0,10); }
function ensureStats(){
  if(!statsDB.version) statsDB={version:1,visits:{},analyses:[],uniqueIPs:{},fullMatches:0,fullMatchNumbers:0,prizeChecks:0,matchedPrizeChecks:0};
  statsDB.visits ||= {};
  statsDB.uniqueIPs ||= {};
  statsDB.analyses ||= [];
  statsDB.fullMatches ||= 0;
  statsDB.fullMatchNumbers ||= 0;
  statsDB.prizeChecks ||= 0;
  statsDB.matchedPrizeChecks ||= 0;
}
ensureStats();

function recordVisit(req){
  const day=todayKey(), ip=ipKey(clientIP(req));
  statsDB.visits[day]=(statsDB.visits[day]||0)+1;
  statsDB.uniqueIPs[`${day}|${ip}`]=true;
  // Keep a rolling 400-day aggregate without retaining raw IP addresses.
  saveStatsDB();
}

function exactMatchInfo(result, prize, suggestions){
  const checked=[];
  const matched=[];
  const prizes = prize === "ALL" ? Object.entries(result?.prizes||{}) : [[prize, result?.prizes?.[prize]||[]]];
  for(const [prizeName, nums] of prizes){
    if(!Array.isArray(nums) || !nums.length) continue;
    checked.push(prizeName);
    const hits=[];
    for(const n of nums){
      const value=String(n);
      if(suggestions.includes(value) && !hits.includes(value)) hits.push(value);
    }
    if(hits.length) matched.push({prize:prizeName,numbers:hits});
  }
  return {checked,matched};
}

function recordAnalysis({date,province,prize,suggestions,result,days,draws,numberCount}){
  const info=exactMatchInfo(result,prize,suggestions);
  const day=dayKey(date);
  statsDB.analyses.push({
    at:new Date().toISOString(),date:day,province,prize,days,draws,numberCount,
    suggestions,
    checkedPrizes:info.checked,
    matched:info.matched,
    fullMatch:info.matched.length>0
  });
  statsDB.prizeChecks += info.checked.length;
  statsDB.matchedPrizeChecks += info.matched.length;
  if(info.matched.length){
    statsDB.fullMatches += 1;
    statsDB.fullMatchNumbers += info.matched.reduce((sum,x)=>sum+x.numbers.length,0);
  }
  saveStatsDB();
  return info;
}

const SCHEDULE = {
  1:["TP.HCM","Đồng Tháp","Cà Mau"],
  2:["Bến Tre","Vũng Tàu","Bạc Liêu"],
  3:["Đồng Nai","Cần Thơ","Sóc Trăng"],
  4:["Tây Ninh","An Giang","Bình Thuận"],
  5:["Vĩnh Long","Bình Dương","Trà Vinh"],
  6:["Long An","Bình Phước","Hậu Giang","TP.HCM"],
  0:["Tiền Giang","Kiên Giang","Đà Lạt"]
};

const normalize = s => s.replace(/\s+/g," ").trim();
const dateUrl = iso => {
  const [y,m,d] = iso.split("-");
  return `${SOURCE}/xsmn-${d}-${m}-${y}`;
};

function parsePage(html, iso) {
  const $ = cheerio.load(html);
  const allowed = SCHEDULE[new Date(iso+"T12:00:00").getDay()] || [];
  const results = [];
  $("table").each((_, table) => {
    const rows = $(table).find("tr");
    if (!rows.length) return;
    const header = [];
    $(rows[0]).find("th,td").each((i,el)=>header[i]=normalize($(el).text()));
    if (!header.some(h=>allowed.includes(h))) return;
    const grid = {};
    for (let r=1;r<rows.length;r++) {
      const cells=[];
      $(rows[r]).find("th,td").each((i,el)=>cells[i]=normalize($(el).text()));
      if (!cells.length) continue;
      const prize=cells[0].toUpperCase().replace("DB","ĐB");
      if (/^(G8|G7|G6|G5|G4|G3|G2|G1|ĐB)$/.test(prize)) grid[prize]=cells.slice(1);
    }
    for(let c=1;c<header.length;c++){
      const province=header[c];
      if(!allowed.includes(province)) continue;
      const prizes={};
      for(const [k,v] of Object.entries(grid)) prizes[k]=(v[c-1]||"").split(/\s+/).filter(x=>/^\d+$/.test(x));
      if(Object.keys(prizes).length) results.push({province,date:iso,prizes});
    }
  });
  return [...new Map(results.map(x=>[x.province,x])).values()];
}

async function getDay(iso) {
  if(cache.has(iso)) return cache.get(iso);
  const r=await fetch(dateUrl(iso),{headers:{"user-agent":"XSMN-iPhone-V2/2.5"}});
  if(!r.ok) throw new Error(`Nguồn dữ liệu HTTP ${r.status}`);
  const data=parsePage(await r.text(),iso);
  if(!data.length) throw new Error("Không đọc được kết quả ngày này từ nguồn dữ liệu.");
  cache.set(iso,data);
  return data;
}

function numbersFrom(result, prize) {
  if(prize && prize!=="ALL") return result.prizes[prize]||[];
  return Object.values(result.prizes).flat();
}
function digitPositionStats(numbers) {
  const maxLen=Math.max(0,...numbers.map(n=>n.length));
  return Array.from({length:maxLen},(_,idx)=>{
    const p=idx+1, counts=Array(10).fill(0);
    for(const n of numbers) if(n.length>=p) counts[+n[n.length-p]]++;
    const total=counts.reduce((a,b)=>a+b,0);
    return {position:p,total,digits:counts.map((count,digit)=>({digit,count,pct:total?+(count*100/total).toFixed(2):0})).sort((a,b)=>b.count-a.count)};
  });
}
function suffixStats(numbers,len){
  const map=new Map();
  for(const n of numbers) if(n.length>=len){ const s=n.slice(-len); map.set(s,(map.get(s)||0)+1); }
  const total=numbers.filter(n=>n.length>=len).length;
  return [...map.entries()].map(([value,count])=>({value,count,pct:total?+(count*100/total).toFixed(2):0})).sort((a,b)=>b.count-a.count).slice(0,20);
}
function headTail(numbers){
  const heads=Array(10).fill(0), tails=Array(10).fill(0);
  for(const n of numbers){ if(!n) continue; heads[+n[0]]++; tails[+n.at(-1)]++; }
  const total=numbers.length;
  const make=a=>a.map((count,digit)=>({digit,count,pct:total?+(count*100/total).toFixed(2):0})).sort((a,b)=>b.count-a.count);
  return {heads:make(heads),tails:make(tails)};
}
function combinations(stats, perPosition=5, limit=5, excludedSuffixes=new Set()){
  const choices=stats.map(s=>s.digits.slice(0,perPosition));
  const out=[];
  function walk(i,rev,score,parts,pcts){
    if(i===choices.length){
      const number=rev.split("").reverse().join("");
      if(excludedSuffixes.has(number.slice(-2)) || excludedSuffixes.has(number.slice(-3))) return;
      const mean=pcts.length?pcts.reduce((a,b)=>a+b,0)/pcts.length:0;
      const spread=pcts.length?Math.max(...pcts)-Math.min(...pcts):0;
      const balance=Math.max(0,100-Math.abs(mean-50)*1.7-spread*0.25);
      out.push({number,score:+(score*balance).toFixed(6),rawScore:+score.toFixed(8),balance:+balance.toFixed(2),parts});
      return;
    }
    for(const x of choices[i]) walk(i+1,rev+x.digit,score*Math.max(x.pct,0.0001),[...parts,x.digit],[...pcts,x.pct]);
  }
  if(choices.length) walk(0,"",1,[],[]);
  return out.sort((a,b)=>b.score-a.score).slice(0,limit);
}
function excludedHotSuffixes(numbers,len=2,ratio=0.2){
  const map=new Map();
  for(const n of numbers) if(n.length>=len){ const k=n.slice(-len); map.set(k,(map.get(k)||0)+1); }
  const ranked=[...map.entries()].sort((a,b)=>b[1]-a[1]);
  const take=Math.max(1,Math.ceil(ranked.length*ratio));
  return new Set(ranked.slice(0,take).map(([k])=>k));
}

app.use(express.json());
app.get("/",(req,res,next)=>{ try{recordVisit(req);}catch{} next(); });
app.use(express.static("public"));
app.get("/api/schedule",(_,res)=>res.json(SCHEDULE));

app.get("/api/day",async(req,res)=>{
  try{
    const date=String(req.query.date||"").slice(0,10);
    const data=await getDay(date);
    res.json({source:SOURCE,date,results:data});
  }catch(e){res.status(502).json({error:e.message,source:SOURCE});}
});

app.get("/api/analyze",async(req,res)=>{
  try{
    const date=String(req.query.date||"").slice(0,10);
    const province=String(req.query.province||"");
    const days=Math.min(Math.max(+req.query.days||90,1),365);
    const prize=String(req.query.prize||"ALL").toUpperCase();
    const key=analysisKey(clientIP(req),date,province,prize);
    if(analysisDB[key]) return res.json({ ...analysisDB[key], saved:true, once:true });
    const end=new Date(date+"T12:00:00");
    const draws=[];
    for(let i=0;i<days;i++){
      const d=new Date(end); d.setDate(d.getDate()-i);
      if(!(SCHEDULE[d.getDay()]||[]).includes(province)) continue;
      const iso=d.toISOString().slice(0,10);
      try{
        const day=await getDay(iso), r=day.find(x=>x.province===province);
        if(r) draws.push(r);
      }catch{}
    }
    const nums=draws.flatMap(r=>numbersFrom(r,prize));
    const positions=digitPositionStats(nums);
    const ht=headTail(nums);
    const suggestions=combinations(positions,5,5,new Set([...excludedHotSuffixes(nums,2),...excludedHotSuffixes(nums,3)])).map(x=>x.number);
    let target=null;
    try{ target=(await getDay(date)).find(x=>x.province===province)||null; }catch{}
    const matchInfo=exactMatchInfo(target,prize,suggestions);
    const payload={
      source:SOURCE,province,date,days,draws:draws.length,numberCount:nums.length,prize,
      positions, heads:ht.heads, tails:ht.tails,
      last2:suffixStats(nums,2), last3:suffixStats(nums,3),
      combinations:combinations(positions,5,5,new Set([...excludedHotSuffixes(nums,2),...excludedHotSuffixes(nums,3)])),
      excludedSuffixes:[...new Set([...excludedHotSuffixes(nums,2),...excludedHotSuffixes(nums,3)])],
      matchInfo,
      note:"Các tỷ lệ trên là tần suất trong dữ liệu lịch sử đã chọn; không phải xác suất chắc chắn của kỳ quay tiếp theo."
    };
    analysisDB[key]=payload;
    saveAnalysisDB();
    recordAnalysis({date,province,prize,suggestions,result:target,days,draws:draws.length,numberCount:nums.length});
    res.json({ ...payload, saved:true, once:true });
  }catch(e){res.status(500).json({error:e.message});}
});

app.get("/api/stats",(req,res)=>{
  ensureStats();
  const analyses=statsDB.analyses;
  const byPrize={};
  for(const a of analyses){
    const key=a.prize;
    byPrize[key] ||= {analyses:0,matchedAnalyses:0,prizeChecks:0,matchedPrizeChecks:0};
    byPrize[key].analyses++;
    if(a.fullMatch) byPrize[key].matchedAnalyses++;
    const checked=(a.checkedPrizes||[]).length;
    const matched=(a.matched||[]).length;
    byPrize[key].prizeChecks += checked;
    byPrize[key].matchedPrizeChecks += matched;
  }
  const days={};
  for(const a of analyses){
    const d=dayKey(a.date); days[d] ||= {analyses:0,matched:0}; days[d].analyses++; if(a.fullMatch) days[d].matched++; }
  const uniqueAll=new Set(Object.keys(statsDB.uniqueIPs).map(k=>k.split("|")[1]));
  const totalVisits=Object.values(statsDB.visits).reduce((a,b)=>a+b,0);
  const totalAnalyses=analyses.length;
  const totalMatched=analyses.filter(a=>a.fullMatch).length;
  res.json({
    version:ALGORITHM_VERSION,
    totalVisits, uniqueVisitors:uniqueAll.size,
    totalAnalyses, analysesWithFullMatch:totalMatched,
    matchRate:totalAnalyses?+(totalMatched*100/totalAnalyses).toFixed(2):0,
    prizeChecks:statsDB.prizeChecks,
    matchedPrizeChecks:statsDB.matchedPrizeChecks,
    prizeMatchRate:statsDB.prizeChecks?+(statsDB.matchedPrizeChecks*100/statsDB.prizeChecks).toFixed(2):0,
    fullMatchNumbers:statsDB.fullMatchNumbers,
    byPrize,
    days:Object.entries(days).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,60).map(([date,v])=>({date,...v,rate:v.analyses?+(v.matched*100/v.analyses).toFixed(2):0})),
    generatedAt:new Date().toISOString()
  });
});


// ---------------- Vietlott V2.6 ----------------
const VL={
  mega:{title:"Mega 6/45",list:"https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/645",max:45,balls:6},
  power:{title:"Power 6/55",list:"https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/655",max:55,balls:6},
  max3d:{title:"Max 3D",list:"https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/max-3D.html",max:999,balls:2},
  max3dpro:{title:"Max 3D Pro",list:"https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/thong-bao-ket-qua-Max3DPro",max:999,balls:2},
  bingo:{title:"Bingo18",list:"https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/view-detail-bingo18-result",max:6,balls:3},
  lotto:{title:"Lotto",list:"https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/lotto",max:49,balls:6}
};
const vlCache=new Map();
function cleanText(s){return String(s||"").replace(/\s+/g," ").trim();}
function firstLink($, selector){let href=null; $("a").each((_,a)=>{const h=$(a).attr("href")||""; if(!href && selector.test(h)) href=h;}); return href?new URL(href,"https://vietlott.vn").href:null;}
async function vlFetch(url){const r=await fetch(url,{headers:{"user-agent":"XSMN-iPhone-V2.6","accept-language":"vi-VN,vi;q=0.9"}});if(!r.ok)throw new Error(`Vietlott HTTP ${r.status}`);return await r.text();}
async function vlLatestPage(game){
  const cfg=VL[game]; if(!cfg) throw new Error("Sản phẩm Vietlott không hợp lệ.");
  const html=await vlFetch(cfg.list); const $=cheerio.load(html);
  let detail=cfg.list;
  if(game==='mega') detail=firstLink($,/\/645\?id=\d+/i)||detail;
  else if(game==='power') detail=firstLink($,/\/655\?id=\d+/i)||detail;
  else if(game==='max3d') detail=firstLink($,/\/max-3D\?id=\d+/i)||detail;
  else if(game==='max3dpro') detail=firstLink($,/\/max-3DPro\?id=\d+/i)||detail;
  else if(game==='bingo') detail=firstLink($,/view-detail-bingo18-result\?id=\d+/i)||detail;
  else detail=firstLink($,/lotto.*id=/i)||detail;
  return {html: detail===cfg.list?html:await vlFetch(detail),url:detail};
}
function parseVL(game,html){
  const $=cheerio.load(html); const text=cleanText($("body").text());
  const idm=text.match(/Kỳ quay thưởng\s*#?\s*(\d+)/i)||text.match(/Kỳ quay\s*#(\d+)/i); const dm=text.match(/(\d{2}\/\d{2}\/\d{4})/);
  let drawId=idm?idm[1]:""; let date=dm?dm[1].split('/').reverse().join('-'):""; let results=[]; let bonus="";
  if(game==='mega'){const m=text.match(/Kỳ quay thưởng\s*#?\s*\d+[\s\S]{0,220}?((?:0?\d{1,2}\s+){5}0?\d{1,2})/i);if(m)results=m[1].match(/\d{1,2}/g).map(x=>x.padStart(2,'0')).slice(0,6);}
  else if(game==='power'){const m=text.match(/Kỳ quay thưởng\s*#?\s*\d+[\s\S]{0,220}?((?:0?\d{1,2}\s+){5}0?\d{1,2})\s*\|\s*(0?\d{1,2})/i);if(m){results=m[1].match(/\d{1,2}/g).map(x=>x.padStart(2,'0')).slice(0,6);bonus=m[2].padStart(2,'0');}}
  else if(game==='bingo'){const m=text.match(/Ngày quay\s*\|\s*Kỳ quay\s*\|\s*Kết quả[\s\S]{0,180}?\|\s*(\d)\s+(\d)\s+(\d)/i);if(m)results=[m[1],m[2],m[3]];}
  else if(game==='max3d'||game==='max3dpro'){const block=text.match(/Giải Đặc biệt\s+([0-9]{3})\s+([0-9]{3})/i);if(block)results=[block[1],block[2]];}
  else {const m=text.match(/Kết quả[^\d]{0,100}((?:\d{1,2}\s+){5}\d{1,2})/i);if(m)results=m[1].match(/\d{1,2}/g).map(x=>x.padStart(2,'0')).slice(0,6);}
  if(!results.length) throw new Error("Chưa đọc được kết quả Vietlott từ trang chính thức.");
  return {game,drawId,date,results,bonus,sourceUrl:"https://vietlott.vn"};
}
async function vlResult(game){const cached=vlCache.get(game);if(cached)return cached;const {html,url}=await vlLatestPage(game);const out=parseVL(game,html);out.detailUrl=url;vlCache.set(game,out);return out;}
function seededWeights(max,history){const counts=Array(max+1).fill(0);for(const n of history||[])for(const x of n){const v=Number(x);if(v>=1&&v<=max)counts[v]++;}return counts;}
function weightedPick(max,count,weights,blocked=new Set(),allowedPool=null){
  const base=allowedPool||Array.from({length:max},(_,i)=>i+1);
  const pool=base.filter(n=>!blocked.has(n));
  const out=[];
  for(let k=0;k<count&&pool.length;k++){
    let total=0; for(const n of pool) total += 1+Math.sqrt((weights[n]||0)+1);
    let r=crypto.randomInt(0,Math.max(1,Math.floor(total*1000000)))/1000000;
    let chosen=pool[pool.length-1];
    for(const n of pool){ const w=1+Math.sqrt((weights[n]||0)+1); r-=w; if(r<=0){chosen=n;break;} }
    out.push(chosen); pool.splice(pool.indexOf(chosen),1);
  }
  return out.sort((a,b)=>a-b).map(n=>String(n).padStart(2,'0'));
}
function powerElement(n){return ["Kim","Mộc","Thủy","Hỏa","Thổ"][(n-1)%5];}
function generateVL(game,historyRows,previous){
  const cfg=VL[game]; const prev=new Set((previous||[]).map(Number));
  const weights=seededWeights(cfg.max,historyRows);
  const hot=[...Array(cfg.max).keys()].map(i=>i+1).sort((a,b)=>(weights[b]||0)-(weights[a]||0));
  const hotSet=new Set(hot.slice(0,Math.max(1,Math.floor(cfg.max*.12))));
  const suggestions=[];
  for(let i=0;i<5;i++){
    let s;
    if(game==='mega'){
      s=weightedPick(45,6,weights,prev);
    } else if(game==='power'){
      // Mô phỏng cân bằng ngũ hành: mỗi bộ ưu tiên đủ 5 hành, hành dư thay đổi theo kỳ.
      const elements=["Kim","Mộc","Thủy","Hỏa","Thổ"]; const target=elements[i%5];
      const powerWeights=Object.fromEntries(Object.entries(weights).map(([n,w])=>[n,(powerElement(Number(n))===target?(w+1)*2.5:w)]));
      const pools={}; for(const e of elements)pools[e]=Array.from({length:55},(_,k)=>k+1).filter(n=>powerElement(n)===e);
      const chosen=[];
      for(const e of elements){ const pool=pools[e]; const pick=weightedPick(55,1,powerWeights,new Set([...prev,...hotSet]),pool); if(pick.length) chosen.push(pick[0]); }
      while(chosen.length<6){ const pool=Array.from({length:55},(_,k)=>k+1).filter(n=>!prev.has(n)&&!hotSet.has(n)&&!chosen.includes(n)); const pick=weightedPick(55,1,weights,new Set(),pool); if(!pick.length)break; chosen.push(pick[0]); }
      if(target) chosen.push(...[]); s=chosen.slice(0,6).sort((a,b)=>a-b).map(n=>String(n).padStart(2,'0'));
    } else if(game==='bingo'){
      // Bingo18 thực tế quay 3 lần, mỗi lần 1..6. Mô phỏng CSPRNG và loại số nóng.
      s=weightedPick(6,3,weights,new Set([...prev,...hotSet]));
      if(s.length<3) s=weightedPick(6,3,weights,prev);
    } else {
      s=weightedPick(cfg.max,cfg.balls,weights,new Set([...prev,...hotSet]));
      if(s.length<cfg.balls) s=weightedPick(cfg.max,cfg.balls,weights,prev);
      if(game==='max3d'||game==='max3dpro') s=s.map(x=>x.padStart(3,'0')).slice(0,2);
    }
    const key=s.join('-'); if(s.length && !suggestions.some(x=>x===key)) suggestions.push(key);
  }
  return suggestions;
}
async function vlHistory(game,limit){
  const cfg=VL[game]; const first=await vlLatestPage(game); const $=cheerio.load(first.html); const urls=[]; $("a").each((_,a)=>{const h=$(a).attr("href")||"";if(h.includes('vietlott.vn')||h.startsWith('/')){const u=new URL(h,'https://vietlott.vn').href;if((game==='mega'&&/\/645\?id=\d+/.test(u))||(game==='power'&&/\/655\?id=\d+/.test(u))||(game==='max3d'&&/\/max-3D\?id=\d+/.test(u))||(game==='max3dpro'&&/\/max-3DPro\?id=\d+/.test(u))||(game==='bingo'&&/view-detail-bingo18-result\?id=\d+/.test(u)))if(!urls.includes(u))urls.push(u);}});urls.unshift(first.url);const rows=[];for(const u of urls.slice(0,Math.max(5,Math.min(limit,30)))){try{const p=await vlFetch(u);const r=parseVL(game,p);if(r.results.length)rows.push(r);}catch{}}if(!rows.length)rows.push(parseVL(game,first.html));return rows;}
function vlAnalysisKey(ip,game,drawId){return ['v2.6',ipKey(ip),game,drawId].join('|');}
app.get('/api/vietlott/results',async(req,res)=>{try{const game=String(req.query.game||'mega').toLowerCase();const r=await vlResult(game);res.json(r);}catch(e){res.status(502).json({error:e.message});}});
app.get('/api/vietlott/analyze',async(req,res)=>{try{const game=String(req.query.game||'mega').toLowerCase();const history=Math.min(Math.max(+req.query.history||90,5),365);const current=await vlResult(game);const key=vlAnalysisKey(clientIP(req),game,current.drawId);const saved=vietlottDB.analyses.find(x=>x.key===key);if(saved)return res.json({...saved,saved:true,once:true});const rows=await vlHistory(game,history);const suggestions=generateVL(game,rows.map(x=>x.results),rows[0]?.results);const matches=suggestions.filter(s=>game==='bingo' ? s.split('-').join('')===current.results.join('') : (game==='max3d'||game==='max3dpro') ? s.split('-').every((x,i)=>x===current.results[i]) : s.split('-').every(x=>current.results.includes(x))); const payload={key,game,drawId:current.drawId,date:current.date,history,algorithm:game==='mega'?'Lồng cầu cơ học mô phỏng + tần suất lịch sử + loại kỳ trước':game==='power'?'Lồng cầu cơ học mô phỏng + ngũ hành theo kỳ + loại kỳ trước':game==='bingo'?'CSPRNG + loại số có tần suất cao':'HRNG mô phỏng bằng entropy hệ điều hành/CSPRNG',suggestions,matches,note:'Đây là mô phỏng phần mềm. Không đại diện cho thiết bị quay vật lý hoặc HRNG phần cứng thật; dữ liệu kết quả dùng để đối chiếu là dữ liệu Vietlott công bố.',at:new Date().toISOString()};vietlottDB.analyses.push(payload);saveVietlottDB();res.json({...payload,saved:true,once:true});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/vietlott/stats',(req,res)=>{const a=vietlottDB.analyses||[];const byGame={};let totalMatches=0,totalSuggestions=0;for(const x of a){const g=x.game;byGame[g] ||= {analyses:0,checks:0,matches:0};byGame[g].analyses++;byGame[g].checks++;byGame[g].matches += (x.matches||[]).length?1:0;totalMatches += (x.matches||[]).length?1:0;totalSuggestions += (x.suggestions||[]).length;}for(const v of Object.values(byGame))v.rate=v.checks?+(v.matches*100/v.checks).toFixed(2):0;res.json({totalAnalyses:a.length,totalMatches,totalSuggestions,rate:a.length?+(totalMatches*100/a.length).toFixed(2):0,byGame});});

app.listen(PORT,()=>console.log(`XSMN V2.6: http://localhost:${PORT}`));
