import hashlib
import uuid
from functools import wraps
from pathlib import Path

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm
from django.core.cache import cache
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Q
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from .access import assignments_for, can_edit_resource, classrooms_for, courses_for, require_role, resources_for, role_for, submissions_for
from .forms import AccountForm, AIConfigForm, AssignmentForm, ClassroomForm, CourseForm, EnrollmentForm, ResetPasswordForm, ResourceForm, SubmissionForm, TaskForm
from .models import AIConfig, Assignment, AuditEvent, Classroom, Course, DiagnosticReport, Enrollment, Profile, Resource, ResourceProgress, Submission, Task, TaskVersion

User = get_user_model()

def _audit(user, event, obj=None, details=None):
    AuditEvent.objects.create(actor=user if user and user.is_authenticated else None, event=event,
        object_type=obj.__class__.__name__ if obj else '', object_id=str(obj.pk) if obj else '', details=details or {})

def _page_form(request, form, title, description='', cancel='dashboard', status=200):
    return render(request, 'teaching/form.html', {'form': form, 'title': title, 'description': description,
        'submit_label': '保存', 'cancel_url': reverse(cancel)}, status=status)

def _limit(key, maximum, seconds=600):
    cache.add(key, 0, timeout=seconds)
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=seconds)
        count = 1
    return count > maximum

@require_http_methods(['GET', 'POST'])
def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    form = AuthenticationForm(request, data=request.POST if request.method == 'POST' else None)
    status = 200
    if request.method == 'POST':
        identifier = hashlib.sha256(request.POST.get('username', '').lower().encode('utf-8')).hexdigest()
        key = f'login:{identifier}'
        if cache.get(key, 0) >= 6 or cache.get('login:global', 0) >= 60:
            form.add_error(None, '登录尝试次数过多，请10分钟后重试。')
            status = 429
        elif form.is_valid():
            user = form.get_user()
            login(request, user)
            cache.delete(key)
            _audit(user, 'auth.login')
            return redirect('dashboard')
        else:
            _limit(key, 6)
            _limit('login:global', 60)
            status = 400
    return render(request, 'teaching/login.html', {'form': form}, status=status)

@login_required
@require_POST
def logout_view(request):
    _audit(request.user, 'auth.logout')
    logout(request)
    return redirect('login')

@login_required
@require_GET
def dashboard(request):
    assignments = assignments_for(request.user)
    submissions = submissions_for(request.user)
    reports = DiagnosticReport.objects.filter(assignment__in=assignments).select_related('assignment', 'created_by')
    if role_for(request.user) == 'student':
        reports = reports.none()
    return render(request, 'teaching/dashboard.html', {
        'stats': {'resource_count': resources_for(request.user).count(), 'assignment_count': assignments.count(),
            'submission_count': submissions.count(), 'pending_count': submissions.filter(status='pending').count()},
        'assignments': assignments[:6], 'recent_submissions': submissions[:6], 'recent_reports': reports[:3],
        'classrooms': classrooms_for(request.user),
    })

@login_required
@require_GET
def resource_list(request):
    query = resources_for(request.user)
    selected_course = request.GET.get('course', '')
    selected_level = request.GET.get('level', '')
    selected_kind = request.GET.get('kind', '')
    search = request.GET.get('q', '')[:120].strip()
    if selected_course.isdecimal() and len(selected_course) <= 10:
        query = query.filter(course_id=int(selected_course))
    if selected_level in ('basic', 'comprehensive', 'contest'):
        query = query.filter(level=selected_level)
    if selected_kind in ('video', 'slides', 'worksheet'):
        query = query.filter(kind=selected_kind)
    if search:
        query = query.filter(Q(title__icontains=search) | Q(body__icontains=search))
    return render(request, 'teaching/resource_list.html', {'resources': query[:200], 'courses': courses_for(request.user),
        'selected_course': selected_course, 'selected_level': selected_level, 'selected_kind': selected_kind,
        'q': search, 'can_manage': role_for(request.user) in ('teacher', 'admin')})

