"""Exercise committed history, other branches and redacted reports in an isolated repository."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCANNER = Path(__file__).resolve().parents[1] / 'scripts/scan_secrets.py'


class SecretScan(unittest.TestCase):
    def test_history_branches_and_redaction(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
            def git(*args):
                return subprocess.check_output(['git', '-C', tmp, *args], env=env, stderr=subprocess.DEVNULL)
            def scan():
                return subprocess.run([sys.executable, str(SCANNER)], cwd=tmp, env=env, capture_output=True, text=True)
            git('init', '-b', 'main')
            git('config', 'user.email', 'test@example.invalid')
            git('config', 'user.name', 'Scanner test')
            (root / 'safe file.txt').write_text('Русский\n', encoding='utf-8')
            git('add', '.')
            git('commit', '-m', 'Initial')
            self.assertEqual(scan().returncode, 0)
            git('checkout', '-b', 'other')
            token = 'gh' + 'p_' + 'a' * 36
            (root / 'leaked.txt').write_text(token, encoding='utf-8')
            git('add', '.')
            git('commit', '-m', 'Historical fixture')
            git('rm', 'leaked.txt')
            git('commit', '-m', 'Remove fixture')
            git('checkout', 'main')
            result = scan()
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertIn('github-token:', result.stdout)
            self.assertIn('leaked.txt:1', result.stdout)
            self.assertNotIn(token, result.stdout + result.stderr)
            # Confirm batched contents exactly match git's individual object reads.
            code = "import importlib.util; s=importlib.util.spec_from_file_location('scan',r'" + str(SCANNER) + "'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); objects=list(m.text_objects()); assert all(value == m.git('cat-file','-p',sha).decode('utf-8',errors='replace') for sha,path,value in objects); print(len(objects))"
            subprocess.run([sys.executable, '-c', code], cwd=tmp, env=env, check=True, capture_output=True)


if __name__ == '__main__':
    unittest.main()
