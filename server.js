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
const ALGORITHM_VERSION = "v2.4.2";
fs.mkdirSync(DATA_DIR, { recursive: true });
let analysisDB = {};
try { analysisDB = JSON.parse(fs.readFileSync(ANALYSIS_FILE, "utf8")); } catch { analysisDB = {}; }
function saveAnalysisDB(){ fs.writeFileSync(ANALYSIS_FILE, JSON.stringify(analysisDB, null, 2)); }
function clientIP(req){
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}
function ipKey(ip){ return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32); }
function analysisKey(ip,date,province,prize){ return [ALGORITHM_VERSION,ipKey(ip),date,province,prize].join("|"); }

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
      for(const [k,v] of Object.entries(grid)){
        prizes[k]=(v[c-1]||"").split(/\s+/).filter(x=>/^\d+$/.test(x));
      }
      if(Object.keys(prizes).length) results.push({province,date:iso,prizes});
    }
  });
  return [...new Map(results.map(x=>[x.province,x])).values()];
}

async function getDay(iso) {
  if(cache.has(iso)) return cache.get(iso);
  const r=await fetch(dateUrl(iso),{headers:{"user-agent":"XSMN-iPhone-V2/2.0"}});
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
  for(const n of numbers) if(n.length>=len){
    const s=n.slice(-len);
    map.set(s,(map.get(s)||0)+1);
  }
  const total=numbers.filter(n=>n.length>=len).length;
  return [...map.entries()].map(([value,count])=>({value,count,pct:total?+(count*100/total).toFixed(2):0}))
    .sort((a,b)=>b.count-a.count).slice(0,20);
}

function headTail(numbers){
  const heads=Array(10).fill(0), tails=Array(10).fill(0);
  for(const n of numbers){ if(!n) continue; heads[+n[0]]++; tails[+n.at(-1)]++; }
  const total=numbers.length;
  const make=a=>a.map((count,digit)=>({digit,count,pct:total?+(count*100/total).toFixed(2):0})).sort((a,b)=>b.count-a.count);
  return {heads:make(heads),tails:make(tails)};
}

function combinations(stats, perPosition=5, limit=5, excludedSuffixes=new Set()){
  // Thuật toán điện toán: tạo toàn bộ tổ hợp từ 5 chữ số có tần suất cao nhất
  // ở từng vị trí, sau đó loại các bộ có đuôi lịch sử quá nổi bật và xếp hạng
  // theo điểm cân bằng. Đây chỉ là bộ lọc thống kê, không làm tăng xác suất trúng.
  const choices=stats.map(s=>s.digits.slice(0,perPosition));
  const out=[];
  function walk(i,rev,score,parts,pcts){
    if(i===choices.length){
      const number=rev.split("").reverse().join("");
      if(excludedSuffixes.has(number.slice(-2)) || excludedSuffixes.has(number.slice(-3))) return;
      const mean=pcts.length?pcts.reduce((a,b)=>a+b,0)/pcts.length:0;
      const spread=pcts.length?Math.max(...pcts)-Math.min(...pcts):0;
      // Ưu tiên bộ có mức tần suất vừa phải, tránh các bộ quá “nóng”.
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
    const payload={
      source:SOURCE,province,date,days,draws:draws.length,numberCount:nums.length,prize,
      positions, heads:ht.heads, tails:ht.tails,
      last2:suffixStats(nums,2), last3:suffixStats(nums,3),
      combinations:combinations(positions,5,5,new Set([...excludedHotSuffixes(nums,2),...excludedHotSuffixes(nums,3)])),
      excludedSuffixes:[...new Set([...excludedHotSuffixes(nums,2),...excludedHotSuffixes(nums,3)])],
      note:"Các tỷ lệ trên là tần suất trong dữ liệu lịch sử đã chọn; không phải xác suất chắc chắn của kỳ quay tiếp theo."
    };
    analysisDB[key]=payload;
    saveAnalysisDB();
    res.json({ ...payload, saved:true, once:true });
  }catch(e){res.status(500).json({error:e.message});}
});

app.listen(PORT,()=>console.log(`XSMN V2: http://localhost:${PORT}`));