@login_required
@require_http_methods(['GET', 'POST'])
def resource_edit(request, pk=None):
    require_role(request.user, 'teacher', 'admin')
    resource = get_object_or_404(resources_for(request.user), pk=pk) if pk else None
    if resource and not can_edit_resource(request.user, resource):
        raise PermissionDenied('只有资源创建者或管理员可以修改此资源。')
    form = ResourceForm(request.POST or None, request.FILES or None, instance=resource, user=request.user)
    if request.method == 'POST' and form.is_valid():
        resource = form.save(commit=False)
        if not resource.pk:
            resource.created_by = request.user
        if 'file' in request.FILES:
            resource.original_filename = Path(request.FILES['file'].name).name[:200]
        resource.save()
        _audit(request.user, 'resource.saved', resource, {'published': resource.is_published})
        messages.success(request, '资源已保存。')
        return redirect('resource_detail', pk=resource.pk)
    return _page_form(request, form, '编辑资源' if pk else '新增分层资源', '资源按课程和角色控制访问，正文以纯文本呈现。', 'resources', 400 if request.method == 'POST' else 200)

@login_required
@require_GET
def resource_detail(request, pk):
    resource = get_object_or_404(resources_for(request.user), pk=pk)
    completion_records = resource.progress.filter(student__enrollments__classroom__in=classrooms_for(request.user)).select_related('student').distinct() if role_for(request.user) in ('teacher', 'admin') else resource.progress.none()
    return render(request, 'teaching/resource_detail.html', {'resource': resource,
        'completed': ResourceProgress.objects.filter(resource=resource, student=request.user).exists(),
        'can_edit': can_edit_resource(request.user, resource), 'completion_records': completion_records})

@login_required
@require_GET
def resource_download(request, pk):
    resource = get_object_or_404(resources_for(request.user), pk=pk)
    if not resource.file:
        raise Http404('资源没有附件。')
    root = Path(settings.MEDIA_ROOT).resolve()
    file_path = Path(resource.file.path).resolve()
    if not file_path.is_relative_to(root) or not file_path.is_file():
        raise Http404('附件不存在。')
    _audit(request.user, 'resource.downloaded', resource)
    response = FileResponse(file_path.open('rb'), as_attachment=True,
        filename=resource.original_filename or file_path.name, content_type='application/octet-stream')
    response['Content-Security-Policy'] = "default-src 'none'; sandbox"
    return response

@login_required
@require_POST
def resource_complete(request, pk):
    require_role(request.user, 'student')
    resource = get_object_or_404(resources_for(request.user), pk=pk)
    _, created = ResourceProgress.objects.get_or_create(resource=resource, student=request.user)
    if created:
        _audit(request.user, 'resource.completed', resource)
    messages.success(request, '学习完成记录已保存。该记录不等同于有效学习时长。')
    return redirect('resource_detail', pk=pk)

@login_required
@require_GET
def teaching(request):
    assignments = assignments_for(request.user)
    can_manage = role_for(request.user) in ('teacher', 'admin')
    reports = DiagnosticReport.objects.filter(assignment__in=assignments).select_related('assignment') if can_manage else DiagnosticReport.objects.none()
    progress_records = ResourceProgress.objects.filter(student__enrollments__classroom__in=classrooms_for(request.user), resource__course__in=courses_for(request.user)).select_related('student', 'resource').distinct().order_by('-completed_at') if can_manage else ResourceProgress.objects.filter(student=request.user).select_related('student', 'resource').order_by('-completed_at')
    return render(request, 'teaching/teaching.html', {'classrooms': classrooms_for(request.user).annotate(student_count=Count('enrollments')),
        'assignments': assignments, 'reports': reports[:20], 'progress_records': progress_records[:100]})

