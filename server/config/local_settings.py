"""Non-secret operator settings shared by the server, launcher, and backup tool."""
import ipaddress
import json
import os
from pathlib import Path
import re
import sys


REPO_DIR = Path(__file__).resolve().parents[2]


def _allowed_hosts(value):
    if not isinstance(value, list):
        raise ValueError('ai_allowed_hosts must be a list of bare HTTPS hostnames.')
    hosts = []
    for host in value:
        if not isinstance(host, str) or len(host) > 253 or not re.fullmatch(
            r'(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+'
            r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?', host
        ):
            raise ValueError('ai_allowed_hosts must contain only bare HTTPS hostnames, without URLs, ports, or wildcards.')
        try:
            ipaddress.ip_address(host)
        except ValueError:
            hosts.append(host.lower())
        else:
            raise ValueError('ai_allowed_hosts must not contain IP addresses.')
    return hosts


def load_local_settings(repo_dir=REPO_DIR, environ=None):
    """Read data only; environment overrides never persist or expose secrets."""
    environ = os.environ if environ is None else environ
    path = Path(repo_dir) / '.local-settings.json'
    try:
        config = json.loads(path.read_text(encoding='utf-8-sig'))
    except FileNotFoundError:
        config = {}
    except (ValueError, OSError):
        raise ValueError('Cannot read .local-settings.json; use valid UTF-8 JSON.') from None
    if not isinstance(config, dict) or config.keys() - {'runtime_dir', 'ai_allowed_hosts'}:
        raise ValueError('.local-settings.json accepts only runtime_dir and ai_allowed_hosts; never store API keys here.')
    runtime = config.get('runtime_dir')
    if 'runtime_dir' in config and (not isinstance(runtime, str) or not runtime or '\x00' in runtime or not Path(runtime).is_absolute()):
        raise ValueError('.local-settings.json: runtime_dir must be an absolute directory path.')
    hosts = _allowed_hosts(config.get('ai_allowed_hosts', []))
    if 'COURSELOOP_AI_ALLOWED_HOSTS' in environ:
        hosts = _allowed_hosts([host.strip() for host in environ['COURSELOOP_AI_ALLOWED_HOSTS'].split(',') if host.strip()])
    if 'COURSELOOP_RUNTIME_DIR' in environ:
        runtime = environ['COURSELOOP_RUNTIME_DIR']
        if not runtime or '\x00' in runtime:
            raise ValueError('COURSELOOP_RUNTIME_DIR must be a non-empty directory path.')
    runtime = runtime or str(Path(repo_dir) / '.runtime')
    return {'runtime_dir': Path(runtime).resolve(), 'ai_allowed_hosts': hosts}


if __name__ == '__main__':
    try:
        config = load_local_settings()
        print(json.dumps({**config, 'runtime_dir': str(config['runtime_dir'])}))
    except ValueError as error:
        print('Local configuration error: ' + str(error), file=sys.stderr)
        sys.exit(1)
