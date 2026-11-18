#!/usr/bin/env python3
"""Prepare and auto-schedule feed slots >=6h ahead; native stories stay manual."""
import datetime as dt
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from zoneinfo import ZoneInfo
ROOT=Path(os.environ.get('UFC_REPO',Path(__file__).resolve().parents[2]))
ZONE=ZoneInfo('America/Chihuahua')

def week_dates(date):
    day=dt.date.fromisoformat(date)
    monday=day-dt.timedelta(days=day.weekday())
    return {name:(monday+dt.timedelta(days=offset)).isoformat() for name,offset in [('monday',0),('thursday',3),('friday',4)]}

def eligible_dates(now):
    instant=dt.datetime.fromisoformat(now.replace('Z','+00:00'))
    dates=week_dates(instant.astimezone(ZONE).date().isoformat())
    return [date for date in dates.values() if dt.datetime.fromisoformat(date+'T19:00:00').replace(tzinfo=ZONE)-instant>=dt.timedelta(hours=6)]

def run_json(node,script,*args):
    result=subprocess.run([node,script,*args],cwd=ROOT,capture_output=True,text=True)
    if result.returncode:
        detail=(result.stderr+'\\n'+result.stdout).strip()
        raise RuntimeError(f'{script} failed: {detail[-2500:]}')
    return json.loads(result.stdout)

def main():
    os.environ['PATH']='/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:'+os.environ.get('PATH','')
    node=shutil.which('node')
    if not node:raise RuntimeError('Node not found')
    now=dt.datetime.now(dt.timezone.utc)
    today=now.astimezone(ZONE).date().isoformat()
    gather=json.loads((ROOT/'fighters/_weekly-gather.json').read_text())
    if gather.get('partial'):raise RuntimeError('Partial research; feed auto-schedule blocked')
    event=gather['event']
    event_date=dt.date.fromisoformat(gather['eventDate'][:10])
    if event_date<now.astimezone(ZONE).date():raise RuntimeError('Stale gathered event; refresh before scheduling')
    if (event_date-now.astimezone(ZONE).date()).days>6:
        print('No event this week; automatic fight-week feed scheduling skipped.')
        return
    planned=[];dates=week_dates(today)
    for date in eligible_dates(now.isoformat()):
        if date==dates['friday']:
            result=run_json(node,'scripts/instagram/card-carousel.mjs','--event='+event,'--date='+today)
        else:
            result=run_json(node,'scripts/instagram/weekly-content.mjs','--event='+event,'--date='+date)
        manifest=result.get('manifestPath')
        if not manifest:raise RuntimeError('Builder returned no manifestPath')
        plan=ROOT/manifest
        scheduled=run_json(node,'scripts/instagram/auto-schedule.mjs','--manifest='+str(plan),'--notify')
        planned.append({'date':date,'manifest':str(plan),'result':scheduled})
    receipt={'checkedAt':now.isoformat(),'event':event,'reviewWindowHours':6,'scheduledSlots':planned,'stories':'manual'}
    (ROOT/'instagram-pack/.automation/weekly-scheduling.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt,indent=2))

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('Weekly feed preparation FAILED: '+str(error),file=sys.stderr);sys.exit(1)
