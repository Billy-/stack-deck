#!/usr/bin/env python3
"""Export the app as one offline HTML file; no dependencies required."""
import base64
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/export-standalone.py /absolute/output/path/Stack-Deck.html')
output = Path(sys.argv[1]).expanduser().resolve()
html = (root / 'index.html').read_text()
style = (root / 'styles.css').read_text()
engine = re.sub(r'^export ', '', (root / 'deck.js').read_text(), flags=re.MULTILINE)
app = (root / 'app.js').read_text()
app = re.sub(r'^import .*?;\n', '', app, count=1)
data_loading = """    const response = await fetch('./data/cards.json');
    if (!response.ok) throw new Error('Category catalogue unavailable');
    catalogue = await response.json();"""
if data_loading not in app:
    raise SystemExit('App loading code changed. Update this exporter before exporting.')
app = app.replace(data_loading, "    catalogue = JSON.parse(document.getElementById('embedded-catalogue').textContent);")
app = app.replace('    setupOffline();', '    offlineReady = true; updateConnectivity();')
html = html.replace('  <script type="module" src="./app.js"></script>\n', '')
html = html.replace('  <link rel="manifest" href="./manifest.webmanifest">\n', '')
html = html.replace('<link rel="stylesheet" href="./styles.css">', '<style>\n' + style + '\n</style>')
for filename, mime in [('icon.svg', 'image/svg+xml'), ('apple-touch-icon.png', 'image/png')]:
    encoded = base64.b64encode((root / 'icons' / filename).read_bytes()).decode()
    html = html.replace('./icons/' + filename, 'data:' + mime + ';base64,' + encoded)
catalogue = json.loads((root / 'data/cards.json').read_text())
data = json.dumps(catalogue, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
code = (engine + '\n' + app).replace('</script', '<\\/script')
embedded = '<script id="embedded-catalogue" type="application/json">' + data + '</script>\n<script>\n' + code + '\n</script>\n'
html = html.replace('</body>', embedded + '</body>')
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html)
print(f'Exported {len(catalogue["cards"])} cards to {output.name} ({output.stat().st_size:,} bytes).')
