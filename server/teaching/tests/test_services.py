from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import http.client
import json
import tempfile
import threading
import time
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, override_settings

from teaching.services import ai, runner


class ReviewedExampleTests(SimpleTestCase):
    def submission(self, key, source):
        return SimpleNamespace(source=source, assignment=SimpleNamespace(task_version=SimpleNamespace(fixture_key=key)))

    def test_reviewed_sources_really_execute_expected_cases(self):
        for key in ("mean-v1", "max-v1", "count-v1"):
            for example in runner.example_sources(key):
                result = runner.evaluate_submission(self.submission(key, example["source"]))
                self.assertEqual(result["status"], "completed")
                self.assertEqual(result["passed"], 3 if "-good-" in example["id"] else 2)
                self.assertEqual(result["total"], 3)

    def test_arbitrary_code_is_saved_pending_without_starting_a_process(self):
        sample = runner.example_sources("mean-v1")[0]["source"]
        for source in (sample + "\n# changed", "__import__('os').system('whoami')", "", "print(4.0)"):
            with patch.object(runner.subprocess, "run") as execute:
                result = runner.evaluate_submission(self.submission("mean-v1", source))
                self.assertEqual(result["status"], "pending")
                self.assertIsNone(result["score"])
                execute.assert_not_called()

    def test_wrong_assignment_cannot_run_a_reviewed_source(self):
        source = runner.example_sources("mean-v1")[0]["source"]
        with patch.object(runner.subprocess, "run") as execute:
            self.assertEqual(runner.evaluate_submission(self.submission("teacher-new-code", source))["status"], "pending")
            execute.assert_not_called()

    def test_changed_repository_fixture_fails_closed(self):
        source = runner.example_sources("mean-v1")[0]["source"]
        with patch.object(Path, "read_bytes", return_value=b"print('unreviewed')"), patch.object(runner.subprocess, "run") as execute:
            result = runner.evaluate_submission(self.submission("mean-v1", source))
            self.assertEqual(result["status"], "error")
            execute.assert_not_called()


class ModelBoundaryTests(SimpleTestCase):
    def config(self):
        return SimpleNamespace(base_url="http://127.0.0.1:11434/v1", model="qwen3.5:4b", timeout_seconds=5, encrypted_key="")

    def test_malformed_provider_messages_fail_cleanly(self):
        for payload in ([], {}, {"choices": []}, {"choices": [None]}, {"choices": [{"message": None}]}, {"choices": [{"message": {"content": []}}]}):
            response = Mock(status=200)
            response.getheader.return_value = "application/json"
            response.read1.side_effect = [json.dumps(payload).encode(), b""]
            connection = Mock(sock=None)
            connection.getresponse.return_value = response
            with self.subTest(payload=payload), patch.object(ai, "_connection", return_value=(connection, "/v1")), self.assertRaises(ai.AIServiceError):
                ai._chat(self.config(), [{"role": "user", "content": "test"}])

    def test_slow_trickling_response_obeys_total_timeout(self):
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                self.rfile.read(int(self.headers.get("Content-Length", "0")))
                body = json.dumps({"choices": [{"message": {"content": "reply"}}]}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                try:
                    for byte in body:
                        self.wfile.write(bytes([byte]))
                        self.wfile.flush()
                        time.sleep(0.3)
                except (OSError, BrokenPipeError):
                    pass
        with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            started = time.monotonic()
            connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
            try:
                with patch.object(ai, "_connection", return_value=(connection, "/v1")), self.assertRaises(ai.AIServiceError):
                    ai._chat(self.config(), [{"role": "user", "content": "test"}])
                self.assertLess(time.monotonic() - started, 6.5)
            finally:
                server.shutdown()

    def test_local_ollama_is_a_narrow_exception(self):
        self.assertEqual(ai.validate_base_url("http://localhost:11434/v1/"), "http://127.0.0.1:11434/v1")
        for value in ("http://127.0.0.1:8080/v1", "http://127.0.0.1:11434/admin/v1", "http://169.254.169.254/v1", "file:///etc/passwd", "https://api.openai.com@127.0.0.1/v1", "https://api.openai.com/v1?key=x", "https://api.openai.com:444/v1", "https://unapproved.example/v1"):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                ai.validate_base_url(value)

    def test_custom_host_requires_operator_allowlist_and_public_dns(self):
        with patch.dict("os.environ", {"COURSELOOP_AI_ALLOWED_HOSTS": "api.example.test"}):
            self.assertEqual(ai.validate_base_url("https://api.example.test/api/v1"), "https://api.example.test/api/v1")
            with patch.object(ai.socket, "getaddrinfo", return_value=[(None, None, None, None, ("127.0.0.1", 443))]), self.assertRaises(ai.AIServiceError):
                ai._connection("https://api.example.test/api/v1", 5)

    @override_settings(AI_ALLOWED_HOSTS=['api.example.test'])
    def test_persistent_operator_allowlist_and_environment_override(self):
        with patch.dict('os.environ', {}, clear=True):
            self.assertEqual(ai.validate_base_url('https://api.example.test/v1'), 'https://api.example.test/v1')
            with patch.dict('os.environ', {'COURSELOOP_AI_ALLOWED_HOSTS': ''}), self.assertRaises(ValidationError):
                ai.validate_base_url('https://api.example.test/v1')

    def test_api_key_encryption_and_corruption_failure(self):
        with tempfile.TemporaryDirectory() as directory, override_settings(RUNTIME_DIR=Path(directory)):
            encrypted = ai.encrypt_api_key("synthetic-test-key")
            self.assertNotIn("synthetic-test-key", encrypted)
            self.assertEqual(ai._decrypt_api_key(encrypted), "synthetic-test-key")
            with self.assertRaises(ai.AIServiceError):
                ai._decrypt_api_key("not-a-valid-encrypted-key")

    def test_browser_safe_config_does_not_return_encrypted_or_plain_key(self):
        config = SimpleNamespace(pk=1, label="测试", base_url="http://127.0.0.1:11434/v1", model="qwen3.5:4b", timeout_seconds=120, version=1, encrypted_key="should-never-be-returned")
        public = ai.public_config(config)
        self.assertTrue(public["key_configured"])
        self.assertNotIn("encrypted_key", public)
        self.assertNotIn("should-never-be-returned", str(public))
