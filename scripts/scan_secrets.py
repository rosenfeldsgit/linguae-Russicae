"""Offline pattern scan of all reachable Git blobs and commit messages.
Only locations and rule names are printed. This is not proof that no secret exists.
"""
import re
import subprocess
import sys

RULES = {
    'github-token': r'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})',
    'openai-token': r'sk-(?:proj-)?[A-Za-z0-9_-]{30,}',
    'google-api-key': r'AIza[0-9A-Za-z_-]{30,}',
    'aws-access-id': r'AKIA[0-9A-Z]{16}',
    'private-key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'credential-url': r'https?://[^\s/:]+:[^\s/@]{6,}@',
    'literal-credential': r'''(?i)(?:api[_-]?key|secret[_-]?key|access[_-]?token|password)\s*[:=]\s*['"]([^'"\n]{16,})['"]''',
}

def git(*args):
    return subprocess.check_output(['git', *args])

def scan():
    count = failures = 0
    for row in git('rev-list', '--objects', '--all').decode().splitlines():
        sha, _, path = row.partition(' ')
        kind = git('cat-file', '-t', sha).strip()
        if kind not in (b'blob', b'commit'):
            continue
        raw = git('cat-file', '-p', sha)
        if b'\0' in raw:
            continue
        count += 1
        value = raw.decode('utf-8', errors='replace')
        for rule, pattern in RULES.items():
            for match in re.finditer(pattern, value):
                # Explicit, non-production fixture used by Django's ephemeral test DB.
                if rule == 'literal-credential' and path == 'server/content/tests.py' and match.group(1) == 'test-only-password-283':
                    continue
                print(f'{rule}: {sha[:12]} {path or "commit message"}:{value[:match.start()].count(chr(10))+1}')
                failures += 1
    print(f'Scanned {count} text objects; {failures} candidate secrets (values redacted)')
    return bool(failures)

if __name__ == '__main__':
    sys.exit(scan())
