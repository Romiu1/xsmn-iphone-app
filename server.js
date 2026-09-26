import express from "express";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;
const SOURCE = "https://sxmn.com.vn";
const cache = new Map();

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

function combinations(stats, perPosition=3, limit=20){
  const choices=stats.map(s=>s.digits.slice(0,perPosition));
  const out=[];
  function walk(i,rev,score,parts){
    if(i===choices.length){
      out.push({number:rev.split("").reverse().join(""),score:+score.toFixed(8),parts});
      return;
    }
    for(const x of choices[i]) walk(i+1,rev+x.digit,score*Math.max(x.pct,0.0001),[...parts,x.digit]);
  }
  if(choices.length) walk(0,"",1,[]);
  return out.sort((a,b)=>b.score-a.score).slice(0,limit);
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
    res.json({
      source:SOURCE,province,date,days,draws:draws.length,numberCount:nums.length,prize,
      positions, heads:ht.heads, tails:ht.tails,
      last2:suffixStats(nums,2), last3:suffixStats(nums,3),
      combinations:combinations(positions,3,20),
      note:"Các tỷ lệ trên là tần suất trong dữ liệu lịch sử đã chọn; không phải xác suất chắc chắn của kỳ quay tiếp theo."
    });
  }catch(e){res.status(500).json({error:e.message});}
});

app.listen(PORT,()=>console.log(`XSMN V2: http://localhost:${PORT}`));

// V3: server-side scraper for public result pages
app.get('/api/scrape', async (req, res) => {
  try {
    const target = String(req.query.url || '');
    if (!/^https?:\/\//i.test(target)) return res.status(400).json({error:'URL không hợp lệ'});
    const r = await fetch(target, {headers:{'User-Agent':'Mozilla/5.0 XSMN-Stats/3.0'}});
    if (!r.ok) return res.status(r.status).json({error:'Nguồn trả về HTTP '+r.status});
    const body = await r.text();
    const $ = cheerio.load(body);
    const out = [];
    $('td,th,span,div,p').each((_,el)=>{
      const ms = $(el).text().replace(/\s+/g,' ').match(/\b\d{2,6}\b/g)||[];
      for (const n of ms) if (!out.includes(n)) out.push(n);
    });
    const m = target.match(/(\d{2})[-_](\d{2})[-_](\d{4})/);
    const date = m ? `${m[3]}-${m[2]}-${m[1]}` : null;
    res.json({date,results:out});
  } catch(e) { res.status(500).json({error:e.message}); }
});
