import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = ['demo-data.js', 'demo-teaching.js', 'demo-admin.js', 'app.js']
  .map(name => fs.readFileSync(new URL('../dist/' + name, import.meta.url), 'utf8'));
const seedContext = { window: {} };
vm.runInNewContext(scripts[0], seedContext);
const seed = structuredClone(seedContext.window.CourseLoopSeed);

function load(change = () => {}, path = '/resources', user = 'teacher') {
  const saved = structuredClone(seed.state);
  saved.resources[0].title = 'SAVED_STATE_SENTINEL';
  change(saved);
  const app = { innerHTML: '' };
  const context = {
    window: { addEventListener() {} },
    document: { getElementById: () => app, addEventListener() {} },
    localStorage: { getItem: () => JSON.stringify(saved) },
    sessionStorage: { getItem: () => user },
    location: { hash: '#' + path },
    structuredClone, URL, URLSearchParams, setTimeout, clearTimeout, console,
  };
  vm.createContext(context);
  for (const script of scripts) vm.runInContext(script, context);
  return app.innerHTML;
}

const warning = '浏览器保存的数据暂时不可用';
assert.match(load(), /SAVED_STATE_SENTINEL/);
assert.doesNotMatch(load(), new RegExp(warning));
for (const change of [
  state => { state.users = [null]; },
  state => { state.users[0].name = 42; },
  state => { state.users[0].role = 'unexpected'; },
  state => { state.users[0].id = 'unsafe"id'; },
  state => { state.classes[0].studentIds = null; },
  state => { state.resources[0].body = null; },
  state => { state.resources[0].id = '1"><img src=x data-loader-proof="injected'; },
  state => { state.resources[0].id = Number.MAX_SAFE_INTEGER + 1; },
  state => { state.resources[0].id = state.resources[1].id; },
  state => { state.assignments[0].resourceIds = ['1']; },
  state => { state.submissions[0].cases[0].expected = {}; },
  state => { state.progress = ['student1:1"><img src=x>']; },
  state => { state.aiConfig = []; },
  state => { state.aiConfig.apiKey = 'must-not-load'; },
  state => { state.aiConfig.baseUrl = 'https://user:secret@example.com/v1'; },
  state => { state.aiConfig.baseUrl = 'https://example.com/v1?api_key=secret'; },
]) {
  const html = load(change);
  assert.match(html, new RegExp(warning));
  assert.doesNotMatch(html, /SAVED_STATE_SENTINEL|data-loader-proof|must-not-load/);
}
const validChanges = state => {
  state.users.push({ id: 'new_student', name: '<b>模拟姓名</b>', role: 'student', active: true });
  state.progress.push('new_student:1');
  state.submissions.push({ id: 50, assignmentId: 1, studentId: 'new_student', source: 'print("edited")', status: 'pending', score: null, passed: null, total: null, createdAt: new Date().toISOString(), feedback: '待评测', cases: [] });
  state.reports.push({ id: 1, assignmentId: 1, model: '演示建议（预设）', content: '<b>模拟报告</b>', createdAt: new Date().toISOString(), adoptedAt: null, evidence: { enrolled_count: 4, submitted_students: 3, evaluated_students: 2, pending_students: 1, mean_example_score: 66.7, common_failed_cases: { '空输入': 2 } } });
};
assert.doesNotMatch(load(validChanges), new RegExp(warning));
assert.match(load(validChanges), /SAVED_STATE_SENTINEL/);
assert.match(load(validChanges, '/manage/accounts', 'admin'), /&lt;b&gt;模拟姓名&lt;\/b&gt;/);
console.log('Saved-state loader checks passed: valid generated records retained; 16 malformed/injected samples rejected with a fresh-data warning.');
