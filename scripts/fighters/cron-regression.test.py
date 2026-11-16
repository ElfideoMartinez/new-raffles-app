"""Offline integration tests for the UFC cron shell pipeline."""
import os
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = pathlib.Path(os.environ.get('UFC_TEST_SCRIPT', ROOT / 'scripts/fighters/cron.sh'))

class CronRegression(unittest.TestCase):
    def run_case(self, fail_insights=False, branch='main'):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as tmp:
            base = pathlib.Path(tmp)
            repo, bins = base / 'repo', base / 'bin'
            repo.mkdir(); bins.mkdir()
            (repo / 'fighters').mkdir()
            (repo / 'fighters/_gather-report.json').write_text('{"event":"Fixture UFC"}')
            for relative in ['scripts/fighters/gather.mjs', 'scripts/fighters/insights.mjs', 'scripts/instagram/build-drafts.mjs']:
                p = repo / relative
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text('// fixture')
            def git(*args):
                return subprocess.run(['git', *args], cwd=repo, check=True, capture_output=True)
            git('init', '-b', branch); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'Fixture')
            git('add', '.'); git('commit', '-m', 'fixture')
            (bins / 'python3').write_text('#!/bin/bash\ncat >/dev/null\nif [ "$#" -eq 1 ]; then echo 2026-11-21; else echo "telegram fixture"; fi\n')
            (bins / 'node').write_text('''#!/bin/bash
case "$1" in
*ig-cancel*) exit 0;;
*gather.mjs) echo gathered > fighters/changed.txt;;
*insights.mjs) if [ "${FAIL_INSIGHTS:-}" = 1 ]; then echo 'fixture insights failure' >&2; exit 42; fi;;
*build-drafts.mjs) echo 'PREVIEW_RENDERED_AND_NOTIFIED';;
*) cat >/dev/null; echo 'Fixture gather report';;
esac
''')
            for p in bins.iterdir(): p.chmod(0o755)
            script = base / 'run.sh'
            # Keep the tested logic intact; isolate command dependencies offline.
            script.write_text(SCRIPT.read_text().replace('export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"', 'export PATH="$TEST_BIN:/usr/bin:/bin"'))
            env = {**os.environ, 'UFC_REPO':str(repo), 'UFC_TELEGRAM_ENV':str(base/'missing.env'), 'HOME':str(base), 'TEST_BIN':str(bins), 'TELEGRAM_BOT_TOKEN':'fixture', 'FAIL_INSIGHTS':'1' if fail_insights else ''}
            result = subprocess.run(['bash', str(script)], env=env, text=True, capture_output=True, timeout=15)
            return result, git('log', '--format=%s').stdout.decode()

    def test_absent_optional_bet_cards_does_not_skip_preview(self):
        result, history = self.run_case()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('PREVIEW_RENDERED_AND_NOTIFIED', result.stdout)
        self.assertIn('fighters: gather run', history)

    def test_insights_failure_is_not_reported_as_success(self):
        result, _ = self.run_case(fail_insights=True)
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('insights', result.stdout + result.stderr)

    def test_wrong_branch_is_visible(self):
        result, _ = self.run_case(branch='feature/fixture')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('branch', result.stdout + result.stderr)

if __name__ == '__main__': unittest.main()
