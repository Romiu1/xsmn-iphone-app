from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import sqlite3, json, os, csv, io, zipfile, hashlib, time
from datetime import datetime

ROOT=os.path.dirname(os.path.abspath(__file__))
DB=os.path.join(ROOT,'stats.sqlite3')
TOKEN=os.environ.get('STATS_COLLECTOR_TOKEN','change-me')
HOST=os.environ.get('HOST','0.0.0.0'); PORT=int(os.environ.get('PORT','8787'))

def db():
    c=sqlite3.connect(DB)
    c.execute('''CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, at TEXT NOT NULL, type TEXT NOT NULL, product TEXT, day TEXT, visitor_hash TEXT, payload TEXT NOT NULL)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_events_day ON events(day)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_events_product ON events(product)')
    c.commit(); return c

def add_event(e):
    eid=str(e.get('id') or hashlib.sha256((json.dumps(e,sort_keys=True)+str(time.time_ns())).encode()).hexdigest())
    at=str(e.get('at') or datetime.utcnow().isoformat()+'Z')
    day=at[:10]; typ=str(e.get('type','event')); product=str(e.get('product',''))
    vh=str(e.get('visitor_hash','')); payload=json.dumps(e,ensure_ascii=False,separators=(',',':'))
    c=db(); c.execute('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?,?)',(eid,at,typ,product,day,vh,payload)); c.commit(); c.close()

def stats(days=30):
    c=db(); rows=c.execute('SELECT id,at,type,product,day,visitor_hash,payload FROM events ORDER BY at').fetchall(); c.close()
    visits=[r for r in rows if r[2]=='visit']; analyses=[r for r in rows if r[2]=='analysis']
    def payload(r):
        try:return json.loads(r[6])
        except:return {}
    matches=sum(1 for r in analyses if payload(r).get('fullMatch') or payload(r).get('matched'))
    by={}
    for r in rows:
        p=r[3] or 'xsmn'; v=by.setdefault(p,{'visits':0,'uniqueVisitors':set(),'analyses':0,'matches':0})
        if r[2]=='visit':v['visits']+=1; v['uniqueVisitors'].add(r[5])
        elif r[2]=='analysis':v['analyses']+=1; q=payload(r); 
        if r[2]=='analysis' and (payload(r).get('fullMatch') or payload(r).get('matched')):v['matches']+=1
    daily=[]
    for i in range(days):
        import datetime as dt
        d=(dt.date.today()-dt.timedelta(days=i)).isoformat(); rr=[r for r in rows if r[4]==d]
        vv=[r for r in rr if r[2]=='visit']; aa=[r for r in rr if r[2]=='analysis']; mm=[r for r in aa if payload(r).get('fullMatch') or payload(r).get('matched')]
        daily.append({'date':d,'visits':len(vv),'uniqueVisitors':len({r[5] for r in vv if r[5]}),'analyses':len(aa),'matches':len(mm),'rate':round(len(mm)*100/len(aa),2) if aa else 0})
    for v in by.values(): v['uniqueVisitors']=len(v['uniqueVisitors']); v['rate']=round(v['matches']*100/v['analyses'],2) if v['analyses'] else 0
    return {'totalVisits':len(visits),'totalUniqueVisitors':len({r[5] for r in visits if r[5]}),'totalAnalyses':len(analyses),'totalMatches':matches,'rate':round(matches*100/len(analyses),2) if analyses else 0,'byProduct':by,'days':daily}

class H(BaseHTTPRequestHandler):
    def send(self,code,obj,ctype='application/json'):
        b=obj if isinstance(obj,bytes) else (json.dumps(obj,ensure_ascii=False).encode() if ctype=='application/json' else str(obj).encode())
        self.send_response(code); self.send_header('Content-Type',ctype+'; charset=utf-8'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def auth(self): return self.headers.get('X-Stats-Token','')==TOKEN
    def do_POST(self):
        if not self.auth(): return self.send(401,{'error':'Unauthorized'})
        n=int(self.headers.get('Content-Length','0')); raw=self.rfile.read(n)
        try: obj=json.loads(raw or b'{}')
        except: return self.send(400,{'error':'Invalid JSON'})
        if self.path=='/api/event': add_event(obj); return self.send(200,{'ok':True})
        if self.path=='/api/events':
            arr=obj if isinstance(obj,list) else obj.get('events',[])
            for e in arr:add_event(e)
            return self.send(200,{'ok':True,'count':len(arr)})
        if self.path=='/api/restore':
            data=obj.get('events',[]) if isinstance(obj,dict) else []
            for e in data:add_event(e)
            return self.send(200,{'ok':True,'count':len(data)})
        return self.send(404,{'error':'Not found'})
    def do_GET(self):
        if self.path.startswith('/api/stats'):
            if not self.auth(): return self.send(401,{'error':'Unauthorized'})
            return self.send(200,stats())
        if self.path.startswith('/api/backup'):
            if not self.auth(): return self.send(401,{'error':'Unauthorized'})
            c=db(); rows=c.execute('SELECT payload FROM events ORDER BY at').fetchall(); c.close()
            data={'format':'so-do-stats-v1','createdAt':datetime.utcnow().isoformat()+'Z','events':[json.loads(x[0]) for x in rows]}
            return self.send(200,data)
        if self.path.startswith('/api/export.csv'):
            if not self.auth(): return self.send(401,{'error':'Unauthorized'})
            c=db(); rows=c.execute('SELECT id,at,type,product,day,visitor_hash,payload FROM events ORDER BY at').fetchall(); c.close()
            s=io.StringIO(); w=csv.writer(s); w.writerow(['id','at','type','product','day','visitor_hash','payload']); w.writerows(rows)
            return self.send(200,s.getvalue(),'text/csv')
        if self.path=='/': return self.send(200,'''<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sổ Đỏ - Statistics Collector</title><h2>Statistics Collector</h2><p>SQLite: stats.sqlite3</p><p><a href="/api/backup">Backup JSON</a> (cần token)</p><p>API đang chạy.</p>''','text/html')
        return self.send(404,{'error':'Not found'})

if __name__=='__main__':
    db(); print(f'Statistics Collector: http://127.0.0.1:{PORT}'); ThreadingHTTPServer((HOST,PORT),H).serve_forever()
