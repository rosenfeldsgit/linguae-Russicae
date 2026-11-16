"""Build an explicit public artifact; never copy the repository root to a web root."""
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parent.parent

def build(destination):
    destination = destination.resolve()
    if destination == ROOT or ROOT.is_relative_to(destination):
        raise ValueError('Destination must not contain the repository')
    if destination.exists():
        raise ValueError('Use a new, empty destination')
    files = set(json.loads((ROOT / 'public-files.json').read_text(encoding='utf-8')))
    files |= {'content.js', 'admin/index.html'}
    files.update(str(p.relative_to(ROOT)) for p in (ROOT / 'test').glob('doshchinsky-*/v[0-9]*.json'))
    for name in sorted(files):
        source = ROOT / name
        if Path(name).is_absolute() or '..' in Path(name).parts:
            raise ValueError('Public file must be relative to the repository: ' + name)
        if not source.is_file():
            raise FileNotFoundError(name)
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    print(f'Public artifact: {len(files)} files')

if __name__ == '__main__':
    build(Path(sys.argv[1]))
