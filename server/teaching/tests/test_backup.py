import hashlib
from contextlib import contextmanager
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile

from cryptography.fernet import Fernet
from django.test import SimpleTestCase

_file = Path(__file__).resolve().parents[3] / 'tools' / 'backup_local.py'
_spec = importlib.util.spec_from_file_location('local_backup', _file)
backup = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(backup)


class BackupVerificationTests(SimpleTestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.addCleanup(self.directory.cleanup)
        with self.database() as database:
            for table in ('auth_user', 'teaching_submission', 'teaching_diagnosticreport'):
                database.execute(f'CREATE TABLE {table} (id INTEGER)')
            database.execute('CREATE TABLE teaching_resource (file TEXT)')
            database.execute('CREATE TABLE teaching_aiconfig (encrypted_key TEXT)')
        (self.root / 'django-secret.key').write_text('synthetic-backup-secret')

    @contextmanager
    def database(self):
        database = sqlite3.connect(self.root / 'course-loop.sqlite3')
        try:
            yield database
            database.commit()
        finally:
            database.close()

    def manifest(self):
        files = {file.relative_to(self.root).as_posix(): hashlib.sha256(file.read_bytes()).hexdigest()
                 for file in self.root.rglob('*') if file.is_file() and file.name != 'manifest.json'}
        (self.root / 'manifest.json').write_text(json.dumps({'files': files}))

    def test_consistent_snapshot_passes(self):
        self.manifest()
        self.assertEqual(backup.verify(self.root)['auth_user'], 0)

    def test_missing_database_referenced_attachment_fails(self):
        with self.database() as database:
            database.execute('INSERT INTO teaching_resource VALUES (?)', ('resources/missing.txt',))
        self.manifest()
        with self.assertRaises(ValueError):
            backup.verify(self.root)

    def test_encrypted_key_without_master_key_fails(self):
        with self.database() as database:
            database.execute('INSERT INTO teaching_aiconfig VALUES (?)', (Fernet(Fernet.generate_key()).encrypt(b'synthetic-key').decode(),))
        self.manifest()
        with self.assertRaises(ValueError):
            backup.verify(self.root)

    def test_missing_django_secret_fails(self):
        (self.root / 'django-secret.key').unlink()
        self.manifest()
        with self.assertRaises(ValueError):
            backup.verify(self.root)

    def test_correct_encrypted_key_can_be_restored(self):
        key = Fernet.generate_key()
        (self.root / 'ai-master.key').write_bytes(key)
        with self.database() as database:
            database.execute('INSERT INTO teaching_aiconfig VALUES (?)', (Fernet(key).encrypt(b'synthetic-key').decode(),))
        self.manifest()
        self.assertEqual(backup.verify(self.root)['auth_user'], 0)
