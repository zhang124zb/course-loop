import uuid
from pathlib import Path
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

LEVELS = [('basic', '基础巩固'), ('comprehensive', '综合开发'), ('contest', '竞赛备赛')]

def resource_upload_path(instance, filename):
    return f'resources/{uuid.uuid4().hex}{Path(filename).suffix.lower()}'

class Profile(models.Model):
    ROLES = [('student', '学生'), ('teacher', '教师'), ('admin', '管理员')]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField('角色', max_length=12, choices=ROLES, default='student')
    display_name = models.CharField('姓名', max_length=60)

    def __str__(self):
        return self.display_name

class Course(models.Model):
    slug = models.SlugField('课程标识', unique=True, max_length=80)
    title = models.CharField('课程名称', max_length=160)
    description = models.TextField('课程介绍', blank=True)
    language = models.CharField('编程语言', max_length=30, default='Python')

    def __str__(self):
        return self.title

class Classroom(models.Model):
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name='classrooms', verbose_name='课程')
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='teaching_classes', verbose_name='任课教师')
    name = models.CharField('班级名称', max_length=100)

    def __str__(self):
        return f'{self.name} · {self.course.title}'

class Enrollment(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='enrollments')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='enrollments')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['classroom', 'student'], name='unique_enrollment')]

class Resource(models.Model):
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name='resources', verbose_name='课程')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_resources')
    title = models.CharField('资源标题', max_length=160)
    level = models.CharField('资源层级', max_length=20, choices=LEVELS)
    kind = models.CharField('资源类型', max_length=20, choices=[('video', '微课'), ('slides', '课件'), ('worksheet', '实训任务单')])
    body = models.TextField('资源正文', blank=True, max_length=40000)
    url = models.URLField('外部资料地址', blank=True, max_length=500)
    file = models.FileField('附件', upload_to=resource_upload_path, blank=True)
    original_filename = models.CharField(max_length=200, blank=True)
    is_published = models.BooleanField('向学生发布', default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['level', '-created_at']

    def __str__(self):
        return self.title

class ResourceProgress(models.Model):
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name='progress')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['resource', 'student'], name='unique_resource_progress')]

class Task(models.Model):
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name='tasks', verbose_name='课程')
    title = models.CharField('题目名称', max_length=160)
    level = models.CharField('任务层级', max_length=20, choices=LEVELS, default='basic')
    knowledge_points = models.JSONField('知识点', default=list)

    def __str__(self):
        return self.title

class TaskVersion(models.Model):
    task = models.ForeignKey(Task, on_delete=models.PROTECT, related_name='versions')
    number = models.PositiveIntegerField(default=1)
    prompt = models.TextField('题目说明', max_length=30000)
    starter_code = models.TextField('初始代码', blank=True, max_length=20000)
    fixture_key = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['task', 'number'], name='unique_task_version')]

    def save(self, *args, **kwargs):
        if self.pk:
            old = TaskVersion.objects.get(pk=self.pk)
            if any(getattr(old, field) != getattr(self, field) for field in ['task_id', 'number', 'prompt', 'starter_code', 'fixture_key']):
                raise ValidationError('已创建的题目版本不可修改，请创建新版本。')
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.task.title} · v{self.number}'

class Assignment(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.PROTECT, related_name='assignments', verbose_name='班级')
    task_version = models.ForeignKey(TaskVersion, on_delete=models.PROTECT, related_name='assignments', verbose_name='题目版本')
    title = models.CharField('教学任务名称', max_length=160)
    stage = models.CharField('教学阶段', max_length=10, choices=[('before', '课前预习'), ('during', '课中实操'), ('after', '课后训练')])
    status = models.CharField('状态', max_length=12, choices=[('draft', '草稿'), ('published', '已发布'), ('closed', '已关闭')], default='draft')
    due_at = models.DateTimeField('截止时间', blank=True, null=True)
    resources = models.ManyToManyField(Resource, blank=True, related_name='assignments', verbose_name='关联资源')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

class Submission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.PROTECT, related_name='submissions')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='submissions')
    source = models.TextField(max_length=20000)
    source_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=12, choices=[('pending', '待评测'), ('completed', '已评测'), ('error', '评测错误')], default='pending')
    score = models.FloatField(null=True, blank=True)
    passed = models.PositiveIntegerField(default=0)
    total = models.PositiveIntegerField(default=0)
    result = models.JSONField(default=dict)
    fixture_id = models.CharField(max_length=100, blank=True)
    request_id = models.UUIDField(default=uuid.uuid4)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['student', 'request_id'], name='unique_student_submission_request')]

class DiagnosticReport(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.PROTECT, related_name='reports')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    status = models.CharField(max_length=12, choices=[('completed', '已生成'), ('failed', '生成失败')])
    evidence = models.JSONField(default=dict)
    content = models.TextField(blank=True)
    error_message = models.TextField(blank=True)
    model_name = models.CharField(max_length=150, blank=True)
    config_version = models.PositiveIntegerField(default=1)
    adopted_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

class AIConfig(models.Model):
    label = models.CharField('服务名称', max_length=100, default='本机 Ollama')
    base_url = models.URLField('OpenAI 兼容服务地址', max_length=500, default='http://127.0.0.1:11434/v1')
    model = models.CharField('模型名称', max_length=150, default='qwen3.5:4b')
    encrypted_key = models.TextField(blank=True)
    timeout_seconds = models.PositiveIntegerField('请求超时秒数', default=120)
    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        return super().save(*args, **kwargs)

class AuditEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    event = models.CharField(max_length=100)
    object_type = models.CharField(max_length=50, blank=True)
    object_id = models.CharField(max_length=100, blank=True)
    details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
