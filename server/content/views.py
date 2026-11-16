import json,re
from django.http import HttpResponse,FileResponse,Http404
from django.conf import settings
from django.shortcuts import redirect
from django.views.decorators.http import require_safe
from .models import Record,Task

@require_safe
def content_js(request):
    cards,exams=[],[]
    for record in Record.objects.filter(active=True).select_related('task','rule').iterator(chunk_size=500):
        if record.category=='card':cards.append(record.payload())
        elif record.category=='exam':exams.append(record.payload())
    payload={'cards':cards,'exams':exams,'disabled':list(Record.objects.filter(active=False).exclude(legacy_id=None).values_list('legacy_id',flat=True)),'tasks':{str(t.number):{'number':t.number,'title':t.title,'maxPrimary':t.max_primary} for t in Task.objects.all()}}
    response=HttpResponse('window.EGE_MANAGED = '+json.dumps(payload,ensure_ascii=False)+';',content_type='application/javascript; charset=utf-8')
    response['Cache-Control']='no-store'
    return response

PUBLIC_FILES = frozenset(json.loads((settings.ROOT / 'public-files.json').read_text(encoding='utf-8')))
@require_safe
def public_file(request,path='index.html'):
    if path in ('theory','feed','edit'):
        return redirect(request.path + '/')
    if path=='test/feed.html':return redirect('../feed/')
    if path=='versions':path='versions/'
    if path in ('','test/','versions/','theory/','feed/','edit/'):path=path+'index.html'
    variant=re.fullmatch(r'test/doshchinsky-(2026|2027)/v(\d+)\.json',path)
    if not (path in PUBLIC_FILES or variant and (1 if variant[1]=="2026" else 3)<=int(variant[2])<=36):raise Http404
    file=settings.ROOT/path
    if not file.is_file():raise Http404
    types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.png':'image/png','.woff2':'font/woff2'}
    return FileResponse(file.open('rb'),content_type=types.get(file.suffix,'application/octet-stream'))
