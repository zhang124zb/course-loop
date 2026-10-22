import json
from pathlib import Path
import tempfile
import unittest

from config.local_settings import load_local_settings


class LocalSettingsTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

    def config(self, value):
        (self.root / '.local-settings.json').write_text(json.dumps(value), encoding='utf-8-sig')

    def test_absent_file_preserves_private_defaults_without_creating_runtime(self):
        self.assertEqual(load_local_settings(self.root, {}), {
            'runtime_dir': self.root / '.runtime', 'ai_allowed_hosts': [],
        })
        self.assertFalse((self.root / '.runtime').exists())

    def test_file_and_explicit_environment_precedence(self):
        self.config({'runtime_dir': str(self.root / '本机数据'), 'ai_allowed_hosts': ['API.Example.Test']})
        self.assertEqual(load_local_settings(self.root, {})['ai_allowed_hosts'], ['api.example.test'])
        selected = load_local_settings(self.root, {
            'COURSELOOP_RUNTIME_DIR': str(self.root / 'override'),
            'COURSELOOP_AI_ALLOWED_HOSTS': '',
        })
        self.assertEqual(selected, {'runtime_dir': self.root / 'override', 'ai_allowed_hosts': []})
        with self.assertRaisesRegex(ValueError, 'COURSELOOP_RUNTIME_DIR'):
            load_local_settings(self.root, {'COURSELOOP_RUNTIME_DIR': ''})

    def test_invalid_data_fails_before_any_runtime_is_created(self):
        for value in ([], {'api_key': 'synthetic-key'}, {'runtime_dir': 'relative/path'},
                      {'runtime_dir': None}, {'ai_allowed_hosts': 'api.example.test'},
                      *({'ai_allowed_hosts': [host]} for host in (
                          'https://api.example.test', 'api.example.test:443', '*.example.test',
                          'api.example.test/v1', '127.0.0.1', 'api..example.test', None))):
            with self.subTest(value=value):
                self.config(value)
                with self.assertRaises(ValueError):
                    load_local_settings(self.root, {})
        self.assertFalse((self.root / '.runtime').exists())

    def test_malformed_json_reports_configuration_error_without_echoing_data(self):
        (self.root / '.local-settings.json').write_text('{"private": synthetic-secret}', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'valid UTF-8 JSON') as error:
            load_local_settings(self.root, {})
        self.assertNotIn('synthetic-secret', str(error.exception))
