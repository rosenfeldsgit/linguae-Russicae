"""Build an explicit public artifact; never copy the repository root to a web root."""
import ast
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
    tree = ast.parse((ROOT / 'server/content/views.py').read_text())
    files = next(ast.literal_eval(node.value) for node in tree.body
                 if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'PUBLIC_FILES' for t in node.targets))
    files |= {'content.js', 'admin/index.html'}
    files.update(str(p.relative_to(ROOT)) for p in (ROOT / 'test').glob('doshchinsky-*/v[0-9]*.json'))
    for name in sorted(files):
        source = ROOT / name
        if not source.is_file():
            raise FileNotFoundError(name)
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    print(f'Public artifact: {len(files)} files')

if __name__ == '__main__':
    build(Path(sys.argv[1]))
