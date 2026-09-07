.PHONY: check

define CHECK_SCRIPT
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json, re, subprocess, xml.etree.ElementTree as ET
r = Path('.')
expected = set('.nojekyll ALFRED.md ASSETS.md CHANGELOG.md Makefile ONTOLOGY.md README.md SCENARIOS.md index.html tokens.css tokens.json design-system.html design-system.css design-system.js icons.svg alfred-concept-reference.png alfred-full-body.png alfred-avatar.png alfred-mood-board.png'.split())
assert {p.name for p in r.iterdir() if p.name != '.git'} == expected, 'Unexpected repository files'
class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(); self.ids = []; self.refs = []; self.assets = []; self.feed(path.read_text())
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        for key in ['href', 'src']:
            if key in a: self.refs.append(a[key])
        if tag == 'img': assert 'alt' in a, 'Image without alt'
        if tag == 'script' and 'src' in a: self.assets.append(a['src'])
        if tag == 'link' and a.get('rel') == 'stylesheet': self.assets.append(a.get('href', ''))
pages = {p.name: Page(p) for p in r.glob('*.html')}
for name, page in pages.items():
    assert len(page.ids) == len(set(page.ids)), 'Duplicate HTML ids: ' + name
    assert all(not urlsplit(x).scheme and not x.startswith('//') for x in page.assets), 'Remote executable/style dependency'
    for ref in page.refs:
        u = urlsplit(ref)
        if u.scheme or u.netloc: continue
        path = unquote(u.path) or name
        assert (r / path).is_file(), 'Broken reference: ' + ref
        if u.fragment and path in pages: assert u.fragment in pages[path].ids, 'Broken anchor: ' + ref
for p in r.glob('*.md'):
    for ref in re.findall(r'!?\[[^]]*\]\(([^)]+)\)', p.read_text()):
        u = urlsplit(ref)
        if not u.scheme and u.path: assert (r / unquote(u.path)).is_file(), 'Broken Markdown link: ' + ref
text = '\n'.join(p.read_text() for p in r.iterdir() if p.suffix in {'.md','.html','.css','.js','.json','.svg'})
bad = re.compile(r'(?:<<<<<<<|=======|>>>>>>>|/Users/|(?:api[_-]?key|secret|access[_-]?token)\s*=)', re.I)
assert not bad.search(text), 'Publication hygiene failure'
assert bad.search('/Users/private/x') and bad.search('API_KEY=x'), 'Privacy fixture failed'
tokens = json.loads((r / 'tokens.json').read_text())
css = (r / 'tokens.css').read_text()
blocks = {selector.strip(): dict(re.findall(r'--([\w-]+):\s*([^;]+);', body)) for selector, body in re.findall(r'([^{}]+)\{([^{}]*)\}', re.sub(r'/\*.*?\*/', '', css, flags=re.S))}
for selector, values in [(':root', tokens['base']), (':root, [data-theme="light"]', tokens['themes']['light']), ('[data-theme="dark"]', tokens['themes']['dark'])]:
    assert blocks[selector] == {'alfred-' + k: v for k, v in values.items()}, 'Token projection drift: ' + selector
assert 'legacyAliases' not in tokens, 'Remove migrated aliases'
assert set(blocks) == {':root', ':root, [data-theme="light"]', '[data-theme="dark"]'}, 'Unexpected token block'
home = (r/'index.html').read_text()
assert 'var(--alfred-danger)' not in home, 'Homepage has no danger actions; use action or decorative tokens'
assert not re.search(r'var\(--(?:ivory|paper|charcoal|red|muted|line|shadow|serif|sans|touch)\b', home), 'Unmigrated homepage alias'
component_css = (r / 'design-system.css').read_text()
assert not re.search(r'#[0-9a-fA-F]{3,8}\b', component_css), 'Hardcoded component color'
refs = set(re.findall(r'var\(--(alfred-[\w-]+)', component_css))
defined = set().union(*(set(v) for v in blocks.values()))
assert refs <= defined, 'Undefined semantic token: ' + str(refs - defined)
assert 'tokens.css' in pages['design-system.html'].assets, 'Workbench must load tokens'
def lum(h):
    c = [int(h[i:i+2],16)/255 for i in (1,3,5)]
    return sum(v*w for v,w in zip([x/12.92 if x <= .04045 else ((x+.055)/1.055)**2.4 for x in c], [.2126,.7152,.0722]))
def contrast(a,b):
    x,y = sorted([lum(a),lum(b)]); return (y+.05)/(x+.05)
ratios=[]
for theme,t in tokens['themes'].items():
    assert len({t['accent'],t['focus'],t['danger']}) == 3, 'Action, focus and danger collide'
    pairs=[(fg,bg,4.5) for fg in ['text','muted'] for bg in ['canvas','surface','surface-2']]
    pairs += [(fg,'surface',4.5) for fg in ['success','warning','danger','accent']]
    pairs += [('on-accent',bg,4.5) for bg in ['accent','accent-hover']]
    pairs += [(fg,bg,3) for fg in ['border','focus'] for bg in ['canvas','surface','surface-2']]
    for fg,bg,minimum in pairs:
        ratio=contrast(t[fg],t[bg]); ratios.append(ratio)
        assert ratio >= minimum, f'{theme} {fg}/{bg}: {ratio:.2f} below {minimum}'
html = (r/'design-system.html').read_text()
assert all(name in html for name in ['decision-card','evidence-block','data-table','Refresh trigger','Next action','Provenance','Confidence','Not reported','Reported zero']), 'Missing decision/evidence/data semantics'
assert '<caption>' in html and 'scope="col"' in html and 'scope="row"' in html, 'Table needs caption and scoped headers'
assert 'font-variant-numeric: tabular-nums' in component_css, 'Numeric alignment missing'
svg=ET.parse(r/'icons.svg'); ns={'s':'http://www.w3.org/2000/svg'}
symbols=svg.findall('.//s:symbol',ns); ids=[s.attrib['id'] for s in symbols]
assert len(ids)==10 and len(set(ids))==10, 'Icon sprite inventory'
for page in pages.values():
    for ref in page.refs:
        if ref.startswith('icons.svg#'): assert ref.split('#')[1] in ids, 'Missing icon'
assert all(p.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n' for p in r.glob('*.png')), 'Invalid PNG'
subprocess.run(['node','--check','design-system.js'],check=True)
print(f'PASS: 19-file manifest; local links/anchors; privacy fixtures; exact token parity; {len(ratios)} contrast pairs; 10 SVG symbols; JS syntax; PNG signatures.')
print('Browser interactions and layout require the separate rendered acceptance pass.')
endef
export CHECK_SCRIPT

check:
	@python3 -c "$$CHECK_SCRIPT"
