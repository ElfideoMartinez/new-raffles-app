#!/usr/bin/env python3
"""Research-only UFC refresh: no Git staging, commits, app writes or publishing."""
import datetime as dt
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

ROOT = Path(os.environ.get('UFC_REPO', Path(__file__).resolve().parents[2]))

def select_event(events, now):
    instant = dt.datetime.fromisoformat(now.replace('Z', '+00:00'))
    eligible = [e for e in events if e.get('status', {}).get('type', {}).get('state') != 'post'
                and dt.datetime.fromisoformat(e['date'].replace('Z', '+00:00')) > instant]
    return min(eligible, key=lambda e: e['date']) if eligible else None

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'raffles-fighters-gatherer/1.0'})
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.load(response)

def main():
    os.environ['PATH'] = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:' + os.environ.get('PATH', '')
    now = dt.datetime.now(dt.timezone.utc)
    end = now + dt.timedelta(days=90)
    base = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates='
    event = select_event(get(base + now.strftime('%Y%m%d') + '-' + end.strftime('%Y%m%d')).get('events', []), now.isoformat())
    if not event:
        raise RuntimeError('No confirmed future UFC event in the next 90 days; no files changed.')
    date = dt.date.fromisoformat(event['date'][:10])
    query_date = None
    for delta in [0, 1, -1]:
        candidate = date + dt.timedelta(days=delta)
        matches = get(base + candidate.strftime('%Y%m%d')).get('events', [])
        # gather.mjs selects the first event returned; never gather another card silently.
        if matches and matches[0].get('id') == event['id']:
            query_date = candidate.isoformat()
            break
    if not query_date:
        raise RuntimeError('Could not verify exact next-card single-date query')
    lock = ROOT / 'instagram-pack/.automation/gather.lock'
    lock.parent.mkdir(parents=True, exist_ok=True)
    try:
        lock.mkdir()
    except FileExistsError:
        raise RuntimeError(f'Gather lock exists: {lock}; inspect active run before retrying')
    try:
        (lock / 'owner.json').write_text(json.dumps({'pid': os.getpid(), 'startedAt': now.isoformat()}))
        node = shutil.which('node')
        if not node:
            raise RuntimeError('Node executable not found')
        print(f"Gathering {event['name']} ({query_date}), official UFC portraits first", flush=True)
        result = subprocess.run([node, 'scripts/fighters/gather.mjs', '--date=' + query_date, '--max=100'], cwd=ROOT)
        report = json.loads((ROOT / 'fighters/_gather-report.json').read_text())
        if report.get('event') != event['name']:
            raise RuntimeError('Gather report does not match next event')
        # Portrait / Wikipedia failures are reported as partial research, never fabricated.
        if result.returncode and not report.get('failures'):
            raise RuntimeError(f'Gather exited {result.returncode} without a diagnostic report')
        subprocess.run([node, 'scripts/fighters/insights.mjs'], cwd=ROOT, check=True)
        roster = []
        for p in (ROOT / 'fighters').glob('*/profile.json'):
            profile = json.loads(p.read_text())
            if profile.get('_event', {}).get('name') != event['name']:
                continue
            photo = profile.get('photo') or {}
            present = bool(photo.get('file') and (p.parent / photo['file']).is_file())
            roster.append({'name': profile.get('name'), 'photo': present, 'source': photo.get('source_url')})
        receipt = {'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'event': event['name'],
                   'eventDate': event['date'], 'queryDate': query_date, 'fighters': roster,
                   'failures': report.get('failures', []), 'partial': bool(result.returncode),
                   'publishing': 'approval-required'}
        (ROOT / 'fighters/_weekly-gather.json').write_text(json.dumps(receipt, indent=2) + '\n')
        missing = [p['name'] for p in roster if not p['photo']]
        print(f"Research refreshed: {event['name']}; {len(roster)} fighters; {len(roster)-len(missing)} portraits; {len(missing)} missing.")
        if missing:
            print('Initials fallback: ' + ', '.join(missing))
        for error in report.get('failures', []):
            print('Research gap: ' + error)
        subprocess.run([sys.executable, 'scripts/instagram/prepare-week.py'], cwd=ROOT, check=True)
        subprocess.run([node, 'scripts/instagram/weekly-report.mjs', '--event=' + event['name'], '--notify'], cwd=ROOT, check=True)
        print('Feed automation prepared with review/cancel lead time; stories remain manual. No Git commit or app deployment performed.')
    finally:
        shutil.rmtree(lock)

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('UFC research FAILED: ' + str(error), file=sys.stderr)
        sys.exit(1)
