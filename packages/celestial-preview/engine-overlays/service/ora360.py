"""ORA 360: durable, model-free, OS-first artifact/continuity laboratory.

Can mount beside the existing ORA Engine 0.2. Private endpoints require auth in
service.oraspace360; the store itself is never a credential verifier.
"""
from __future__ import annotations
from contextlib import contextmanager, closing
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from hashlib import sha256
from html import escape
from email.message import EmailMessage
from pathlib import Path
import json, re, secrets, sqlite3, threading, uuid

VERSION='ora.360/0.3'
SUPPORTED_VIEWS=('web','article','paper','app','svg','email','storyboard','api')
SEEDS={
 'ORA OS':('missions','generators','integrations','continuity'),
 'Space OS':('clock','coordinates','celestial projection','program'),
 'World OS':('geography','population','transport','simulation'),
 'Life OS':('clock straight','life events','birth credentials','recurrences'),
 'Events OS':('typed event','SSE','sources','replay'),
 'MUSES':('epic','historic','lyric','comic','kinetic'),
 'GLASS Academy':('curriculum','laboratory','research proof','university'),
 'GLASS OS':('Unison','compiler','operator','glyph','provenance'),
 'SUPER':('adapt','translate','test','realization'),
 'HOMELESS':('world contract','Mason walk','player','viewport'),
 'Courier':('email','baton','communication','outbox'),
 'Creator':('site','article','visualization','video','artifact'),
}
# Study-oriented tool contracts, not 100+ deceptive live integrations.
DOMAINS={
 'github':('repository','issue','pull_request','branch','commit'),
 'notion':('page','block','database','comment'),
 'slack':('conversation','message','thread','member'),
 'shopify':('product','variant','order','collection'),
 'email':('message','mailbox','draft','attachment'),
 'calendar':('event','invite','availability'),
 'publishing':('post','draft','tag','schedule'),
 'make':('scenario','module','blueprint'),
 'n8n':('workflow','node','execution'),
 'zapier':('zap','trigger','action'),
 'social':('post','profile','campaign','analytics'),
 'media':('original_score','timeline','licensed_asset'),
 'os':('ORA','machine','generator','artifact','baton'),
 'space':('orb','star','clock','world','trajectory'),
}
VERBS={
 'read':'OBSERVE','list':'OBSERVE','inspect':'OBSERVE','search':'OBSERVE',
 'draft':'PURE','structure':'PURE','calculate':'PURE','render':'PURE',
 'propose':'PROPOSE','review':'PROPOSE','approve':'AUTHORIZED',
 'create':'WRITE','update':'WRITE','send':'NETWORK_WRITE','publish':'NETWORK_WRITE',
 'delete':'DESTRUCTIVE','charge':'FINANCIAL',
}
KEYWORDS={
 'software':('code','developer','software','app','website','github'),
 'research':('research','experiment','science','math','paper','university'),
 'commerce':('store','shop','product','business','shopify'),
 'creative':('music','song','video','art','film','show','comedy'),
 'communication':('email','newsletter','message','outreach','social'),
 'world':('world','earth','people','homeless','travel','city'),
 'cosmos':('sky','star','space','celestial','planet','orbit'),
}

def now():return datetime.now(timezone.utc).isoformat(timespec='seconds')
def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def hash_of(x):return sha256(canonical(x).encode()).hexdigest()
def title_from(intent):
    words=re.findall(r'[\w\-]+',intent,flags=re.UNICODE)
    return ' '.join(words[:8])[:88] or 'Your ORA'
def classify(intent):
    t=intent.casefold()
    hits=[domain for domain,words in KEYWORDS.items() if any(w in t for w in words)]
    return hits or ['general']
def motif(intent):
    a=int(hash_of(intent)[:8],16)
    return {'seed':a,'phase':round(a%360/360,4),'orbit_count':max(3,min(12,len(classify(intent))*3))}
