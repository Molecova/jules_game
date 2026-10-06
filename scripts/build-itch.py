#!/usr/bin/env python3
"""itch.io 업로드용 v4 빌드: v4/index.html 을 루트 index.html 로 옮기고 필요한 스크립트만 묶어 zip 으로 만든다.

사용: python3 scripts/build-itch.py [출력 폴더(기본 dist)]
결과: <출력>/paper-token-forces/ 폴더, <출력>/paper-token-forces.zip,
      그리고 스크립트를 모두 안에 넣은 한 파일짜리 <출력>/paper-token-forces.html(메신저·메일로 바로 공유용)
"""
import re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'dist').resolve()
NAME = 'paper-token-forces'
dst = OUT / NAME
if dst.exists():
    shutil.rmtree(dst)
(dst / 'v4').mkdir(parents=True)

html = (ROOT / 'v4' / 'index.html').read_text(encoding='utf-8')
single = html
# 페이지가 읽는 스크립트만 복사하고, 루트 기준 경로로 바꾼다
for src in re.findall(r'<script src="([^"]+)"', html):
    path = (ROOT / 'v4' / src).resolve()
    rel = path.relative_to(ROOT)
    (dst / rel).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dst / rel)
    html = html.replace(f'src="{src}"', f'src="{rel.as_posix()}"')
    code = path.read_text(encoding='utf-8').replace('</script', '<\\/script')
    single = single.replace(f'<script src="{src}"></script>', f'<script>/* {rel.as_posix()} */\n{code}\n</script>')
(dst / 'index.html').write_text(html, encoding='utf-8')

zip_path = shutil.make_archive(str(OUT / NAME), 'zip', dst)
print(zip_path)
assert '<script src=' not in single
(OUT / f'{NAME}.html').write_text(single, encoding='utf-8')
print(OUT / f'{NAME}.html')
