(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const storage=scope=>scope==='fixed'?'folio-fixed-categories':'folio-money-categories';
 const get=scope=>JSON.parse(localStorage.getItem(storage(scope))||'[]');
 const options=(scope,selected)=>`<option value="">분류 선택</option>${selected&&!get(scope).includes(selected)?`<option selected disabled value="${esc(selected)}">${esc(selected)} (이전 분류)</option>`:''}${get(scope).map(c=>`<option value="${esc(c)}" ${c===selected?'selected':''}>${esc(c)}</option>`).join('')}`;
 const manager=scope=>`<section class="money-category-manager"><div class="card-title">${scope==='fixed'?'고정 지출':'일반 지출'} 분류</div><form data-category-add="${scope}" class="category-add-form"><input name="category" maxlength="40" placeholder="새 분류" required aria-label="새 ${scope==='fixed'?'고정':'일반'} 지출 분류"><button class="primary-button">추가</button></form><div class="money-category-rows">${get(scope).map(c=>`<form data-category-rename="${scope}" data-original="${esc(c)}"><input name="category" value="${esc(c)}" maxlength="40" required aria-label="분류 이름 수정"><button class="secondary-button">수정</button></form>`).join('')}</div></section>`;
 const table=compact=>{
  const now=new Date(),last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),groups=new Map();
  state.fixedExpenses.forEach(item=>{const day=Math.min(Number(item.dueDay),last);if(!Number.isInteger(day)||day<1)return;if(!groups.has(day))groups.set(day,[]);groups.get(day).push(item);});
  const amount=item=>Number(String(item.amount||'').replace(/[^0-9.]/g,''))||0;
  return groups.size?`<div class="fixed-table-scroll"><table class="fixed-date-table"><thead><tr><th>날짜</th><th>항목${compact?'':' / 분류'}</th><th>금액</th>${compact?'':'<th>관리</th>'}</tr></thead><tbody>${[...groups].sort(([a],[b])=>a-b).map(([day,items])=>items.map((item,index)=>`<tr>${index===0?`<th scope="rowgroup" rowspan="${items.length}" class="fixed-date-cell"><strong>${day}일</strong><small>${['일','월','화','수','목','금','토'][new Date(now.getFullYear(),now.getMonth(),day).getDay()]}요일</small><span>${(items.reduce((s,i)=>s+amount(i),0)).toLocaleString()}원</span></th>`:''}<td>${esc(item.item||'고정 지출')}${compact?'':`<small>${esc(item.category||'미분류')} · ${esc(item.source||'결제수단 미입력')}</small>`}</td><td class="fixed-table-amount">₩${amount(item).toLocaleString()}</td>${compact?'':`<td><button class="secondary-button" data-edit-fixed="${esc(item.id)}">수정</button><button class="fixed-expense-remove" data-remove-fixed-expense="${esc(item.id)}" aria-label="고정 지출 삭제">×</button></td>`}</tr>`).join('')).join('')}</tbody></table></div>`:'<p class="muted">등록된 고정 지출이 없어요.</p>';
 };
 document.addEventListener('submit',event=>{
  const form=event.target;if(!form.matches('[data-category-add],[data-category-rename]'))return;event.preventDefault();
  const scope=form.dataset.categoryAdd||form.dataset.categoryRename,before=form.dataset.original,after=String(new FormData(form).get('category')).trim();if(!after)return;
  const list=get(scope);if(after!==before&&list.includes(after)){alert('이미 있는 분류 이름이에요.');return;}
  if(get(scope==='fixed'?'general':'fixed').includes(after)){alert('다른 지출 유형에서 사용하는 분류예요. 구분할 수 있는 다른 이름을 입력해주세요.');return;}
  if(before){const i=list.indexOf(before);if(i<0)return;list[i]=after;if(scope==='fixed'){state.fixedExpenses.forEach(item=>{if(item.category===before)item.category=after;});localStorage.setItem('folio-fixed-expenses',JSON.stringify(state.fixedExpenses));}}
  else list.push(after);
  localStorage.setItem(storage(scope),JSON.stringify(list));window.dispatchEvent(new CustomEvent('folio-categories-updated',{detail:{scope,before,after}}));render();
 });
 document.addEventListener('change',event=>{
  if(event.target.name!=='isFixed')return;
  const form=event.target.form;if(!form)return;const select=form.querySelector('select[name="category"]');if(select)select.innerHTML=options(event.target.checked?'fixed':'general',select.value);
 });
 const prior=render;render=()=>{
  prior();if(state.view==='money'){
   const old=document.querySelector('[data-add-money-category]')?.closest('.paper-card');if(old)old.innerHTML=`<div class="money-category-grid">${manager('general')}${manager('fixed')}</div>`;
   const list=document.querySelector('.fixed-expense-card .fixed-expense-list');if(list)list.innerHTML=table(false);
   const dates=document.querySelector('.fixed-payment-dates');if(dates)dates.innerHTML=table(true);
   document.querySelectorAll('[data-edit-transaction]').forEach(form=>{const check=form.querySelector('[name=isFixed]'),select=form.querySelector('[name=category]');if(select)select.innerHTML=options(check?.checked?'fixed':'general',select.value);});
  }
 };
 render();
})();
