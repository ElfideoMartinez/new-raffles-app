"""Offline contract tests for scheduled research, without publishing or Git writes."""
import importlib.util
import pathlib
import unittest

FILE = pathlib.Path(__file__).with_name('weekly-gather.py')

class WeeklyGather(unittest.TestCase):
    def test_discovers_only_future_uncompleted_event(self):
        self.assertTrue(FILE.exists(), 'weekly gather runner missing')
        spec = importlib.util.spec_from_file_location('weekly_gather', FILE)
        assert spec is not None and spec.loader is not None
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        events = [
            {'id':'old','date':'2026-11-16T10:00Z','status':{'type':{'state':'post'}}},
            {'id':'later','date':'2026-12-05T15:00Z','status':{'type':{'state':'pre'}}},
            {'id':'next','date':'2026-11-21T15:00Z','status':{'type':{'state':'pre'}}},
        ]
        self.assertEqual(m.select_event(events, '2026-11-17T00:00:00+00:00')['id'], 'next')
        self.assertIsNone(m.select_event(events[:1], '2026-11-17T00:00:00+00:00'))

    def test_research_finishes_with_numbered_visual_weekly_report(self):
        source = FILE.read_text()
        self.assertIn("'scripts/instagram/weekly-report.mjs'", source)
        self.assertIn("'--notify'", source)
        self.assertIn("'--event=' + event['name']", source)

    def test_research_runner_has_no_git_or_publishing_side_effects(self):
        self.assertTrue(FILE.exists())
        source = FILE.read_text()
        self.assertNotIn("'git'", source)
        self.assertNotIn('--schedule', source)
        self.assertNotIn('--any-license', source)
        self.assertIn('--max=100', source)
        self.assertNotIn('build-bet-cards', source)

if __name__ == '__main__': unittest.main()