@login_required
@require_http_methods(['GET', 'POST'])
def task_new(request, pk=None):
    require_role(request.user, 'teacher', 'admin')
    task = get_object_or_404(Task.objects.filter(course__in=courses_for(request.user)), pk=pk) if pk else None
    form = TaskForm(request.POST or None, instance=task, user=request.user)
    if task and request.method == 'GET':
        latest = task.versions.order_by('-number').first()
        form.initial.update(knowledge_points_text='，'.join(task.knowledge_points), prompt=latest.prompt, starter_code=latest.starter_code)
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            task = form.save(commit=False)
            task.knowledge_points = [item.strip() for item in form.cleaned_data['knowledge_points_text'].replace('，', ',').split(',') if item.strip()][:20]
            task.save()
            version = TaskVersion.objects.create(task=task,
                number=(task.versions.aggregate(value=Max('number'))['value'] or 0) + 1,
                prompt=form.cleaned_data['prompt'], starter_code=form.cleaned_data['starter_code'], fixture_key='')
            _audit(request.user, 'task.version_created', version)
        messages.success(request, '题目版本已保存。新增题目的代码提交先进入待评测，不会自动进入本机运行白名单。')
        return redirect('assignment_new')
    return _page_form(request, form, '创建题目新版本' if pk else '新增教学题目', '题目版本创建后不可修改；教师新增代码不会自动成为可执行样例。', 'teaching', 400 if request.method == 'POST' else 200)

@login_required
@require_http_methods(['GET', 'POST'])
def assignment_edit(request, pk=None):
    require_role(request.user, 'teacher', 'admin')
    assignment = get_object_or_404(assignments_for(request.user), pk=pk) if pk else None
    form = AssignmentForm(request.POST or None, instance=assignment, user=request.user)
    if request.method == 'POST' and form.is_valid():
        assignment = form.save(commit=False)
        if not assignment.pk:
            assignment.created_by = request.user
        with transaction.atomic():
            assignment.save()
            form.save_m2m()
            _audit(request.user, 'assignment.saved', assignment, {'status': assignment.status, 'task_version': assignment.task_version_id})
        messages.success(request, '教学任务已保存。')
        return redirect('assignment_detail', pk=assignment.pk)
    return _page_form(request, form, '编辑教学任务' if pk else '布置教学任务', '课前、课中、课后活动共用真实任务与提交记录。', 'teaching', 400 if request.method == 'POST' else 200)

@login_required
@require_GET
def assignment_detail(request, pk):
    assignment = get_object_or_404(assignments_for(request.user), pk=pk)
    from .services.runner import example_sources
    submissions = submissions_for(request.user).filter(assignment=assignment)
    can_manage = role_for(request.user) in ('teacher', 'admin')
    source = assignment.task_version.starter_code
    fixtures = example_sources(assignment.task_version.fixture_key)
    if fixtures and not source:
        source = fixtures[0]['source']
    visible_resources = assignment.resources.all() if can_manage else assignment.resources.filter(is_published=True)
    return render(request, 'teaching/assignment_detail.html', {'assignment': assignment,
        'submissions': submissions[:100], 'my_submissions': submissions.filter(student=request.user)[:20],
        'submission_form': SubmissionForm(initial={'source': source, 'request_id': uuid.uuid4()}),
        'fixtures': fixtures, 'fixture_examples': fixtures, 'can_manage': can_manage, 'visible_resources': visible_resources,
        'latest_report': assignment.reports.first() if can_manage else None,
        'completed_count': assignment.submissions.filter(status='completed').count() if can_manage else None,
    })

