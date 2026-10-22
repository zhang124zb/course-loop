from django.core.exceptions import PermissionDenied
from .models import Assignment, Classroom, Course, Resource, Submission

def role_for(user):
    if not user.is_authenticated:
        return ''
    if user.is_superuser:
        return 'admin'
    try:
        role = user.profile.role
        return role if role in ('teacher', 'student') else 'student'
    except Exception:
        return 'student'

def require_role(user, *roles):
    if role_for(user) not in roles:
        raise PermissionDenied('当前账号无权执行此操作。')

def classrooms_for(user):
    role = role_for(user)
    query = Classroom.objects.select_related('course', 'teacher')
    if role == 'admin':
        return query.all()
    if role == 'teacher':
        return query.filter(teacher=user)
    return query.filter(enrollments__student=user).distinct()

def courses_for(user):
    if role_for(user) == 'admin':
        return Course.objects.all()
    return Course.objects.filter(classrooms__in=classrooms_for(user)).distinct()

def resources_for(user):
    query = Resource.objects.select_related('course', 'created_by').filter(course__in=courses_for(user))
    if role_for(user) == 'student':
        query = query.filter(is_published=True)
    return query

def assignments_for(user):
    query = Assignment.objects.select_related('classroom__course', 'classroom__teacher', 'task_version__task').filter(classroom__in=classrooms_for(user))
    if role_for(user) == 'student':
        query = query.exclude(status='draft')
    return query

def submissions_for(user):
    query = Submission.objects.select_related('assignment__classroom', 'assignment__task_version__task', 'student').filter(assignment__in=assignments_for(user))
    return query.filter(student=user) if role_for(user) == 'student' else query

def can_edit_resource(user, resource):
    return role_for(user) == 'admin' or (role_for(user) == 'teacher' and resource.created_by_id == user.pk and courses_for(user).filter(pk=resource.course_id).exists())
