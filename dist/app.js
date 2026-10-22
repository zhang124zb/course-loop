/* Static teaching demonstration. No authentication, code execution or model network calls. */
(() => {
 'use strict';
 const KEY='courseloop-teaching-demo-v1', VIEW='courseloop-demo-view-v1';
 const initial=()=>structuredClone(window.CourseLoopSeed.state);
 const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let state=initial(),currentId=null,storageWarning='',timer;
 const collections=['courses','classes','users','resources','tasks','assignments','submissions','reports','progress','audit'];
 function validSaved(saved){
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const text=value=>typeof value==='string', id=value=>Number.isSafeInteger(value)&&value>0;
  const uid=value=>text(value)&&value.length>=3&&value.length<=40&&!/[^A-Za-z0-9_.-]/.test(value);
  const array=(value,check)=>Array.isArray(value)&&value.length<=600&&value.every(check);
  const strings=(item,keys)=>keys.every(key=>text(item[key]));
  const count=value=>Number.isSafeInteger(value)&&value>=0, score=value=>value===null||(Number.isFinite(value)&&value>=0&&value<=100);
  if(!record(saved)||!collections.every(key=>array(saved[key],key==='progress'?text:item=>record(item)&&(key==='users'?uid(item.id):id(item.id)))))return false;
  if(!collections.filter(key=>key!=='progress').every(key=>new Set(saved[key].map(item=>item.id)).size===saved[key].length))return false;
  if(!saved.users.length||!saved.users.every(item=>text(item.name)&&item.name.length>0&&item.name.length<=60&&['student','teacher','admin'].includes(item.role)&&typeof item.active==='boolean'))return false;
  if(!saved.users.some(item=>item.role==='admin'&&item.active))return false;
  if(!saved.courses.every(item=>strings(item,['title','language','description'])))return false;
  if(!saved.classes.every(item=>text(item.name)&&id(item.courseId)&&uid(item.teacherId)&&array(item.studentIds,uid)))return false;
  if(!saved.resources.every(item=>strings(item,['title','body'])&&id(item.courseId)&&['basic','comprehensive','contest'].includes(item.level)&&['video','slides','worksheet'].includes(item.kind)&&typeof item.published==='boolean'))return false;
  if(!saved.tasks.every(item=>strings(item,['title','prompt','starterCode'])&&['basic','advanced','project'].includes(item.level)&&array(item.knowledgePoints,text)&&(item.fixtureKey===null||['mean','max','count'].includes(item.fixtureKey))))return false;
  if(!saved.assignments.every(item=>text(item.title)&&id(item.taskId)&&id(item.classId)&&['before','during','after'].includes(item.stage)&&['published','draft','closed'].includes(item.status)&&array(item.resourceIds,id)))return false;
  if(!saved.submissions.every(item=>strings(item,['source','feedback','createdAt'])&&id(item.assignmentId)&&uid(item.studentId)&&['completed','pending'].includes(item.status)&&score(item.score)&&(item.passed===null||count(item.passed))&&(item.total===null||count(item.total))&&array(item.cases,test=>record(test)&&strings(test,['name','input','expected','actual'])&&typeof test.passed==='boolean')))return false;
  if(!saved.reports.every(item=>strings(item,['model','content','createdAt'])&&id(item.assignmentId)&&(item.adoptedAt===null||text(item.adoptedAt))&&record(item.evidence)&&['enrolled_count','submitted_students','evaluated_students','pending_students'].every(key=>count(item.evidence[key]))&&score(item.evidence.mean_example_score)&&record(item.evidence.common_failed_cases)&&Object.values(item.evidence.common_failed_cases).every(count)))return false;
  if(!saved.progress.every(key=>{const parts=key.split(':');return parts.length===2&&uid(parts[0])&&/^[1-9][0-9]*$/.test(parts[1])&&id(Number(parts[1]));}))return false;
  if(!saved.audit.every(item=>strings(item,['event','objectLabel','createdAt'])&&uid(item.actorId)))return false;
  const config=saved.aiConfig;
  if(!record(config)||!Object.keys(config).every(key=>['label','baseUrl','model','timeout'].includes(key))||!strings(config,['label','baseUrl','model'])||!config.label||!config.model||!Number.isInteger(config.timeout)||config.timeout<5||config.timeout>120)return false;
  const address=new URL(config.baseUrl);
  return ['http:','https:'].includes(address.protocol)&&!address.username&&!address.password&&!address.search&&!address.hash;
 }
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){
   const saved=JSON.parse(raw);
   if(raw.length>2000000||!validSaved(saved))throw Error('Invalid demo data');
   state=saved;
  }
 }catch{storageWarning='浏览器保存的数据暂时不可用，已加载全新模拟数据。';}
 try{currentId=sessionStorage.getItem(VIEW);}catch{storageWarning='浏览器存储不可用，操作仅在当前页面暂存，刷新后会丢失。';}
 const app=document.getElementById('app');
 const roles={student:'学生',teacher:'教师',admin:'管理员'};
 const C={e,fixtures:window.CourseLoopSeed.fixtures,levels:{basic:'基础巩固',comprehensive:'综合开发',contest:'竞赛备赛'},taskLevels:{basic:'基础',advanced:'进阶',project:'项目'},kinds:{video:'微课讲稿',slides:'课件讲义',worksheet:'实训任务单'},stages:{before:'课前预习',during:'课中实操',after:'课后训练'},statuses:{published:'已发布',draft:'草稿',closed:'已关闭',completed:'演示已评测',pending:'待评测'}};
 Object.defineProperties(C,{state:{get:()=>state},user:{get:()=>state.users.find(u=>u.id===currentId&&u.active)},role:{get:()=>C.user?.role},canTeach:{get:()=>['teacher','admin'].includes(C.role)},query:{get:()=>new URL(location.hash.slice(1)||'/login','https://demo.invalid').searchParams}});
 C.fmt=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('zh-CN',{hour12:false});};
 C.nextId=name=>Math.max(0,...state[name].map(item=>Number(item.id)||0))+1;
 C.toast=message=>{const box=document.getElementById('demo-toast');clearTimeout(timer);box.textContent=String(message);box.hidden=false;timer=setTimeout(()=>{box.hidden=true;},6000);};
 C.audit=(event,label)=>{state.audit.unshift({id:C.nextId('audit'),event,actorId:currentId||'demo',objectLabel:String(label).slice(0,180),createdAt:new Date().toISOString()});state.audit=state.audit.slice(0,500);};
 C.save=message=>{
  let persisted=true;
  try{const value=JSON.stringify(state);if(value.length>2000000||!validSaved(state))throw Error('Demo limit');localStorage.setItem(KEY,value);storageWarning='';}
  catch{persisted=false;storageWarning='浏览器无法保存本次修改；数据仅在当前页面暂存，刷新后可能丢失。';}
  paint();C.toast(persisted?(message||'演示操作已保存在当前浏览器。'):storageWarning);return persisted;
 };
 C.navigate=path=>{const next='#'+(path.startsWith('/')?path:'/dashboard');if(location.hash===next)paint();else location.hash=next;};
 function choose(id){
  if(!state.users.some(u=>u.id===id&&u.active)){C.toast('请选择有效的模拟账号。');return;}
  currentId=id;try{sessionStorage.setItem(VIEW,id);}catch{}
  C.navigate('/dashboard');
 }
 function login(){
  return `<main id="main" class="login-layout"><section class="login-story"><a class="brand light" href="#/login"><span class="brand-mark" aria-hidden="true">&lt;/&gt;</span><span><strong>CourseLoop</strong><small>让教学与练习形成闭环</small></span></a><div class="login-copy"><p class="eyebrow">TEACH · PRACTICE · GROW</p><h1>从课堂出发，<br>在每次实践中进阶。</h1><p>把分层资源、课堂任务和学习证据连接起来，让反馈回到教学。</p><div class="story-steps"><span>教<small>分层教学</small></span><i aria-hidden="true">→</i><span>学<small>自主实训</small></span><i aria-hidden="true">→</i><span>评<small>精准反馈</small></span></div></div><p class="login-story-foot">在线教学演示 · Python 程序设计 · 模拟数据</p></section><section class="login-side"><div class="login-box"><span class="badge">本机教学版同款界面 · 在线演示</span><h2>欢迎体验教学空间</h2><p class="muted">选择一个演示视角，无需真实账号或密码。</p>${storageWarning?`<div class="message warning">${e(storageWarning)}</div>`:''}<div class="demo-role-options">${[['student1','学生','学习资源与提交练习'],['teacher','教师','安排任务与核对教学建议'],['admin','管理员','管理模拟账号、课程与班级']].map(([id,name,summary])=>`<button type="button" class="button ${id==='student1'?'primary':''}" data-action="choose-view" data-user="${id}"><span>${name}视角</span><small>${summary} →</small></button>`).join('')}</div><form data-form="choose-account" class="stack-form"><p><label for="demo-user">选择其他模拟账号</label><select id="demo-user" name="user">${state.users.filter(u=>u.active).map(u=>`<option value="${e(u.id)}">${e(u.name)} · ${roles[u.role]||'模拟视角'}</option>`).join('')}</select></p><button class="button full-width" type="submit">进入选定视角 →</button></form><div class="login-help"><strong>操作只保存在这个浏览器</strong><p>全部为模拟数据。代码反馈和 AI 建议为演示结果，不会执行代码或调用模型。可以随时重置演示。</p></div><div class="demo-login-links"><a href="local.html">本机真实系统说明 ↗</a><a href="prototype/">早期课赛融合原型 ↗</a></div><p class="login-note">请只输入模拟材料。真实登录、持久数据库和 DeepSeek 诊断请使用本机版。</p></div></section></main>`;
 }
 function visibleAssignments(){
  const classIds=state.classes.filter(room=>C.role==='admin'||(C.role==='teacher'?room.teacherId===C.user.id:room.studentIds.includes(C.user.id))).map(room=>room.id);
  return state.assignments.filter(a=>classIds.includes(a.classId)&&(C.canTeach||a.status!=='draft'));
 }
 function dashboard(){
  const assignments=visibleAssignments(), ids=assignments.map(a=>a.id), subs=state.submissions.filter(s=>ids.includes(s.assignmentId)&&(C.canTeach||s.studentId===C.user.id));
  const resources=state.resources.filter(r=>C.canTeach||r.published), reports=state.reports.filter(r=>ids.includes(r.assignmentId));
  const heading=C.role==='student'?'学习工作台':C.role==='admin'?'平台工作台':'教学工作台';
  const taskRows=assignments.slice(0,5).map((a,i)=>`<a class="task-row" href="#/assignments/${e(a.id)}"><span class="number-circle">${i+1}</span><div><strong>${e(a.title)}</strong><p>${e(state.classes.find(c=>c.id===a.classId)?.name||'模拟班级')} · ${e(C.stages[a.stage])}</p></div><span class="badge neutral">${e(C.statuses[a.status])}</span></a>`).join('');
  const secondary=C.canTeach?reports.slice(-5).reverse().map(r=>`<a class="compact-row" href="#/reports/${e(r.id)}"><div><strong>${e(state.assignments.find(a=>a.id===r.assignmentId)?.title||'演示报告')}</strong><p>${e(C.fmt(r.createdAt))} · 预设建议</p></div><span class="badge success">演示报告</span></a>`).join(''):subs.slice(-5).reverse().map(s=>`<a class="compact-row" href="#/submissions/${e(s.id)}"><div><strong>${e(state.assignments.find(a=>a.id===s.assignmentId)?.title||'模拟任务')}</strong><p>${e(C.fmt(s.createdAt))}</p></div><span class="badge ${s.status==='completed'?'success':'warning'}">${s.status==='completed'?'演示已评测':'待评测'}</span></a>`).join('');
  return {title:heading,html:`<div class="page-heading"><div><p class="eyebrow">COURSELOOP / WORKSPACE</p><h1>${heading}</h1><p class="subtitle">你好，${e(C.user.name)}。${C.canTeach?'从学习证据出发，安排下一步教学。':'从一项练习开始，让理解变成能力。'}</p></div><span class="date-label">${new Date().toLocaleDateString('zh-CN')}</span></div><section class="hero-panel"><div><span class="badge">PYTHON 程序设计</span><h2>${C.canTeach?'让每一次实训，<br>成为下一次教学的依据。':'从会写代码，<br>到学会解决问题。'}</h2><p>${C.canTeach?'连接课前、课中、课后活动，查看班级提交并体验教学建议。':'阅读分层资源，完成课堂任务，查看每次提交的演示反馈。'}</p><a class="button primary" href="#/teaching">${C.canTeach?'进入课堂与任务':'进入我的任务'} →</a></div><div class="hero-art" aria-hidden="true"><div class="code-window"><span>● ● ●</span><strong>&lt; / &gt;</strong><small>LEARN THROUGH PRACTICE</small></div><span class="hero-check">✓</span></div></section><div class="metrics-grid">${[['blue','▤','可用资源',resources.length,'按当前演示视角统计'],['green','⌘','课堂任务',assignments.length,'课前 · 课中 · 课后'],['purple','↥','提交记录',subs.length,'仅为浏览器内模拟记录'],['amber','◷','待评测提交',subs.filter(s=>s.status==='pending').length,'编辑代码保存后等待评测']].map(([color,icon,label,count,note])=>`<article class="metric"><span class="metric-icon ${color}">${icon}</span><div><p>${label}</p><strong>${count}</strong><small>${note}</small></div></article>`).join('')}</div><div class="two-column"><section class="panel"><div class="panel-header"><h2>${C.canTeach?'近期课堂任务':'我的课堂任务'}</h2><a class="text-link" href="#/teaching">查看全部 →</a></div><div class="list-body">${taskRows||'<div class="empty-state"><strong>还没有课堂任务</strong><p>可在教师视角安排新的演示任务。</p></div>'}</div></section><section class="panel"><div class="panel-header"><h2>${C.canTeach?'教学诊断':'最近提交'}</h2></div><div class="list-body">${secondary||'<div class="empty-state"><span class="empty-symbol">✧</span><strong>让教学建议有据可循</strong><p>进入课堂任务，根据模拟提交体验教学建议。</p></div>'}</div></section></div>`};
 }
 function shell(page,path){
  const links=[['/dashboard','▦','工作台'],['/resources','▤','分层资源库'],['/teaching','⌘',C.canTeach?'课堂与任务':'我的课堂任务']];
  const admin=[['/manage/accounts','♙','账号管理'],['/manage/classes','▥','班级与课程'],['/manage/ai','✧','模型服务'],['/manage/audit','≡','操作记录']];
  const nav=items=>items.map(([href,icon,label])=>`<a class="nav-item ${path===href||path.startsWith(href+'/')?'active':''}" href="#${href}"><span class="nav-icon" aria-hidden="true">${icon}</span>${label}</a>`).join('');
  return `<aside class="sidebar" id="sidebar"><a class="brand" href="#/dashboard"><span class="brand-mark" aria-hidden="true">&lt;/&gt;</span><span><strong>CourseLoop</strong><small>让教学与练习形成闭环</small></span></a><div class="workspace-chip"><span class="status-dot" aria-hidden="true"></span> 在线教学演示 <span class="mini-label">DEMO</span></div><p class="nav-label">教学空间</p><nav aria-label="主要导航">${nav(links)}${C.role==='admin'?`<p class="nav-label">平台管理</p>${nav(admin)}`:''}</nav><div class="sidebar-bottom"><div class="prototype-card"><strong>从演示，走向真实教学</strong><p>本机版提供真实账号、数据保存与 DeepSeek 教师诊断。</p><a href="local.html">本机使用说明 ↗</a><a href="prototype/">早期课赛融合原型 ↗</a></div><button type="button" class="text-button demo-reset" data-action="reset-demo">重置此浏览器的演示数据</button><p class="local-foot"><span class="status-dot" aria-hidden="true"></span> 模拟数据 · 浏览器内保存</p></div></aside><div class="workspace"><header class="topbar"><div class="topbar-left"><button type="button" class="menu-button" aria-label="展开导航" aria-controls="sidebar" aria-expanded="false" data-action="toggle-menu">☰</button><span class="breadcrumb">教学空间 <span aria-hidden="true">/</span><strong>${e(page.title)}</strong></span></div><div class="identity"><span class="role-badge">${roles[C.role]} · 演示</span><span class="avatar" aria-hidden="true">${e(C.user.name.slice(0,1))}</span><span class="identity-name">${e(C.user.name)}</span><div class="logout-form"><button type="button" class="text-button" data-action="logout">切换视角</button></div></div></header><main id="main" class="main" tabindex="-1"><div class="mode-notice" role="note"><span><strong>在线演示</strong> · 全部为模拟数据，操作只保存在当前浏览器；代码与 AI 结果为演示。</span><a href="local.html">本机真实系统说明 ↗</a></div>${storageWarning?`<div class="message warning demo-storage-warning">${e(storageWarning)}</div>`:''}${page.html}<footer class="page-footer"><span>CourseLoop · 每一步学习都有据可循</span><span>在线静态演示 · 无真实登录与模型后台</span></footer></main></div>`;
 }
 function paint(){
  try{
  const path=new URL(location.hash.slice(1)||'/login','https://demo.invalid').pathname;
  if(!C.user||path==='/login'){app.innerHTML=login();document.title='体验教学空间 · CourseLoop';return;}
  let page=path==='/dashboard'?dashboard():window.CourseLoopTeaching.render(path,C)||window.CourseLoopAdmin.render(path,C);
  if(!page)page={title:'页面未找到',html:'<section class="panel demo-error"><h1>暂时没有这个演示页面</h1><p>可以返回工作台继续体验。</p><a class="button primary" href="#/dashboard">返回工作台</a></section>'};
  app.innerHTML=shell(page,path);document.title=page.title+' · CourseLoop 在线演示';
  }catch{
   document.title='演示数据待恢复 · CourseLoop';
   app.innerHTML='<main id="main" class="standalone-error"><section class="panel demo-error"><h1>浏览器中的演示数据需要恢复</h1><p>已保存的数据格式可能有误。可以重置这个浏览器的教学演示，恢复全新模拟数据。</p><button class="button primary" type="button" data-action="reset-demo">重置教学演示</button><p class="small muted">只影响当前浏览器的在线演示，不影响本机系统或早期原型。</p></section></main>';
  }
 }
 document.addEventListener('submit',event=>{
  const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();
  if(!form.reportValidity())return;
  const values=new FormData(form),name=form.dataset.form;
  if(name==='choose-account'){choose(values.get('user'));return;}
  if(!C.user)return;
  try{if(!window.CourseLoopTeaching.submit(name,values,C)&&!window.CourseLoopAdmin.submit(name,values,C))C.toast('这项演示暂未提供。');}
  catch(error){console.error(error);C.toast('演示操作未完成，请检查填写内容或重置模拟数据。');}
 });
 document.addEventListener('click',event=>{
  if(event.target.closest('a.skip-link')){event.preventDefault();const main=document.getElementById('main');if(main){main.tabIndex=-1;main.focus();}return;}
  const button=event.target.closest('[data-action]');if(!button)return;
  event.preventDefault();
  const action=button.dataset.action;
  if(action==='choose-view'){choose(button.dataset.user);return;}
  if(action==='logout'){currentId=null;try{sessionStorage.removeItem(VIEW);}catch{}C.navigate('/login');return;}
  if(action==='toggle-menu'){const sidebar=document.getElementById('sidebar');sidebar.classList.toggle('is-open');button.setAttribute('aria-expanded',String(sidebar.classList.contains('is-open')));return;}
  if(action==='reset-demo'){
   if(!confirm('清除这个浏览器内的教学演示修改，并恢复全新模拟数据？本机系统和早期原型的数据不受影响。'))return;
   state=initial();C.save('演示数据已重置。');if(!C.user){currentId=null;C.navigate('/login');}return;
  }
  if(!C.user)return;
  try{window.CourseLoopTeaching.action(action,button,C)||window.CourseLoopAdmin.action(action,button,C);}
  catch(error){console.error(error);C.toast('演示操作未完成，请重试或重置模拟数据。');}
 });
 window.addEventListener('hashchange',()=>{paint();document.getElementById('main')?.focus({preventScroll:true});window.scrollTo(0,0);});
 paint();
})();
