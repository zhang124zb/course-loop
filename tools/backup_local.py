"""Create a private, restorable local snapshot without printing credentials."""
import argparse
from contextlib import closing
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import sys
from cryptography.fernet import Fernet, InvalidToken

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = Path(os.environ.get('COURSELOOP_RUNTIME_DIR', str(ROOT / '.runtime'))).resolve()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(directory):
    directory = directory.resolve()
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    for required in ('course-loop.sqlite3', 'django-secret.key'):
        if required not in manifest['files']:
            raise ValueError('备份缺少必要文件：' + required)
    for filename, expected in manifest["files"].items():
        candidate = (directory / filename).resolve()
        if directory not in candidate.parents or not candidate.is_file() or digest(candidate) != expected:
            raise ValueError("备份文件校验失败：" + filename)
    with closing(sqlite3.connect(str(directory / "course-loop.sqlite3"))) as database:
        if database.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("备份数据库完整性检查失败")
        counts = {table: database.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
                  for table in ("auth_user", "teaching_submission", "teaching_diagnosticreport")}
        for (filename,) in database.execute('SELECT file FROM teaching_resource WHERE file != ?', ('',)):
            relative = 'uploads/' + filename.replace('\\', '/')
            candidate = (directory / relative).resolve()
            if not candidate.is_relative_to((directory / 'uploads').resolve()) or relative not in manifest['files'] or not candidate.is_file():
                raise ValueError('备份缺少数据库引用的附件。')
        encrypted_keys = [row[0] for row in database.execute('SELECT encrypted_key FROM teaching_aiconfig WHERE encrypted_key != ?', ('',))]
        if encrypted_keys:
            if 'ai-master.key' not in manifest['files']:
                raise ValueError('备份缺少解密模型配置所需的本机密钥。')
            try:
                cipher = Fernet((directory / 'ai-master.key').read_bytes())
                for encrypted in encrypted_keys:
                    cipher.decrypt(encrypted.encode('ascii'))
            except (ValueError, InvalidToken, UnicodeError):
                raise ValueError('备份中的模型密钥无法解密。') from None
    return counts


def backup():
    source = RUNTIME / "course-loop.sqlite3"
    if not source.is_file():
        raise ValueError("尚未初始化数据库，请先运行本机教学服务。")
    directory = RUNTIME / "backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    directory.mkdir(parents=True)
    with closing(sqlite3.connect(str(source))) as origin, closing(sqlite3.connect(str(directory / source.name))) as target:
        origin.backup(target)
        target.commit()
    for name in ("django-secret.key", "ai-master.key", "demo-accounts.txt"):
        if (RUNTIME / name).is_file():
            shutil.copy2(RUNTIME / name, directory / name)
    if (RUNTIME / "uploads").is_dir():
        shutil.copytree(RUNTIME / "uploads", directory / "uploads")
    files = {file.relative_to(directory).as_posix(): digest(file) for file in directory.rglob("*") if file.is_file()}
    (directory / "manifest.json").write_text(json.dumps({"created_at": datetime.now().isoformat(), "files": files}, ensure_ascii=False, indent=2), encoding="utf-8")
    counts = verify(directory)
    print(json.dumps({"backup": str(directory), "verified": True, "records": counts}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="请停止服务并关闭上传操作后备份。备份包含私有数据与密钥，不要上传GitHub。")
    parser.add_argument("--verify", type=Path, help="验证已有备份目录，不覆盖运行数据")
    arguments = parser.parse_args()
    try:
        if arguments.verify:
            print(json.dumps({"verified": True, "records": verify(arguments.verify)}, ensure_ascii=False))
        else:
            backup()
    except (ValueError, OSError, sqlite3.Error) as error:
        print("备份操作失败：" + str(error), file=sys.stderr)
        sys.exit(1)
