'use strict';

(() => {
  const byId = (items, id) => items.find(item => item.id === Number(id));
  const normalize = value => String(value).replace(/\r\n/g, '\n');
  const classList = C => C.state.classes.filter(item => C.role === 'admin' || (C.role === 'teacher' ? item.teacherId === C.user.id : item.studentIds.includes(C.user.id)));
  const courseList = C => C.role === 'admin' ? C.state.courses : C.state.courses.filter(item => classList(C).some(group => group.courseId === item.id));
  const resourceList = C => C.state.resources.filter(item => courseList(C).some(course => course.id === item.courseId) && (C.canTeach || item.published));
  const assignmentList = C => C.state.assignments.filter(item => classList(C).some(group => group.id === item.classId) && (C.canTeach || item.status !== 'draft'));
  const submissionList = C => C.state.submissions.filter(item => assignmentList(C).some(assignment => assignment.id === item.assignmentId) && (C.canTeach || item.studentId === C.user.id));
  const reportList = C => C.canTeach ? C.state.reports.filter(item => assignmentList(C).some(assignment => assignment.id === item.assignmentId)) : [];
  const recent = items => [...items].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.id - a.id);
  const courseName = (C, id) => byId(C.state.courses, id)?.title || '未指定课程';
  const studentName = (C, id) => C.state.users.find(user => user.id === id)?.name || '演示学生';
  const badge = (C, text, kind = 'neutral') => `<span class="badge ${kind}">${C.e(text)}</span>`;
  const empty = (title, text) => `<div class="empty-state"><strong>${title}</strong><p>${text}</p></div>`;
  const link = (path, text, kind = 'button') => `<a class="${kind}" href="#${path}">${text}</a>`;
  const heading = (C, title, subtitle, actions = '', label = 'CLASSROOM') => `<div class="page-heading"><div><p class="eyebrow">COURSELOOP / ${label}</p><h1>${C.e(title)}</h1><p class="subtitle">${C.e(subtitle)}</p></div><div class="actions">${actions}</div></div>`;
  const options = (C, items, selected, getText = item => item.title) => items.map(item => `<option value="${C.e(item.id)}" ${String(item.id) === String(selected) ? 'selected' : ''}>${C.e(getText(item))}</option>`).join('');
  const mapOptions = (C, map, selected) => Object.entries(map).map(([value, text]) => `<option value="${C.e(value)}" ${value === selected ? 'selected' : ''}>${C.e(text)}</option>`).join('');
  const denied = () => ({ title: '内容暂不可见', html: empty('当前演示角色没有此内容', '请返回教学工作台，或切换到相应的演示角色。') + link('/dashboard', '返回工作台') });
  const taskLevels = { basic: '基础巩固', advanced: '进阶应用', project: '综合项目' };
  const statusBadge = (C, status) => badge(C, C.statuses[status] || status, status === 'published' || status === 'completed' ? 'success' : status === 'pending' || status === 'draft' ? 'warning' : 'neutral');

  function resources(C) {
    const level = C.query.get('level') || '', kind = C.query.get('kind') || '', q = (C.query.get('q') || '').slice(0, 120), course = C.query.get('course') || '';
    const items = resourceList(C).filter(item => (!level || item.level === level) && (!kind || item.kind === kind) && (!course || String(item.courseId) === course) && `${item.title}\n${item.body}`.toLowerCase().includes(q.toLowerCase()));
    return { title: '分层资源库', html: heading(C, '分层校本资源库', '基础巩固、综合开发、竞赛备赛，让不同阶段都有合适的学习材料。', C.canTeach ? link('/resources/new', '＋ 新建资源', 'button primary') : '', 'RESOURCES') +
      `<form data-form="resource-filter" class="filter-bar"><div class="filter-field"><label for="course-filter">课程</label><select id="course-filter" name="course"><option value="">全部课程</option>${options(C, courseList(C), course)}</select></div><div class="filter-field"><label for="level-filter">层级</label><select id="level-filter" name="level"><option value="">全部层级</option>${mapOptions(C, C.levels, level)}</select></div><div class="filter-field"><label for="kind-filter">类型</label><select id="kind-filter" name="kind"><option value="">全部类型</option>${mapOptions(C, C.kinds, kind)}</select></div><div class="filter-field search"><label for="resource-search">搜索</label><input id="resource-search" name="q" type="search" maxlength="120" value="${C.e(q)}" placeholder="资源名称或内容"></div><button class="button" type="submit">筛选</button>${link('/resources', '重置', 'text-link')}</form>` +
      `<div class="resource-grid">${items.map(item => `<article class="resource-card"><a class="resource-cover ${C.e(item.level)}" href="#/resources/${item.id}"><div><span>${C.e(C.levels[item.level] || item.level)}</span><strong>${C.e(C.kinds[item.kind] || item.kind)}</strong><small>${C.e(courseName(C, item.courseId))}</small></div><span class="cover-glyph" aria-hidden="true">${item.kind === 'video' ? '▷' : item.kind === 'slides' ? '▤' : '&lt;/&gt;'}</span></a><div class="resource-body">${badge(C, item.published ? '可学习' : '草稿', item.published ? '' : 'warning')}<h2><a href="#/resources/${item.id}">${C.e(item.title)}</a></h2><p>${C.e(item.body.slice(0, 85))}${item.body.length > 85 ? '…' : ''}</p><div class="card-footer"><span>${C.e(C.kinds[item.kind] || item.kind)}</span>${link(`/resources/${item.id}`, '查看资源 →', 'text-link')}</div></div></article>`).join('') || `<div class="wide panel">${empty('当前条件下没有资源', '试试其他课程、层级或关键词。')}</div>`}</div>` };
  }

  function resourceDetail(C, item) {
    const completed = C.state.progress.includes(`${C.user.id}:${item.id}`);
    const students = C.state.users.filter(user => user.role === 'student' && classList(C).some(group => group.courseId === item.courseId && group.studentIds.includes(user.id)) && C.state.progress.includes(`${user.id}:${item.id}`));
    return { title: '学习资源', html: heading(C, item.title, `${courseName(C, item.courseId)} · ${C.levels[item.level]} · ${C.kinds[item.kind]}`, link('/resources', '返回资源库') + (C.canTeach ? link(`/resources/${item.id}/edit`, '编辑资源', 'button primary') : ''), 'RESOURCE') +
      `<article class="panel reading-panel"><div class="panel-header"><div class="actions">${badge(C, C.levels[item.level])}${badge(C, C.kinds[item.kind])}${!item.published ? badge(C, '草稿', 'warning') : ''}</div><span class="small muted">模拟课程材料</span></div><div class="reading-content plain-text">${C.e(item.body)}</div></article>` +
      (C.role === 'student' ? `<section class="completion-strip"><div><strong>${completed ? '已记录学习完成' : '学完这项资源了吗？'}</strong><p>完成标记仅保存在当前浏览器，不表示学习时长。</p></div>${completed ? badge(C, '已完成', 'success') : `<button class="button primary" type="button" data-action="complete-resource" data-id="${item.id}">标记学习完成 ✓</button>`}</section>` : '') +
      (C.canTeach && students.length ? `<section class="panel section-gap"><div class="panel-header"><h2>学生学习完成记录</h2><span class="small muted">当前演示班级</span></div><div class="table-scroll"><table><thead><tr><th>学生</th><th>记录类型</th></tr></thead><tbody>${students.map(student => `<tr><td>${C.e(student.name)}</td><td>${badge(C, '学生确认完成', 'success')}</td></tr>`).join('')}</tbody></table></div></section>` : '') };
  }

  function resourceForm(C, item) {
    if (!C.canTeach) return denied();
    if (!courseList(C).length) return { title: '新建资源', html: empty('请先准备课程与班级', '管理员创建课程和演示班级后，教师就可以添加资源。') };
    return { title: item ? '编辑资源' : '新建资源', html: heading(C, item ? '编辑资源' : '新建资源', '填写模拟课程正文；在线演示不上传文件或读取外部材料。', '', 'EDITOR') +
      `<section class="panel form-panel"><form data-form="resource-save" class="stack-form"><input type="hidden" name="id" value="${item?.id || ''}"><p><label for="resource-course">课程</label><select id="resource-course" name="courseId" required ${item ? 'disabled' : ''}>${options(C, courseList(C), item?.courseId)}</select></p><p><label for="resource-title">资源名称</label><input id="resource-title" name="title" required maxlength="160" value="${C.e(item?.title || '')}"></p><p><label for="resource-level">资源层级</label><select id="resource-level" name="level">${mapOptions(C, C.levels, item?.level || 'basic')}</select></p><p><label for="resource-kind">资源类型</label><select id="resource-kind" name="kind">${mapOptions(C, C.kinds, item?.kind || 'worksheet')}</select></p><p><label for="resource-body">资源正文</label><textarea id="resource-body" name="body" rows="10" required maxlength="30000">${C.e(item?.body || '')}</textarea></p><p><label><input type="checkbox" name="published" ${item?.published ? 'checked' : ''}> 发布后对本课程演示学生可见</label></p><div class="form-actions"><button type="submit" class="button primary">保存资源</button>${link(item ? `/resources/${item.id}` : '/resources', '取消')}</div></form></section>` };
  }

  function teaching(C) {
    const assignments = assignmentList(C), reports = recent(reportList(C)).slice(0, 8);
    const progress = [];
    for (const resource of resourceList(C)) for (const student of C.state.users.filter(user => user.role === 'student' && (C.canTeach || user.id === C.user.id))) {
      if (C.state.progress.includes(`${student.id}:${resource.id}`) && classList(C).some(group => group.courseId === resource.courseId && group.studentIds.includes(student.id))) progress.push({ resource, student });
    }
    return { title: C.canTeach ? '课堂与任务' : '我的课堂任务', html: heading(C, C.canTeach ? '课堂与任务' : '我的课堂任务', '课前有准备，课中有实践，课后有反馈。', C.canTeach ? link('/tasks/new', '新增题目') + link('/assignments/new', '＋ 布置任务', 'button primary') : '') +
      `<div class="classroom-strip">${classList(C).map(group => `<div class="classroom-summary"><span class="class-icon" aria-hidden="true">▥</span><div><strong>${C.e(group.name)}</strong><p>${C.e(courseName(C, group.courseId))} · ${C.e(studentName(C, group.teacherId))}</p></div></div>`).join('')}</div><div class="phase-guide"><div><span>01</span><div><strong>课前预习</strong><p>阅读资源，带着问题进入课堂。</p></div></div><div><span>02</span><div><strong>课中实操</strong><p>提交代码，用结果检查理解。</p></div></div><div><span>03</span><div><strong>课后巩固</strong><p>根据反馈订正与复习。</p></div></div></div>` +
      `<section class="panel"><div class="panel-header"><h2>教学任务</h2><span class="small muted">${assignments.length} 项可见任务</span></div><div class="table-scroll"><table><thead><tr><th>任务</th><th>班级 / 课程</th><th>教学阶段</th><th>状态</th><th>操作</th></tr></thead><tbody>${assignments.map(item => { const group = byId(C.state.classes, item.classId), task = byId(C.state.tasks, item.taskId); return `<tr><td>${link(`/assignments/${item.id}`, C.e(item.title), 'table-title')}<span class="table-subtitle">${C.e(task?.title || '练习题目')}</span></td><td>${C.e(group?.name || '')}<span class="table-subtitle">${C.e(courseName(C, group?.courseId))}</span></td><td>${badge(C, C.stages[item.stage])}</td><td>${statusBadge(C, item.status)}</td><td>${link(`/assignments/${item.id}`, C.canTeach ? '查看进度 →' : '进入任务 →', 'text-link')}</td></tr>`; }).join('') || `<tr><td colspan="5">${empty('暂时没有任务', C.canTeach ? '发布任务后，即可查看演示学生的提交与反馈。' : '演示教师发布任务后会显示在这里。')}</td></tr>`}</tbody></table></div></section>` +
      (reports.length ? `<section class="panel section-gap"><div class="panel-header"><h2>最近教学建议</h2></div><div class="list-body">${reports.map(report => `<a class="compact-row" href="#/reports/${report.id}"><div><strong>${C.e(byId(C.state.assignments, report.assignmentId)?.title || '')}</strong><p>${C.e(C.fmt(report.createdAt))} · 演示建议（预设）</p></div>${badge(C, report.adoptedAt ? '教师已采纳' : '待教师确认', report.adoptedAt ? 'success' : 'warning')}</a>`).join('')}</div></section>` : '') +
      (progress.length ? `<section class="panel section-gap"><div class="panel-header"><h2>${C.canTeach ? '资源学习完成记录' : '我的资源学习记录'}</h2><span class="small muted">完成标记不等同于学习时长</span></div><div class="table-scroll"><table><thead><tr>${C.canTeach ? '<th>学生</th>' : ''}<th>学习资源</th><th>课程</th></tr></thead><tbody>${progress.map(({resource, student}) => `<tr>${C.canTeach ? `<td>${C.e(student.name)}</td>` : ''}<td>${link(`/resources/${resource.id}`, C.e(resource.title), 'table-title')}</td><td>${C.e(courseName(C, resource.courseId))}</td></tr>`).join('')}</tbody></table></div></section>` : '') };
  }

  function taskForm(C) {
    if (!C.canTeach) return denied();
    return { title: '新增题目', html: heading(C, '新增题目', '新增模拟题目与初始代码。自建题目提交仅保存为待评测。', '', 'EDITOR') +
      `<section class="panel form-panel"><form data-form="task-save" class="stack-form"><p><label for="task-title">题目名称</label><input id="task-title" name="title" required maxlength="160"></p><p><label for="task-level">任务层级</label><select id="task-level" name="level">${mapOptions(C, taskLevels, 'basic')}</select></p><p><label for="task-points">知识点</label><input id="task-points" name="knowledgePoints" required maxlength="500" placeholder="列表、循环、边界条件"><span class="helptext">使用中文或英文逗号分隔。</span></p><p><label for="task-prompt">题目说明</label><textarea id="task-prompt" name="prompt" rows="8" required maxlength="30000"></textarea></p><p><label for="task-code">初始代码（可选）</label><textarea id="task-code" name="starterCode" rows="8" maxlength="20000" spellcheck="false"></textarea></p><div class="form-actions"><button class="button primary" type="submit">保存题目</button>${link('/teaching', '取消')}</div></form></section>` };
  }

  function assignmentForm(C, item) {
    if (!C.canTeach) return denied();
    if (!classList(C).length || !C.state.tasks.length) return { title: '布置任务', html: empty('请先准备班级与题目', '管理员创建演示班级后，教师可以新增题目并布置任务。') };
    return { title: item ? '编辑任务' : '布置任务', html: heading(C, item ? '编辑任务' : '布置任务', '选择题目和班级，将资源、练习与反馈连接起来。', '', 'EDITOR') +
      `<section class="panel form-panel"><form data-form="assignment-save" class="stack-form"><input type="hidden" name="id" value="${item?.id || ''}"><p><label for="assignment-class">班级</label><select id="assignment-class" name="classId" required ${item ? 'disabled' : ''}>${options(C, classList(C), item?.classId, group => `${group.name} · ${courseName(C, group.courseId)}`)}</select></p><p><label for="assignment-task">练习题目</label><select id="assignment-task" name="taskId" required ${item ? 'disabled' : ''}>${options(C, C.state.tasks, item?.taskId)}</select></p><p><label for="assignment-title">任务名称</label><input id="assignment-title" name="title" required maxlength="160" value="${C.e(item?.title || '')}"></p><p><label for="assignment-stage">教学阶段</label><select id="assignment-stage" name="stage">${mapOptions(C, C.stages, item?.stage || 'during')}</select></p><p><label for="assignment-status">状态</label><select id="assignment-status" name="status">${mapOptions(C, {draft: '草稿', published: '已发布', closed: '已关闭'}, item?.status || 'draft')}</select></p><fieldset><legend>关联学习资源（可选）</legend><p class="helptext">仅勾选与所选班级同课程的资源；发布任务时关联资源也应已发布。</p>${resourceList(C).map(resource => `<p><label><input type="checkbox" name="resourceIds" value="${resource.id}" ${item?.resourceIds.includes(resource.id) ? 'checked' : ''}> ${C.e(resource.title)} · ${C.e(courseName(C, resource.courseId))}${resource.published ? '' : '（草稿）'}</label></p>`).join('') || '<p class="muted">当前暂无可关联资源。</p>'}</fieldset><div class="form-actions"><button class="button primary" type="submit">保存任务</button>${link(item ? `/assignments/${item.id}` : '/teaching', '取消')}</div></form></section>` };
  }

  function submissionTable(C, submissions) {
    return `<div class="table-scroll"><table><thead><tr>${C.canTeach ? '<th>学生</th>' : ''}<th>提交时间</th><th>评测状态</th><th>用例 / 分数</th><th>详情</th></tr></thead><tbody>${recent(submissions).map(item => `<tr>${C.canTeach ? `<td>${C.e(studentName(C, item.studentId))}</td>` : ''}<td>${C.e(C.fmt(item.createdAt))}</td><td>${badge(C, item.status === 'completed' ? '示例反馈（模拟）' : '待评测', item.status === 'completed' ? 'success' : 'warning')}</td><td>${item.status === 'completed' ? `${C.e(item.passed)} / ${C.e(item.total)}<span class="table-subtitle">${C.e(item.score)} 分 · 演示结果</span>` : '<span class="muted">暂不计分</span>'}</td><td>${link(`/submissions/${item.id}`, '查看 →', 'text-link')}</td></tr>`).join('') || `<tr><td colspan="${C.canTeach ? 5 : 4}">${empty('还没有提交', '提交后会在当前浏览器留下代码与演示反馈记录。')}</td></tr>`}</tbody></table></div>`;
  }

  function assignmentDetail(C, item) {
    const group = byId(C.state.classes, item.classId), task = byId(C.state.tasks, item.taskId);
    if (!task || !group) return denied();
    const fixtures = C.fixtures[task.fixtureKey] || [], reports = recent(reportList(C).filter(report => report.assignmentId === item.id));
    const resources = resourceList(C).filter(resource => item.resourceIds.includes(resource.id));
    const studentEditor = C.role === 'student' && item.status === 'published' ? `<section class="panel section-gap"><div class="panel-header"><h2>提交我的代码</h2>${badge(C, 'Python', '')}</div><div class="panel-content"><div class="notice warning"><strong>在线演示评测范围</strong><p>预设代码仅展示模拟用例反馈，不执行 Python。自行编辑的代码保存为“待评测”，不会获得虚构分数。</p></div>${fixtures.length ? `<div class="fixture-toolbar"><label for="fixture-select">体验预设样例</label><select id="fixture-select"><option value="">请选择样例</option>${fixtures.map(fixture => `<option value="${C.e(fixture.id)}">${C.e(fixture.label)}</option>`).join('')}</select><button class="button" type="button" data-action="fill-fixture" data-id="${item.id}">填入样例</button></div>` : ''}<form data-form="code-submit" class="stack-form code-form"><input type="hidden" name="assignmentId" value="${item.id}"><p><label for="submission-source">Python 代码</label><textarea id="submission-source" name="source" required maxlength="20000" rows="16" spellcheck="false">${C.e(task.starterCode || '')}</textarea></p><div class="form-actions"><button type="submit" class="button primary">提交并查看反馈 ↑</button><span class="small muted">模拟记录保存在当前浏览器</span></div></form></div></section>` : C.role === 'student' ? '<div class="notice warning section-gap">此任务已关闭，仍可查看原有提交，不能新增提交。</div>' : '';
    return { title: '课堂任务', html: heading(C, item.title, `${group.name} · ${courseName(C, group.courseId)} · ${C.stages[item.stage]}`, link('/teaching', '返回课堂') + (C.canTeach ? link(`/assignments/${item.id}/edit`, '编辑任务') : ''), 'ASSIGNMENT') +
      `<div class="assignment-layout"><div class="main-column"><section class="panel"><div class="panel-header"><h2>任务要求</h2>${statusBadge(C, item.status)}</div><div class="panel-content"><h3>${C.e(task.title)}</h3><div class="plain-text task-prompt">${C.e(task.prompt)}</div><div class="tag-list">${task.knowledgePoints.map(point => badge(C, point)).join('')}${badge(C, taskLevels[task.level] || task.level)}</div></div></section>${studentEditor}<section class="panel section-gap"><div class="panel-header"><h2>${C.canTeach ? '学生提交与反馈' : '我的提交记录'}</h2></div>${submissionTable(C, submissionList(C).filter(submission => submission.assignmentId === item.id))}</section></div><aside class="detail-sidebar"><section class="panel"><div class="panel-header"><h2>关联学习资源</h2></div><div class="list-body">${resources.map(resource => `<a class="compact-row" href="#/resources/${resource.id}"><div><span class="small muted">${C.e(C.kinds[resource.kind])}</span><strong>${C.e(resource.title)}</strong></div><span aria-hidden="true">→</span></a>`).join('') || empty('暂无关联资源', '可以先完成任务，再回到资源库复习。')}</div></section>${C.canTeach ? `<section class="panel ai-panel section-gap"><span class="ai-mark" aria-hidden="true">✧</span><h2>班级教学诊断</h2><p>根据当前演示名单及每名学生的最新提交，展示预设教学建议与证据快照。</p><button class="button primary full-width" type="button" data-action="diagnose" data-id="${item.id}">生成演示教学建议</button><small>演示建议（预设）。不会请求真实模型，由教师复核确认。</small>${reports[0] ? link(`/reports/${reports[0].id}`, '查看最近诊断 →', 'text-link block-link') : ''}</section>` : ''}<div class="side-note"><strong>先看证据，再做判断</strong><p>待评测不等于错误。示例分数用于交互演示，不形成正式课程成绩。</p></div></aside></div>` };
  }

  function submissionDetail(C, item) {
    const assignment = byId(C.state.assignments, item.assignmentId);
    return { title: '提交反馈', html: heading(C, '每次实践，都有反馈', `${assignment?.title || ''} · ${studentName(C, item.studentId)} · ${C.fmt(item.createdAt)}`, link(`/assignments/${item.assignmentId}`, '返回任务'), 'SUBMISSION') +
      `<div class="result-banner ${item.status === 'completed' ? 'completed' : 'pending'}"><div>${badge(C, item.status === 'completed' ? '预设示例反馈' : '待评测', item.status === 'completed' ? 'success' : 'warning')}<h2>${item.status === 'completed' ? '示例反馈已展示' : '代码已保存，等待评测'}</h2><p>${C.e(item.feedback)}</p></div>${item.status === 'completed' ? `<div class="score"><strong>${C.e(item.score)}</strong><span>分 · 模拟结果</span></div>` : ''}</div>` +
      (item.cases.length ? `<section class="panel section-gap"><div class="panel-header"><h2>用例反馈（模拟）</h2><span class="small muted">未执行代码</span></div><div class="table-scroll"><table><thead><tr><th>用例</th><th>预期输出</th><th>示例输出</th><th>结果</th></tr></thead><tbody>${item.cases.map(test => `<tr><td>${C.e(test.name || test.label || '')}</td><td><code>${C.e(test.expected)}</code></td><td><code>${C.e(test.actual)}</code></td><td>${badge(C, test.passed ? '通过' : '未通过', test.passed ? 'success' : 'danger')}</td></tr>`).join('')}</tbody></table></div></section>` : '') +
      `<section class="panel section-gap"><div class="panel-header"><h2>提交代码快照</h2><span class="small muted">记录 #${item.id}</span></div><pre class="code-block"><code>${C.e(item.source)}</code></pre><div class="code-footer"><span>${item.status === 'completed' ? '匹配预设样例 · 反馈为模拟' : '学生编辑提交 · 待评测'}</span><span>仅保存在当前浏览器</span></div></section>` };
  }

  function reportDetail(C, item) {
    const assignment = byId(C.state.assignments, item.assignmentId), group = byId(C.state.classes, assignment?.classId), evidence = item.evidence;
    const metrics = [['班级人数', evidence.enrolled_count, '人'], ['已提交', evidence.submitted_students, '人'], ['已评测示例', evidence.evaluated_students, '人'], ['待评测', evidence.pending_students, '人'], ['示例反馈均分', evidence.mean_example_score === null ? '暂无' : evidence.mean_example_score, evidence.mean_example_score === null ? '' : '分']];
    return { title: '教学诊断', html: heading(C, '精准教学建议', `${assignment?.title || ''} · ${group?.name || ''} · ${C.fmt(item.createdAt)}`, link(`/assignments/${item.assignmentId}`, '返回课堂任务'), 'TEACHING INSIGHT') +
      `<div class="report-summary"><div><span class="ai-mark" aria-hidden="true">✧</span><div><h2>从班级提交中，找到下一步教学重点</h2><p>${C.e(item.model)} · 依据生成时的演示提交</p></div></div>${badge(C, item.adoptedAt ? '教师已确认采纳' : '等待教师复核', item.adoptedAt ? 'success' : 'warning')}</div><div class="notice section-gap"><strong>演示建议（预设）</strong><p>以下内容按演示证据套用预设建议，不调用真实模型，不会自动改分或发布任务。</p></div><article class="panel section-gap"><div class="panel-header"><h2>共性问题与教学建议</h2><span class="small muted">报告 #${item.id}</span></div><div class="report-content plain-text">${C.e(item.content)}</div></article>` +
      (item.adoptedAt ? `<div class="completion-strip"><div><strong>已记录演示教师确认</strong><p>确认时间：${C.e(C.fmt(item.adoptedAt))}。后续教学活动仍由教师安排。</p></div>${badge(C, '已采纳', 'success')}</div>` : `<div class="report-adopt"><div><strong>核对证据，确认这份建议可用于演示教学。</strong><p>采纳只记录确认状态，不会自动调整任务或成绩。</p></div><button class="button primary" type="button" data-action="adopt-report" data-id="${item.id}">教师确认采纳 ✓</button></div>`) +
      `<section class="panel section-gap"><div class="panel-header"><h2>本次诊断的提交证据</h2><span class="small muted">生成时点的演示快照</span></div><dl class="diagnostic-metrics">${metrics.map(([label, value, unit]) => `<div><dt>${label}</dt><dd>${C.e(value)}<small>${unit}</small></dd></div>`).join('')}</dl><div class="evidence-explanation"><p>每名学生只统计生成时当前班级名单中的最新提交，后续操作不会改写本次快照。</p><p>待评测不按零分计算；预设样例反馈为模拟结果，不是正式课程成绩。</p></div>${Object.keys(evidence.common_failed_cases).length ? `<div class="table-scroll"><table><caption class="evidence-caption">预设样例中未通过的用例</caption><thead><tr><th>用例</th><th>涉及人数</th></tr></thead><tbody>${Object.entries(evidence.common_failed_cases).map(([name, count]) => `<tr><td>${C.e(name)}</td><td>${C.e(count)} 人</td></tr>`).join('')}</tbody></table></div>` : '<p class="evidence-empty">本次没有可展示的失败用例，待评测提交不表示已通过。</p>'}</section>` };
  }

  function render(path, C) {
    path = path.replace(/\/$/, '') || '/';
    if (path === '/resources') return resources(C);
    if (path === '/resources/new') return resourceForm(C);
    let match = path.match(/^\/resources\/(\d+)(\/edit)?$/);
    if (match) { const item = byId(resourceList(C), match[1]); return item ? match[2] ? resourceForm(C, item) : resourceDetail(C, item) : denied(); }
    if (path === '/teaching') return teaching(C);
    if (path === '/tasks/new') return taskForm(C);
    if (path === '/assignments/new') return assignmentForm(C);
    match = path.match(/^\/assignments\/(\d+)(\/edit)?$/);
    if (match) { const item = byId(assignmentList(C), match[1]); return item ? match[2] ? assignmentForm(C, item) : assignmentDetail(C, item) : denied(); }
    match = path.match(/^\/submissions\/(\d+)$/);
    if (match) { const item = byId(submissionList(C), match[1]); return item ? submissionDetail(C, item) : denied(); }
    match = path.match(/^\/reports\/(\d+)$/);
    if (match) { const item = byId(reportList(C), match[1]); return item ? reportDetail(C, item) : denied(); }
    return null;
  }

  function field(data, name, maximum, required = true) {
    const value = String(data.get(name) || '').trim();
    if ((required && !value) || value.length > maximum) throw new Error('请完整填写表单，并遵守字段长度限制。');
    return value;
  }
  function requireTeacher(C) { if (!C.canTeach) throw new Error('请切换到演示教师或管理员后操作。'); }
  function choose(map, key) { if (!Object.hasOwn(map, key)) throw new Error('请选择有效的表单选项。'); return key; }

  function submit(name, data, C) {
    if (!['resource-filter', 'resource-save', 'task-save', 'assignment-save', 'code-submit'].includes(name)) return false;
    try {
      if (name === 'resource-filter') {
        const query = new URLSearchParams();
        for (const key of ['course', 'level', 'kind', 'q']) { const value = field(data, key, 120, false); if (value) query.set(key, value); }
        C.navigate(`/resources${query.size ? `?${query}` : ''}`); return true;
      }
      if (name === 'resource-save') {
        requireTeacher(C);
        const id = field(data, 'id', 20, false), item = id ? byId(resourceList(C), id) : null;
        if (id && !item) throw new Error('该资源已不可编辑，请返回资源库。');
        const courseId = item?.courseId || Number(data.get('courseId'));
        if (!byId(courseList(C), courseId)) throw new Error('请选择当前演示课程。');
        const values = { title: field(data, 'title', 160), body: field(data, 'body', 30000), courseId, level: choose(C.levels, field(data, 'level', 30)), kind: choose(C.kinds, field(data, 'kind', 30)), published: data.has('published') };
        if (!values.published && item && C.state.assignments.some(assignment => assignment.status === 'published' && assignment.resourceIds.includes(item.id))) throw new Error('已发布任务正在使用此资源，请先编辑任务解除关联或关闭任务。');
        const resource = item || { id: C.nextId('resources') };
        Object.assign(resource, values); if (!item) C.state.resources.push(resource);
        C.audit(item ? 'resource.updated' : 'resource.created', resource.title); C.save('演示资源已保存。'); C.navigate(`/resources/${resource.id}`); return true;
      }
      if (name === 'task-save') {
        requireTeacher(C);
        const rawCode = String(data.get('starterCode') || '');
        if (rawCode.length > 20000) throw new Error('初始代码最多 20000 个字符。');
        const task = { id: C.nextId('tasks'), title: field(data, 'title', 160), prompt: field(data, 'prompt', 30000), level: choose(taskLevels, field(data, 'level', 30)), knowledgePoints: field(data, 'knowledgePoints', 500).split(/[,，、\n]/).map(point => point.trim()).filter(Boolean), fixtureKey: null, starterCode: rawCode };
        if (!task.knowledgePoints.length || task.knowledgePoints.length > 20) throw new Error('请填写 1 至 20 个知识点。');
        C.state.tasks.push(task); C.audit('task.created', task.title); C.save('演示题目已保存，可继续布置任务。'); C.navigate('/assignments/new'); return true;
      }
      if (name === 'assignment-save') {
        requireTeacher(C);
        const id = field(data, 'id', 20, false), item = id ? byId(assignmentList(C), id) : null;
        if (id && !item) throw new Error('该任务已不可编辑，请返回课堂。');
        const group = byId(classList(C), item?.classId || data.get('classId')), task = byId(C.state.tasks, item?.taskId || data.get('taskId'));
        if (!group || !task) throw new Error('请选择有效的班级和题目。');
        const status = choose({ draft: true, published: true, closed: true }, field(data, 'status', 30));
        if (status === 'draft' && item && C.state.submissions.some(submission => submission.assignmentId === item.id)) throw new Error('已有提交的任务不能退回草稿；如需停止提交，请设为已关闭。');
        const resourceIds = [...new Set(data.getAll('resourceIds').map(Number))];
        if (resourceIds.some(resourceId => { const resource = byId(resourceList(C), resourceId); return !resource || resource.courseId !== group.courseId || (status === 'published' && !resource.published); })) throw new Error('关联资源须与班级同课程；发布任务时请先发布关联资源。');
        const values = { title: field(data, 'title', 160), taskId: task.id, classId: group.id, stage: choose(C.stages, field(data, 'stage', 30)), status, resourceIds };
        const assignment = item || { id: C.nextId('assignments') };
        Object.assign(assignment, values); if (!item) C.state.assignments.push(assignment);
        C.audit(item ? 'assignment.updated' : 'assignment.created', assignment.title); C.save('演示课堂任务已保存。'); C.navigate(`/assignments/${assignment.id}`); return true;
      }
      if (name === 'code-submit') {
        if (C.role !== 'student') throw new Error('请切换到演示学生后提交。');
        const assignment = byId(assignmentList(C), data.get('assignmentId')), source = String(data.get('source') || '');
        if (!assignment || assignment.status !== 'published') throw new Error('当前任务未开放提交。');
        if (!source.trim() || source.length > 20000) throw new Error('请输入 1 至 20000 个字符的代码。');
        const task = byId(C.state.tasks, assignment.taskId), fixture = (C.fixtures[task?.fixtureKey] || []).find(item => normalize(item.source) === normalize(source));
        const item = { id: C.nextId('submissions'), assignmentId: assignment.id, studentId: C.user.id, source, status: fixture ? 'completed' : 'pending', score: fixture ? Math.round(fixture.passed / fixture.total * 1000) / 10 : null, passed: fixture ? fixture.passed : null, total: fixture ? fixture.total : null, createdAt: new Date().toISOString(), feedback: fixture ? '已匹配预设样例，展示模拟用例反馈。本站没有执行代码，演示分数不构成正式课程成绩。' : '已保存在当前浏览器，状态为待评测。自行编辑的代码不会执行，也不会自动给出分数。', cases: fixture ? fixture.cases.map(test => ({ ...test })) : [] };
        C.state.submissions.push(item); C.audit('submission.created', assignment.title); C.save(fixture ? '已保存代码与模拟样例反馈。' : '代码已保存为待评测。'); C.navigate(`/submissions/${item.id}`); return true;
      }
    } catch (error) { C.toast(error.message); }
    return true;
  }

  function evidenceFor(C, assignment) {
    const group = byId(C.state.classes, assignment.classId), latest = new Map();
    for (const item of recent(C.state.submissions.filter(submission => submission.assignmentId === assignment.id && group.studentIds.includes(submission.studentId)))) if (!latest.has(item.studentId)) latest.set(item.studentId, item);
    const records = [...latest.values()], evaluated = records.filter(item => item.status === 'completed'), failed = new Map();
    for (const item of evaluated) for (const test of item.cases) if (!test.passed) { const name = test.name || test.label || '未命名用例'; failed.set(name, (failed.get(name) || 0) + 1); }
    return { enrolled_count: group.studentIds.length, submitted_students: records.length, evaluated_students: evaluated.length, pending_students: records.filter(item => item.status === 'pending').length, mean_example_score: evaluated.length ? Math.round(evaluated.reduce((sum, item) => sum + item.score, 0) / evaluated.length * 10) / 10 : null, common_failed_cases: Object.fromEntries(failed) };
  }

  function action(name, element, C) {
    if (!['complete-resource', 'fill-fixture', 'diagnose', 'adopt-report'].includes(name)) return false;
    try {
      const id = Number(element.dataset.id);
      if (name === 'complete-resource') {
        const resource = byId(resourceList(C), id);
        if (C.role !== 'student' || !resource) throw new Error('请以演示学生身份查看已发布资源。');
        const key = `${C.user.id}:${id}`;
        if (!C.state.progress.includes(key)) { C.state.progress.push(key); C.audit('resource.completed', resource.title); C.save('已记录演示学习完成。'); }
        return true;
      }
      if (name === 'fill-fixture') {
        const assignment = byId(assignmentList(C), id), task = byId(C.state.tasks, assignment?.taskId);
        if (C.role !== 'student' || !assignment || assignment.status !== 'published') throw new Error('当前任务未开放提交。');
        const selected = document.querySelector('#fixture-select')?.value, fixture = (C.fixtures[task?.fixtureKey] || []).find(item => item.id === selected), editor = document.querySelector('textarea[name="source"]');
        if (!fixture || !editor) throw new Error('请先选择一个预设样例。');
        editor.value = fixture.source; editor.dispatchEvent(new Event('input', { bubbles: true })); editor.focus(); return true;
      }
      if (name === 'diagnose') {
        requireTeacher(C);
        const assignment = byId(assignmentList(C), id);
        if (!assignment) throw new Error('当前演示班级没有此任务。');
        const evidence = evidenceFor(C, assignment), failed = Object.entries(evidence.common_failed_cases);
        const report = { id: C.nextId('reports'), assignmentId: id, model: '演示建议（预设）', evidence, createdAt: new Date().toISOString(), adoptedAt: null,
          content: `演示建议（预设）\n\n任务：${assignment.title}\n当前班级共 ${evidence.enrolled_count} 人，已有 ${evidence.submitted_students} 人提交；其中 ${evidence.evaluated_students} 人匹配预设样例、${evidence.pending_students} 人待评测。每人只取最新一次提交。\n\n观察与建议\n${failed.length ? failed.map(([label, count]) => `• “${label}”用例有 ${count} 人的最新示例未通过。可在课堂中对照输入、预期输出和示例代码，检查边界处理。`).join('\n') : evidence.evaluated_students ? '• 最新预设样例没有记录失败用例。请通过新题和解释思路继续核对理解，不据此推断全面掌握。' : '• 当前尚无已评测样例，暂不能从用例结果判断共性错误。可先收集学生的解题思路。'}\n• ${evidence.pending_students ? `还有 ${evidence.pending_students} 人的编辑代码待评测，请教师先阅读代码与思路；待评测不能计为零分。` : '可选取一份样例解释解题思路，再安排不同输入的巩固练习。'}\n• ${evidence.enrolled_count > evidence.submitted_students ? `有 ${evidence.enrolled_count - evidence.submitted_students} 人尚未提交，可先了解学习进度。` : '班级提交情况应结合课堂观察，不将一次提交视为最终结论。'}\n\n以上内容来自预设建议模板，未请求真实模型。示例分数为模拟反馈，不用于正式课程成绩。采纳后仍需教师手动安排后续教学。` };
        C.state.reports.push(report); C.audit('report.generated.demo', assignment.title); C.save('已生成预设演示建议与证据快照。'); C.navigate(`/reports/${report.id}`); return true;
      }
      if (name === 'adopt-report') {
        requireTeacher(C);
        const report = byId(reportList(C), id);
        if (!report) throw new Error('当前演示角色无法查看此报告。');
        if (!report.adoptedAt) { report.adoptedAt = new Date().toISOString(); C.audit('report.adopted', byId(C.state.assignments, report.assignmentId)?.title || '演示报告'); C.save('已记录演示教师确认；不会自动调整任务或成绩。'); }
        return true;
      }
    } catch (error) { C.toast(error.message); }
    return true;
  }

  window.CourseLoopTeaching = { render, submit, action };
})();
