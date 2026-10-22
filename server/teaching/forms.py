import zipfile
from pathlib import Path
from urllib.parse import urlsplit
from django import forms
from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError
from .access import classrooms_for, courses_for
from .models import AIConfig, Assignment, Classroom, Course, Profile, Resource, Task, TaskVersion

User = get_user_model()

class ResourceForm(forms.ModelForm):
    class Meta:
        model = Resource
        fields = ['course', 'title', 'level', 'kind', 'body', 'url', 'file', 'is_published']
        widgets = {'body': forms.Textarea(attrs={'rows': 10})}

    def __init__(self, *args, user, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['course'].queryset = courses_for(user)
        if self.instance.pk:
            self.fields['course'].disabled = True
        self.fields['file'].help_text = '最大20MB；支持PDF、PPTX、MP4、WEBM、TXT、MD。附件需登录并具备课程权限才能下载。'
        self.fields['url'].help_text = '可选，仅支持HTTPS外部资料链接；平台不会代为读取此地址。'

    def clean_url(self):
        value = self.cleaned_data.get('url', '')
        if value:
            parsed = urlsplit(value)
            if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
                raise ValidationError('资料链接须为不含账号密码的HTTPS地址。')
        return value

    def clean_file(self):
        upload = self.cleaned_data.get('file')
        if not upload or not hasattr(upload, 'content_type'):
            return upload
        if not 0 < upload.size <= 20 * 1024 * 1024:
            raise ValidationError('附件大小须在1字节到20MB之间。')
        extension = Path(upload.name).suffix.lower()
        if extension not in {'.pdf', '.pptx', '.mp4', '.webm', '.txt', '.md'}:
            raise ValidationError('此附件类型不支持；请使用PDF、PPTX、MP4、WEBM、TXT或MD。')
        header = upload.read(512)
        upload.seek(0)
        valid = True
        if extension == '.pdf':
            valid = header.startswith(b'%PDF-')
        elif extension == '.pptx':
            try:
                with zipfile.ZipFile(upload) as archive:
                    names = archive.namelist()
                    valid = len(names) <= 3000 and '[Content_Types].xml' in names and 'ppt/presentation.xml' in names
            except (zipfile.BadZipFile, OSError):
                valid = False
            finally:
                upload.seek(0)
        elif extension == '.mp4':
            valid = len(header) >= 12 and header[4:8] == b'ftyp'
        elif extension == '.webm':
            valid = header.startswith(b'\x1aE\xdf\xa3')
        else:
            try:
                text = upload.read().decode('utf-8-sig')
                valid = '\x00' not in text
            except UnicodeDecodeError:
                valid = False
            finally:
                upload.seek(0)
        if not valid:
            raise ValidationError('附件内容与文件类型不匹配，或文本不是UTF-8编码。')
        return upload

    def clean(self):
        values = super().clean()
        if not any(values.get(key) for key in ['body', 'url', 'file']):
            raise ValidationError('请至少提供正文、外部资料链接或附件之一。')
        return values

class AssignmentForm(forms.ModelForm):
    class Meta:
        model = Assignment
        fields = ['classroom', 'task_version', 'title', 'stage', 'status', 'due_at', 'resources']
        widgets = {'due_at': forms.DateTimeInput(attrs={'type': 'datetime-local'}), 'resources': forms.CheckboxSelectMultiple()}

    def __init__(self, *args, user, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['classroom'].queryset = classrooms_for(user)
        self.fields['task_version'].queryset = TaskVersion.objects.filter(task__course__in=courses_for(user)).select_related('task')
        self.fields['resources'].queryset = Resource.objects.filter(course__in=courses_for(user))
        self.fields['due_at'].input_formats = ['%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M']
        if self.instance.pk:
            # An assignment always points to the task version used when it was created.
            self.fields['classroom'].disabled = True
            self.fields['task_version'].disabled = True

    def clean(self):
        values = super().clean()
        if self.instance.pk and values.get('status') == 'draft' and self.instance.submissions.exists():
            raise ValidationError('已有提交的教学任务不能退回草稿；如需停止提交，请设为已关闭。')
        classroom, version = values.get('classroom'), values.get('task_version')
        if classroom and version and classroom.course_id != version.task.course_id:
            raise ValidationError('班级和题目版本必须属于同一课程。')
        for resource in values.get('resources', []):
            if classroom and resource.course_id != classroom.course_id:
                raise ValidationError('关联资源必须属于班级课程。')
            if values.get('status') == 'published' and not resource.is_published:
                raise ValidationError('任务发布前，请先发布全部关联资源。')
        return values

class SubmissionForm(forms.Form):
    source = forms.CharField(label='Python代码', max_length=20000, strip=False, widget=forms.Textarea(attrs={'rows': 16, 'spellcheck': 'false'}))
    request_id = forms.UUIDField(widget=forms.HiddenInput())

class TaskForm(forms.ModelForm):
    knowledge_points_text = forms.CharField(label='知识点', max_length=500, help_text='使用中文或英文逗号分隔。')
    prompt = forms.CharField(label='题目说明', max_length=30000, widget=forms.Textarea(attrs={'rows': 8}))
    starter_code = forms.CharField(label='初始代码', required=False, strip=False, max_length=20000, widget=forms.Textarea(attrs={'rows': 8}))

    class Meta:
        model = Task
        fields = ['course', 'title', 'level']

    def __init__(self, *args, user, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['course'].queryset = courses_for(user)
        if self.instance.pk:
            self.fields['course'].disabled = True

class CourseForm(forms.ModelForm):
    class Meta:
        model = Course
        fields = ['slug', 'title', 'description', 'language']

class ClassroomForm(forms.ModelForm):
    students = forms.ModelMultipleChoiceField(label='学生名单', queryset=User.objects.none(), required=False, widget=forms.CheckboxSelectMultiple())

    class Meta:
        model = Classroom
        fields = ['course', 'teacher', 'name']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['teacher'].queryset = User.objects.filter(profile__role='teacher', is_active=True)
        self.fields['students'].queryset = User.objects.filter(profile__role='student', is_active=True)

class EnrollmentForm(forms.Form):
    classroom = forms.ModelChoiceField(label='班级', queryset=Classroom.objects.none())
    students = forms.ModelMultipleChoiceField(label='完整学生名单', queryset=User.objects.none(), required=False, widget=forms.CheckboxSelectMultiple(), help_text='保存后以所选名单替换该班级名单。历史提交仍保留。')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['classroom'].queryset = Classroom.objects.all()
        self.fields['students'].queryset = User.objects.filter(profile__role='student', is_active=True)

class AccountForm(forms.Form):
    username = forms.RegexField(label='登录账号', regex=r'^[A-Za-z0-9_.-]{3,40}$', max_length=40, help_text='3—40位英文字母、数字、点、下划线或短横线。')
    display_name = forms.CharField(label='显示姓名', max_length=60)
    role = forms.ChoiceField(label='角色', choices=Profile.ROLES)
    password1 = forms.CharField(label='初始密码', widget=forms.PasswordInput(), max_length=128)
    password2 = forms.CharField(label='确认密码', widget=forms.PasswordInput(), max_length=128)

    def clean_username(self):
        value = self.cleaned_data['username']
        if User.objects.filter(username__iexact=value).exists():
            raise ValidationError('此账号已存在。')
        return value

    def clean(self):
        values = super().clean()
        if values.get('password1') != values.get('password2'):
            raise ValidationError('两次密码不一致。')
        if values.get('password1'):
            password_validation.validate_password(values['password1'], User(username=values.get('username', '')))
        return values

class ResetPasswordForm(forms.Form):
    action = forms.ChoiceField(choices=[('reset_password', '重置密码')], initial='reset_password', widget=forms.HiddenInput())
    user_id = forms.IntegerField(min_value=1, widget=forms.HiddenInput())
    password1 = forms.CharField(label='新密码', widget=forms.PasswordInput(), max_length=128)
    password2 = forms.CharField(label='确认新密码', widget=forms.PasswordInput(), max_length=128)

    def clean(self):
        values = super().clean()
        if values.get('password1') != values.get('password2'):
            raise ValidationError('两次密码不一致。')
        if values.get('password1'):
            password_validation.validate_password(values['password1'])
        return values

class AIConfigForm(forms.ModelForm):
    api_key = forms.CharField(label='新API密钥', required=False, max_length=2000, widget=forms.PasswordInput(render_value=False), help_text='留空保留已有密钥；本机Ollama通常不需要密钥。密钥不会回显。')
    clear_key = forms.BooleanField(label='清除已有密钥', required=False)

    class Meta:
        model = AIConfig
        fields = ['label', 'base_url', 'model', 'timeout_seconds']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._original_base_url = self.instance.base_url
        self._had_encrypted_key = bool(self.instance.encrypted_key)

    def clean_base_url(self):
        from .services.ai import validate_base_url
        return validate_base_url(self.cleaned_data['base_url'])

    def clean_timeout_seconds(self):
        value = self.cleaned_data['timeout_seconds']
        if not 5 <= value <= 120:
            raise ValidationError('超时应为5—120秒。')
        return value

    def clean(self):
        values = super().clean()
        if values.get('clear_key') and values.get('api_key'):
            raise ValidationError('清除密钥和填写新密钥不能同时选择。')
        old, new = urlsplit(self._original_base_url), urlsplit(values.get('base_url', ''))
        if self._had_encrypted_key and new.netloc and (old.scheme, old.netloc) != (new.scheme, new.netloc) and not values.get('api_key') and not values.get('clear_key'):
            raise ValidationError('更换模型服务时，必须填写新密钥或明确勾选清除已有密钥，防止将旧密钥发送给其他服务。')
        return values
