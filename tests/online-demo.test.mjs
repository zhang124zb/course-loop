import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function demo() {
  const sandbox = { window: {}, URL, URLSearchParams };
  vm.createContext(sandbox);
  for (const name of ['demo-data.js', 'demo-teaching.js', 'demo-admin.js']) {
    vm.runInContext(readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8'), sandbox, { filename: name });
  }
  const { CourseLoopSeed: seed, CourseLoopTeaching: teaching, CourseLoopAdmin: admin } = sandbox.window;
  const state = structuredClone(seed.state), messages = [];
  let user = state.users.find(item => item.id === 'student1');
  const C = {
    state, fixtures: seed.fixtures, query: new URLSearchParams(),
    get user() { return user; }, get role() { return user.role; }, get canTeach() { return user.role !== 'student'; },
    levels: { basic: '基础巩固', comprehensive: '综合开发', contest: '竞赛备赛' },
    kinds: { video: '微课', slides: '课件', worksheet: '实训任务单' },
    stages: { before: '课前预习', during: '课中实操', after: '课后巩固' },
    statuses: { draft: '草稿', published: '已发布', closed: '已关闭' },
    e: value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])),
    nextId: collection => Math.max(0, ...state[collection].map(item => item.id)) + 1,
    fmt: value => String(value), navigate: path => { C.path = path; },
    save: message => messages.push(message), toast: message => messages.push(message),
    audit: (event, objectLabel) => state.audit.push({ id: C.nextId('audit'), event, actorId: user.id, objectLabel, createdAt: new Date().toISOString() })
  };
  const as = id => { user = state.users.find(item => item.id === id); assert.ok(user); };
  const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) for (const item of Array.isArray(value) ? value : [value]) data.append(key, item); return data; };
  const submitCode = (id, source, student = 'student1') => { as(student); teaching.submit('code-submit', form({ assignmentId: id, source }), C); return state.submissions.at(-1); };
  return { C, state, teaching, admin, as, form, submitCode, messages, sandbox };
}

test('fixed samples show simulated feedback; edited code remains pending and never executes', () => {
  const { C, state, teaching, submitCode, sandbox } = demo();
  for (const assignment of state.assignments) {
    const key = state.tasks.find(item => item.id === assignment.taskId).fixtureKey;
    for (const fixture of C.fixtures[key]) {
      const result = submitCode(assignment.id, fixture.source);
      assert.equal(result.status, 'completed');
      assert.equal(result.passed, fixture.id.endsWith('-bad') ? 2 : 3);
      assert.equal(result.total, 3); assert.equal(result.score, fixture.id.endsWith('-bad') ? 66.7 : 100);
      assert.match(teaching.render(`/submissions/${result.id}`, C).html, /模拟/);
    }
  }
  const edited = submitCode(1, 'globalThis.UNSAFE_EXECUTED = true; <script>unsafe</script>');
  assert.equal(edited.status, 'pending'); assert.equal(edited.score, null); assert.equal(edited.cases.length, 0);
  assert.equal(sandbox.UNSAFE_EXECUTED, undefined);
  const html = teaching.render(`/submissions/${edited.id}`, C).html;
  assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;')); assert.ok(!html.includes('<script>unsafe</script>'));
});

test('student pages show own submissions and reject teacher/admin writes', () => {
  const { C, state, teaching, admin, as, form, submitCode } = demo();
  const own = submitCode(1, 'student one private code'); as('student2');
  assert.ok(!teaching.render(`/submissions/${own.id}`, C).html.includes(own.source));
  assert.ok(!teaching.render('/resources/new', C).html.includes('data-form="resource-save"'));
  assert.ok(!admin.render('/manage/accounts', C).html.includes('data-form="admin-create-account"'));
  const before = JSON.stringify(state);
  teaching.submit('resource-save', form({ title: 'forbidden', body: 'text', courseId: 1, level: 'basic', kind: 'worksheet' }), C);
  teaching.submit('task-save', form({ title: 'forbidden', prompt: 'text', level: 'basic', knowledgePoints: 'loop' }), C);
  teaching.action('diagnose', { dataset: { id: '1' } }, C);
  admin.submit('admin-create-account', form({ id: 'forbidden', name: 'sample', role: 'admin' }), C);
  assert.equal(JSON.stringify(state), before);
});

test('diagnosis uses latest submissions in current roster, excludes pending scores, and requires manual adoption', () => {
  const { C, state, teaching, admin, as, form, submitCode } = demo(); state.submissions = [];
  submitCode(1, C.fixtures.mean[0].source); submitCode(1, C.fixtures.mean[1].source);
  submitCode(1, 'edited code awaiting review', 'student2'); submitCode(1, C.fixtures.mean[0].source, 'student3');
  as('admin'); admin.submit('admin-enroll', form({ classId: 1, studentIds: ['student1', 'student2'] }), C);
  as('teacher'); teaching.action('diagnose', { dataset: { id: '1' } }, C);
  const report = state.reports.at(-1), evidence = report.evidence, snapshot = JSON.stringify(evidence);
  assert.equal(evidence.enrolled_count, 2); assert.equal(evidence.submitted_students, 2);
  assert.equal(evidence.evaluated_students, 1); assert.equal(evidence.pending_students, 1);
  assert.equal(evidence.mean_example_score, 100); assert.equal(Object.keys(evidence.common_failed_cases).length, 0);
  assert.match(report.content, /演示建议（预设）/); assert.equal(report.adoptedAt, null);
  submitCode(1, C.fixtures.mean[0].source); assert.equal(JSON.stringify(evidence), snapshot);
  teaching.action('adopt-report', { dataset: { id: String(report.id) } }, C); assert.equal(report.adoptedAt, null);
  assert.ok(!teaching.render(`/reports/${report.id}`, C).html.includes(report.content));
  as('teacher'); teaching.action('adopt-report', { dataset: { id: String(report.id) } }, C); assert.ok(report.adoptedAt);
});

test('resource text is escaped, model URL rejects credentials, and new students join only valid rosters', () => {
  const { C, state, teaching, admin, as, form } = demo(); as('teacher');
  teaching.submit('resource-save', form({ title: '<img src=x onerror=unsafe()>', body: '<script>unsafe</script>', courseId: 1, level: 'basic', kind: 'worksheet', published: 'on' }), C);
  const resource = state.resources.at(-1), html = teaching.render(`/resources/${resource.id}`, C).html;
  assert.ok(html.includes('&lt;img src=x onerror=unsafe()&gt;')); assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
  as('admin'); const config = JSON.stringify(state.aiConfig);
  admin.submit('admin-ai-config', form({ label: 'demo', baseUrl: 'https://name:password@example.com/v1', model: 'sample-model', timeout: 30 }), C);
  assert.equal(JSON.stringify(state.aiConfig), config);
  admin.submit('admin-create-account', form({ id: 'new-student', name: '新增模拟学生', role: 'student' }), C);
  assert.ok(state.users.find(user => user.id === 'new-student')?.active);
  assert.ok(!state.classes[0].studentIds.includes('new-student'));
  const previous = JSON.stringify(state.classes[0].studentIds);
  admin.submit('admin-enroll', form({ classId: 1, studentIds: ['new-student', 'teacher'] }), C); assert.equal(JSON.stringify(state.classes[0].studentIds), previous);
  admin.submit('admin-enroll', form({ classId: 1, studentIds: ['new-student', 'new-student'] }), C);
  assert.deepEqual([...state.classes[0].studentIds], ['new-student']); as('new-student');
  assert.ok(teaching.render('/teaching', C).html.includes('href="#/assignments/1"'));
});
