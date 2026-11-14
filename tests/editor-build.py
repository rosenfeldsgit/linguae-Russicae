"""Check the editor ships the exact canonical baseline and stable rule identities."""
from pathlib import Path
import json
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class EditorBuild(unittest.TestCase):
    def test_reproducible_and_complete(self):
        paths = [ROOT / 'edit/index.html', ROOT / 'edit/chapters.json']
        before = [path.read_bytes() for path in paths]
        subprocess.run(['python3', str(ROOT / 'scripts/build_editor.py')], check=True)
        self.assertEqual(before, [path.read_bytes() for path in paths])
        payload = json.loads(paths[1].read_text())
        self.assertEqual(payload['schemaVersion'], 1)
        self.assertEqual([chapter['number'] for chapter in payload['chapters']], list(map(str, range(1, 28))))
        for chapter in payload['chapters']:
            canonical = (ROOT / chapter['path']).read_text()
            self.assertEqual(chapter['originalMarkdown'], canonical)
            expected_ids = re.findall(r'^### ([RS]\d+-\d+)\.', canonical, re.M)
            actual_ids = re.findall(r'<section id="([RS]\d+-\d+)"', chapter['html'])
            self.assertEqual(expected_ids, actual_ids, chapter['number'])
            self.assertNotIn('practice-link', chapter['html'])
            if chapter['number'] in ('4', '5'):
                dictionary = chapter['dictionary']
                self.assertEqual(dictionary['original'], json.loads((ROOT / dictionary['path']).read_text()))
                self.assertIn('class="dictionary"', chapter['html'])
        self.assertIn('noindex, nofollow, noarchive', paths[0].read_text())

    def test_no_public_navigation_to_editor(self):
        for page in [ROOT / 'index.html', ROOT / 'theory/index.html', ROOT / 'feed/index.html', ROOT / 'test/index.html']:
            self.assertNotRegex(page.read_text(), r'href=["\'][^"\']*edit(?:/|["\'])')


if __name__ == '__main__':
    unittest.main()
