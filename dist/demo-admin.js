/* Administration for the browser-local, static teaching demonstration. */
(() => {
  "use strict";

  const roles = { admin: "管理员", teacher: "教师", student: "学生" };
  const routes = ["/manage/accounts", "/manage/classes", "/manage/ai", "/manage/audit"];
  const forms = ["admin-create-account", "admin-create-course", "admin-create-class", "admin-load-roster", "admin-enroll", "admin-ai-config"];
  let connectionResult = "";

  function heading(code, title, subtitle, C) {
    return `<div class="page-heading"><div><p class="eyebrow">COURSELOOP / ${C.e(code)}</p><h1>${C.e(title)}</h1><p class="subtitle">${C.e(subtitle)}</p></div><span class="badge">管理员演示</span></div>`;
  }

  function options(items, label, C, selected) {
    return items.map(item => `<option value="${C.e(item.id)}"${String(item.id) === String(selected) ? " selected" : ""}>${C.e(label(item))}</option>`).join("");
  }

  function studentsField(C, selected = []) {
    const students = C.state.users.filter(user => user.role === "student" && user.active);
    return `<div role="group" aria-label="学生名单"><p class="small muted">学生名单</p>${students.length ? students.map(user => `<label><input type="checkbox" name="studentIds" value="${C.e(user.id)}"${selected.includes(user.id) ? " checked" : ""}>${C.e(user.name)} <span class="small muted">${C.e(user.id)}</span></label>`).join("") : '<p class="small muted">暂无启用的学生账号，请先在账号管理中创建。</p>'}</div>`;
  }

  function accounts(C) {
    const rows = C.state.users.map(user => `<tr><td><strong>${C.e(user.name)}</strong><span class="table-subtitle">${C.e(user.id)}</span></td><td><span class="badge neutral">${C.e(roles[user.role] || user.role)}</span></td><td><span class="badge ${user.active ? "success" : "neutral"}">${user.active ? "启用" : "已停用"}</span></td><td>${user.id === C.user.id ? '<span class="small muted">当前演示账号</span>' : `<button type="button" class="text-button${user.active ? " danger-text" : ""}" data-action="admin-toggle-account" data-id="${C.e(user.id)}">${user.active ? "停用账号" : "重新启用账号"}</button>`}</td></tr>`).join("");
    return heading("ACCOUNTS", "账号管理", "创建用于切换角色的演示账号。所有记录只保存在当前浏览器，不设置密码。", C) +
      `<div class="admin-layout"><section class="panel"><div class="panel-header"><h2>教学账号</h2></div><div class="table-scroll"><table><thead><tr><th>账号 / 姓名</th><th>角色</th><th>状态</th><th>管理</th></tr></thead><tbody>${rows || '<tr><td colspan="4"><div class="empty-state"><p>暂无演示账号。</p></div></td></tr>'}</tbody></table></div></section><section class="panel"><div class="panel-header"><h2>创建账号</h2></div><div class="panel-content"><form class="stack-form" data-form="admin-create-account"><p><label for="admin-account-id">演示账号</label><input id="admin-account-id" name="id" required minlength="3" maxlength="40" pattern="[A-Za-z0-9_.-]{3,40}" autocomplete="off" spellcheck="false"><span class="helptext">3—40 位英文字母、数字、点、下划线或短横线。请使用虚构账号和姓名。</span></p><p><label for="admin-account-name">显示姓名</label><input id="admin-account-name" name="name" required maxlength="60" autocomplete="off"></p><p><label for="admin-account-role">角色</label><select id="admin-account-role" name="role"><option value="student">学生</option><option value="teacher">教师</option><option value="admin">管理员</option></select></p><button type="submit" class="button primary full-width">创建演示账号</button></form><p class="small muted section-gap-sm">创建学生后，在班级管理中将账号加入对应班级。真实账号与密码请在<a class="text-link" href="local.html">本机教学服务</a>中管理。</p></div></section></div>`;
  }

  function classes(C) {
    const state = C.state;
    const teachers = state.users.filter(user => user.role === "teacher" && user.active);
    const requested = Number(C.query.get("class"));
    const current = state.classes.find(item => item.id === requested) || state.classes[0];
    const rows = state.classes.map(item => {
      const course = state.courses.find(course => course.id === item.courseId);
      const teacher = state.users.find(user => user.id === item.teacherId);
      return `<tr><td><strong>${C.e(item.name)}</strong><span class="table-subtitle">${C.e(item.studentIds.length)} 名学生 · <a class="text-link" href="#/manage/classes?class=${C.e(item.id)}">管理名单</a></span></td><td>${C.e(course ? course.title : "课程已移除")}<span class="table-subtitle">${C.e(course ? course.language : "")}</span></td><td>${C.e(teacher ? teacher.name : "教师已移除")}${teacher && !teacher.active ? '<span class="table-subtitle">账号已停用</span>' : ""}</td><td><a class="text-link" href="#/teaching">查看教学任务 →</a></td></tr>`;
    }).join("");
    const unavailable = !state.courses.length || !teachers.length;
    const inactiveCount = current ? current.studentIds.filter(id => state.users.some(user => user.id === id && user.role === "student" && !user.active)).length : 0;
    const roster = current ? `<form class="stack-form" data-form="admin-load-roster"><p><label for="admin-roster-class">选择班级</label><select id="admin-roster-class" name="classId" required>${options(state.classes, item => item.name, C, current.id)}</select><span class="helptext">选择其他班级后，先载入该班级的现有名单。</span></p><button type="submit" class="button small-button">载入班级名单</button></form><form class="stack-form section-gap" data-form="admin-enroll"><input type="hidden" name="classId" value="${C.e(current.id)}"><p><strong>${C.e(current.name)}</strong><span class="helptext">保存后以所选学生替换该班级名单，历史提交仍保留。${inactiveCount ? `其中 ${C.e(inactiveCount)} 名已停用学生的原有成员关系保留，重新启用后可调整。` : ""}</span></p>${studentsField(C, current.studentIds)}<div class="form-actions"><button type="submit" class="button primary">保存班级名单</button></div></form>` : '<div class="empty-state compact"><p>先创建班级，再添加学生。</p></div>';
    return heading("CLASSES", "班级与课程", "从一门 Python 课程开始，为演示班级安排教师与学生。", C) +
      `<section class="panel"><div class="panel-header"><h2>当前班级</h2></div><div class="table-scroll"><table><thead><tr><th>班级</th><th>课程</th><th>任课教师</th><th>教学入口</th></tr></thead><tbody>${rows || '<tr><td colspan="4"><div class="empty-state"><p>创建课程和班级后即可安排教师与学生。</p></div></td></tr>'}</tbody></table></div></section><div class="management-grid section-gap"><section class="panel"><div class="panel-header"><h2>创建班级</h2></div><div class="panel-content">${unavailable ? '<div class="notice warning"><p>创建班级需要至少一门课程与一个启用的教师账号。</p><a class="text-link" href="#/manage/accounts">管理教师账号 →</a></div>' : ""}<form class="stack-form" data-form="admin-create-class"><p><label for="admin-class-course">课程</label><select id="admin-class-course" name="courseId" required><option value="">请选择课程</option>${options(state.courses, item => item.title, C)}</select></p><p><label for="admin-class-teacher">任课教师</label><select id="admin-class-teacher" name="teacherId" required><option value="">请选择教师</option>${options(teachers, item => `${item.name}（${item.id}）`, C)}</select></p><p><label for="admin-class-name">班级名称</label><input id="admin-class-name" name="name" required maxlength="120"></p>${studentsField(C)}<div class="form-actions"><button type="submit" class="button primary"${unavailable ? " disabled" : ""}>创建班级</button></div></form></div></section><section class="panel"><div class="panel-header"><h2>学生加入班级</h2></div><div class="panel-content">${roster}</div></section><section class="panel"><div class="panel-header"><h2>添加课程</h2></div><div class="panel-content"><form class="stack-form" data-form="admin-create-course"><p><label for="admin-course-title">课程名称</label><input id="admin-course-title" name="title" required maxlength="120"></p><p><label for="admin-course-language">编程语言</label><input id="admin-course-language" name="language" value="Python" required maxlength="40"></p><p><label for="admin-course-description">课程简介</label><textarea id="admin-course-description" name="description" maxlength="1200" rows="4"></textarea></p><button type="submit" class="button">创建课程</button></form></div></section></div>`;
  }

  function ai(C) {
    const config = C.state.aiConfig;
    return heading("MODEL SERVICE", "模型服务", "演示模型服务配置界面。此页面只保存非敏感的演示字段，不连接任何模型。", C) +
      `<div class="two-column settings-layout"><section class="panel"><div class="panel-header"><h2>连接配置</h2><span class="badge neutral">浏览器演示</span></div><div class="panel-content"><div class="notice"><strong>密钥状态：线上演示不收集密钥</strong><p>请勿填写真实密钥、访问令牌或带认证信息的地址。真实服务请按<a class="text-link" href="local.html">本机教学说明</a>配置。</p></div><form class="stack-form" data-form="admin-ai-config"><p><label for="admin-ai-label">服务名称</label><input id="admin-ai-label" name="label" value="${C.e(config.label)}" required maxlength="100"></p><p><label for="admin-ai-url">服务地址</label><input id="admin-ai-url" name="baseUrl" type="url" value="${C.e(config.baseUrl)}" required maxlength="300" autocomplete="off" spellcheck="false"><span class="helptext">只记录 http / https 地址；请勿携带用户名、密码、查询参数或令牌。不会向此地址发送请求。</span></p><p><label for="admin-ai-model">模型名称</label><input id="admin-ai-model" name="model" value="${C.e(config.model)}" required maxlength="100" autocomplete="off" spellcheck="false"></p><p><label for="admin-ai-timeout">请求超时（秒）</label><input id="admin-ai-timeout" name="timeout" type="number" min="5" max="120" step="1" value="${C.e(config.timeout)}" required><span class="helptext">5—120 秒，仅用于演示配置。</span></p><p><label for="admin-ai-key">API 密钥</label><input id="admin-ai-key" type="text" value="线上演示不接收密钥" disabled aria-describedby="admin-ai-key-help"><span class="helptext" id="admin-ai-key-help">该字段已停用。请在自己的本机服务中设置真实密钥。</span></p><button type="submit" class="button primary">保存演示模型配置</button></form></div></section><div><section class="panel"><div class="panel-header"><h2>连接检查</h2><span class="badge warning">模拟</span></div><div class="panel-content"><p class="muted">检查已保存配置的格式，并展示模拟结果；不会发送网络请求，也不能判断真实模型是否可用。</p><dl class="detail-list"><div><dt>服务地址</dt><dd>${C.e(config.baseUrl || "尚未配置")}</dd></div><div><dt>模型名称</dt><dd>${C.e(config.model || "尚未配置")}</dd></div></dl><button type="button" class="button full-width" data-action="admin-ai-test">演示连接检查（不发请求）</button>${connectionResult ? `<div class="connection-result success" role="status"><strong>模拟检查已完成</strong><p>${C.e(connectionResult)}</p></div>` : ""}</div></section><section class="side-note"><strong>真实教学在本机服务中运行</strong><p>线上报告由预设样例生成。浏览器中填写的地址、模型与超时只用于展示配置流程。</p><p>需要真实模型连接、独立账号和数据库保存时，请查看<a class="text-link" href="local.html">本机教学说明 →</a></p><p>AI 建议仍需教师复核，不会自动发布任务或修改成绩。</p></section></div></div>`;
  }

  function audit(C) {
    const events = [...C.state.audit].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.id - a.id);
    const rows = events.map(event => {
      const actor = C.state.users.find(user => user.id === event.actorId);
      return `<tr><td class="small">${C.e(C.fmt(event.createdAt))}</td><td>${C.e(actor ? actor.name : "演示系统")}</td><td><strong>${C.e(event.event)}</strong></td><td class="audit-details">${C.e(event.objectLabel)}</td></tr>`;
    }).join("");
    return heading("ACTIVITY LOG", "操作记录", "核对当前浏览器中的演示操作；这些记录可随重置演示一起清除。", C) +
      `<section class="panel"><div class="panel-header"><h2>近期记录</h2><span class="small muted">不收集密码和模型密钥</span></div><div class="table-scroll"><table><thead><tr><th>时间</th><th>操作人</th><th>事件</th><th>对象</th></tr></thead><tbody>${rows || '<tr><td colspan="4"><div class="empty-state"><p>完成教学操作后，重要事件会显示在这里。</p></div></td></tr>'}</tbody></table></div></section>`;
  }

  function render(path, C) {
    if (!routes.includes(path)) return null;
    if (C.role !== "admin") return { title: "管理员演示", html: '<section class="panel error-panel"><span class="badge neutral">演示角色</span><h1>请切换到管理员演示</h1><p>当前角色的演示页面不包含账号、班级与模型管理。可通过顶部角色入口切换到管理员。</p><a class="button" href="#/resources">返回学习资源</a></section>' };
    const pages = {
      "/manage/accounts": ["账号管理", accounts],
      "/manage/classes": ["班级与课程", classes],
      "/manage/ai": ["模型服务", ai],
      "/manage/audit": ["操作记录", audit]
    };
    const [title, page] = pages[path];
    return { title, html: page(C) };
  }

  function value(form, key) {
    const result = form.get(key);
    return typeof result === "string" ? result.trim() : "";
  }

  function checkStudents(form, C) {
    const selected = form.getAll("studentIds");
    if (selected.some(id => typeof id !== "string" || !C.state.users.some(user => user.id === id && user.role === "student" && user.active))) return null;
    return [...new Set(selected)];
  }

  function configError(config) {
    if (!config.label || config.label.length > 100 || !config.model || config.model.length > 100) return "请填写 100 字以内的服务名称和模型名称。";
    if (!Number.isInteger(config.timeout) || config.timeout < 5 || config.timeout > 120) return "请求超时应为 5—120 秒的整数。";
    try {
      const address = new URL(config.baseUrl);
      if (config.baseUrl.length > 300 || !["http:", "https:"].includes(address.protocol) || address.username || address.password || address.search || address.hash) return "服务地址仅支持不带认证信息、查询参数或片段的 http / https 地址。";
    } catch (_) {
      return "请填写有效的 http / https 服务地址。";
    }
    return "";
  }

  function submit(name, form, C) {
    if (!forms.includes(name)) return false;
    if (C.role !== "admin" || !C.user.active) {
      C.toast("请先切换到启用的管理员演示账号。");
      return true;
    }
    const fail = message => { C.toast(message); return true; };
    if (name === "admin-create-account") {
      const id = value(form, "id"), displayName = value(form, "name"), role = value(form, "role");
      if (!/^[A-Za-z0-9_.-]{3,40}$/.test(id)) return fail("演示账号应为 3—40 位英文字母、数字、点、下划线或短横线。");
      if (!displayName || displayName.length > 60 || !Object.hasOwn(roles, role)) return fail("请填写 60 字以内的姓名并选择有效角色。");
      if (C.state.users.some(user => user.id.toLowerCase() === id.toLowerCase())) return fail("此演示账号已存在，请更换账号名。");
      C.state.users.push({ id, name: displayName, role, active: true });
      C.audit("创建演示账号", `${displayName}（${id}）· ${roles[role]}`);
      C.save("演示账号已创建，可通过角色入口切换。学生请继续加入班级。");
      return true;
    }
    if (name === "admin-create-course") {
      const title = value(form, "title"), language = value(form, "language"), description = value(form, "description");
      if (!title || title.length > 120 || !language || language.length > 40 || description.length > 1200) return fail("请填写课程名称与编程语言，并检查输入长度。");
      C.state.courses.push({ id: C.nextId("courses"), title, language, description });
      C.audit("创建课程", title);
      C.save("课程已添加，可以为它创建班级。");
      return true;
    }
    if (name === "admin-create-class") {
      const courseId = Number(value(form, "courseId")), teacherId = value(form, "teacherId"), className = value(form, "name"), studentIds = checkStudents(form, C);
      if (!className || className.length > 120) return fail("请填写 120 字以内的班级名称。");
      if (!C.state.courses.some(course => course.id === courseId)) return fail("请选择现有课程。");
      if (!C.state.users.some(user => user.id === teacherId && user.role === "teacher" && user.active)) return fail("请选择启用的教师账号。");
      if (studentIds === null) return fail("学生名单含有无效或已停用的账号，请重新载入页面。");
      if (C.state.classes.some(item => item.courseId === courseId && item.name.toLowerCase() === className.toLowerCase())) return fail("此课程中已有同名班级。");
      const id = C.nextId("classes");
      C.state.classes.push({ id, courseId, name: className, teacherId, studentIds });
      C.audit("创建班级", `${className} · ${studentIds.length} 名学生`);
      C.save("班级已创建。");
      C.navigate(`/manage/classes?class=${encodeURIComponent(id)}`);
      return true;
    }
    if (name === "admin-load-roster" || name === "admin-enroll") {
      const classroom = C.state.classes.find(item => item.id === Number(value(form, "classId")));
      if (!classroom) return fail("请选择现有班级。");
      if (name === "admin-load-roster") {
        C.navigate(`/manage/classes?class=${encodeURIComponent(classroom.id)}`);
        return true;
      }
      const studentIds = checkStudents(form, C);
      if (studentIds === null) return fail("学生名单含有无效或已停用的账号，请重新载入班级名单。");
      const inactive = classroom.studentIds.filter(id => C.state.users.some(user => user.id === id && user.role === "student" && !user.active));
      classroom.studentIds = [...new Set([...studentIds, ...inactive])];
      C.audit("更新班级名单", `${classroom.name} · ${classroom.studentIds.length} 名学生`);
      C.save("班级名单已保存，历史提交仍保留。");
      return true;
    }
    if (name === "admin-ai-config") {
      const config = { label: value(form, "label"), baseUrl: value(form, "baseUrl"), model: value(form, "model"), timeout: Number(value(form, "timeout")) };
      const error = configError(config);
      if (error) return fail(error);
      C.state.aiConfig = config;
      connectionResult = "";
      C.audit("保存演示模型配置", `${config.label} · ${config.model}`);
      C.save("演示配置已保存。未保存密钥，未连接模型服务。");
      return true;
    }
    return false;
  }

  function action(name, element, C) {
    if (!["admin-toggle-account", "admin-ai-test"].includes(name)) return false;
    if (C.role !== "admin" || !C.user.active) {
      C.toast("请先切换到启用的管理员演示账号。");
      return true;
    }
    if (name === "admin-toggle-account") {
      const account = C.state.users.find(user => user.id === element.dataset.id);
      if (!account || account.id === C.user.id) {
        C.toast("当前演示账号不能在此停用。");
        return true;
      }
      if (account.active && account.role === "admin" && C.state.users.filter(user => user.role === "admin" && user.active).length <= 1) {
        C.toast("请至少保留一个启用的管理员演示账号。");
        return true;
      }
      account.active = !account.active;
      C.audit(account.active ? "启用演示账号" : "停用演示账号", `${account.name}（${account.id}）`);
      C.save(account.active ? "演示账号已启用。" : "演示账号已停用，已有教学记录仍保留。");
      return true;
    }
    const error = configError(C.state.aiConfig);
    if (error) {
      C.toast(error);
      return true;
    }
    connectionResult = "已保存配置的字段格式符合演示要求。模拟回复：已准备好展示教学建议。这不是实际连接结果，未发送请求，不能证明服务或模型可用。";
    C.audit("模拟模型连接检查", `${C.state.aiConfig.label} · 无网络请求`);
    C.save("模拟检查已完成；未连接真实模型。");
    return true;
  }

  window.CourseLoopAdmin = { render, submit, action };
})();