def concept(intent,seed=None):
    if not isinstance(intent,str) or not 5<=len(intent)<=4000:raise ValueError('intent must contain 5..4000 characters')
    domains=classify(intent);title=title_from(intent)
    steps=[{'id':'capture','output':'SOURCE','effect':'PURE','status':'READY','label':'Listen and identify'},
           {'id':'shape','output':'STRUCTURE','effect':'PURE','status':'READY','label':'Build its grammar'},
           {'id':'compose','output':'ARTIFACT','effect':'LOCAL_DRAFT','status':'READY','label':'Compose first artifact'},
           {'id':'review','output':'APPROVAL','effect':'OWNER_REVIEW','status':'AWAITING_GRANT','label':'Review and activate'}]
    return {'title':title,'intent':intent,'domains':domains,'steps':steps,'views':list(SUPPORTED_VIEWS),
            'motif':motif(intent),'status':'PREPARED','external_actions':0,'source':'USER_INTENT',
            'model_required':False,'admission':'BOUNDED_GENERATORS_ONLY'}

class Store:
    def __init__(self,path):
        self.path=str(path);Path(self.path).parent.mkdir(parents=True,exist_ok=True)
        self.lock=threading.RLock();self._init()
    def _conn(self):
        c=sqlite3.connect(self.path,timeout=8,isolation_level=None)
        c.row_factory=sqlite3.Row;c.execute('PRAGMA busy_timeout=8000')
        return c
    @contextmanager
    def tx(self):
        with self.lock,closing(self._conn()) as c:
            c.execute('BEGIN IMMEDIATE')
            try:yield c;c.commit()
            except BaseException:c.rollback();raise
    def _init(self):
        with closing(self._conn()) as c:
            c.executescript('''PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS objects(id TEXT PRIMARY KEY,ora_id TEXT NOT NULL,owner TEXT NOT NULL,intent TEXT NOT NULL,blueprint TEXT NOT NULL,state TEXT NOT NULL,revision INT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS anchors(id TEXT PRIMARY KEY,ora_id TEXT NOT NULL,owner TEXT NOT NULL,principal TEXT NOT NULL,scope TEXT NOT NULL,secret_hash TEXT NOT NULL,expiry TEXT NOT NULL,attached_at TEXT,status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS batons(id TEXT PRIMARY KEY,owner TEXT NOT NULL,ora_id TEXT NOT NULL,recipient TEXT NOT NULL,subject TEXT NOT NULL,state TEXT NOT NULL,revision INT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS records(seq INTEGER PRIMARY KEY AUTOINCREMENT,object_id TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,created TEXT NOT NULL,prev_hash TEXT NOT NULL,hash TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx360_object ON records(object_id,seq);''')
    def _event(self,c,oid,kind,body):
        r=c.execute('SELECT hash FROM records ORDER BY seq DESC LIMIT 1').fetchone()
        p=r['hash'] if r else '0'*64;ts=now()
        entry={'object_id':oid,'kind':kind,'body':body,'created':ts,'prev_hash':p}
        h=hash_of(entry)
        c.execute('INSERT INTO records(object_id,kind,body,created,prev_hash,hash) VALUES(?,?,?,?,?,?)',
                  (oid,kind,canonical(body),ts,p,h))
        return h
    def verify(self):
        with closing(self._conn()) as c:
            head='0'*64
            for r in c.execute('SELECT * FROM records ORDER BY seq'):
                body={'object_id':r['object_id'],'kind':r['kind'],'body':json.loads(r['body']),
                      'created':r['created'],'prev_hash':head}
                if r['prev_hash']!=head or r['hash']!=hash_of(body):return False
                head=r['hash']
        return True
    def events(self,after=0):
        with closing(self._conn()) as c:
            return [dict(r)|{'body':json.loads(r['body'])} for r in c.execute('SELECT * FROM records WHERE seq>? ORDER BY seq LIMIT 100',(after,))]
    def create(self,ora_id,intent,owner='owner'):
        blueprint=concept(intent);oid='real-'+uuid.uuid4().hex[:20];t=now()
        with self.tx() as c:
            c.execute('INSERT INTO objects VALUES (?,?,?,?,?,?,?,?,?)',
                     (oid,ora_id,owner,intent,canonical(blueprint),'PREPARED',1,t,t))
            self._event(c,oid,'REALIZATION_PREPARED',{'ora_id':ora_id,'domains':blueprint['domains'],'preview_hash':hash_of(blueprint)})
        return self.get(oid,owner)
    def get(self,oid,owner='owner'):
        with closing(self._conn()) as c:
            r=c.execute('SELECT * FROM objects WHERE id=? AND owner=?',(oid,owner)).fetchone()
            if not r:raise KeyError('not found')
            d=dict(r);d['blueprint']=json.loads(d['blueprint']);return d
    def list(self,owner='owner'):
        with closing(self._conn()) as c:
            rows=c.execute('SELECT id FROM objects WHERE owner=? ORDER BY created DESC LIMIT 100',(owner,))
            ids=[r['id'] for r in rows]
        return [self.get(i,owner) for i in ids]
    def approve(self,oid,revision,owner='owner'):
        with self.tx() as c:
            r=c.execute('SELECT * FROM objects WHERE id=? AND owner=?',(oid,owner)).fetchone()
            if not r:raise KeyError('not found')
            if r['revision']!=revision:raise ValueError('stale revision')
            if r['state']!='PREPARED':raise ValueError('already realized')
            c.execute('UPDATE objects SET state=?,revision=revision+1,updated=? WHERE id=?',('REALIZED_LOCAL',now(),oid))
            self._event(c,oid,'OWNER_APPROVED_LOCAL',{'revision':revision+1,'network_effects':0})
        return self.get(oid,owner)
    def anchor(self,ora_id,principal,scope='review-code',ttl_minutes=120,owner='owner'):
        if not isinstance(principal,str) or not re.fullmatch('[a-zA-Z0-9._:-]{3,100}',principal):raise ValueError('principal identifier required')
        if scope not in ('review-code','read-mission','propose-patch'):raise ValueError('unknown scope')
        if type(ttl_minutes)!=int or not 1<=ttl_minutes<=1440:raise ValueError('invalid expiry')
        aid='anchor-'+uuid.uuid4().hex[:20];secret=secrets.token_urlsafe(32)
        expiry=(datetime.now(timezone.utc)+timedelta(minutes=ttl_minutes)).isoformat()
        with self.tx() as c:
            c.execute('INSERT INTO anchors VALUES (?,?,?,?,?,?,?,?,?)',(aid,ora_id,owner,principal,scope,sha256(secret.encode()).hexdigest(),expiry,None,'OFFERED'))
            self._event(c,aid,'ANCHOR_OFFERED',{'ora_id':ora_id,'scope':scope,'principal':principal,'expiry':expiry})
        return {'id':aid,'ora_id':ora_id,'principal':principal,'scope':scope,'expiry':expiry,'status':'OFFERED',
                'one_time_secret':secret,'warning':'Send the secret only through a secure channel, not in the URL.'}
    def anchor_info(self,aid,public=True):
        with closing(self._conn()) as c:
            r=c.execute('SELECT * FROM anchors WHERE id=?',(aid,)).fetchone()
            if not r:raise KeyError('anchor missing')
            return {k:r[k] for k in ('id','ora_id','principal','scope','status','expiry')}
    def attach(self,aid,principal,secret):
        with self.tx() as c:
            r=c.execute('SELECT * FROM anchors WHERE id=?',(aid,)).fetchone()
            if not r:raise KeyError('anchor missing')
            if r['status']!='OFFERED':raise ValueError('anchor not offered')
            if datetime.fromisoformat(r['expiry'])<=datetime.now(timezone.utc):raise ValueError('anchor expired')
            if principal!=r['principal'] or not secrets.compare_digest(sha256(str(secret).encode()).hexdigest(),r['secret_hash']):raise PermissionError('authentication failed')
            c.execute('UPDATE anchors SET status=?,attached_at=? WHERE id=?',('ATTACHED',now(),aid))
            self._event(c,aid,'ANCHOR_ATTACHED',{'principal':principal,'scope':r['scope'],'session_bound':True})
        return self.anchor_info(aid)
    def baton(self,ora_id,recipient,subject,owner='owner'):
        if not isinstance(recipient,str) or len(recipient)<2 or len(recipient)>100:raise ValueError('recipient required')
        if not isinstance(subject,str) or len(subject)<5 or len(subject)>300:raise ValueError('subject required')
        bid='baton-'+uuid.uuid4().hex[:22]
        with self.tx() as c:
            c.execute('INSERT INTO batons VALUES (?,?,?,?,?,?,?,?)',(bid,owner,ora_id,recipient,subject,'OFFERED',1,now()))
            self._event(c,bid,'BATON_OFFERED',{'ora_id':ora_id,'recipient':recipient,'subject_sha256':hash_of(subject)})
        return self.baton_info(bid,owner)
    def baton_info(self,bid,owner='owner'):
        with closing(self._conn()) as c:
            r=c.execute('SELECT * FROM batons WHERE id=? AND owner=?',(bid,owner)).fetchone()
            if not r:raise KeyError('baton missing')
            return dict(r)
    def baton_preview(self,bid):
        with closing(self._conn()) as c:
            r=c.execute('SELECT * FROM batons WHERE id=?',(bid,)).fetchone()
            if not r:raise KeyError('baton missing')
            return {'id':bid,'state':r['state'],'version':r['revision'],'read_only':True,
                    'private_message':'REDACTED','has_unread_messages':'NOT_SUPPORTED'}


