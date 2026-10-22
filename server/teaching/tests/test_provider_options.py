import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from teaching.services import ai


class ProviderOptionsTests(SimpleTestCase):
    def test_fast_diagnostics_option_is_limited_to_the_documented_provider_and_model(self):
        for host, model, expected in (
            ('api.deepseek.com', 'deepseek-flash', {'type': 'disabled'}),
            ('other.example.test', 'deepseek-flash', None),
            ('api.deepseek.com', 'another-model', None),
        ):
            with self.subTest(host=host, model=model):
                response = Mock(status=200)
                response.getheader.return_value = 'application/json'
                response.read1.side_effect = [b'{"choices":[{"message":{"content":"ok"}}]}', b'']
                connection = Mock(sock=None)
                connection.getresponse.return_value = response
                config = SimpleNamespace(base_url='https://' + host + '/compatible-mode/v1', model=model,
                                         timeout_seconds=5, encrypted_key='')
                with patch.object(ai, '_connection', return_value=(connection, '/compatible-mode/v1')):
                    self.assertEqual(ai._chat(config, [{'role': 'user', 'content': 'test'}]), 'ok')
                body = json.loads(connection.request.call_args.kwargs['body'])
                self.assertEqual(body.get('thinking'), expected)
                self.assertNotIn('enable_thinking', body)
                self.assertNotIn('reasoning_effort', body)
