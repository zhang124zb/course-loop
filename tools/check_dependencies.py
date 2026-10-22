"""Return whether the installed application matches the reviewed dependency lock."""
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
import sys

mismatches = []
for line in (Path(__file__).resolve().parent.parent / 'requirements.lock').read_text(encoding='utf-8').splitlines():
    if not line.strip() or line.startswith('#'):
        continue
    name, expected = line.split('==', 1)
    try:
        actual = version(name)
    except PackageNotFoundError:
        actual = None
    if actual != expected:
        mismatches.append(name)
if mismatches:
    print('需要准备或更新依赖：' + '、'.join(mismatches))
sys.exit(bool(mismatches))
