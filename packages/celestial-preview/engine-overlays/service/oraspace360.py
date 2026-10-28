"""Launch ORA 0.2 plus ORA 360 and the new immersive ORASPACE static client.

Install as an additive module in akadaan310/ORA. Keeps all legacy endpoints.
python -m service.oraspace360 --web ../ORASPACE/web --db data/ora.sqlite3
Remote binding requires token + separately configured TLS/access proxy.
"""
from __future__ import annotations
import argparse, hmac, json, mimetypes, os, re, secrets
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from service.app import APIServer, Handler
from service.engine import Engine
from service.ora360 import Store, SEEDS, connector_contracts, render

class Server360(APIServer):
    def __init__(self,address,engine,web,token,store):
        self.store360=store
        super().__init__(address,engine,web,token)
        self.RequestHandlerClass=Handler360

class Handler360(Handler):
    def reply(self,status,value):
        return super().reply(status,value)
    def do_GET(self):
        p=urlsplit(self.path).path;store=self.server.store360
        if p in ('/app.js','/style.css','/scene.js','/space-sky.js','/gpu-water.js') or p.startswith('/assets/'):
            content=(self.server.web / p.lstrip('/'))
            if not content.resolve().is_relative_to(self.server.web.resolve()) or not content.is_file():return self.reply(404,{'error':'ASSET_NOT_FOUND'})
            body=content.read_bytes();ctype=('text/javascript; charset=utf-8' if p.endswith('.js') else 'text/css; charset=utf-8' if p.endswith('.css') else 'image/webp' if p.endswith('.webp') else 'application/octet-stream')
            self.send_response(200)
            for key,value in [('Content-Type',ctype),('Content-Length',str(len(body))),('X-Content-Type-Options','nosniff'),('Cache-Control','no-cache'),('Referrer-Policy','no-referrer')]:self.send_header(key,value)
            self.end_headers();self.wfile.write(body);return
        if p=='/api/v1/360/health':return self.reply(200,{'service':'ora.360/0.3','ok':True,'ledger_valid':store.verify(),'mode':'REFERENCE_NO_PROVIDER_CREDENTIALS'})
        if p=='/api/v1/360/catalog':return self.reply(200,{'seeds':[{ 'name':k,'capabilities':list(v),'state':'BLUEPRINT_ONLY'} for k,v in SEEDS.items()]})
        if p=='/api/v1/360/tools':return self.reply(200,connector_contracts())
        m=re.fullmatch(r'/o/(ora-[a-z0-9-]{4,72})/anchor/(anchor-[a-z0-9]{20})',p)
        if m:
            try:
                x=store.anchor_info(m.group(2));
                if x['ora_id']!=m.group(1):return self.reply(404,{'error':'NOT_FOUND'})
                return self.reply(200,{'schema':'ora.anchor/0.3','method':'READ_ONLY_GET','anchor':x,
                      'instruction':'Codex may inspect this manifest; to attach a session, use a separately provisioned credential and an authenticated POST. The URL does not grant rights.',
                      'attach_path':'/api/v1/360/anchors/'+m.group(2)+'/attach','secret_in_url':False})
            except KeyError:return self.reply(404,{'error':'NOT_FOUND'})
        m=re.fullmatch(r'/b/(baton-[a-z0-9]{22})/capsule',p)
        if m:
            try:return self.reply(200,store.baton_preview(m.group(1)))
            except KeyError:return self.reply(404,{'error':'NOT_FOUND'})
        if p.startswith('/api/v1/360/'):
            if not self.require_auth():return
            if p=='/api/v1/360/objects':return self.reply(200,{'objects':store.list()})
            if p=='/api/v1/360/events':
                try:after=int(parse_qs(urlsplit(self.path).query).get('after',['0'])[0]);assert after>=0
                except (ValueError,AssertionError):return self.reply(400,{'error':'INVALID_CURSOR'})
                return self.reply(200,{'events':store.events(after),'valid':store.verify()})
            m=re.fullmatch(r'/api/v1/360/objects/(real-[a-z0-9]{20})',p)
            if m:
                try:return self.reply(200,{'object':store.get(m.group(1))})
                except KeyError:return self.reply(404,{'error':'NOT_FOUND'})
            m=re.fullmatch(r'/api/v1/360/objects/(real-[a-z0-9]{20})/render/(web|article|paper|app|svg|email|storyboard|api)',p)
            if m:
                try:
                    obj=store.get(m.group(1));result=render(obj['blueprint'],m.group(2))
                    return self.reply(200,{'representation':m.group(2),'mime':result['mime'],'content':result['content'],'object_id':obj['id']})
                except KeyError:return self.reply(404,{'error':'NOT_FOUND'})
            m=re.fullmatch(r'/api/v1/360/anchors/(anchor-[a-z0-9]{20})',p)
            if m:
                try:return self.reply(200,{'anchor':store.anchor_info(m.group(1))})
                except KeyError:return self.reply(404,{'error':'NOT_FOUND'})
            m=re.fullmatch(r'/api/v1/360/batons/(baton-[a-z0-9]{22})',p)
            if m:
                try:return self.reply(200,{'baton':store.baton_info(m.group(1))})
                except KeyError:return self.reply(404,{'error':'NOT_FOUND'})
            return self.reply(404,{'error':'NOT_FOUND'})
        return super().do_GET()
    def do_POST(self):
        p=urlsplit(self.path).path;store=self.server.store360
        if not p.startswith('/api/v1/360/'):return super().do_POST()
        if not self.require_auth():return
        origin=self.headers.get('Origin')
        if origin and urlsplit(origin).netloc.casefold()!=self.headers.get('Host','').casefold():return self.reply(403,{'error':'ORIGIN_DENIED'})
        if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json':return self.reply(415,{'error':'JSON_REQUIRED'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 1<=size<=240_000:return self.reply(413,{'error':'PAYLOAD_LIMIT'})
            data=json.loads(self.rfile.read(size))
            if not isinstance(data,dict):raise ValueError('JSON object required')
            if p=='/api/v1/360/realize':
                intent=data.get('intent','')
                from service.ora360 import concept
                preview=concept(intent)
                # One governed ORA is actually created by the established ORA Engine.
                ora=self.server.engine.create(preview['title'],intent,placement='oracle')
                obj=store.create(ora['id'],intent)
                return self.reply(201,{'object':obj,'ora':ora})
            m=re.fullmatch(r'/api/v1/360/objects/(real-[a-z0-9]{20})/approve',p)
            if m:return self.reply(200,{'object':store.approve(m.group(1),data.get('revision'))})
            if p=='/api/v1/360/anchors':
                ora_id=data.get('ora_id','')
                if not self.server.engine.get(ora_id):return self.reply(404,{'error':'ORA_NOT_FOUND'})
                return self.reply(201,{'anchor':store.anchor(ora_id,data.get('principal',''),data.get('scope','review-code'),data.get('ttl_minutes',120))})
            m=re.fullmatch(r'/api/v1/360/anchors/(anchor-[a-z0-9]{20})/attach',p)
            if m:
                # A post is permitted only for the explicitly named principal and supplied
                # separate one-use secret. Session-based roles are future work.
                a=store.attach(m.group(1),data.get('principal'),data.get('secret'))
                return self.reply(200,{'anchor':a})
            if p=='/api/v1/360/batons':
                if not self.server.engine.get(data.get('ora_id','')):return self.reply(404,{'error':'ORA_NOT_FOUND'})
                return self.reply(201,{'baton':store.baton(data.get('ora_id'),data.get('recipient',''),data.get('subject',''))})
            return self.reply(404,{'error':'NOT_FOUND'})
        except PermissionError as e:return self.reply(403,{'error':'AUTH_FAILED','detail':str(e)})
        except KeyError as e:return self.reply(404,{'error':'NOT_FOUND','detail':str(e)})
        except (ValueError,TypeError,AssertionError,json.JSONDecodeError) as e:return self.reply(422,{'error':'INVALID_REQUEST','detail':str(e)})


def main():
    a=argparse.ArgumentParser()
    a.add_argument('--host',default='127.0.0.1');a.add_argument('--port',type=int,default=8767)
    a.add_argument('--db',default='data/ora.sqlite3');a.add_argument('--db360',default='data/ora360.sqlite3');a.add_argument('--web',default='../ORASPACE/web')
    args=a.parse_args()
    token=os.environ.get('ORA_ADMIN_TOKEN','')
    if args.host not in ('127.0.0.1','::1','localhost') and len(token)<32:raise SystemExit('Remote host requires ORA_ADMIN_TOKEN >=32 characters and HTTPS proxy')
    eng=Engine(args.db,worker=True);store=Store(args.db360);server=Server360((args.host,args.port),eng,args.web,token,store)
    print('ORA 360 READY http://%s:%s (reference, not publicly hosted)'%(args.host,args.port),flush=True)
    try:server.serve_forever(poll_interval=.2)
    except KeyboardInterrupt:pass
    finally:server.server_close();eng.shutdown()
if __name__=='__main__':main()