def render(blueprint,view):
    if view not in SUPPORTED_VIEWS:raise ValueError('unknown representation')
    title=blueprint['title'];intent=blueprint['intent'];domains=blueprint['domains']
    safe=escape(title);detail=escape(intent)
    if view=='web':
        return {'mime':'text/html','content':f'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{safe} | ORA 360</title><style>body{{background:#090f21;color:#f0e7db;font-family:Georgia,serif;max-width:760px;margin:12vh auto;padding:22px}}h1{{font-size:clamp(3rem,9vw,6rem);font-weight:400}}p{{color:#b9bcd5;font-size:1.3rem;line-height:1.7}}span{{color:#edb98a;letter-spacing:.3em;font:12px Arial}}</style><span>ORA 360 · PREPARED</span><h1>{safe}</h1><p>{detail}</p><p>Designed to be composed further · {escape(", ".join(domains))}</p></html>'}
    if view in ('article','paper'):
        content=f'# {title}\n\n**ORA 360 · {"Research paper draft" if view=="paper" else "Article draft"}**\n\n## Intent\n\n{intent}\n\n## Proposed Structure\n\n'
        content+='\n'.join(f'{i}. {x["label"]} ({x["status"]})' for i,x in enumerate(blueprint['steps'],1))
        content+='\n\n## Evidence and Limitations\n\nThis is a generated scaffold. Independent sources, citations, original research, and review are required.\n'
        return {'mime':'text/markdown','content':content}
    if view=='email':
        mail=EmailMessage();mail['Subject']='Regarding '+title
        mail.set_content(f'Hello,\n\nI am exploring: {intent}\n\nI would welcome a conversation about this.\n\nBest regards,\n[Your name]\n')
        return {'mime':'message/rfc822','content':mail.as_string()}
    if view=='svg':
        return {'mime':'image/svg+xml','content':f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 380" role="img" aria-label="Abstract ORA composition"><rect width="680" height="380" fill="#071226"/><circle cx="340" cy="180" r="94" fill="#333e70" stroke="#d9b48f" stroke-width="2"/><circle cx="340" cy="180" r="19" fill="#ffe1aa"/><path d="M70 170Q340 -40 610 170Q340 370 70 170Z" fill="none" stroke="#b9a0d9" opacity=".6"/><text x="340" y="340" text-anchor="middle" font-family="serif" font-size="24" fill="#ede7ed">{safe}</text></svg>'}
    if view=='app':
        return {'mime':'application/json','content':canonical({'kind':'ora.app-scaffold/0.3','title':title,'routes':['/','/inspect','/review'],'events':['START','PROPOSE','WITNESS'],'source':blueprint['source'],'status':'SCAFFOLD_ONLY'})}
    if view=='storyboard':
        return {'mime':'application/json','content':canonical({'kind':'ora.storyboard/0.3','title':title,'scenes':[{'duration':5,'action':s['label'],'visual':'celestial trajectory','audio':'UNGENERATED'} for s in blueprint['steps']],'renders_video':False})}
    return {'mime':'application/json','content':canonical({'schema':'ora.360.api/0.3','routes':['GET /o/{id}','GET /api/v1/360/objects/{id}'],'source_intent':intent,'requires_auth':True})}


def connector_contracts():
    return {'providers':[{ 'id':provider,'nouns':list(nouns),'verbs':list(VERBS),
                            'state':'CONTRACT_ONLY','network_access':False} for provider,nouns in DOMAINS.items()],
            'known_provider_count':len(DOMAINS), 'primitive_verbs':VERBS,
            'claim':'Schemas for discovering/adapting tools, not authenticated integrations'}

SENSITIVE_KEYS=frozenset(('token','access_token','refresh_token','password','authorization','secret','client_secret','api_key','apikey','credentials','cookie'))

def study_workflow(provider,blueprint):
    """Compile sanitized third-party workflow exports to ORA typed proposals.

    No execution, token import, provider-wide compatibility, or silent translation.
    Exports with embedded credential fields fail closed: redact before submission.
    """
    if provider not in ('n8n','make','zapier'):raise ValueError('unsupported workflow provider')
    if not isinstance(blueprint,dict) or len(canonical(blueprint))>200_000:raise ValueError('workflow size/type')
    def inspect(v):
        if isinstance(v,dict):
            for k,x in v.items():
                if k.casefold() in SENSITIVE_KEYS:raise ValueError('credential fields may not be imported')
                inspect(x)
        elif isinstance(v,list):
            for x in v:inspect(x)
    inspect(blueprint)
    if provider=='n8n':nodes=blueprint.get('nodes',[])
    elif provider=='make':nodes=blueprint.get('flow',[])
    else:nodes=blueprint.get('steps',[])
    if not isinstance(nodes,list) or not 1<=len(nodes)<=100:raise ValueError('1..100 workflow nodes required')
    out=[]
    for i,node in enumerate(nodes):
        if not isinstance(node,dict):raise ValueError('node object required')
        type_id=str(node.get('type') or node.get('module') or node.get('action') or 'UNKNOWN')[:90]
        # Safe read-only types are only proposed here: mapped semantics must pass fixtures.
        recognized=any(x in type_id.casefold() for x in ('webhook','set','noop','manualtrigger','schedule','interval','filter','transform'))
        out.append({'id':str(node.get('id',i))[:80],'source_type':type_id,
                    'status':'NEEDS_MAPPING_FIXTURES' if recognized else 'UNSUPPORTED_NODE',
                    'effect':'PROPOSAL_ONLY','requires_provider_connection':True})
    return {'schema':'ora.workflow-import/0.3','source':provider,'status':'PROPOSED_NOT_EXECUTED',
            'source_hash':hash_of(blueprint),'nodes':out,'network_calls':0,'credentials_imported':False}
