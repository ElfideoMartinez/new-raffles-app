#!/usr/bin/env python3
"""Upload an editorial feed draft for review, never schedule or publish it."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.request

ROOT=Path(os.environ.get('UFC_REPO',Path(__file__).resolve().parents[2]))
ACCOUNT='gUi1o3IWQLG6ws6vHnYi'
WORKSPACE='tUp47gQT6TMIUL6JZYnK'

def draft_payload(text,media):
    return {'accounts':[ACCOUNT],'workspaceId':WORKSPACE,'draft':True,'text':text,'media':[media],
            'options':{'instagram':{'publishType':'post','postToGrid':True}}}

def envfile(name):
    values={}
    for line in (Path.home()/'.hermes/scripts'/name).read_text().splitlines():
        if '=' not in line or line.lstrip().startswith('#'):continue
        key,value=line.split('=',1)
        values[key.strip().removeprefix('export ')]=value.strip().strip('\"\'')
    return values

def request(url,method='GET',data=None,headers=None,raw=False):
    h=dict(headers or {})
    if data is not None and not raw:
        data=json.dumps(data).encode();h['Content-Type']='application/json'
    req=urllib.request.Request(url,data=data,method=method,headers=h)
    with urllib.request.urlopen(req,timeout=60) as res:return json.load(res)

def main():
    if len(sys.argv)!=2:raise RuntimeError('Usage: review-feed.py <weekly-manifest.json>')
    manifest_path=Path(sys.argv[1]).resolve();p=json.loads(manifest_path.read_text())
    feed=p.get('feed')
    if not feed:return
    receipt_path=manifest_path.parent/'feed-review.json'
    receipt=json.loads(receipt_path.read_text()) if receipt_path.exists() else {}
    key=envfile('.antwork.env')['ANTWORK_API_KEY']
    auth={'Authorization':'Bearer '+key}
    def aw(endpoint,method='GET',data=None,suffix=''):
        headers={**auth}
        if method!='GET':headers['Idempotency-Key']=hashlib.sha256((feed['id']+suffix).encode()).hexdigest()
        return request('https://antwork.io/api/v1'+endpoint,method,data,headers)
    if not receipt.get('postId'):
        file=ROOT/feed['path'];content=file.read_bytes()
        upload=aw('/media','POST',{'workspaceId':WORKSPACE,'upload':{'filename':file.name,'mimeType':'image/jpeg','size':len(content)}},'-upload')
        media=request(upload['uploadUrl'],'PUT',content,{'Content-Type':'image/jpeg'},True)
        inp=json.loads((file.parent/'input.json').read_text())
        caption=inp['caption']['text']+'\n\n'+inp['caption'].get('hashtags','')
        created=aw('/posts','POST',draft_payload(caption,media['url']),'-draft')
        post=created['posts'][0]
        if not post.get('id') or post.get('status') in ['rejected','failed']:raise RuntimeError('Draft refused: '+str(post))
        receipt={'postId':post['id'],'editUrl':post.get('editUrl') or f"https://antwork.io/workspace/{WORKSPACE}/compose?postId={post['id']}",'slot':feed['id']}
        receipt_path.write_text(json.dumps(receipt,indent=2)+'\n')
    # Read the exact target after creation; never infer draft status from POST response.
    verified=aw('/posts/'+receipt['postId'])
    target=verified.get('post',verified)
    if target.get('status')!='draft':raise RuntimeError('Expected draft; got '+str(target.get('status')))
    if target.get('accountId')!=ACCOUNT:raise RuntimeError('Unexpected account on draft')
    receipt['verifiedStatus']=target['status'];receipt['verifiedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    if not receipt.get('telegramMessageId'):
        tg=envfile('.ufc-telegram.env')
        text=f"Feed listo para revisión · {p['event']['name'] if p.get('event') else 'UFC'}\nPropuesto: {p['date']} 19:00 Chihuahua. Si ya pasó, publicar después de aprobar.\nBorrador, NO programado: {receipt['editUrl']}\nAprueba el contenido antes de programar. Historias de hoy: publicación manual; si pasó la 1 PM, puedes compartirlas esta tarde."
        result=request('https://api.telegram.org/bot'+tg['TELEGRAM_BOT_TOKEN']+'/sendMessage','POST',{'chat_id':tg.get('TELEGRAM_CHAT_ID','5262019985'),'text':text,'disable_web_page_preview':True})
        if not result.get('ok'):raise RuntimeError('Telegram feed review failed')
        receipt['telegramMessageId']=result['result']['message_id']
    receipt_path.write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt,indent=2))

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('Feed review FAILED: '+str(error),file=sys.stderr);sys.exit(1)
