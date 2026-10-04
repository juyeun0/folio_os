(() => {
  const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mobileText=value=>String(value??'').trim().split(/\s+/).flatMap(word=>{
    const chars=Array.from(word),limit=/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(word)?4:5,lines=[];
    for(let i=0;i<chars.length;i+=limit)lines.push(escapeText(chars.slice(i,i+limit).join('')));
    return lines;
  }).join('<br>');
  const dateForWeekday = (weekday) => {
    const today = new Date(2026, 9, 1);
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const offsets = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };
    monday.setDate(monday.getDate() + offsets[weekday]);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  };

  const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const minimumMonth = new Date(2026, 5, 1);
  const maximumMonth = new Date(2027, 11, 1);
  const savedMonth = localStorage.getItem('folio-visible-month') || '2026-10';
  let visibleMonth = new Date(`${savedMonth}-01T12:00:00`);
  if (Number.isNaN(visibleMonth.getTime()) || visibleMonth < minimumMonth || visibleMonth > maximumMonth) visibleMonth = new Date(2026, 9, 1);

  const savedPlans = JSON.parse(localStorage.getItem('folio-weekly-plans') || '[]');
  savedPlans.forEach((plan) => {
    if (!plan.date && plan.day) plan.date = dateForWeekday(plan.day);
  });
  localStorage.setItem('folio-weekly-plans', JSON.stringify(savedPlans));
  state.weeklyPlans = savedPlans;

  views.monthly = () => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const dayCount = new Date(year, month + 1, 0).getDate();
    const cellCount = Math.ceil((offset + dayCount) / 7) * 7;
    const headings = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const dates = Array.from({ length: cellCount }, (_, i) => {
      const date = new Date(year, month, 1 - offset + i);
      const currentMonth = date.getMonth() === month;
      const dateKey = isoDate(date);
      const items = state.weeklyPlans.filter((plan) => plan.date === dateKey && plan.showMonthly !== false);
      const fixedIncomeItems = (state.fixedIncomes || []).filter((item) => Math.min(Number(item.dueDay), dayCount) === date.getDate());
      const today = new Date();
      const isToday = dateKey === isoDate(today);
      const incomeEvents = currentMonth ? fixedIncomeItems.map((item) => `<div class="event fixed-income-event">↗ ${item.item} · ₩${Number(String(item.amount).replace(/[^0-9]/g, '')).toLocaleString()}<small>고정 수입 예정</small></div>`).join('') : '';
      return `<div class="date-cell ${currentMonth ? '' : 'dim'} ${isToday ? 'today' : ''}"><span class="date-number">${date.getDate()}</span>${items.map((item) => `<div class="event ${item.category === 'fixed' ? 'fixed' : item.category === 'work' ? '' : item.category === 'family' ? 'green' : 'blue'} ${item.done?'is-done':''}"><span class="event-text">${escapeText(item.text).replace(/\s+/g,'\n')}</span><span class="event-mobile-text" aria-hidden="true">${mobileText(item.text)}</span></div>`).join('')}${incomeEvents}</div>`;
    }).join('');
    const monthTitle = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(visibleMonth).toUpperCase();
    const atStart = year === minimumMonth.getFullYear() && month === minimumMonth.getMonth();
    const atEnd = year === maximumMonth.getFullYear() && month === maximumMonth.getMonth();
    return `<section class="paper-card monthly-wide"><div class="card-head"><span class="card-title">${monthTitle}</span><div class="month-controls"><button type="button" class="month-nav-button" data-month-shift="-1" aria-label="이전 달" ${atStart ? 'disabled' : ''}>‹</button><button type="button" class="month-nav-button" data-month-shift="1" aria-label="다음 달" ${atEnd ? 'disabled' : ''}>›</button></div></div><div class="calendar" style="--month-weeks:${cellCount / 7}">${headings.map((day) => `<div class="day-name">${day}</div>`).join('')}${dates}</div></section>`;
  };

  document.addEventListener('click', (event) => {
    const control = event.target.closest('[data-month-shift]');
    if (!control || control.disabled) return;
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + Number(control.dataset.monthShift), 1);
    localStorage.setItem('folio-visible-month', `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`);
    titles.monthly[0] = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(visibleMonth).toUpperCase();
    render();
  });

  let pending = null;
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.add-plan');
    if (!button) return;
    const day = button.dataset.day;
    pending = {
      day,
      date: dateForWeekday(day),
      text: document.querySelector(`[data-plan-text="${day}"]`)?.value.trim(),
      time: document.querySelector(`[data-plan-time="${day}"]`)?.value.trim() || '',
    };
  }, true);

  document.addEventListener('click', (event) => {
    if (event.target.closest('.add-plan') && pending?.text) {
      const plan = [...state.weeklyPlans].reverse().find((item) => item.day === pending.day && item.text === pending.text && (item.time || '') === pending.time && !item.date);
      if (plan) {
        plan.date = pending.date;
        localStorage.setItem('folio-weekly-plans', JSON.stringify(state.weeklyPlans));
      }
      pending = null;
      if (state.view === 'monthly') render();
    }
  });

  render();
})();
