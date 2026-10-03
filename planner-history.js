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
  const entryForm = (kind, day) => `<form data-transaction-form="${kind}" data-date="${day}" class="transaction-form"><input name="amount" type="number" min="0.01" step="0.01" placeholder="${kind==='expense'?'지출':'수입'} 금액" required><select name="category">${opts('')}</select><input name="source" placeholder="${kind==='expense'?'지출처':'수입처'}"><input name="item" placeholder="항목"><button type="submit" class="primary-button">기록 추가</button></form>`;
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
      const toggle=card.querySelector('[data-toggle-week-day]'); toggle.setAttribute('aria-expanded',String(open)); toggle.textContent=open?'⌃':'⌄';
      card.querySelectorAll('.day-section').forEach(section=>{
        const label=section.querySelector('.day-label')?.textContent.trim();
        if(label==='EXPENSE'||label==='INCOME') {
          const kind=label==='EXPENSE'?'expense':'income';
          const rows=transactions.filter(t=>t.date===day&&t.kind===kind);
          section.innerHTML=`<div class="day-label">${label} · ${rows.length}건 · ${won(rows.reduce((s,t)=>s+t.amount,0))}</div>${entryForm(kind,day)}<small class="muted">여러 건 추가할 수 있어요 · 수정은 Money에서</small>`;
        }
      });
      card.querySelectorAll('.add-plan').forEach(button=>{button.classList.remove('add-plan');button.dataset.historyAdd=code;});
    });
    const parent=cards[0]?.parentElement;
    cards.sort((a,b)=> (a.dataset.date===today()?-1:b.dataset.date===today()?1:a.dataset.date.localeCompare(b.dataset.date))).forEach(c=>parent.append(c));
    template.content.querySelectorAll('.weekly-total').forEach(el=>el.remove());
    const months = new Set(Object.keys(history).map(w=>w.slice(0,7)));
    for(let offset=-4;offset<=14;offset++){const d=date(`${browseMonth}-01`);d.setMonth(d.getMonth()+offset);months.add(key(d).slice(0,7));}
    months.add(browseMonth);
    const archive=[...months].sort().map(month=>{
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
    const fixed=[...old.content.querySelectorAll('.fixed-expense-card,.fixed-income-card')].map(el=>el.outerHTML).join('');
    const total=kind=>transactions.filter(t=>t.kind===kind).reduce((s,t)=>s+t.amount,0);
    const form = t => `<form data-edit-transaction="${t.id}" class="transaction-form"><input name="date" type="date" value="${t.date}" required><select name="kind"><option value="expense" ${t.kind==='expense'?'selected':''}>지출</option><option value="income" ${t.kind==='income'?'selected':''}>수입</option></select><input name="amount" type="number" min="0.01" step="0.01" value="${t.amount}" required><select name="category">${opts(t.category)}</select><input name="source" value="${esc(t.source)}" placeholder="지출처 / 수입처"><input name="item" value="${esc(t.item)}" placeholder="항목"><button class="primary-button">저장</button><button type="button" data-cancel-transaction class="secondary-button">취소</button></form>`;
    const rows=[...transactions].sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||'')).map(t=>`<article class="money-ledger-row"><span class="ledger-kind ${t.kind}">${t.kind==='expense'?'−':'+'}</span><div class="ledger-description"><strong>${t.kind==='expense'?'지출':'수입'} · ${won(t.amount)} · ${esc(t.item)}</strong><small>사용일 ${t.date} · ${esc(t.source || '출처 미입력')} · ${esc(t.category || '미분류')}</small><small>기록 일시: ${t.createdAt?new Date(t.createdAt).toLocaleString('ko-KR'):'이전 기록 (일시 미상)'}${t.updatedAt?` · 수정 ${new Date(t.updatedAt).toLocaleString('ko-KR')}`:''}</small>${editing===t.id?form(t):''}</div><button class="secondary-button" data-open-transaction="${t.id}">수정</button></article>`).join('');
    const sources=new Map();transactions.filter(t=>t.kind==='expense').forEach(t=>sources.set(t.source||'출처 미입력',(sources.get(t.source||'출처 미입력')||0)+t.amount));
    let angle=0;const colors=['#d99da4','#93b8ce','#91ad8b','#b5a6c7','#e2bf75','#86b9ad'];
    const slices=[...sources].map(([s,v],i)=>{const start=angle;angle+=v/total('expense')*100;return `${colors[i%colors.length]} ${start}% ${angle}%`;});
    return `<p class="view-intro">Weekly에서 추가한 모든 거래가 날짜와 기록 일시별로 쌓여요. 고정 예상 금액은 실제 거래와 별도로 관리해요.</p><div class="ledger-overview"><section class="paper-card">누적 지출 <strong>${won(total('expense'))}</strong></section><section class="paper-card">누적 수입 <strong>${won(total('income'))}</strong></section><section class="paper-card">차액 <strong>${won(total('income')-total('expense'))}</strong></section></div><section class="paper-card"><form data-add-money-category class="category-add-form"><label>분류 추가 <input name="category" maxlength="40" placeholder="예: 교통비" required></label><button class="primary-button">추가</button></form><p class="muted">현재 분류: ${categories.map(esc).join(' · ')}</p></section><section class="paper-card expense-source-card"><div class="card-title">SPENDING BY MERCHANT</div><div class="expense-source-content"><div class="expense-donut" style="--donut-background:${slices.length?`conic-gradient(${slices.join(',')})`:'#eee9e2'}"><div><strong>${won(total('expense'))}</strong><small>누적 지출</small></div></div><div>${[...sources].map(([s,v])=>`<p>${esc(s)} · ${won(v)} · ${(v/total('expense')*100).toFixed(1)}%</p>`).join('')||'아직 지출 기록이 없어요.'}</div></div></section><section class="paper-card"><div class="card-head"><span class="card-title">TRANSACTIONS</span><span>${transactions.length}건</span></div>${rows||'<p class="money-empty">Weekly에서 첫 거래를 추가해보세요.</p>'}</section>${fixed}`;
  };
  views.todos=()=>`<p class="view-intro">날짜별 투두만 모아요. 시간 있는 일정은 제외해요.</p>${[...new Set(state.weeklyPlans.filter(p=>!String(p.time||'').trim()).map(p=>p.date))].filter(Boolean).sort().map(day=>`<section class="paper-card"><div class="card-title">${day}</div>${state.weeklyPlans.filter(p=>p.date===day&&!String(p.time||'').trim()&&!p.done).map(p=>`<div class="weekly-record"><button class="todo-check" data-complete-plan="${p.id}">□</button><span>${esc(p.text)}</span><button class="remove-record" data-remove-plan="${p.id}">×</button></div>`).join('')||'<p class="muted">모두 완료했어요.</p>'}</section>`).join('')}`;
  // Window capture runs before historical document handlers, preventing duplicate additions.
  window.addEventListener('click',event=>{
    const add=event.target.closest('[data-history-add]');
    if(add){event.preventDefault();event.stopImmediatePropagation();const day=add.dataset.historyAdd;
      const text=document.querySelector(`[data-plan-text="${day}"]`).value.trim();if(!text)return;
      const time=document.querySelector(`[data-plan-time="${day}"]`).value.trim();
      if(time&&!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)){alert('시간은 24시간 형식으로 입력해주세요. 예: 08:30, 19:30');return;}
      state.weeklyPlans.push({id:Date.now(),day,date:plus(selected,codes.indexOf(day)),text,time,category:document.querySelector(`[data-plan-category="${day}"]`).value,showMonthly:document.querySelector(`[data-show-monthly="${day}"]`).checked});persistPlans();render();return;}
    const select=event.target.closest('[data-select-week]');if(select){saveWeek();selected=select.dataset.selectWeek;browseMonth=selected.slice(0,7);loadWeek();render();return;}
    const edit=event.target.closest('[data-open-transaction]');if(edit){editing=edit.dataset.openTransaction;render();}
    if(event.target.closest('[data-cancel-transaction]')){editing=null;render();}
  },true);
  document.addEventListener('change',event=>{if(event.target.matches('[data-browse-month]')&&event.target.value){browseMonth=event.target.value;render();}});
  document.addEventListener('click',event=>{if(event.target.closest('.habit-check'))saveWeek();});
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
  const previousRender=render;
  render=()=>{saveWeek();titles.weekly=[`${selected} — ${plus(selected,6)}`,'Weekly'];previousRender();if(state.view==='money')document.querySelectorAll('.fixed-expense-form select[name="category"]').forEach(select=>{select.innerHTML=opts(select.value);});};
  render();
})();
