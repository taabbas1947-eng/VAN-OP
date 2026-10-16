import json, glob, os, re, sys
HERE=os.path.dirname(os.path.abspath(__file__))
# Rebuilds SYSDOC_DATA inside apps/o2s/o2s.html from the JSON files in this folder.
# Run: python3 build_sysdoc.py   then run the O2S tests (tests/audit16a.test.js fails on gaps).
TABS=['flows','dataflows','logic','schema','api','decisions','guide','changelog','formulas','dictionary','access','tests']
D={}; problems=[]
OK={'p','list','table','lanes','states','note'}
for t in TABS:
    f=os.path.join(HERE,'%s.json'%t)
    if not os.path.exists(f): continue
    d=json.load(open(f))
    d['tab']=t; d['ver']='2026-10-16a'; d['date']='2026-10-16'; d['owner']='COO (Tahir)'
    for it in d.get('items',[]):
        for k in ('id','title'):
            if not it.get(k): problems.append((t,'missing '+k,it.get('id')))
        it.setdefault('owner','not confirmed'); it.setdefault('rules',[]); it.setdefault('src',[]); it.setdefault('blocks',[])
        if it.get('status') not in ('confirmed','not confirmed'): it['status']='not confirmed'
        if str(it.get('owner','')).strip().lower() in ('','not confirmed'): it['owner']='COO (Tahir), by default'
        if it['status']=='not confirmed' and not it.get('default'): it['default']='Kept exactly as the app does today and treated as accepted; nothing was built, removed or changed for it. Tahir to confirm or correct.'
        bl=[]
        for b in it['blocks']:
            ks=set(b.keys())
            if not (ks & OK): problems.append((t,'bad block',it['id'],list(ks))); continue
            bl.append(b)
        it['blocks']=bl
    D[t]=d

# 16a code review: the app page can be opened before sign-in, so no security weakness goes into it.
RISK=re.compile(r"S-0\d|S-1\d|security register|SECURITY.REGISTER|security item|no O2S role check|does not check the O2S role|password length is checked|default password|password hash|is public|SESSION_SECRET|overwrite all|can read the list of logins",re.I)
FINAL=re.compile(r"restart clears|password is right|jodilkah|HostGator|/home/claude|Any signed-in login|\bS-[01]\d\b|no O2S role check|does not check the O2S role|password length is checked|default password|password hash|is public|SESSION_SECRET|overwrite all|can read the list of logins",re.I)
SENT_RISK=re.compile(r"restart clears|only after the password is right|wrong password still|jodilkah|HostGator|can read the list of logins",re.I)
def clean(x):
    x=x.replace('/home/claude/src/','').replace('/home/claude/repo/','')
    x=re.sub(r"\bAny signed-in login\b","Signed in",x)
    if SENT_RISK.search(x):
        parts=re.split(r"(?<=[.;])\s+",x); keep=[q for q in parts if not SENT_RISK.search(q)]
        x=' '.join(keep)
    x=re.sub(r"^S-\d\d(?: in docs/SECURITY-REGISTER\.md)?(?: \([^)]*\))?:\s*","Known limit: ",x)
    x=re.sub(r"\s*\([^()]*\bS-\d\d\b[^()]*\)","",x)
    x=x.replace(" The server does not check the O2S role.","")
    return x
def san(o):
    if isinstance(o,str): return clean(o)
    if isinstance(o,list):
        out=[]
        for v in o:
            v=san(v)
            if isinstance(v,str) and RISK.search(v): continue
            if isinstance(v,dict) and any(isinstance(v.get(k),str) and RISK.search(v.get(k)) for k in ('p','note')): continue
            if isinstance(v,list) and any(isinstance(c,str) and RISK.search(c) for c in v): continue
            out.append(v)
        return out
    if isinstance(o,dict): return {k:san(v) for k,v in o.items()}
    return o
keep07=D.get('tests',{}).get('items',[])
D={t:san(d) for t,d in D.items()}
if 'tests' in D:
    for i,it in enumerate(D['tests']['items']):
        if it.get('id')=='TS-07':
            D['tests']['items'][i]={'id':'TS-07','title':'Security findings (kept outside the app)','owner':'Security department','rules':[],'status':'confirmed','src':['docs/SECURITY-REGISTER.md'],
              'blocks':[{'p':'Security findings are written to docs/SECURITY-REGISTER.md in the code repository, for the security department. They are not copied into the app, because the app page can be opened before anyone signs in. Security is not Tahir\u2019s job and never blocks an O2S release.'}]}
    D['tests']['intro']=re.sub(r",? and the security register\.?",". Security findings are kept outside the app (TS-07).",D['tests'].get('intro',''))
for t,d in D.items():
    for it in d.get('items',[]):
        if it.get('id')=='TS-07': continue
        def walk(o):
            if isinstance(o,str):
                if FINAL.search(o): problems.append((t,'security text left',it.get('id'),o[:120]))
            elif isinstance(o,list): [walk(v) for v in o]
            elif isinstance(o,dict): [walk(v) for v in o.values()]
        walk(it)
    if FINAL.search(d.get('intro','')): problems.append((t,'security text in intro'))
for t,d in D.items():
    js1=json.dumps(d,ensure_ascii=False)
    for bad in ('voidProdEntry(','Raw-material check'):
        if bad in js1: problems.append((t,'text that breaks a whole-file test',bad))
js=json.dumps(D,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
p=os.path.join(HERE,'..','..','o2s.html'); s=open(p).read()
a=s.index('/*SYSDOC_DATA_START*/'); b=s.index('/*SYSDOC_DATA_END*/')
s=s[:a]+'/*SYSDOC_DATA_START*/var SYSDOC_DATA='+js+';'+s[b:]
open(p,'w').write(s)
print('tabs',list(D.keys()),'bytes',len(js)); print('problems',problems[:20], len(problems))
if problems: sys.exit(1)
