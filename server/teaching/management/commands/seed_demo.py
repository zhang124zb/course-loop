import hashlib
import secrets
import uuid
from pathlib import Path
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from teaching.models import AIConfig, Assignment, AuditEvent, Classroom, Course, Enrollment, Profile, Resource, Submission, Task, TaskVersion
from teaching.services.runner import evaluate_submission, example_sources

User = get_user_model()

class Command(BaseCommand):
    help = '幂等创建模拟课程和独立演示账号；初始密码仅写入本机.runtime目录。'

    def handle(self, *args, **options):
        credentials = []
        with transaction.atomic():
            users = {}
            definitions = [('admin', '管理员（模拟）', 'admin'), ('teacher', '林老师（模拟）', 'teacher')]
            definitions += [(f'student{i}', f'模拟学生{i}', 'student') for i in range(1, 5)]
            for username, display, role in definitions:
                user, created = User.objects.get_or_create(username=username)
                if created:
                    password = secrets.token_urlsafe(15)
                    user.set_password(password)
                    user.is_superuser = role == 'admin'
                    user.is_staff = role == 'admin'
                    user.save()
                    credentials.append(f'{display}\n账号：{username}\n密码：{password}\n')
                Profile.objects.get_or_create(user=user, defaults={'role': role, 'display_name': display})
                users[username] = user
            course, _ = Course.objects.get_or_create(slug='python-programming', defaults={
                'title': 'Python程序设计（样例课程）', 'language': 'Python',
                'description': '面向大学生的教学演示课程。全部班级、学生与提交证据为模拟内容，不用于正式成绩。'})
            classroom, _ = Classroom.objects.get_or_create(course=course, name='软件技术演示班', defaults={'teacher': users['teacher']})
            for index in range(1, 5):
                Enrollment.objects.get_or_create(classroom=classroom, student=users[f'student{index}'])
            content = {
                'basic': ('基础巩固', '列表遍历与空输入', '掌握列表遍历、len与sum；先判断是否为空，再计算平均值。\n思考：为什么空列表不能直接除以len(values)？'),
                'comprehensive': ('综合开发', '函数封装与边界测试', '将输入解析、计算和输出封装为独立函数。\n测试正常输入、空输入、负数、重复值，说明每个用例覆盖的边界。'),
                'contest': ('竞赛备赛', '计数问题与复杂度', '用一次遍历完成偶数计数，分析时间复杂度。\n赛前练习使用相同知识点，正式赛事与成绩回流尚未接通。'),
            }
            resources = []
            for level, (label, topic, text) in content.items():
                for kind, kind_label in [('video', '微课讲稿'), ('slides', '课件讲义'), ('worksheet', '实训任务单')]:
                    title = f'{topic} · {kind_label}'
                    body = f'【样例教学材料】\n资源层级：{label}\n主题：{topic}\n\n{text}\n\n'
                    if kind == 'video':
                        body += '本条提供微课讲稿，尚未提供视频文件；教师可以编辑资源补充经授权的视频文件或HTTPS链接。'
                    elif kind == 'worksheet':
                        body += '实训步骤：阅读知识点 → 手工分析用例 → 完成任务 → 提交并核对反馈 → 记录订正理由。'
                    else:
                        body += '课堂讲义：概念、输入输出约定、典型错误、边界测试、课后迁移练习。'
                    resource, created = Resource.objects.get_or_create(course=course, title=title, defaults={
                        'created_by': users['teacher'], 'level': level, 'kind': kind, 'body': body, 'is_published': True})
                    if created and kind != 'video':
                        filename = f'{level}-{kind}-sample.md'
                        resource.file.save(filename, ContentFile((f'# {title}\n\n{body}\n').encode('utf-8')), save=False)
                        resource.original_filename = filename
                        resource.save()
                    resources.append(resource)
            specifications = [
                ('列表平均值与空输入', 'basic', ['列表', '边界条件', '除零处理'], 'mean-v1', 'before',
                    '输入若干整数或小数，用空格分隔，输出保留一位小数的平均值；空输入输出0。\n示例：输入1 2 3，输出2.0。请先运行边界遗漏示例，再比较订正示例。'),
                ('列表最大值与负数', 'comprehensive', ['列表', '初始化', '负数'], 'max-v1', 'during',
                    '输入若干整数，输出最大值；空输入输出0。\n特别检查：如果列表全部是负数，初始最大值应如何设置？'),
                ('偶数计数与负数', 'contest', ['条件判断', '取模', '边界测试'], 'count-v1', 'after',
                    '输入若干整数，输出其中偶数的个数；空输入输出0。\n请解释：为什么负偶数和0也应计入？'),
            ]
            for number, (title, level, points, fixture_key, stage, prompt) in enumerate(specifications, 1):
                task, _ = Task.objects.get_or_create(course=course, title=title, defaults={'level': level, 'knowledge_points': points})
                examples = example_sources(fixture_key)
                version, _ = TaskVersion.objects.get_or_create(task=task, number=1, defaults={
                    'prompt': prompt, 'starter_code': examples[0]['source'] if examples else '', 'fixture_key': fixture_key})
                assignment, created = Assignment.objects.get_or_create(classroom=classroom, task_version=version,
                    defaults={'title': title, 'stage': stage, 'status': 'published', 'created_by': users['teacher']})
                if created:
                    assignment.resources.set([resource for resource in resources if resource.level == level])
                for index in range(1, 5):
                    request_id = uuid.uuid5(uuid.NAMESPACE_URL, f'courseloop-demo:{number}:student{index}')
                    if Submission.objects.filter(student=users[f'student{index}'], request_id=request_id).exists():
                        continue
                    example = examples[0 if index <= 3 else -1]
                    submission = Submission.objects.create(assignment=assignment, student=users[f'student{index}'],
                        source=example['source'], source_hash=hashlib.sha256(example['source'].encode('utf-8')).hexdigest(), request_id=request_id)
                    result = evaluate_submission(submission)
                    for field in ['status', 'score', 'passed', 'total', 'fixture_id']:
                        setattr(submission, field, result[field])
                    submission.result = result
                    submission.save()
            AIConfig.objects.get_or_create(pk=1, defaults={'timeout_seconds': 120})
            if credentials:
                AuditEvent.objects.create(event='demo.seeded', details={'simulated': True, 'new_accounts': len(credentials)})
        credential_path = Path(settings.RUNTIME_DIR) / 'demo-accounts.txt'
        if credentials:
            with credential_path.open('a', encoding='utf-8') as target:
                target.write('\nCourseLoop 本机模拟账号；请勿上传或公开此文件。\n' + '\n'.join(credentials))
            credential_path.chmod(0o600)
        self.stdout.write(self.style.SUCCESS('样例课程、班级、资源、任务和真实样例运行记录已准备完成。'))
        self.stdout.write(f'新建账号的本机凭据位置：{credential_path}')
        self.stdout.write('重复运行不会重置密码，也不会覆盖已编辑的课程或重复添加提交。')