@login_required
@require_POST
def assignment_submit(request, pk):
    require_role(request.user, 'student')
    assignment = get_object_or_404(assignments_for(request.user), pk=pk)
    if assignment.status != 'published' or (assignment.due_at and assignment.due_at < timezone.now()):
        raise PermissionDenied('此任务当前不接受新的提交。')
    form = SubmissionForm(request.POST)
    if not form.is_valid():
        return _page_form(request, form, '提交内容需要修改', '代码未保存，请检查错误。', status=400)
    duplicate = Submission.objects.filter(student=request.user, request_id=form.cleaned_data['request_id']).first()
    if duplicate:
        if duplicate.assignment_id != assignment.pk:
            raise PermissionDenied('提交标识已用于其他任务。')
        return redirect('submission_detail', pk=duplicate.pk)
    if _limit(f'submission:{request.user.pk}', 30, 60):
        messages.error(request, '提交过于频繁，请稍后再试。')
        return redirect('assignment_detail', pk=pk)
    source = form.cleaned_data['source'].replace('\r\n', '\n')
    try:
        submission = Submission.objects.create(assignment=assignment, student=request.user, source=source,
            source_hash=hashlib.sha256(source.encode('utf-8')).hexdigest(), request_id=form.cleaned_data['request_id'])
    except IntegrityError:
        submission = get_object_or_404(Submission, student=request.user, request_id=form.cleaned_data['request_id'])
        if submission.assignment_id != assignment.pk:
            raise PermissionDenied('提交标识已用于其他任务。')
        return redirect('submission_detail', pk=submission.pk)
    from .services.runner import evaluate_submission
    result = evaluate_submission(submission)
    submission.status = result['status']
    submission.score = result['score']
    submission.passed = result['passed']
    submission.total = result['total']
    submission.fixture_id = result['fixture_id']
    submission.result = result
    submission.save(update_fields=['status', 'score', 'passed', 'total', 'fixture_id', 'result'])
    _audit(request.user, 'submission.created', submission, {'status': submission.status, 'source_hash': submission.source_hash})
    return redirect('submission_detail', pk=submission.pk)

@login_required
@require_GET
def submission_detail(request, pk):
    return render(request, 'teaching/submission_detail.html', {'submission': get_object_or_404(submissions_for(request.user), pk=pk)})

@login_required
@require_POST
def assignment_diagnose(request, pk):
    require_role(request.user, 'teacher', 'admin')
    assignment = get_object_or_404(assignments_for(request.user), pk=pk)
    if _limit(f'diagnosis:{request.user.pk}', 5, 60):
        messages.error(request, '诊断生成次数过多，请稍后重试。')
        return redirect('assignment_detail', pk=pk)
    from .services.ai import generate_report
    report = generate_report(assignment, request.user)
    _audit(request.user, 'diagnostic.generated', report, {'status': report.status, 'config_version': report.config_version})
    return redirect('report_detail', pk=report.pk)

@login_required
@require_GET
def report_detail(request, pk):
    require_role(request.user, 'teacher', 'admin')
    report = get_object_or_404(DiagnosticReport.objects.select_related('assignment__classroom', 'created_by').filter(assignment__in=assignments_for(request.user)), pk=pk)
    return render(request, 'teaching/report_detail.html', {'report': report})

@login_required
@require_POST
def report_adopt(request, pk):
    require_role(request.user, 'teacher', 'admin')
    report = get_object_or_404(DiagnosticReport.objects.filter(assignment__in=assignments_for(request.user)), pk=pk)
    if report.status != 'completed':
        raise PermissionDenied('失败的诊断不能确认为已审阅。')
    if not report.adopted_at:
        report.adopted_at = timezone.now()
        report.save(update_fields=['adopted_at'])
        _audit(request.user, 'diagnostic.adopted', report)
    messages.success(request, '已记录教师审阅确认。建议不会自动发布任务或更改成绩。')
    return redirect('report_detail', pk=pk)

