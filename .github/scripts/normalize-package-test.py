from pathlib import Path
import re

path = Path(__file__).resolve().parents[2] / "windows-10/package.json"
text = path.read_text(encoding="utf-8-sig")
pattern = r'"test:pdv-payments"\s*:\s*"(?:\\.|[^"\\])*"'
replacement = '"test:pdv-payments":  "tsc -p tsconfig.test.json && node --test .tmp-tests/tests/pdv-payment.test.js"'
text, count = re.subn(pattern, replacement, text, count=1)
if count != 1:
    raise RuntimeError(f"Could not normalize test script in {path}; matches={count}")
path.write_text(text, encoding="utf-8")
print("PDV test command normalized for migration.")
