#!/usr/bin/env python3
"""Export only tracked native import inputs from an exact Git commit."""
import argparse
import hashlib
import json
import re
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


def git(*args):
    return subprocess.check_output(['git', *args])


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, help='Full source commit SHA')
    parser.add_argument('--output', required=True)
    parser.add_argument('--readme', required=True)
    parser.add_argument('--checklist', required=True)
    parser.add_argument('--evidence', required=True)
    parser.add_argument('--privacy-draft', help='Explicitly unpublished draft for operator review')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}', args.source):
        parser.error('--source must be a complete commit SHA')
    if git('rev-parse', f'{args.source}^{{commit}}').decode().strip() != args.source:
        parser.error('source is not the exact commit')
    output = Path(args.output).resolve()
    if output.exists():
        parser.error('output already exists; choose a new file')

    entries = git('ls-tree', '-rz', args.source, '--',
                  'miniprogram/src', 'miniprogram/project.config.json').split(b'\0')
    source_files = {}
    for entry in entries:
        if not entry:
            continue
        identity, filename = entry.split(b'\t', 1)
        mode, kind, blob = identity.decode().split()
        name = filename.decode()
        if mode not in {'100644', '100755'} or kind != 'blob':
            raise ValueError(f'Unsupported import object: {name}')
        if PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts:
            raise ValueError('Unsafe archive path')
        if name != 'miniprogram/project.config.json' and not name.startswith('miniprogram/src/'):
            raise ValueError('Unexpected import path')
        if re.search(r'(^|/)(\.env[^/]*|project\.private\.config\.json|preview|node_modules)(/|$)|\.(pem|key)$', name):
            raise ValueError('Private or local-only import input')
        source_files[name] = git('cat-file', 'blob', blob)

    config = json.loads(source_files['miniprogram/project.config.json'])
    if (config['appid'] != 'wxccf9f8fc9515ebd5' or config['miniprogramRoot'] != 'src/' or
            config['compileType'] != 'miniprogram' or config['setting']['urlCheck'] is not True):
        raise ValueError('Unexpected project identity or disabled domain validation')
    app = json.loads(source_files['miniprogram/src/app.json'])
    client = source_files['miniprogram/src/config.js'].decode()
    if not re.search(r"origin:\s*'https://home\.thuzijing\.top'", client):
        raise ValueError('Unexpected API origin')
    for route in app['pages']:
        for extension in ['.js', '.json', '.wxml', '.wxss']:
            if f'miniprogram/src/{route}{extension}' not in source_files:
                raise ValueError(f'Missing page input: {route}{extension}')

    payload = dict(source_files)
    payload['README_IMPORT.md'] = Path(args.readme).read_bytes()
    payload['ACCEPTANCE_CHECKLIST.md'] = Path(args.checklist).read_bytes()
    if args.privacy_draft:
        payload['PRIVACY_DRAFT_UNPUBLISHED.md'] = Path(args.privacy_draft).read_bytes()
    readiness = json.loads(Path(args.evidence).read_text())
    if readiness['sourceCommit'] != args.source or readiness['releaseReady'] is not False:
        raise ValueError('Unexpected readiness statement')
    payload['READINESS.json'] = json.dumps(readiness, ensure_ascii=False, indent=2).encode() + b'\n'
    manifest = {
        'schemaVersion': 1, 'sourceCommit': args.source,
        'importDirectory': 'miniprogram', 'nativeDependencies': 0,
        'pages': len(app['pages']),
        'nativeSourceFiles': len(source_files) - 1,
        'nativeSourceBytes': sum(len(data) for name, data in source_files.items()
                                 if name.startswith('miniprogram/src/')),
        'projectConfigIncluded': True, 'privateConfigAndCredentialsIncluded': False,
        'sourceFiles': {name: {'bytes': len(data), 'SHA256': sha256(data)}
                        for name, data in sorted(source_files.items())},
        'supportingFiles': {name: {'bytes': len(data), 'SHA256': sha256(data)}
                            for name, data in sorted(payload.items()) if name not in source_files},
    }
    payload['SOURCE_MANIFEST.json'] = json.dumps(manifest, ensure_ascii=False, indent=2).encode() + b'\n'
    timestamp = datetime.fromtimestamp(int(git('show', '-s', '--format=%ct', args.source)), timezone.utc)
    zip_time = (max(1980, timestamp.year), timestamp.month, timestamp.day,
                timestamp.hour, timestamp.minute, timestamp.second)
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(payload.items()):
            info = zipfile.ZipInfo(name, zip_time)
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None or set(archive.namelist()) != set(payload):
            raise ValueError('Archive integrity check failed')
        for name, data in payload.items():
            if archive.read(name) != data:
                raise ValueError(f'Archive bytes changed: {name}')
    print(json.dumps({
        'file': str(output), 'sourceCommit': args.source, 'bytes': output.stat().st_size,
        'SHA256': sha256(output.read_bytes()), 'zipEntries': len(payload),
        'sourceEntries': len(source_files), 'pages': len(app['pages']),
        'nativeSourceFiles': manifest['nativeSourceFiles'], 'nativeSourceBytes': manifest['nativeSourceBytes'],
        'exactGitSourceVerified': True, 'zipCRCAndBytesVerified': True,
        'releaseReady': False, 'platformCommandsExecuted': [],
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
