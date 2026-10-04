/* Date-based weekly history and append-only ledger. All folio-* keys cloud-sync. */
(() => {
  const read = (key, fallback) => JSON.parse(localStorage.getItem(key) || 'null') || fallback;
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const codes = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const date = key => new Date(`${key}T12:00:00`);
  const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const plus = (k, n) => { const d = date(k); d.setDate(d.getDate()+n); return key(d); };
  const monday = k => plus(k, -(date(k).getDay()+6)%7);
  const today = () => key(new Date());
  let selected = monday(today()), activeCurrent = selected, browseMonth = selected.slice(0,7), editing = null;
  const history = read('folio-week-history', {});
  const transactions = read('folio-transactions', []);
  const categories = read('folio-money-categories', ['주거비','식비','카페비','생필품','꾸밈비']);
  const amount = value => Number(String(value || '').replace(/,/g,'')) || 0;
  const won = value => `₩${Number(value).toLocaleString('ko-KR')}`;
  if (!localStorage.getItem('folio-history-migrated')) {
    history['2026-09-28'] = { fields: structuredClone(state.weeklyFields), habits: structuredClone(state.habits) };
    Object.entries(state.weeklyFields).forEach(([day, fields]) => {
      const index = codes.indexOf(day); if (index < 0) return;
      ['expense','income'].forEach(kind => {
        const value = Number(String(fields[kind] || '').replace(/[^0-9.]/g,''));
        if (value > 0) transactions.push({id:crypto.randomUUID(), kind, amount:value, date:plus('2026-09-28',index), createdAt:null, category:fields[`${kind}Category`] || '', source:fields[`${kind}Source`] || '', item:fields[`${kind}Item`] || ''});
      });
    });
    write('folio-week-history', history); write('folio-transactions', transactions);
    localStorage.setItem('folio-history-migrated','1');
  }
  const loadWeek = () => {
    const saved = history[selected] || {fields:{},habits:{}};
    state.weeklyFields = structuredClone(saved.fields); state.habits = structuredClone(saved.habits);
  };
  const saveWeek = () => { history[selected] = {fields:structuredClone(state.weeklyFields),habits:structuredClone(state.habits)}; write('folio-week-history',history); };
  loadWeek();
  saveFields = () => { saveWeek(); };
  refreshDaySummaries = () => document.querySelectorAll('.week-day[data-date]').forEach(card => {
    const code = codes[(date(card.dataset.date).getDay()+6)%7];
    const fields = state.weeklyFields[code] || {}, head = card.querySelector('.week-day-head');
    head.querySelector('.day-summary')?.remove();
    const icons = {'맑음':'☀️','구름':'⛅','비':'🌧️','눈':'❄️','바람':'🍃'};
    const values = [icons[fields.weather], fields.top, fields.bottom, fields.outer].filter(Boolean);
    if (values.length) { const box=document.createElement('div');box.className='day-summary';box.innerHTML=values.map(v=>`<span>${esc(v)}</span>`).join('');head.insertBefore(box,head.querySelector('.week-date')); }
  });
  planFor = day => state.weeklyPlans.filter(plan => plan.date === plus(selected,codes.indexOf(day)));
  const opts = selectedCategory => `<option value="">분류 선택</option>${[...new Set([...categories,selectedCategory].filter(Boolean))].map(c=>`<option value="${esc(c)}" ${c===selectedCategory?'selected':''}>${esc(c)}</option>`).join('')}`;
  const entryForm = (kind, day) => `<form data-transaction-form="${kind}" data-date="${day}" class="transaction-form"><input name="amount" type="number" min="0.01" step="0.01" placeholder="${kind==='expense'?'지출':'수입'} 금액" required><select name="category">${opts('')}</select><input name="source" placeholder="${kind==='expense'?'결제수단':'수입처'}"><input name="item" placeholder="항목"><button type="submit" class="primary-button">기록 추가</button></form>`;
  const weeklyView = views.weekly;
  views.weekly = () => {
    const current = monday(today());
    if (activeCurrent !== current) { saveWeek(); activeCurrent=current; selected=current; loadWeek(); }
    const template = document.createElement('template'); template.innerHTML = weeklyView();
    const heading = template.content.querySelector('.card-title');
    if (heading) heading.textContent = `${selected} — ${plus(selected,6)}`;
    const cards = [...template.content.querySelectorAll('.week-day')];
    cards.forEach(card => {
      const code = card.querySelector('.week-day-name').textContent.trim().slice(0,3);
      const day = plus(selected,codes.indexOf(code)); card.dataset.date=day;
      card.querySelector('.week-date').textContent = day.slice(5).replace('-','/');
      card.querySelectorAll('.today-badge, .today-tag').forEach(el=>el.remove());
      // The old template's TODAY decoration is weekday-only: replace with a date-based badge.
      const name = card.querySelector('.week-day-name'); name.textContent=code;
      if(day===today()) name.insertAdjacentHTML('beforeend',' <span class="today-badge">TODAY</span>');
      const open=day===today(); card.classList.toggle('collapsed',!open);
      card.querySelectorAll('.weekly-record').forEach(row => {
        const id=row.querySelector('[data-complete-plan]')?.dataset.completePlan;
        const plan=state.weeklyPlans.find(p=>String(p.id)===id);
        if(!plan || String(plan.time||'').trim())return;
        row.innerHTML=`<button class="todo-check" data-complete-plan="${plan.id}" aria-pressed="${Boolean(plan.done)}">${plan.done?'✓':'□'}</button><span class="tag ${esc(plan.category)}">${esc(plan.category)}</span><span class="plan-record-text">${esc(plan.text)}</span><button type="button" class="edit-plan-button" data-edit-plan="${plan.id}">수정</button><label class="monthly-item-toggle"><input type="checkbox" data-plan-monthly="${plan.id}" ${plan.showMonthly===false?'':'checked'}> 월간</label><button class="remove-record" data-remove-plan="${plan.id}">×</button>`;
      });
      card.querySelectorAll('.day-section').forEach(section=>{
        if(!section.querySelector('.day-label')?.textContent.includes('SCHEDULE'))return;
        section.classList.add('schedule-section');
        section.querySelectorAll('.monthly-item-toggle').forEach(toggle=>toggle.remove());
        section.querySelectorAll('.weekly-record>span:not(.tag)').forEach(text=>text.classList.add('schedule-record-text'));
      });
      const toggle=card.querySelector('[data-toggle-week-day]'); toggle.setAttribute('aria-expanded',String(open)); toggle.textContent=open?'⌃':'⌄';
      card.querySelectorAll('.day-section').forEach(section=>{
        const label=section.querySelector('.day-label')?.textContent.trim();
        if(label==='EXPENSE'||label==='INCOME') {
          const kind=label==='EXPENSE'?'expense':'income';
          const rows=transactions.filter(t=>t.date===day&&t.kind===kind);
          section.innerHTML=`<div class="day-label">${label} · ${rows.length}건 · ${won(rows.reduce((s,t)=>s+t.amount,0))}</div>${entryForm(kind,day)}<small class="muted">여러 건 추가할 수 있어요 · 수정은 Money에서</small>`;
        }
      });
      const clothes = card.querySelector('[data-field="outer"]')?.closest('.day-meta');
      if (clothes) {
        let anchor = clothes;
        card.querySelectorAll('.day-section').forEach(section => {
          if (section.querySelector('[data-transaction-form]')) { anchor.after(section); anchor = section; }
        });
      }
      card.querySelectorAll('.add-plan').forEach(button=>{button.classList.remove('add-plan');button.dataset.historyAdd=code;});
    });
    const parent=cards[0]?.parentElement;
    cards.sort((a,b)=> (a.dataset.date===today()?-1:b.dataset.date===today()?1:a.dataset.date.localeCompare(b.dataset.date))).forEach(c=>parent.append(c));
    template.content.querySelectorAll('.weekly-total').forEach(el=>el.remove());
    const months = new Set(Object.keys(history).map(w=>w.slice(0,7)));
    for(let offset=-4;offset<=14;offset++){const d=date(`${browseMonth}-01`);d.setMonth(d.getMonth()+offset);months.add(key(d).slice(0,7));}
    months.add(browseMonth);
    const archive=[...months].filter(month=>month>='2026-08').sort().map(month=>{
      const start=`${month}-01`, weeks=[];let w=monday(start);if(w<start)w=plus(w,7);
      while(w.slice(0,7)===month){weeks.push(w);w=plus(w,7);}
      return `<details class="week-month"><summary>${month.replace('-','년 ')}월</summary><div class="week-month-list">${weeks.map((w,i)=>`<button type="button" data-select-week="${w}" class="secondary-button ${w===selected?'selected':''}">${i+1}주 · ${w.slice(5)} – ${plus(w,6).slice(5)}${w===current?' · 이번 주':''}</button>`).join('')}</div></details>`;
    }).join('');
    const totals=kind=>transactions.filter(t=>t.kind===kind&&t.date>=selected&&t.date<=plus(selected,6)).reduce((s,t)=>s+t.amount,0);
    return `<div class="history-week-bar"><button class="secondary-button" data-select-week="${plus(selected,-7)}">← 이전 주</button><strong>${selected} – ${plus(selected,6)}</strong><button class="secondary-button" data-select-week="${plus(selected,7)}">다음 주 →</button><button class="secondary-button" data-select-week="${current}">이번 주</button></div><p class="view-intro">주간 지출 ${won(totals('expense'))} · 수입 ${won(totals('income'))}</p>${template.innerHTML}<section class="paper-card week-archive"><div class="card-head"><span class="card-title">월별 주간 보관함</span><input type="month" value="${browseMonth}" data-browse-month aria-label="찾아볼 월"></div><p class="muted">월요일이 속한 달에 보관해요. 주를 선택하면 펼쳐볼 수 있어요.</p>${archive}</section>`;
  };
  const previousMoney = views.money;
  views.money = () => {
    const old=document.createElement('template');old.innerHTML=previousMoney();
    const fixed=[...old.content.querySelectorAll('.fixed-expense-card,.fixed-income-card')].map(el=>el.outerHTML).join('').replaceAll('지출처','결제수단');
    const total=kind=>transactions.filter(t=>t.kind===kind).reduce((s,t)=>s+t.amount,0);
    const form = t => `<form data-edit-transaction="${t.id}" class="transaction-form"><input name="date" type="date" value="${t.date}" required><select name="kind"><option value="expense" ${t.kind==='expense'?'selected':''}>지출</option><option value="income" ${t.kind==='income'?'selected':''}>수입</option></select><input name="amount" type="number" min="0.01" step="0.01" value="${t.amount}" required><select name="category">${opts(t.category)}</select><input name="source" value="${esc(t.source)}" placeholder="지출처 / 수입처"><input name="item" value="${esc(t.item)}" placeholder="항목"><button class="primary-button">저장</button><button type="button" data-cancel-transaction class="secondary-button">취소</button></form>`;
    const rows=[...transactions].sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||'')).map(t=>`<article class="money-ledger-row"><span class="ledger-kind ${t.kind}">${t.kind==='expense'?'−':'+'}</span><div class="ledger-description"><strong>${t.kind==='expense'?'지출':'수입'} · ${won(t.amount)} · ${esc(t.item)}</strong><small>사용일 ${t.date} · ${esc(t.source || '출처 미입력')} · ${esc(t.category || '미분류')}</small><small>기록 일시: ${t.createdAt?new Date(t.createdAt).toLocaleString('ko-KR'):'이전 기록 (일시 미상)'}${t.updatedAt?` · 수정 ${new Date(t.updatedAt).toLocaleString('ko-KR')}`:''}</small>${editing===t.id?form(t):''}</div><button class="secondary-button" data-open-transaction="${t.id}">수정</button></article>`).join('');
    const sources=new Map();transactions.filter(t=>t.kind==='expense').forEach(t=>sources.set(t.source||'출처 미입력',(sources.get(t.source||'출처 미입력')||0)+t.amount));
    let angle=0;const colors=['#d99da4','#93b8ce','#91ad8b','#b5a6c7','#e2bf75','#86b9ad'];
    const slices=[...sources].map(([s,v],i)=>{const start=angle;angle+=v/total('expense')*100;return `${colors[i%colors.length]} ${start}% ${angle}%`;});
    return `<p class="view-intro">Weekly에서 추가한 모든 거래가 날짜와 기록 일시별로 쌓여요. 고정 예상 금액은 실제 거래와 별도로 관리해요.</p><div class="ledger-overview"><section class="paper-card">누적 지출 <strong>${won(total('expense'))}</strong></section><section class="paper-card">누적 수입 <strong>${won(total('income'))}</strong></section><section class="paper-card">차액 <strong>${won(total('income')-total('expense'))}</strong></section></div><section class="paper-card"><form data-add-money-category class="category-add-form"><label>분류 추가 <input name="category" maxlength="40" placeholder="예: 교통비" required></label><button class="primary-button">추가</button></form><p class="muted">현재 분류: ${categories.map(esc).join(' · ')}</p></section><section class="paper-card expense-source-card"><div class="card-title">SPENDING BY MERCHANT</div><div class="expense-source-content"><div class="expense-donut" style="--donut-background:${slices.length?`conic-gradient(${slices.join(',')})`:'#eee9e2'}"><div><strong>${won(total('expense'))}</strong><small>누적 지출</small></div></div><div>${[...sources].map(([s,v])=>`<p>${esc(s)} · ${won(v)} · ${(v/total('expense')*100).toFixed(1)}%</p>`).join('')||'아직 지출 기록이 없어요.'}</div></div></section><section class="paper-card"><div class="card-head"><span class="card-title">TRANSACTIONS</span><span>${transactions.length}건</span></div>${rows||'<p class="money-empty">Weekly에서 첫 거래를 추가해보세요.</p>'}</section>${fixed}`;
  };
  views.todos=()=>`<p class="view-intro">날짜별 투두만 모아요. 시간 있는 일정은 제외해요.</p>${[...new Set(state.weeklyPlans.filter(p=>!String(p.time||'').trim()).map(p=>p.date))].filter(Boolean).sort().map(day=>`<section class="paper-card"><div class="card-title task-date-highlight">${day} · ${['일','월','화','수','목','금','토'][date(day).getDay()]}요일</div>${state.weeklyPlans.filter(p=>p.date===day&&!String(p.time||'').trim()).map(p=>`<div class="weekly-record ${p.done?'is-done':''}"><button class="todo-check" data-complete-plan="${p.id}" aria-pressed="${Boolean(p.done)}">${p.done?'✓':'□'}</button><span class="plan-record-text">${esc(p.text)}</span><button class="remove-record" data-remove-plan="${p.id}">×</button></div>`).join('')||'<p class="muted">모두 완료했어요.</p>'}</section>`).join('')}`;
  // Window capture runs before historical document handlers, preventing duplicate additions.
  window.addEventListener('click',event=>{
    const add=event.target.closest('[data-history-add]');
    if(add){event.preventDefault();event.stopImmediatePropagation();const day=add.dataset.historyAdd;
      const text=document.querySelector(`[data-plan-text="${day}"]`).value.trim();if(!text)return;
      const time=document.querySelector(`[data-plan-time="${day}"]`).value.trim();
      if(time&&!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)){alert('시간은 24시간 형식으로 입력해주세요. 예: 08:30, 19:30');return;}
      state.weeklyPlans.push({id:Date.now(),day,date:plus(selected,codes.indexOf(day)),text,time,category:document.querySelector(`[data-plan-category="${day}"]`).value,showMonthly:document.querySelector(`[data-show-monthly="${day}"]`).checked});persistPlans();render();return;}
    const select=event.target.closest('[data-select-week]');if(select){if(select.dataset.selectWeek<'2026-08-03')return;saveWeek();selected=select.dataset.selectWeek;browseMonth=selected.slice(0,7);loadWeek();render();return;}
    const edit=event.target.closest('[data-open-transaction]');if(edit){editing=edit.dataset.openTransaction;render();}
    if(event.target.closest('[data-cancel-transaction]')){editing=null;render();}
  },true);
  document.addEventListener('change',event=>{if(event.target.matches('[data-browse-month]')&&event.target.value){browseMonth=event.target.value<'2026-08'?'2026-08':event.target.value;render();}});
  document.addEventListener('click',event=>{
    if(event.target.closest('.habit-check,.weather-choice'))saveWeek();
    if(event.target.closest('.weather-choice'))refreshDaySummaries();
  });
  document.addEventListener('submit',event=>{
    const form=event.target;
    if(!form.matches('[data-transaction-form],[data-edit-transaction],[data-add-money-category]'))return;
    event.preventDefault();const data=new FormData(form);
    if(form.matches('[data-add-money-category]')){const c=String(data.get('category')).trim();if(c&&!categories.includes(c)){categories.push(c);write('folio-money-categories',categories);}render();return;}
    const value=amount(data.get('amount'));if(value<=0||!Number.isFinite(value))return;
    const fields={amount:value,category:String(data.get('category')||''),source:String(data.get('source')||'').trim(),item:String(data.get('item')||'').trim()};
    if(form.dataset.editTransaction){const t=transactions.find(t=>t.id===form.dataset.editTransaction);if(t)Object.assign(t,fields,{date:String(data.get('date')),kind:String(data.get('kind')),updatedAt:new Date().toISOString()});editing=null;}
    else transactions.push({id:crypto.randomUUID(),...fields,kind:form.dataset.transactionForm,date:form.dataset.date,createdAt:new Date().toISOString()});
    write('folio-transactions',transactions);render();
  });
  let sleepWeek=monday(today());
  const memos=read('folio-memos',[]);
  let memoId=null;
  const draft=()=>read('folio-memo-draft',{title:'',text:''});
  titles.sleep=['WEEKLY SLEEP','Sleep'];titles.memos=['MY NOTEBOOK','메모장'];
  [['sleep','☾','Sleep','Sleep'],['memos','▤','메모장','Memo']].forEach(([view,icon,label,mobile])=>{
    [['.nav-list','nav-item',label],['.mobile-nav','mobile-nav-item',mobile]].forEach(([selector,className,text])=>{
      const nav=document.querySelector(selector);if(!nav)return;
      const button=document.createElement('button');button.className=className;button.dataset.view=view;button.innerHTML=`<span>${icon}</span>${text}`;nav.append(button);
    });
  });
  const minutes=value=>{const match=String(value||'').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);return match?Number(match[1])*60+Number(match[2]):null;};
  const fieldsFor=day=>history[monday(day)]?.fields?.[codes[(date(day).getDay()+6)%7]]||{};
  views.sleep=()=>{
    const rows=codes.map((code,index)=>{const day=plus(sleepWeek,index),fields=fieldsFor(day);
      const bed=minutes(fields.sleep),wake=minutes(fields.wake);
      const duration=bed!==null&&wake!==null?((wake-bed+1440)%1440)/60:null;
      return {day,code,bed,wake,duration};});
    const durations=rows.filter(r=>r.duration!==null),average=durations.length?durations.reduce((s,r)=>s+r.duration,0)/durations.length:null;
    const weeks=[...new Set([...Object.keys(history),sleepWeek,monday(today())])].sort().reverse();
    const timeLabel=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
    return `<p class="view-intro">Weekly에 적은 기상·취침 시간이 주별로 쌓여요. 같은 요일 칸에 적은 전날 밤 취침과 당일 아침 기상을 한 쌍으로 계산해요. 자정 이후 취침도 지원해요.</p><div class="history-week-bar"><button class="secondary-button" data-sleep-week="${plus(sleepWeek,-7)}">← 이전 주</button><strong>${sleepWeek} – ${plus(sleepWeek,6)}</strong><button class="secondary-button" data-sleep-week="${plus(sleepWeek,7)}">다음 주 →</button><button class="secondary-button" data-sleep-week="${monday(today())}">이번 주</button></div><section class="paper-card sleep-chart"><div class="card-head"><span class="card-title">기상 / 취침 · 24시간</span><span class="muted">${average===null?'수면 시간 기록 대기':`평균 수면 ${average.toFixed(1)}시간 · ${durations.length}일 기록`}</span></div><div class="sleep-legend"><span>☀ 기상</span><span>☾ 취침</span></div><div class="sleep-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>${rows.map(r=>`<div class="sleep-row"><div class="sleep-date">${r.code}<small>${r.day.slice(5)}</small></div><div class="sleep-track" role="img" aria-label="${r.day} 기상 ${r.wake===null?'미기록':timeLabel(r.wake)}, 취침 ${r.bed===null?'미기록':timeLabel(r.bed)}">${r.wake===null?'':`<span class="sleep-point wake-point" style="left:${r.wake/1440*100}%" title="기상 ${timeLabel(r.wake)}">☀</span>`}${r.bed===null?'':`<span class="sleep-point bed-point" style="left:${r.bed/1440*100}%" title="취침 ${timeLabel(r.bed)}">☾</span>`}</div><div class="sleep-values"><span>기상 ${r.wake===null?'—':timeLabel(r.wake)} · 취침 ${r.bed===null?'—':timeLabel(r.bed)}</span><small>${r.duration===null?'수면 시간: 같은 날의 기상·취침 기록 필요':`수면 ${r.duration.toFixed(1)}시간`}</small></div></div>`).join('')}<p class="muted">시간은 24시간 형식(예: 07:30, 23:00)으로 적어주세요. 비어 있거나 형식이 다른 기록은 그래프에서 제외해요.</p></section><section class="paper-card week-archive"><div class="card-title">주간 수면 보관함</div><div class="week-month-list">${weeks.map(w=>`<button class="secondary-button" data-sleep-week="${w}">${w} – ${plus(w,6)}</button>`).join('')}</div></section>`;
  };
  views.memos=()=>{
    const memo=memos.find(m=>m.id===memoId)||draft();
    return `<p class="view-intro">생각이나 자료를 자유롭게 적고, 저장한 메모를 다시 열어 수정해요. 작성 중인 내용도 자동으로 보관돼요.</p><div class="memo-layout"><section class="paper-card"><div class="card-head"><span class="card-title">저장한 메모 · ${memos.length}개</span><button class="secondary-button" data-new-memo>새 메모</button></div><div class="memo-list">${memos.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(m=>`<button class="memo-list-item ${m.id===memoId?'selected':''}" data-open-memo="${m.id}"><strong>${esc(m.title||'제목 없는 메모')}</strong><small>${new Date(m.updatedAt).toLocaleString('ko-KR')}</small><span>${esc(m.text.slice(0,80))}</span></button>`).join('')||'<p class="muted">첫 메모를 작성해보세요.</p>'}</div></section><section class="paper-card"><form data-memo-form><input class="memo-title-input" name="title" placeholder="메모 제목" value="${esc(memo.title)}" maxlength="200" aria-label="메모 제목"><textarea class="memo-text-input" name="text" placeholder="편하게 적어보세요…" aria-label="메모 내용">${esc(memo.text)}</textarea><div class="card-head"><span class="muted" id="memo-save-status">${memoId?'저장된 메모':'새 메모 · 임시 보관'}</span><button class="primary-button">메모 저장</button></div></form></section></div>`;
  };
  document.addEventListener('click',event=>{
    const week=event.target.closest('[data-sleep-week]');if(week){sleepWeek=week.dataset.sleepWeek;render();}
    const open=event.target.closest('[data-open-memo]');if(open){memoId=open.dataset.openMemo;render();}
    if(event.target.closest('[data-new-memo]')){memoId=null;render();}
  });
  document.addEventListener('input',event=>{
    const form=event.target.closest('[data-memo-form]');if(!form)return;
    const data=new FormData(form),values={title:String(data.get('title')),text:String(data.get('text'))};
    const memo=memos.find(m=>m.id===memoId);
    if(memo){Object.assign(memo,values,{updatedAt:new Date().toISOString()});write('folio-memos',memos);}else write('folio-memo-draft',values);
    document.querySelector('#memo-save-status').textContent='자동 저장됨';
  });
  document.addEventListener('submit',event=>{
    if(!event.target.matches('[data-memo-form]'))return;event.preventDefault();
    const data=new FormData(event.target),values={title:String(data.get('title')).trim(),text:String(data.get('text'))};
    if(!values.title&&!values.text.trim())return;
    const memo=memos.find(m=>m.id===memoId),now=new Date().toISOString();
    if(memo)Object.assign(memo,values,{updatedAt:now});else {memoId=crypto.randomUUID();memos.push({id:memoId,...values,createdAt:now,updatedAt:now});write('folio-memo-draft',{title:'',text:''});}
    write('folio-memos',memos);render();
  });
  const groupMoneyDays=()=>{
    const rows=[...document.querySelectorAll('.money-ledger-row')];if(!rows.length)return;
    const sorted=transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||''));
    const container=rows[0].parentElement,groups=new Map();
    sorted.forEach((t,index)=>{if(!groups.has(t.date))groups.set(t.date,[]);groups.get(t.date).push({transaction:t,row:rows[index]});});
    groups.forEach((items,day)=>{
      const expense=items.filter(i=>i.transaction.kind==='expense').reduce((s,i)=>s+i.transaction.amount,0),income=items.filter(i=>i.transaction.kind==='income').reduce((s,i)=>s+i.transaction.amount,0);
      const section=document.createElement('section');section.className='money-date-group';section.innerHTML=`<div class="money-date-heading"><strong>${day} · ${['일','월','화','수','목','금','토'][date(day).getDay()]}요일</strong><span>지출 ${won(expense)} · 수입 ${won(income)}</span></div>`;
      items.forEach(i=>section.append(i.row));container.append(section);
    });
  };
  const previousRender=render;
  // Navigation is a device-local preference, not a cloud data change.
  const lastViewKey='planner-last-view';
  const lastView=localStorage.getItem(lastViewKey);
  if(lastView && Object.hasOwn(views,lastView) && Object.hasOwn(titles,lastView)) state.view=lastView;
  render=()=>{
    if(localStorage.getItem(lastViewKey)!==state.view)localStorage.setItem(lastViewKey,state.view);
    saveWeek();titles.weekly=[`${selected} — ${plus(selected,6)}`,'Weekly'];previousRender();
    if(state.view==='weekly')refreshDaySummaries();
    const monthInput=document.querySelector('[data-browse-month]');if(monthInput)monthInput.min='2026-08';
    document.querySelectorAll('[data-select-week]').forEach(button=>{button.disabled=button.dataset.selectWeek<'2026-08-03';});
    if(state.view==='money'){
      groupMoneyDays();
      document.querySelectorAll('.fixed-expense-form select[name="category"]').forEach(select=>{select.innerHTML=opts(select.value);});
      document.querySelectorAll('[data-edit-transaction] input[name="source"]').forEach(input=>{input.placeholder='결제수단 / 수입처';});
      const chartHeading=document.querySelector('.expense-source-card .card-title');if(chartHeading)chartHeading.textContent='SPENDING BY PAYMENT METHOD';
    }
  };
  render();
})();