@login_required
@require_http_methods(['GET', 'POST'])
def accounts(request):
    require_role(request.user, 'admin')
    form = AccountForm(request.POST if request.method == 'POST' and request.POST.get('action', 'create') == 'create' else None)
    status = 200
    if request.method == 'POST':
        action = request.POST.get('action', 'create')
        if action == 'create' and form.is_valid():
            with transaction.atomic():
                user = User.objects.create_user(username=form.cleaned_data['username'], password=form.cleaned_data['password1'],
                    is_superuser=form.cleaned_data['role'] == 'admin', is_staff=form.cleaned_data['role'] == 'admin')
                Profile.objects.create(user=user, role=form.cleaned_data['role'], display_name=form.cleaned_data['display_name'])
                _audit(request.user, 'account.created', user, {'role': form.cleaned_data['role']})
            messages.success(request, '账号已创建，请通过安全方式交付初始密码。')
            return redirect('accounts')
        elif action in ('deactivate', 'activate', 'reset_password'):
            target = get_object_or_404(User, pk=request.POST.get('user_id') if request.POST.get('user_id', '').isdigit() else 0)
            if target.pk == request.user.pk and action == 'deactivate':
                raise PermissionDenied('不能停用当前登录账号。')
            if action == 'reset_password':
                reset = ResetPasswordForm(request.POST)
                if not reset.is_valid():
                    return _page_form(request, reset, '重置账号密码', cancel='accounts', status=400)
                target.set_password(reset.cleaned_data['password1'])
                target.save(update_fields=['password'])
            else:
                target.is_active = action == 'activate'
                target.save(update_fields=['is_active'])
            _audit(request.user, f'account.{action}', target)
            messages.success(request, '账号设置已更新。')
            return redirect('accounts')
        else:
            status = 400
    return render(request, 'teaching/accounts.html', {'users': User.objects.select_related('profile').order_by('username'), 'form': form}, status=status)

@login_required
@require_http_methods(['GET', 'POST'])
def classes(request):
    require_role(request.user, 'admin')
    action = request.POST.get('action', 'create_class') if request.method == 'POST' else ''
    form = ClassroomForm(request.POST if action == 'create_class' else None)
    course_form = CourseForm(request.POST if action == 'create_course' else None)
    enrollment_form = EnrollmentForm(request.POST if action == 'enroll' else None)
    status = 200
    if request.method == 'POST':
        if action == 'create_class' and form.is_valid():
            with transaction.atomic():
                classroom = form.save()
                Enrollment.objects.bulk_create([Enrollment(classroom=classroom, student=student) for student in form.cleaned_data['students']])
                _audit(request.user, 'classroom.created', classroom)
            messages.success(request, '班级和学生名单已保存。')
            return redirect('classes')
        if action == 'create_course' and course_form.is_valid():
            course = course_form.save()
            _audit(request.user, 'course.created', course)
            messages.success(request, '课程已创建，可以添加班级、资源和任务。')
            return redirect('classes')
        if action == 'enroll' and enrollment_form.is_valid():
            classroom = enrollment_form.cleaned_data['classroom']
            ids = [student.pk for student in enrollment_form.cleaned_data['students']]
            with transaction.atomic():
                Enrollment.objects.filter(classroom=classroom).exclude(student_id__in=ids).delete()
                for student_id in ids:
                    Enrollment.objects.get_or_create(classroom=classroom, student_id=student_id)
                _audit(request.user, 'classroom.enrollment_updated', classroom, {'student_count': len(ids)})
            messages.success(request, '班级名单已更新，历史提交保留。')
            return redirect('classes')
        status = 400
    return render(request, 'teaching/classes.html', {'classrooms': Classroom.objects.select_related('course', 'teacher').annotate(student_count=Count('enrollments')),
        'form': form, 'course_form': course_form, 'enrollment_form': enrollment_form}, status=status)

