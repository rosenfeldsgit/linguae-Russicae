"""Verify only intended public files, including every local HTML dependency, ship."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key == 'src' or key == 'href' and tag == 'link':
                self.urls.append(value)

class PublicArtifact(unittest.TestCase):
    def test_no_private_files_and_no_missing_assets(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'public'
            subprocess.run(['python3', str(ROOT / 'scripts/build_public.py'), str(target)], check=True)
            for private in ['server/ege/settings.py', 'compose.yaml', '.env', '.git/config', 'data/paronyms-source.json']:
                self.assertFalse((target / private).exists(), private)
            for page in target.rglob('*.html'):
                parser = Links()
                parser.feed(page.read_text())
                for url in parser.urls:
                    parsed = urlsplit(url)
                    if not parsed.scheme and parsed.path:
                        self.assertTrue((page.parent / parsed.path).is_file(), (page, url))

if __name__ == '__main__':
    unittest.main()
