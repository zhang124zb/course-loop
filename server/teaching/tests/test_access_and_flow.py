from pathlib import Path
import tempfile
import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from teaching.models import AIConfig, Assignment, AuditEvent, Classroom, Course, DiagnosticReport, Enrollment, Profile, Resource, ResourceProgress, Submission, Task, TaskVersion
from teaching.services import ai, runner

User = get_user_model()


class TeachingSecurityFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        def user(name, role):
            result = User.objects.create_user(username=name, is_superuser=role == "admin", is_staff=role == "admin")
            Profile.objects.create(user=result, role=role, display_name="模拟" + name)
            return result
        cls.admin = user("administrator", "admin")
        cls.teacher = user("teacher_a", "teacher")
        cls.other_teacher = user("teacher_b", "teacher")
        cls.student = user("student_a", "student")
        cls.classmate = user("student_b", "student")
        cls.outsider = user("student_c", "student")
        cls.course = Course.objects.create(slug="python", title="Python样例课")
        cls.other_course = Course.objects.create(slug="other", title="另一门课")
        cls.classroom = Classroom.objects.create(course=cls.course, teacher=cls.teacher, name="模拟A班")
        cls.other_classroom = Classroom.objects.create(course=cls.course, teacher=cls.other_teacher, name="模拟B班")
        for student in (cls.student, cls.classmate):
            Enrollment.objects.create(classroom=cls.classroom, student=student)
        Enrollment.objects.create(classroom=cls.other_classroom, student=cls.outsider)
        task = Task.objects.create(course=cls.course, title="列表平均值", level="basic", knowledge_points=["空输入"])
        cls.version = TaskVersion.objects.create(task=task, number=1, prompt="空列表输出0", fixture_key="mean-v1")
        cls.assignment = Assignment.objects.create(classroom=cls.classroom, task_version=cls.version, title="课堂实操", stage="during", status="published", created_by=cls.teacher)
        cls.other_assignment = Assignment.objects.create(classroom=cls.other_classroom, task_version=cls.version, title="别班实操", stage="during", status="published", created_by=cls.other_teacher)
        cls.draft = Assignment.objects.create(classroom=cls.classroom, task_version=cls.version, title="未发布任务", stage="after", status="draft", created_by=cls.teacher)
        cls.resource = Resource.objects.create(course=cls.course, created_by=cls.teacher, title="样例资源", level="basic", kind="worksheet", body="学习材料", is_published=True)
        cls.unpublished = Resource.objects.create(course=cls.course, created_by=cls.teacher, title="未发布资源", level="basic", kind="worksheet", body="草稿", is_published=False)
        AIConfig.objects.create(model="qwen3.5:4b", timeout_seconds=120)

    def setUp(self):
        cache.clear()

    def login_as(self, user):
        self.client.force_login(user)

    def submit(self, source, assignment=None, request_id=None, **extra):
        data = {"source": source, "request_id": str(request_id or uuid.uuid4()), **extra}
        return self.client.post(reverse("assignment_submit", args=[(assignment or self.assignment).pk]), data)

    def test_anonymous_json_is_401_and_html_requires_login(self):
        self.assertEqual(self.client.get(reverse("api_courses")).status_code, 401)
        self.assertEqual(self.client.get(reverse("dashboard")).status_code, 302)

    def test_student_cannot_access_management_or_teaching_mutations(self):
        self.login_as(self.student)
        for name in ("accounts", "classes", "ai_settings", "audit", "resource_new", "task_new", "assignment_new"):
            with self.subTest(name=name):
                self.assertEqual(self.client.get(reverse(name)).status_code, 403)
        self.assertEqual(self.client.post(reverse("ai_test")).status_code, 403)
        self.assertEqual(self.client.post(reverse("assignment_diagnose", args=[self.assignment.pk])).status_code, 403)

    def test_draft_and_other_class_assignments_are_hidden(self):
        self.login_as(self.student)
        for assignment in (self.draft, self.other_assignment):
            self.assertEqual(self.client.get(reverse("assignment_detail", args=[assignment.pk])).status_code, 404)
            self.assertEqual(self.client.get(reverse("api_assignment", args=[assignment.pk])).status_code, 404)
            self.assertEqual(self.submit("print('x')", assignment).status_code, 404)
        self.assertEqual(self.client.get(reverse("resource_detail", args=[self.unpublished.pk])).status_code, 404)

    def test_teacher_cannot_read_other_class_results_or_report(self):
        submission = Submission.objects.create(assignment=self.other_assignment, student=self.outsider, source="x", source_hash="1" * 64)
        report = DiagnosticReport.objects.create(assignment=self.other_assignment, created_by=self.other_teacher, status="completed", content="私有班级报告")
        self.login_as(self.teacher)
        self.assertEqual(self.client.get(reverse("submission_detail", args=[submission.pk])).status_code, 404)
        self.assertEqual(self.client.get(reverse("api_submission", args=[submission.pk])).status_code, 404)
        self.assertEqual(self.client.get(reverse("report_detail", args=[report.pk])).status_code, 404)
        self.assertEqual(self.client.post(reverse("report_adopt", args=[report.pk])).status_code, 404)
        self.assertEqual(self.client.post(reverse("assignment_diagnose", args=[self.other_assignment.pk])).status_code, 404)

    def test_student_cannot_read_a_classmates_submission(self):
        submission = Submission.objects.create(assignment=self.assignment, student=self.classmate, source="x", source_hash="1" * 64)
        self.login_as(self.student)
        self.assertEqual(self.client.get(reverse("submission_detail", args=[submission.pk])).status_code, 404)
        self.assertEqual(self.client.get(reverse("api_submission", args=[submission.pk])).status_code, 404)

    def test_reviewed_source_result_is_server_owned_and_idempotent(self):
        self.login_as(self.student)
        example = next(item for item in runner.example_sources("mean-v1") if "-good-" in item["id"])
        request_id = uuid.uuid4()
        result = self.submit(example["source"], request_id=request_id, student=self.classmate.pk, status="pending", score="0", fixture_id="forged")
        self.assertEqual(result.status_code, 302)
        submission = Submission.objects.get(student=self.student)
        self.assertEqual(submission.status, "completed")
        self.assertEqual(submission.score, 100)
        self.assertEqual(submission.passed, 3)
        self.assertNotEqual(submission.fixture_id, "forged")
        with patch.object(runner, "evaluate_submission") as evaluate:
            self.submit("changed duplicate", request_id=request_id)
            evaluate.assert_not_called()
        self.assertEqual(Submission.objects.count(), 1)

    def test_edited_code_pending_and_xss_remains_text(self):
        self.login_as(self.student)
        source = '<script>window.__injected=true</script>\n# arbitrary code'
        with patch.object(runner.subprocess, "run") as execute:
            self.assertEqual(self.submit(source, score="100", status="completed").status_code, 302)
            execute.assert_not_called()
        submission = Submission.objects.get(student=self.student)
        self.assertEqual(submission.status, "pending")
        self.assertIsNone(submission.score)
        response = self.client.get(reverse("submission_detail", args=[submission.pk]))
        self.assertContains(response, "&lt;script&gt;")
        self.assertNotContains(response, "<script>window.__injected")

    def test_closed_task_rejects_new_submissions(self):
        self.assignment.status = "closed"
        self.assignment.save()
        self.login_as(self.student)
        self.assertEqual(self.submit("print(1)").status_code, 403)
        self.assertEqual(Submission.objects.count(), 0)

    def test_resource_completion_is_real_and_idempotent(self):
        self.login_as(self.student)
        url = reverse("resource_complete", args=[self.resource.pk])
        self.assertEqual(self.client.get(url).status_code, 405)
        self.client.post(url)
        self.client.post(url)
        self.assertEqual(ResourceProgress.objects.filter(resource=self.resource, student=self.student).count(), 1)

    def test_csrf_is_required_and_get_cannot_logout(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.student)
        self.assertEqual(client.post(reverse("assignment_submit", args=[self.assignment.pk]), {"source": "x", "request_id": str(uuid.uuid4())}).status_code, 403)
        self.assertEqual(client.get(reverse("logout")).status_code, 405)

    def test_headers_and_loopback_access_boundary(self):
        self.login_as(self.student)
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.headers["X-Frame-Options"], "DENY")
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertIn("script-src 'self'", response.headers["Content-Security-Policy"])
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertEqual(self.client.get(reverse("dashboard"), REMOTE_ADDR="192.168.1.50").status_code, 403)
        self.assertEqual(self.client.get(reverse("dashboard"), HTTP_HOST="attacker.example").status_code, 400)

    def test_model_key_is_encrypted_and_never_echoed(self):
        self.login_as(self.admin)
        with tempfile.TemporaryDirectory() as directory, override_settings(RUNTIME_DIR=Path(directory)):
            data = {"label": "本机测试", "base_url": "http://127.0.0.1:11434/v1", "model": "qwen3.5:4b", "timeout_seconds": 120, "api_key": "synthetic-private-test-key"}
            self.assertEqual(self.client.post(reverse("ai_settings"), data).status_code, 302)
            config = AIConfig.objects.get()
            self.assertNotIn(data["api_key"], config.encrypted_key)
            original = config.encrypted_key
            response = self.client.get(reverse("ai_settings"))
            self.assertNotContains(response, data["api_key"])
            self.assertNotContains(response, original)
            data["api_key"] = ""
            self.client.post(reverse("ai_settings"), data)
            self.assertEqual(AIConfig.objects.get().encrypted_key, original)
            self.assertNotIn("synthetic-private-test-key", str(list(AuditEvent.objects.values_list("details", flat=True))))

    def test_changing_provider_cannot_silently_forward_old_key(self):
        self.login_as(self.admin)
        config = AIConfig.objects.get()
        config.encrypted_key = 'synthetic-encrypted-placeholder'
        config.save()
        data = {'label': '另一个服务', 'base_url': 'https://api.example.test/v1', 'model': 'model', 'timeout_seconds': 30, 'api_key': ''}
        with patch.dict('os.environ', {'COURSELOOP_AI_ALLOWED_HOSTS': 'api.example.test'}):
            self.assertEqual(self.client.post(reverse('ai_settings'), data).status_code, 400)
            self.assertEqual(AIConfig.objects.get().base_url, 'http://127.0.0.1:11434/v1')
            data['clear_key'] = 'on'
            self.assertEqual(self.client.post(reverse('ai_settings'), data).status_code, 302)
            self.assertEqual(AIConfig.objects.get().encrypted_key, '')

    def test_unsafe_upload_rejected_and_safe_text_is_private(self):
        self.login_as(self.teacher)
        with tempfile.TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=Path(directory)):
            data = {"course": self.course.pk, "title": "上传样例", "level": "basic", "kind": "worksheet", "body": "说明", "is_published": "on"}
            data["file"] = SimpleUploadedFile("script.html", b"<script>alert(1)</script>", "text/html")
            self.assertEqual(self.client.post(reverse("resource_new"), data).status_code, 400)
            data["file"] = SimpleUploadedFile("pretend.pdf", b"<script>alert(1)</script>", "application/pdf")
            self.assertEqual(self.client.post(reverse("resource_new"), data).status_code, 400)
            data["file"] = SimpleUploadedFile("lesson.txt", "Python样例材料".encode(), "text/plain")
            self.assertEqual(self.client.post(reverse("resource_new"), data).status_code, 302)
            resource = Resource.objects.get(title="上传样例")
            self.assertNotIn("lesson", resource.file.name)
            self.login_as(self.student)
            response = self.client.get(reverse("resource_download", args=[resource.pk]))
            self.assertEqual(response.status_code, 200)
            self.assertIn("attachment", response.headers["Content-Disposition"])
            self.assertEqual(response.headers["Content-Type"], "application/octet-stream")
            response.close()
            self.client.logout()
            self.assertEqual(self.client.get(reverse("resource_download", args=[resource.pk])).status_code, 302)

    def test_task_version_is_immutable(self):
        self.version.prompt = "篡改旧题目"
        with self.assertRaises(ValidationError):
            self.version.save()

    def test_extensions_do_not_fake_success(self):
        self.login_as(self.student)
        for name in ("api_contests", "api_evaluations"):
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, 501)
            self.assertEqual(response.json()["error"]["code"], "not_implemented")

    def test_invalid_password_reset_preserves_target_for_retry(self):
        self.login_as(self.admin)
        response = self.client.post(reverse("accounts"), {"action": "reset_password", "user_id": self.student.pk, "password1": "x", "password2": "y"})
        self.assertEqual(response.status_code, 400)
        self.assertContains(response, 'name="action" value="reset_password"', status_code=400)
        self.assertContains(response, f'name="user_id" value="{self.student.pk}"', status_code=400)
        new_password = "Synthetic-Retry-Strong-2026!"
        self.assertEqual(self.client.post(reverse("accounts"), {"action": "reset_password", "user_id": self.student.pk, "password1": new_password, "password2": new_password}).status_code, 302)
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password(new_password))

    def test_ai_failure_is_saved_without_fabricated_report(self):
        Submission.objects.create(assignment=self.assignment, student=self.student, source="edited", source_hash="1" * 64, status="pending")
        with patch.object(ai, "_chat", side_effect=ai.AIServiceError("模拟模型断开")):
            report = ai.generate_report(self.assignment, self.teacher)
        self.assertEqual(report.status, "failed")
        self.assertEqual(report.content, "")
        self.assertEqual(report.evidence["pending_students"], 1)
        self.assertIsNone(report.evidence["mean_example_score"])
        self.login_as(self.teacher)
        self.assertEqual(self.client.post(reverse("report_adopt", args=[report.pk])).status_code, 403)

    def test_report_uses_latest_student_result_and_teacher_must_adopt(self):
        for score in (20, 80):
            Submission.objects.create(assignment=self.assignment, student=self.student, source="reviewed", source_hash="1" * 64, status="completed", score=score, result={"cases": [{"label": "空输入", "passed": False}]})
        Submission.objects.create(assignment=self.assignment, student=self.classmate, source="edited", source_hash="2" * 64, status="pending")
        with patch.object(ai, "_chat", return_value="待教师核对的建议"):
            report = ai.generate_report(self.assignment, self.teacher)
        self.assertEqual(report.evidence["submitted_students"], 2)
        self.assertEqual(report.evidence["evaluated_students"], 1)
        self.assertEqual(report.evidence["mean_example_score"], 80)
        self.assertEqual(report.evidence["common_failed_cases"], {"空输入": 1})
        self.assertIsNone(report.adopted_at)
        self.login_as(self.teacher)
        self.assertEqual(self.client.post(reverse("report_adopt", args=[report.pk])).status_code, 302)
        report.refresh_from_db()
        self.assertIsNotNone(report.adopted_at)

    def test_report_current_cohort_excludes_withdrawn_students(self):
        Submission.objects.create(assignment=self.assignment, student=self.classmate, source='historical', source_hash='1' * 64, status='completed', score=100)
        Enrollment.objects.filter(classroom=self.classroom, student=self.classmate).delete()
        evidence = ai._evidence(self.assignment)
        self.assertEqual(evidence['enrolled_count'], 1)
        self.assertEqual(evidence['submitted_students'], 0)
        self.assertEqual(evidence['source_samples'], [])
