"""Leitura local: metadados de achados, nunca imprime/persiste valores secretos."""
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlparse, quote

ROOT = Path(__file__).resolve().parents[1]
def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, check=True, capture_output=True).stdout

def fictitious(value):
    return not value or bool(re.search(r'fictici|fixture|example|placeholder|troque|change.?me|^test[-_](?:secret|token|password)$|^test$|^forma$', value, re.I))

private = []
env_files = [p for p in ROOT.glob('.env*') if p.is_file() and not p.name.endswith('.example')]
env_files += [p for p in (ROOT / 'server').glob('.env*') if p.is_file() and not p.name.endswith('.example')]
for path in env_files:
    for line in path.read_text().splitlines():
        match = re.match(r'\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)', line)
        if not match:
            continue
        key, value = match.groups()
        value = value.strip().strip('\"\'')
        if key == 'DATABASE_URL':
            password = unquote(urlparse(value).password or '')
            if not fictitious(password): private.append(('DATABASE_PASSWORD', password))
        elif re.search(r'ACCESS_TOKEN|REFRESH_TOKEN|CLIENT_SECRET|WEBHOOK_SECRET|SMTP_PASS|SESSION_SECRET|JWT_SECRET|ADMIN_PASSWORD', key) and not fictitious(value):
            private.append((key, value))

findings, seen = [], set()
patterns = {
    'mercadopago_access_token': re.compile(rb'\b(?:APP_USR|TEST)-\d{6,}-\d{4,}-[A-Za-z0-9]{20,}-\d+\b'),
    'jwt_token': re.compile(rb'\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\b'),
    'github_token': re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b'),
    'private_key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'aws_access_key': re.compile(rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
}

def add(scope, path, kind, line=0):
    item = (scope, path, kind, line)
    if item not in seen:
        seen.add(item); findings.append(dict(scope=scope, path=path, kind=kind, line=line))

def scan(data, scope, path):
    for kind, pattern in patterns.items():
        for match in pattern.finditer(data):
            if b'EXAMPLE' not in match.group(): add(scope, path, kind, data[:match.start()].count(b'\n') + 1)
    for key, secret in private:
        variants = {secret.encode(), quote(secret, safe='').encode(), json.dumps(secret)[1:-1].encode()}
        if any(v and v in data for v in variants): add(scope, path, key)

tracked = git('ls-files', '-z').decode().split('\0')
untracked = git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0')
for name in filter(None, set(tracked + untracked)):
    path = ROOT / name
    if re.fullmatch(r'\.env(?:\..+)?', path.name) and path.name != '.env.example': add('worktree', name, 'environment_file_not_ignored')
    if path.is_file() and path.stat().st_size <= 3_000_000: scan(path.read_bytes(), 'worktree', name)

history = git('rev-list', '--objects', '--all', '--reflog').decode().splitlines()
names = dict((line.split(' ', 1) + [''])[:2] for line in history)
batch = subprocess.run(['git', 'cat-file', '--batch'], cwd=ROOT, input=('\n'.join(names)+'\n').encode(), check=True, capture_output=True).stdout
offset, blobs = 0, 0
while offset < len(batch):
    end = batch.index(b'\n', offset)
    header = batch[offset:end].decode().split(); offset = end + 1
    if len(header) != 3: continue
    oid, kind, size = header; size = int(size)
    data = batch[offset:offset+size]; offset += size + 1
    if kind != 'blob': continue
    blobs += 1
    name = names.get(oid, oid)
    if re.fullmatch(r'\.env(?:\..+)?', Path(name).name) and Path(name).name != '.env.example': add('history', name, 'versioned_environment_file')
    scan(data, 'history', name)

bundle_files = list((ROOT / 'dist').rglob('*'))
for path in bundle_files:
    if path.is_file(): scan(path.read_bytes(), 'bundle', str(path.relative_to(ROOT)))
scan(git('diff', '--no-ext-diff', 'HEAD'), 'diff', 'HEAD..worktree')
report = dict(historyBlobs=blobs, trackedFiles=len(list(filter(None, tracked))), localPrivateValuesCompared=len(private),
              bundleFiles=sum(p.is_file() for p in bundle_files), findings=findings,
              limitation='Heurística e comparação local; não prova ausência universal de segredos desconhecidos/revogados.')
output = ROOT / '.tmp/security-audit'
output.mkdir(parents=True, exist_ok=True)
(output / 'secrets.json').write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n')
print(json.dumps(report, ensure_ascii=False))
raise SystemExit(bool(findings))
