(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const codes=['MON','TUE','WED','THU','FRI','SAT','SUN'];
 const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const shift=(k,n)=>{const d=new Date(`${k}T12:00:00`);d.setDate(d.getDate()+n);return key(d);};
 const monday=k=>{const d=new Date(`${k}T12:00:00`);return shift(k,-(d.getDay()+6)%7);};
 const minutes=v=>{const m=String(v||'').match(/^([01]?\d|2[0-3]):([0-5]\d)$/);return m?+m[1]*60 + +m[2]:null;};
 const clock=m=>m===1440?'24:00':`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
 const end=p=>{const start=minutes(p.time),explicit=p.endTime==='24:00'?1440:minutes(p.endTime);return explicit!==null&&explicit>start?explicit:Math.min(1440,start+60);};
 const money=n=>`₩${n.toLocaleString('ko-KR')}`;
 let week=monday(key(new Date())),editingFixed=null,editingPlan=null,drag=null,suppressClick=false;
 titles.schedule=['WEEKLY TIMEBLOCKS','Schedule'];
 [['.nav-list','nav-item'],['.mobile-nav','mobile-nav-item']].forEach(([selector,className])=>{const nav=document.querySelector(selector);if(!nav)return;const button=document.createElement('button');button.className=className;button.dataset.view='schedule';button.innerHTML='<span>▥</span>Schedule';nav.insertBefore(button,nav.querySelector('[data-view="daily"]'));});
 const baseWeekly=views.weekly;
 views.weekly=()=>{
  const template=document.createElement('template');template.innerHTML=baseWeekly();
  template.content.querySelectorAll('.week-entry-form').forEach(form=>{
   const day=form.querySelector('[data-plan-text]')?.dataset.planText;if(!day)return;
   form.querySelector('[data-plan-time]').placeholder='시작 HH:MM';
   const ending=document.createElement('input');ending.dataset.planEnd=day;ending.placeholder='종료 HH:MM';ending.setAttribute('aria-label','종료 시간');form.querySelector('[data-plan-time]').after(ending);
   const arch=document.createElement('label');arch.className='monthly-toggle';arch.innerHTML=`<input type="checkbox" data-plan-arch="${day}"> Arch`;form.querySelector('[data-history-add]').before(arch);
  });
  template.content.querySelectorAll('.weekly-record').forEach(row=>{const id=row.querySelector('[data-complete-plan]')?.dataset.completePlan;const p=state.weeklyPlans.find(p=>String(p.id)===id);if(!p||minutes(p.time)!==null)return;row.insertAdjacentHTML('beforeend',`<label class="monthly-item-toggle"><input type="checkbox" data-record-arch="${p.id}" ${p.arch?'checked':''}> Arch</label>`);});
  // Keep entry forms, but do not show transaction detail lists in Weekly.
  template.content.querySelectorAll('[data-transaction-form="expense"]').forEach(form=>form.insertAdjacentHTML('afterend','<label class="fixed-transaction-choice"><input type="checkbox" name="isFixed" form="'+(form.id=`expense-${form.dataset.date}`)+'"> 고정 지출 (일반 소비 합계에서 제외)</label>'));
  const transactions=JSON.parse(localStorage.getItem('folio-transactions')||'[]');
  const ordinary=transactions.filter(t=>t.kind==='expense'&&!t.isFixed);
  const now=key(new Date()),current=monday(now),total=filter=>ordinary.filter(filter).reduce((s,t)=>s+Number(t.amount||0),0);
  const intro=template.content.querySelector('.view-intro');
  if(intro)intro.innerHTML=`<span class="weekly-spend-total">오늘 일반 지출 <strong>${money(total(t=>t.date===now))}</strong></span><span class="weekly-spend-total">이번 주 일반 지출 <strong>${money(total(t=>t.date>=current&&t.date<=shift(current,6)))}</strong></span><small>고정 지출 제외 · ${current} – ${shift(current,6)}</small>`;
  return template.innerHTML;
 };
 // Assign lanes to connected clusters of overlapping events.
 const arrange=plans=>{
  const sorted=plans.map(p=>({p,start:minutes(p.time),end:end(p)})).sort((a,b)=>a.start-b.start||a.end-b.end);let group=[],lastEnd=-1;
  const flush=()=>{const lanes=[];group.forEach(item=>{let lane=lanes.findIndex(e=>e<=item.start);if(lane<0)lane=lanes.length;lanes[lane]=item.end;item.lane=lane;});group.forEach(item=>item.count=lanes.length);group=[];};
  sorted.forEach(item=>{if(group.length&&item.start>=lastEnd)flush();if(!group.length)lastEnd=item.end;else lastEnd=Math.max(lastEnd,item.end);group.push(item);});flush();return sorted;
 };
 views.schedule=()=>{
  const dates=codes.map((_,i)=>shift(week,i));
  const included=state.weeklyPlans.filter(p=>dates.includes(p.date)&&(minutes(p.time)!==null||p.arch));
  return `<p class="view-intro">Weekly 일정이 자동 반영돼요. 블록을 끌어 날짜·시간을 옮기고, 아래 손잡이로 길이를 조절해요. 클릭하면 직접 수정할 수 있어요. 종료 시간 미입력은 1시간으로 표시해요.</p><div class="history-week-bar"><button class="secondary-button" data-schedule-week="${shift(week,-7)}">← 이전 주</button><strong>${week} – ${shift(week,6)}</strong><button class="secondary-button" data-schedule-week="${shift(week,7)}">다음 주 →</button><button class="secondary-button" data-schedule-week="${monday(key(new Date()))}">이번 주</button></div><section class="paper-card arch-calendar"><div class="arch-scroll"><div class="arch-board"><div class="arch-heading"><span>시간</span>${dates.map((d,i)=>`<strong>${codes[i]}<small>${d.slice(5)}</small></strong>`).join('')}</div><div class="arch-all-day"><span>종일</span>${dates.map(d=>`<div data-arch-date="${d}" data-all-day>${included.filter(p=>p.date===d&&minutes(p.time)===null).map(p=>`<button class="arch-all-day-event ${esc(p.category)} ${p.done?'is-done':''}" data-schedule-edit="${p.id}">${esc(p.text)}</button>`).join('')}</div>`).join('')}</div><div class="arch-timeline"><div class="arch-hours">${Array.from({length:24},(_,h)=>`<span style="top:${h*60}px">${clock(h*60)}</span>`).join('')}</div>${dates.map(d=>`<div class="arch-day-column" data-arch-date="${d}">${arrange(included.filter(p=>p.date===d&&minutes(p.time)!==null)).map(({p,start,end,lane,count})=>`<div class="arch-event ${esc(p.category)} ${p.done?'is-done':''}" data-schedule-edit="${p.id}" data-arch-block="${p.id}" style="top:${start}px;height:${end-start}px;left:calc(${lane/count*100}% + 2px);width:calc(${100/count}% - 4px)" tabindex="0" role="button" aria-label="${esc(p.text)} ${p.date} ${clock(start)}–${clock(end)}"><strong>${esc(p.text)}</strong><small>${clock(start)} – ${clock(end)}</small><span class="arch-resize" data-arch-resize aria-label="종료 시간 조절"></span></div>`).join('')}</div>`).join('')}</div></div></div></section>`;
 };
 const dialog=document.createElement('dialog');dialog.className='planner-edit-dialog';document.body.append(dialog);
 const categoryOptions=chosen=>[...new Set([...JSON.parse(localStorage.getItem('folio-fixed-categories')||'[]'),chosen].filter(Boolean))].map(c=>`<option ${c===chosen?'selected':''}>${esc(c)}</option>`).join('');
 const openFixed=id=>{
  const item=state.fixedExpenses.find(i=>String(i.id)===id);if(!item)return;editingFixed=id;editingPlan=null;
  dialog.innerHTML=`<form data-fixed-edit><h3>고정 지출 수정</h3><label>금액<input name="amount" type="number" min="1" value="${Number(item.amount)}" required></label><label>분류<select name="category">${categoryOptions(item.category)}</select></label><label>결제수단<input name="source" value="${esc(item.source)}"></label><label>항목<input name="item" value="${esc(item.item)}" required></label><label>매달 지출일<input name="dueDay" type="number" min="1" max="31" value="${Number(item.dueDay)}" required></label><div class="edit-dialog-actions"><button type="button" data-close-planner-dialog class="secondary-button">취소</button><button class="primary-button">저장</button></div></form>`;dialog.showModal();
 };
 const openPlan=id=>{
  const p=state.weeklyPlans.find(p=>String(p.id)===id);if(!p)return;editingPlan=id;editingFixed=null;
  dialog.innerHTML=`<form data-schedule-edit-form><h3>일정 조정</h3><label>내용<input name="text" value="${esc(p.text)}" required></label><label>날짜<input name="date" type="date" value="${p.date}" required></label><label>시작 시간<input name="time" type="time" value="${esc(p.time)}"></label><label>종료 시간<input name="endTime" placeholder="HH:MM 또는 24:00" value="${minutes(p.time)!==null?clock(end(p)):''}"></label><label>분류<select name="category">${['personal','work','family','fixed'].map(c=>`<option ${c===p.category?'selected':''}>${c}</option>`).join('')}</select></label><label><input type="checkbox" name="arch" ${p.arch?'checked':''}> 시간 없을 때 Arch 종일 영역에 표시</label><div class="edit-dialog-actions"><button type="button" data-close-planner-dialog class="secondary-button">취소</button><button class="primary-button">저장</button></div></form>`;dialog.showModal();
 };
 document.addEventListener('click',event=>{
  const fixed=event.target.closest('[data-edit-fixed]');if(fixed)openFixed(fixed.dataset.editFixed);
  const nav=event.target.closest('[data-schedule-week]');if(nav){week=nav.dataset.scheduleWeek;render();}
  const edit=event.target.closest('[data-schedule-edit]');if(edit){if(suppressClick){suppressClick=false;return;}openPlan(edit.dataset.scheduleEdit);}
  if(event.target.closest('[data-close-planner-dialog]'))dialog.close();
 });
 document.addEventListener('keydown',event=>{const block=event.target.closest('[data-arch-block]');if(block&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openPlan(block.dataset.archBlock);}});
 document.addEventListener('change',event=>{
  if(event.target.matches('[data-record-arch]')){const p=state.weeklyPlans.find(p=>String(p.id)===event.target.dataset.recordArch);if(p){p.arch=event.target.checked;persistPlans();}}
 });
 document.addEventListener('submit',event=>{
  const form=event.target;if(!form.matches('[data-fixed-edit],[data-schedule-edit-form]'))return;event.preventDefault();const data=Object.fromEntries(new FormData(form));
  if(form.matches('[data-fixed-edit]')){const item=state.fixedExpenses.find(i=>String(i.id)===editingFixed);if(!item)return;Object.assign(item,{amount:String(data.amount),category:data.category||'',source:data.source||'',item:data.item.trim(),dueDay:String(data.dueDay)});localStorage.setItem('folio-fixed-expenses',JSON.stringify(state.fixedExpenses));}
  else {const p=state.weeklyPlans.find(p=>String(p.id)===editingPlan),start=minutes(data.time),finish=data.endTime==='24:00'?1440:minutes(data.endTime);if(!p)return;if(data.time&&start===null||data.endTime&&(finish===null||start===null||finish<=start)){alert('종료 시간은 시작 시간보다 늦게 입력해주세요.');return;}Object.assign(p,{text:data.text.trim(),date:data.date,day:codes[(new Date(data.date+'T12:00:00').getDay()+6)%7],time:data.time||'',endTime:data.endTime||'',category:data.category,arch:data.arch==='on'});persistPlans();}
  dialog.close();render();
 });
 document.addEventListener('pointerdown',event=>{
  const block=event.target.closest('[data-arch-block]');if(!block||event.button!==0)return;
  const p=state.weeklyPlans.find(p=>String(p.id)===block.dataset.archBlock);if(!p)return;
  drag={block,p,id:event.pointerId,x:event.clientX,y:event.clientY,start:minutes(p.time),end:end(p),resize:Boolean(event.target.closest('[data-arch-resize]')),moved:false};block.setPointerCapture(event.pointerId);
 });
 document.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;const dy=event.clientY-drag.y,dx=event.clientX-drag.x;if(Math.abs(dx)+Math.abs(dy)<5&&!drag.moved)return;
  drag.moved=true;event.preventDefault();drag.block.classList.add('is-dragging');
  if(drag.resize)drag.block.style.height=`${Math.max(15,Math.min(1440-drag.start,drag.end-drag.start+Math.round(dy/15)*15))}px`;else drag.block.style.transform=`translate(${dx}px,${Math.round(dy/15)*15}px)`;
 });
 const finishDrag=(event,cancel=false)=>{
  if(!drag||event.pointerId!==drag.id)return;const d=drag;drag=null;
  if(d.moved&&!cancel){const delta=Math.round((event.clientY-d.y)/15)*15;
   if(d.resize)d.p.endTime=clock(Math.min(1440,Math.max(d.start+15,d.end+delta)));
   else {const length=d.end-d.start,start=Math.max(0,Math.min(1440-length,d.start+delta));const column=[...document.querySelectorAll('.arch-day-column')].find(c=>{const r=c.getBoundingClientRect();return event.clientX>=r.left&&event.clientX<=r.right;});if(column){d.p.date=column.dataset.archDate;d.p.day=codes[(new Date(d.p.date+'T12:00:00').getDay()+6)%7];d.p.time=clock(start);d.p.endTime=clock(start+length);}}
   persistPlans();suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
  }
  if(d.moved)render();
 };
 document.addEventListener('pointerup',event=>finishDrag(event));document.addEventListener('pointercancel',event=>finishDrag(event,true));
 const priorRender=render;
 render=()=>{priorRender();if(state.view==='schedule'){
  const scroll=document.querySelector('.arch-scroll'),starts=state.weeklyPlans.filter(p=>p.date>=week&&p.date<=shift(week,6)&&minutes(p.time)!==null).map(p=>minutes(p.time));
  if(scroll)scroll.scrollTop=Math.max(0,(starts.length?Math.min(...starts):480)-60);
 }if(state.view==='money'){
  document.querySelectorAll('[data-remove-fixed-expense]').forEach(remove=>{const button=document.createElement('button');button.className='secondary-button';button.dataset.editFixed=remove.dataset.removeFixedExpense;button.textContent='수정';remove.before(button);});
  document.querySelectorAll('[data-edit-transaction]').forEach(form=>{const t=JSON.parse(localStorage.getItem('folio-transactions')||'[]').find(t=>t.id===form.dataset.editTransaction);form.insertAdjacentHTML('beforeend',`<label class="fixed-transaction-choice"><input type="checkbox" name="isFixed" ${t?.isFixed?'checked':''}> 고정 지출 (일반 소비 합계에서 제외)</label>`);});
 }};
 window.addEventListener('folio-app-ready',event=>{const v=event.detail?.preferredView;if(v&&views[v]){state.view=v;render();}});
 render();
})();
