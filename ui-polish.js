(() => {
  const codes=['MON','TUE','WED','THU','FRI','SAT','SUN'], labels=['월','화','수','목','금','토','일'];
  const parse=k=>new Date(`${k}T12:00:00`);
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const shift=(k,n)=>{const d=parse(k);d.setDate(d.getDate()+n);return dateKey(d);};
  const currentWeek=()=>{const d=new Date();d.setDate(d.getDate()-(d.getDay()+6)%7);return dateKey(d);};
  let week=currentWeek();
  const minutes=v=>{const m=String(v||'').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);return m?+m[1]*60 + +m[2]:null;};
  views.sleep=()=>{
    const history=JSON.parse(localStorage.getItem('folio-week-history')||'{}');
    const rows=codes.map((code,i)=>{const f=history[week]?.fields?.[code]||{},wake=minutes(f.wake),bed=minutes(f.sleep);return {code,day:shift(week,i),wake,bed,duration:wake===null||bed===null?null:(wake-bed+1440)%1440};});
    const valid=rows.filter(r=>r.duration!==null),avg=valid.length?Math.round(valid.reduce((s,r)=>s+r.duration,0)/valid.length):null;
    const x=i=>64+i*78, y=m=>270-m/1440*228;
    const series=(field,color)=>{
      const pieces=[];let segment=[];
      rows.forEach((r,i)=>{if(r[field]===null){if(segment.length)pieces.push(segment);segment=[];}else segment.push(`${x(i)},${y(r[field])}`);});if(segment.length)pieces.push(segment);
      return pieces.map(points=>`<polyline class="sleep-trend-line ${field}" points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`).join('')+rows.map((r,i)=>r[field]===null?'':`<circle cx="${x(i)}" cy="${y(r[field])}" r="5" fill="${color}"><title>${labels[i]}요일 ${field==='wake'?'기상':'취침'} ${String(Math.floor(r[field]/60)).padStart(2,'0')}:${String(r[field]%60).padStart(2,'0')}</title></circle>`).join('');
    };
    const weeks=[...new Set([...Object.keys(history),week,currentWeek()])].sort().reverse();
    return `<p class="view-intro">요일별 기상·취침 시간의 추이를 비교해요. 취침은 같은 요일 칸에 적은 전날 밤(또는 당일 새벽) 시간이에요.</p><div class="history-week-bar"><button class="secondary-button" data-trend-week="${shift(week,-7)}">← 이전 주</button><strong>${week} – ${shift(week,6)}</strong><button class="secondary-button" data-trend-week="${shift(week,7)}">다음 주 →</button><button class="secondary-button" data-trend-week="${currentWeek()}">이번 주</button></div><section class="paper-card"><div class="card-head"><span class="card-title">주간 기상 / 취침 추이</span><div class="trend-legend"><span class="wake">● 기상</span><span class="bed">● 취침</span></div></div><svg class="sleep-trend" viewBox="0 0 580 315" role="img" aria-label="가로축 월요일부터 일요일, 세로축 0시부터 24시. 기상과 취침 시간 그래프">${[0,6,12,18,24].map(h=>`<line x1="64" x2="532" y1="${y(h*60)}" y2="${y(h*60)}" stroke="#e7e4de"/><text x="50" y="${y(h*60)+4}" text-anchor="end">${String(h).padStart(2,'0')}:00</text>`).join('')}${labels.map((label,i)=>`<text x="${x(i)}" y="294" text-anchor="middle">${label}</text>`).join('')}${series('wake','#d6ad54')}${series('bed','#9b87bb')}</svg><div class="sleep-average"><span>이번 주 평균 수면 시간</span><strong>${avg===null?'아직 기록이 없어요':`${Math.floor(avg/60)}시간 ${avg%60}분`}</strong><small>${valid.length}일 기준 · 기상과 취침을 모두 적은 날만 계산</small></div><div class="sleep-data-list">${rows.map((r,i)=>`<div><strong>${labels[i]} · ${r.day.slice(5)}</strong><span>기상 ${r.wake===null?'—':`${Math.floor(r.wake/60)}:${String(r.wake%60).padStart(2,'0')}`} / 취침 ${r.bed===null?'—':`${Math.floor(r.bed/60)}:${String(r.bed%60).padStart(2,'0')}`}</span></div>`).join('')}</div></section><section class="paper-card week-archive"><div class="card-title">주간 수면 보관함</div><div class="week-month-list">${weeks.map(w=>`<button class="secondary-button" data-trend-week="${w}">${w} – ${shift(w,6)}</button>`).join('')}</div></section>`;
  };
  const sidebar=document.querySelector('.sidebar'),topbar=document.querySelector('.topbar');
  const menu=document.createElement('button');menu.className='mobile-menu-button';menu.type='button';menu.textContent='☰';menu.setAttribute('aria-label','메뉴 열기');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-controls','planner-menu');sidebar.id='planner-menu';topbar.prepend(menu);
  const overlay=document.createElement('button');overlay.type='button';overlay.className='mobile-menu-overlay';overlay.setAttribute('aria-label','메뉴 닫기');overlay.hidden=true;document.body.append(overlay);
  const closeMenu=()=>{document.body.classList.remove('menu-open');overlay.hidden=true;menu.setAttribute('aria-expanded','false');sidebar.querySelector('.mobile-menu-close')?.remove();};
  menu.addEventListener('click',()=>{
    if(document.body.classList.contains('menu-open')){closeMenu();return;}
    document.body.classList.add('menu-open');overlay.hidden=false;menu.setAttribute('aria-expanded','true');
    const close=document.createElement('button');close.className='mobile-menu-close';close.type='button';close.textContent='× 닫기';close.onclick=()=>{closeMenu();menu.focus();};sidebar.prepend(close);close.focus();
  });
  overlay.addEventListener('click',()=>{closeMenu();menu.focus();});
  document.addEventListener('keydown',event=>{
    if(!document.body.classList.contains('menu-open'))return;
    if(event.key==='Escape'){closeMenu();menu.focus();}
    if(event.key==='Tab'){const buttons=[...sidebar.querySelectorAll('button')];const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  });
  document.addEventListener('click',event=>{const trend=event.target.closest('[data-trend-week]');if(trend){week=trend.dataset.trendWeek;render();}if(event.target.closest('.sidebar [data-view]'))closeMenu();});
  window.addEventListener('resize',()=>{if(innerWidth>760)closeMenu();});
  render();
})();
