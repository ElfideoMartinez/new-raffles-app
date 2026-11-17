import importlib.util
from pathlib import Path
import unittest
FILE=Path(__file__).with_name('prepare-week.py')
class PrepareWeek(unittest.TestCase):
    def test_weekly_feed_preparation_is_early_enough_to_review(self):
        self.assertTrue(FILE.exists(), 'weekly advance preparation missing')
        spec=importlib.util.spec_from_file_location('prepare_week',FILE)
        assert spec is not None and spec.loader is not None
        m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        self.assertEqual(m.week_dates('2026-11-17'),{'monday':'2026-11-16','thursday':'2026-11-19','friday':'2026-11-20'})
        self.assertEqual(m.eligible_dates('2026-11-17T17:00:00+00:00'),['2026-11-19','2026-11-20'])
        self.assertEqual(m.eligible_dates('2026-11-20T20:00:00+00:00'),[])
        self.assertEqual(m.eligible_dates('2026-11-16T18:15:00+00:00'),['2026-11-16','2026-11-19','2026-11-20'])
if __name__=='__main__':unittest.main()