@login_required
@require_http_methods(['GET', 'POST'])
def ai_settings(request):
    require_role(request.user, 'admin')
    from .services.ai import encrypt_api_key, public_config
    config = AIConfig.objects.filter(pk=1).first() or AIConfig(pk=1, timeout_seconds=120)
    form = AIConfigForm(request.POST or None, instance=config)
    if request.method == 'POST' and form.is_valid():
        try:
            encrypted = encrypt_api_key(form.cleaned_data['api_key']) if form.cleaned_data['api_key'] else None
        except ValidationError as error:
            form.add_error('api_key', error)
        else:
            with transaction.atomic():
                current = AIConfig.objects.select_for_update().filter(pk=1).first()
                updated = form.save(commit=False)
                updated.encrypted_key = '' if form.cleaned_data['clear_key'] else encrypted if encrypted is not None else current.encrypted_key if current else ''
                updated.version = current.version + 1 if current else 1
                updated.save()
                _audit(request.user, 'ai.config_updated', updated, {'version': updated.version, 'model': updated.model})
            messages.success(request, '模型配置已保存；密钥已按本机配置加密，不会回显。')
            return redirect('ai_settings')
    return render(request, 'teaching/ai_settings.html', {'form': form, 'config': public_config(config),
        'key_configured': bool(config.encrypted_key), 'test_result': request.session.pop('ai_test_result', None),
        'allowed_ai_hosts': settings.AI_ALLOWED_HOSTS}, status=400 if request.method == 'POST' else 200)

@login_required
@require_POST
def ai_test(request):
    require_role(request.user, 'admin')
    if _limit(f'ai-test:{request.user.pk}', 4, 60):
        messages.error(request, '连接测试过于频繁，请稍后再试。')
        return redirect('ai_settings')
    from .services.ai import AIServiceError, test_connection
    config, _ = AIConfig.objects.get_or_create(pk=1, defaults={'timeout_seconds': 120})
    try:
        result = test_connection(config)
    except (AIServiceError, ValidationError):
        result = {'ok': False, 'message': '连接失败，请检查模型服务、模型名称、允许域名和超时设置。'}
    request.session['ai_test_result'] = result
    _audit(request.user, 'ai.connection_test', config, {'ok': result.get('ok', False)})
    return redirect('ai_settings')

@login_required
@require_GET
def audit(request):
    require_role(request.user, 'admin')
    return render(request, 'teaching/audit.html', {'events': AuditEvent.objects.select_related('actor')[:200]})

def api_auth(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': {'code': 'authentication_required', 'message': '请先登录。'}}, status=401)
        try:
            return view(request, *args, **kwargs)
        except Http404:
            return JsonResponse({'error': {'code': 'not_found', 'message': '对象不存在或无访问权限。'}}, status=404)
    return wrapped

@api_auth
@require_GET
def api_courses(request):
    return JsonResponse({'items': list(courses_for(request.user).values('id', 'slug', 'title', 'language'))})

@api_auth
@require_GET
def api_assignment(request, pk):
    item = get_object_or_404(assignments_for(request.user), pk=pk)
    return JsonResponse({'id': item.pk, 'title': item.title, 'stage': item.stage, 'status': item.status,
        'course_id': item.classroom.course_id, 'classroom_id': item.classroom_id,
        'task_version_id': item.task_version_id, 'task_version': item.task_version.number,
        'prompt': item.task_version.prompt, 'due_at': item.due_at.isoformat() if item.due_at else None})

@api_auth
@require_GET
def api_submission(request, pk):
    item = get_object_or_404(submissions_for(request.user), pk=pk)
    return JsonResponse({'id': item.pk, 'assignment_id': item.assignment_id, 'student_id': item.student_id,
        'status': item.status, 'score': item.score, 'passed': item.passed, 'total': item.total,
        'source_hash': item.source_hash, 'result': item.result, 'created_at': item.created_at.isoformat()})

@api_auth
@require_GET
def api_extensions(request):
    return JsonResponse({'version': 'v1', 'implemented': ['courses', 'assignments', 'submissions', 'teacher_diagnostics'],
        'planned': {'contests': {'url': '/api/v1/contests/', 'status': 'not_implemented'},
                    'evaluations': {'url': '/api/v1/evaluations/', 'status': 'not_implemented'}},
        'code_execution': 'reviewed_repository_examples_only', 'official_grades': False})

@api_auth
@require_GET
def api_unimplemented(request):
    return JsonResponse({'error': {'code': 'not_implemented', 'message': '该功能保留接口，尚未实现真实业务。'}, 'status': 'planned'}, status=501)
