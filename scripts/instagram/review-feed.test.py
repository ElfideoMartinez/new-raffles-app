import importlib.util
from pathlib import Path
import unittest

FILE=Path(__file__).with_name('review-feed.py')
class ReviewFeed(unittest.TestCase):
    def test_feed_payload_is_explicit_draft_for_only_authorized_account(self):
        self.assertTrue(FILE.exists(), 'feed review bridge missing')
        spec=importlib.util.spec_from_file_location('review_feed',FILE)
        assert spec is not None and spec.loader is not None
        m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        p=m.draft_payload('approved copy','https://antwork.io/media/test.jpg')
        self.assertIs(p['draft'], True)
        self.assertEqual(p['accounts'], ['gUi1o3IWQLG6ws6vHnYi'])
        self.assertNotIn('scheduledFor',p)
        self.assertEqual(p['media'],['https://antwork.io/media/test.jpg'])

if __name__=='__main__':unittest.main()
