"""Local container smoke test, never a load test of the public website."""
import urllib.request
import urllib.error

ROOT = 'http://127.0.0.1:18080'

def get(path, forwarded='198.51.100.1'):
    request = urllib.request.Request(ROOT + path, headers={'X-Forwarded-For': forwarded})
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, response.headers
    except urllib.error.HTTPError as error:
        return error.code, error.headers

status, headers = get('/index.html')
assert status == 200, status
assert headers['X-Content-Type-Options'] == 'nosniff'
for path in ['/server/ege/settings.py', '/.env', '/.git/config', '/compose.yaml']:
    assert get(path)[0] == 404, path
# No backend is started here: allowed requests return 502; excess must stop at Nginx.
# Arbitrary forwarded addresses supplied by an untrusted client must not bypass the limit.
statuses = [get('/admin/login/', f'198.51.100.{i}')[0] for i in range(1, 13)]
assert 429 in statuses, statuses
assert statuses[-1] == 429, statuses
print('Gateway: public files, private-path denial, security headers and login throttling OK')
