(() => {
  const moneyResetKey = 'folio-money-reset-20261002';
  if (!localStorage.getItem(moneyResetKey)) {
    for (const fields of Object.values(state.weeklyFields)) {
      for (const key of ['expense', 'expenseCategory', 'expenseSource', 'expenseItem', 'income', 'incomeCategory', 'incomeSource', 'incomeItem']) delete fields[key];
    }
    localStorage.setItem('folio-weekly-fields', JSON.stringify(state.weeklyFields));
    localStorage.setItem(moneyResetKey, '1');
  }
  const defaultHabits = ['운동', '독서', '묵상'].map((name) => ({ id: name, name }));
  const moneyCategories = ['주거비', '식비', '카페비', '생필품', '꾸밈비'];
  const moneyCategoryOptions = (selected = '') => `<option value="">분류</option>${moneyCategories.map((category) => `<option value="${category}" ${selected === category ? 'selected' : ''}>${category}</option>`).join('')}`;
  state.habitNames = JSON.parse(localStorage.getItem('folio-habit-names') || 'null') || defaultHabits;
  const habitDays = ['월', '화', '수', '목', '금', '토', '일'];
  const planCategoryOptions = (selected = '') => ['personal', 'work', 'family', 'fixed'].map((category) => `<option value="${category}" ${selected === category ? 'selected' : ''}>${category[0].toUpperCase() + category.slice(1)}</option>`).join('');

  const habitMarkup = () => `<section class="paper-card habit-card"><div class="card-head"><span class="card-title">HABIT TRACKER</span><span class="muted">this week</span></div><div class="habit-weekdays" aria-hidden="true"><span></span><div class="habit-weekday-labels">${habitDays.map((day) => `<span>${day}</span>`).join('')}</div><span></span></div>${state.habitNames.map((habit) => `<div class="habit-row"><span class="habit-name">${habit.name}</span><div class="habit-days">${habitDays.map((day, index) => { const key = `${habit.id}-${index}`; return `<button class="habit-check ${state.habits[key] ? 'checked' : ''}" data-habit="${key}" aria-label="${habit.name} ${day}요일">${state.habits[key] ? '✓' : ''}</button>`; }).join('')}</div><button class="habit-remove" data-remove-habit="${habit.id}" aria-label="${habit.name} 습관 삭제">×</button></div>`).join('')}<form class="habit-add" id="habit-add-form"><input id="new-habit-name" placeholder="추가할 습관" maxlength="24"><button class="primary-button" type="submit">습관 추가</button></form></section>`;

  const baseWeeklyView = views.weekly;
  views.weekly = () => {
    const template = document.createElement('template');
    template.innerHTML = baseWeeklyView()
      .replace(/<div><label>OUTFIT<\/label><input[^>]*data-field="outfit"[^>]*><\/div>/g, '')
      .replace(/<select class="save-field" data-day="([^"]+)" data-field="weather">[\s\S]*?<\/select>/g, (_match, day) => {
        const choices = [['', '날씨 선택', '☁️'], ['맑음', '맑음', '☀️'], ['구름', '구름', '⛅'], ['비', '비', '🌧️'], ['눈', '눈', '❄️'], ['바람', '바람', '🍃']];
        const selected = state.weeklyFields[day]?.weather || '';
        return `<span class="weather-picker" role="group" aria-label="날씨 선택">${choices.map(([value, label, icon]) => `<button type="button" class="weather-choice ${selected === value ? 'selected' : ''}" data-day="${day}" data-field="weather" value="${value}" aria-label="${label}" title="${label}">${icon}</button>`).join('')}</span>`;
      });
    template.content.querySelectorAll('.week-day').forEach((day) => {
      const head = day.querySelector('.week-day-head');
      const dayCode = head?.querySelector('.week-day-name')?.textContent.trim().slice(0, 3);
      const displayedDate = day.querySelector('.week-date');
      if (displayedDate && dayCode && dayDateLabels?.[dayCode]) displayedDate.textContent = dayDateLabels[dayCode];
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'day-collapse-toggle';
      toggle.dataset.toggleWeekDay = '';
      toggle.setAttribute('aria-expanded', String(dayCode === todayCode));
      toggle.setAttribute('aria-label', `${dayCode} ${dayCode === todayCode ? '접기' : '펼치기'}`);
      toggle.textContent = dayCode === todayCode ? '⌃' : '⌄';
      day.classList.toggle('collapsed', dayCode !== todayCode);
      head?.append(toggle);
      const fields = day.querySelectorAll('.day-meta');
      const weather = fields[0];
      const clothes = fields[1];
      const todo = [...day.querySelectorAll('.day-section')].find((section) => section.querySelector('.day-label')?.textContent.trim() === 'TODO');
      weather?.querySelector('[data-field="outfit"]')?.closest('div')?.remove();
      if (todo && weather) {
        todo.after(weather);
        if (clothes) weather.after(clothes);
      }
      const dayCodeForMoney = dayCode;
      const dayFields = state.weeklyFields[dayCodeForMoney] || {};
      const moneyEditor = (kind, label) => `<div class="day-section"><div class="day-label">${label}</div><div class="money-editor"><input class="day-entry save-field" data-day="${dayCodeForMoney}" data-field="${kind}" value="${escapeHtml(dayFields[kind] || '')}" inputmode="decimal" placeholder="${label} 금액"><select class="day-entry save-field" data-day="${dayCodeForMoney}" data-field="${kind}Category">${moneyCategoryOptions(dayFields[`${kind}Category`] || '')}</select><input class="day-entry save-field" data-day="${dayCodeForMoney}" data-field="${kind}Source" value="${escapeHtml(dayFields[`${kind}Source`] || '')}" placeholder="${label === 'EXPENSE' ? '지출처' : '수입처'}"><input class="day-entry save-field" data-day="${dayCodeForMoney}" data-field="${kind}Item" value="${escapeHtml(dayFields[`${kind}Item`] || '')}" placeholder="항목"></div></div>`;
      const existingMoneySection = [...day.querySelectorAll('.day-section')].find((section) => section.querySelector('.day-label')?.textContent.trim() === 'MONEY');
      if (existingMoneySection) existingMoneySection.outerHTML = `${moneyEditor('expense', 'EXPENSE')}${moneyEditor('income', 'INCOME')}`;
      else {
        const wakeSection = [...day.querySelectorAll('.day-section')].find((section) => section.querySelector('.day-label')?.textContent.includes('SLEEP / WAKE'));
        wakeSection?.insertAdjacentHTML('afterend', `${moneyEditor('expense', 'EXPENSE')}${moneyEditor('income', 'INCOME')}`);
      }
    });
    return template.innerHTML
    .replace(/<section class="paper-card habit-card">[\s\S]*?<\/section>/, habitMarkup())
    .replace(/<button class="primary-button add-plan" data-day="([^"]+)"/g, '<label class="monthly-toggle"><input type="checkbox" data-show-monthly="$1"> Monthly</label><button class="primary-button add-plan" data-day="$1"')
    .replace(/<div class="weekly-record"><span>○<\/span><b>([^<]*)<\/b>([\s\S]*?)<button class="remove-record" data-remove-plan="([^"]+)">×<\/button><\/div>/g, (_match, time, content, id) => {
      const plan = state.weeklyPlans.find((item) => String(item.id) === id);
      return `<div class="weekly-record ${plan?.done ? 'is-done' : ''}"><button class="todo-check schedule-check" data-complete-plan="${id}" aria-pressed="${Boolean(plan?.done)}">${plan?.done ? '✓' : '○'}</button><b>${time}</b>${content}<button type="button" class="edit-plan-button" data-edit-plan="${id}" aria-label="${escapeHtml(plan?.text || '항목')} 수정">수정</button><label class="monthly-item-toggle" title="Monthly에 표시"><input type="checkbox" data-plan-monthly="${id}" ${plan?.showMonthly === false ? '' : 'checked'}> 월간</label><button class="remove-record" data-remove-plan="${id}">×</button></div>`;
    })
    .replace(/<div class="weekly-record"><button class="todo-check" data-todo="([^"]+)">□<\/button>/g, (_match, id) => {
      const plan = state.weeklyPlans.find((item) => String(item.id) === id);
      return `<div class="weekly-record ${plan?.done ? 'is-done' : ''}"><button class="todo-check" data-complete-plan="${id}" aria-pressed="${Boolean(plan?.done)}">${plan?.done ? '✓' : '□'}</button><span class="tag ${plan?.category}">${plan?.category}</span><span>${escapeHtml(plan?.text || '')}</span><button type="button" class="edit-plan-button" data-edit-plan="${id}" aria-label="${escapeHtml(plan?.text || '항목')} 수정">수정</button><label class="monthly-item-toggle" title="Monthly에 표시"><input type="checkbox" data-plan-monthly="${id}" ${plan?.showMonthly === false ? '' : 'checked'}> 월간</label><button class="remove-record" data-remove-plan="${id}">×</button>`;
    });
  };

  let pendingPlan = null;
  document.addEventListener('click', (event) => {
    const dayToggle = event.target.closest('[data-toggle-week-day]');
    if (dayToggle) {
      const selectedDay = dayToggle.closest('.week-day');
      const shouldOpen = selectedDay.classList.contains('collapsed');
      document.querySelectorAll('.week-day').forEach((day) => {
        const open = day === selectedDay && shouldOpen;
        day.classList.toggle('collapsed', !open);
        const button = day.querySelector('[data-toggle-week-day]');
        button.setAttribute('aria-expanded', String(open));
        button.textContent = open ? '⌃' : '⌄';
        button.setAttribute('aria-label', `${day.querySelector('.week-day-name').textContent.trim().slice(0, 3)} ${open ? '접기' : '펼치기'}`);
      });
      return;
    }
    const completionButton = event.target.closest('[data-complete-plan]');
    if (completionButton) {
      const plan = state.weeklyPlans.find((item) => String(item.id) === completionButton.dataset.completePlan);
      if (plan) {
        plan.done = !plan.done;
        persistPlans();
        render();
      }
      return;
    }
    const addButton = event.target.closest('.add-plan');
    if (!addButton) return;
    const day = addButton.dataset.day;
    pendingPlan = {
      day,
      text: document.querySelector(`[data-plan-text="${day}"]`)?.value.trim(),
      time: document.querySelector(`[data-plan-time="${day}"]`)?.value.trim() || '',
      showMonthly: Boolean(document.querySelector(`[data-show-monthly="${day}"]`)?.checked),
    };
  }, true);

  document.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-plan]');
    if (editButton) {
      const plan = state.weeklyPlans.find((item) => String(item.id) === editButton.dataset.editPlan);
      const row = editButton.closest('.weekly-record');
      if (!plan || !row) return;
      row.classList.add('is-editing');
      row.innerHTML = `<input class="plan-edit-text" aria-label="내용 수정" value="${escapeHtml(plan.text)}"><input class="plan-edit-time" aria-label="시간 수정" placeholder="시간 없음은 투두" value="${escapeHtml(plan.time || '')}"><select class="plan-edit-category" aria-label="분류 수정">${planCategoryOptions(plan.category)}</select><button type="button" class="save-plan-edit" data-plan-id="${plan.id}">저장</button><button type="button" class="cancel-plan-edit">취소</button>`;
      return;
    }
    const saveEditButton = event.target.closest('.save-plan-edit');
    if (saveEditButton) {
      const row = saveEditButton.closest('.weekly-record');
      const plan = state.weeklyPlans.find((item) => String(item.id) === saveEditButton.dataset.planId);
      const text = row?.querySelector('.plan-edit-text')?.value.trim();
      if (!plan || !text) return;
      plan.text = text;
      plan.time = row.querySelector('.plan-edit-time').value.trim();
      plan.category = row.querySelector('.plan-edit-category').value;
      persistPlans();
      render();
      return;
    }
    if (event.target.closest('.cancel-plan-edit')) {
      render();
      return;
    }
    if (event.target.closest('.add-plan') && pendingPlan?.text) {
      const plan = [...state.weeklyPlans].reverse().find((item) => item.day === pendingPlan.day && item.text === pendingPlan.text && (item.time || '') === pendingPlan.time && !Object.hasOwn(item, 'showMonthly'));
      if (plan) {
        plan.showMonthly = pendingPlan.showMonthly;
        localStorage.setItem('folio-weekly-plans', JSON.stringify(state.weeklyPlans));
      }
      pendingPlan = null;
      render();
    }

    const removeButton = event.target.closest('[data-remove-habit]');
    if (removeButton) {
      state.habitNames = state.habitNames.filter((habit) => habit.id !== removeButton.dataset.removeHabit);
      localStorage.setItem('folio-habit-names', JSON.stringify(state.habitNames));
      render();
    }

  });

  document.addEventListener('submit', (event) => {
    if (event.target.id !== 'habit-add-form') return;
    event.preventDefault();
    const input = document.querySelector('#new-habit-name');
    const name = input.value.trim();
    if (!name) return;
    state.habitNames.push({ id: `custom-${Date.now()}`, name });
    localStorage.setItem('folio-habit-names', JSON.stringify(state.habitNames));
    render();
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-plan-monthly]')) {
      const plan = state.weeklyPlans.find((item) => String(item.id) === event.target.dataset.planMonthly);
      if (plan) {
        plan.showMonthly = event.target.checked;
        localStorage.setItem('folio-weekly-plans', JSON.stringify(state.weeklyPlans));
        render();
      }
    }
  });

  document.addEventListener('click', (event) => {
    const choice = event.target.closest('.weather-choice');
    if (!choice) return;
    const day = choice.dataset.day;
    const selected = choice.value;
    state.weeklyFields[day] = state.weeklyFields[day] || {};
    state.weeklyFields[day].weather = selected;
    localStorage.setItem('folio-weekly-fields', JSON.stringify(state.weeklyFields));
    choice.closest('.weather-picker').querySelectorAll('.weather-choice').forEach((button) => button.classList.toggle('selected', button === choice));
    const summary = choice.closest('.week-day').querySelector('.day-summary');
    if (summary) summary.remove();
    const weatherIcons = { '맑음': '☀️', '구름': '⛅', '비': '🌧️', '눈': '❄️', '바람': '🍃' };
    const fields = [weatherIcons[state.weeklyFields[day].weather], state.weeklyFields[day].top, state.weeklyFields[day].bottom, state.weeklyFields[day].outer].filter(Boolean);
    if (fields.length) {
      const box = document.createElement('div');
      box.className = 'day-summary';
      box.innerHTML = fields.map((value, index) => `<span class="${index === 0 ? 'weather' : ''}">${value}</span>`).join('');
      choice.closest('.week-day').querySelector('.week-day-head').insertBefore(box, choice.closest('.week-day').querySelector('.week-date'));
    }
    const note = document.querySelector('.saved-note');
    if (note) note.textContent = '저장됨 ✓';
    setTimeout(() => { if (note) note.textContent = '자동 저장'; }, 900);
  });

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const isScheduledPlan = (plan) => /^\s*\d{1,2}:\d{2}\s*$/.test(String(plan.time || ''));
  state.fixedExpenses = JSON.parse(localStorage.getItem('folio-fixed-expenses') || '[]');
  state.fixedIncomes = JSON.parse(localStorage.getItem('folio-fixed-incomes') || '[]');
  titles.money = ['MONEY LEDGER', 'Money'];
  titles.todos = ['TASKS FROM WEEKLY', 'To-do'];
  const dayDateLabels = { MON: '09/28', TUE: '09/29', WED: '09/30', THU: '10/01', FRI: '10/02', SAT: '10/03', SUN: '10/04' };
  const todosNavigation = document.createElement('button');
  todosNavigation.className = 'nav-item';
  todosNavigation.dataset.view = 'todos';
  todosNavigation.innerHTML = '<span>☑</span>To-do';
  document.querySelector('.nav-list').insertBefore(todosNavigation, document.querySelector('[data-view="daily"]'));
  const mobileTodosNavigation = document.createElement('button');
  mobileTodosNavigation.className = 'mobile-nav-item';
  mobileTodosNavigation.dataset.view = 'todos';
  mobileTodosNavigation.innerHTML = '<span>☑</span>Tasks';
  const mobileNav = document.querySelector('.mobile-nav');
  if (mobileNav) mobileNav.insertBefore(mobileTodosNavigation, mobileNav.querySelector('[data-view="daily"]'));
  views.todos = () => {
    const dayCards = orderedDays.map((day) => {
      const plans = state.weeklyPlans.filter((plan) => plan.day === day && !isScheduledPlan(plan)).slice();
      if (!plans.length) return '';
      const unfinished = plans.filter((plan) => !plan.done).length;
      return `<section class="paper-card todo-day-card"><div class="card-head"><span class="todo-day-heading">${day} <small>${dayDateLabels[day] || ''}</small></span><span class="muted">${unfinished}개 남음</span></div><div class="todo-day-list">${plans.map((plan) => `<article class="plan-item plain-todo ${plan.done ? 'is-done' : ''}"><button type="button" class="todo-check" data-complete-plan="${plan.id}" aria-label="${plan.done ? '완료 취소' : '완료'}: ${escapeHtml(plan.text)}" aria-pressed="${Boolean(plan.done)}">${plan.done ? '✓' : '□'}</button><span class="tag ${plan.category}">${escapeHtml(plan.category)}</span><span class="plan-text">${escapeHtml(plan.text)}</span><button type="button" class="remove-record" data-remove-plan="${plan.id}" aria-label="삭제: ${escapeHtml(plan.text)}">×</button></article>`).join('')}</div></section>`;
    }).join('');
    const todos = state.weeklyPlans.filter((plan) => !isScheduledPlan(plan));
    const activeCount = todos.filter((plan) => !plan.done).length;
    return `<p class="view-intro">Weekly에서 시간 없이 작성한 투두만 모아봤어요. 체크하면 완료 표시되고, ×를 누르면 Weekly에서도 삭제돼요.</p><div class="todo-page-summary"><span>남은 투두</span><strong>${activeCount}</strong></div><div class="todo-day-grid">${dayCards || '<section class="paper-card todo-empty">Weekly에서 시간 없이 작성한 투두가 여기에 모여요.</section>'}</div>`;
  };

  state.wishlist = JSON.parse(localStorage.getItem('folio-wishlist') || '{"shopping":[],"content":[]}');
  state.faithNotes = JSON.parse(localStorage.getItem('folio-faith-notes') || '{"gratitude":[],"prayer":[],"scripture":[]}');
  titles.wishlist = ['WISHLIST', 'Wishlist'];
  titles.faith = ['FAITH & REFLECTION', 'Faith Notes'];
  const navItems = [
    { view: 'wishlist', icon: '♡', label: 'Wishlist', mobile: 'Wish' },
    { view: 'faith', icon: '✧', label: 'Faith Notes', mobile: 'Faith' },
  ];
  navItems.forEach(({ view, icon, label, mobile }) => {
    const desktopButton = document.createElement('button');
    desktopButton.className = 'nav-item';
    desktopButton.dataset.view = view;
    desktopButton.innerHTML = `<span>${icon}</span>${label}`;
    document.querySelector('.nav-list').insertBefore(desktopButton, document.querySelector('[data-view="brain"]'));
    const mobileButton = document.createElement('button');
    mobileButton.className = 'mobile-nav-item';
    mobileButton.dataset.view = view;
    mobileButton.innerHTML = `<span>${icon}</span>${mobile}`;
    mobileNav?.insertBefore(mobileButton, mobileNav.querySelector('[data-view="brain"]'));
  });
  document.querySelector('[data-view="search"]')?.remove();
  document.querySelector('#top-search')?.remove();
  document.querySelector('[data-view="brain"] span')?.replaceChildren('✎');
  document.querySelector('#type-picker [data-type="brain"]')?.replaceChildren('✎ ', Object.assign(document.createElement('span'), { textContent: 'Brain Dump' }));
  const baseBrainView = views.brain;
  views.brain = () => baseBrainView().replaceAll('🧠', '✎');

  const moneyText = (value) => value ? `₩${Number(String(value).replace(/[^0-9]/g, '')).toLocaleString()}` : '가격 미입력';
  const persistWishlist = () => localStorage.setItem('folio-wishlist', JSON.stringify(state.wishlist));
  const persistFaithNotes = () => localStorage.setItem('folio-faith-notes', JSON.stringify(state.faithNotes));
  const dateStamp = () => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
  views.wishlist = () => `<p class="view-intro">사거나 확인한 항목은 체크해서 위시리스트를 정리할 수 있어요.</p><section class="paper-card wishlist-section"><div class="card-head"><span class="card-title">SHOPPING WISHLIST</span><span class="muted">가격 변동 기록</span></div><form id="shopping-wish-form" class="wishlist-form shopping-wish-form"><input name="item" placeholder="항목" required><input name="price" inputmode="numeric" placeholder="현재 가격"><button class="primary-button" type="submit">추가</button></form><div class="shopping-wish-list">${state.wishlist.shopping.map((item) => `<article class="shopping-wish-row ${item.done ? 'wish-done' : ''}" data-wish-row="${item.id}"><button type="button" class="wish-check ${item.done ? 'checked' : ''}" data-toggle-wish="shopping:${item.id}" aria-label="${item.done ? '구매 완료 취소' : '구매 완료 표시'}" aria-pressed="${Boolean(item.done)}">${item.done ? '✓' : ''}</button><div class="wish-item-name"><strong>${escapeHtml(item.item)}</strong><small>${moneyText(item.price)}</small></div><div class="price-tracker"><form class="price-log-form" data-price-log-form="${item.id}"><input name="note" placeholder="가격 변동 기록 (예: 39,000원으로 인하)"><button type="submit" class="secondary-button">기록</button></form>${item.logs?.length ? `<ul class="price-log-list">${item.logs.map((log) => `<li><time>${escapeHtml(log.date)}</time>${escapeHtml(log.note)}</li>`).join('')}</ul>` : '<small class="muted">가격 변동 기록이 여기에 쌓여요.</small>'}</div><button type="button" class="wish-remove" data-remove-shopping-wish="${item.id}" aria-label="${escapeHtml(item.item)} 삭제">×</button></article>`).join('') || '<p class="wishlist-empty">쇼핑 위시리스트가 비어 있어요.</p>'}</div></section><section class="paper-card wishlist-section"><div class="card-head"><span class="card-title">CONTENT WISHLIST</span><span class="muted">보고, 읽고, 가고 싶은 것</span></div><form id="content-wish-form" class="wishlist-form content-wish-form"><input name="category" placeholder="콘텐츠 분류 (책, 영화, 여행 등)" required><input name="title" placeholder="제목" required><input name="purpose" placeholder="목적"><button class="primary-button" type="submit">추가</button></form><div class="content-wish-list">${state.wishlist.content.map((item) => `<article class="content-wish-row ${item.done ? 'wish-done' : ''}"><span class="tag personal">${escapeHtml(item.category)}</span><strong>${escapeHtml(item.title)}</strong><span class="wish-purpose">${escapeHtml(item.purpose || '목적 미입력')}</span><button type="button" class="wish-check ${item.done ? 'checked' : ''}" data-toggle-wish="content:${item.id}" aria-label="${item.done ? '완료 표시 취소' : '확인 완료 표시'}" aria-pressed="${Boolean(item.done)}">${item.done ? '✓' : ''}</button><button type="button" class="wish-remove" data-remove-content-wish="${item.id}" aria-label="${escapeHtml(item.title)} 삭제">×</button></article>`).join('') || '<p class="wishlist-empty">콘텐츠 위시리스트가 비어 있어요.</p>'}</div></section>`;

  const reflectionList = (kind, items) => items.map((item,index) => `<article class="reflection-entry"><time><span class="reflection-number">#${items.length-index}</span> ${escapeHtml(item.date)}</time><p>${escapeHtml(item.text)}</p><button type="button" class="wish-remove" data-remove-reflection="${kind}:${item.id}" aria-label="기록 삭제">×</button></article>`).join('') || '<p class="wishlist-empty">아직 쌓인 기록이 없어요.</p>';
  views.faith = () => `<p class="view-intro">마음에 남은 감사와 기도를 날짜와 함께 차곡차곡 기록해두세요.</p><div class="faith-grid"><section class="paper-card faith-card"><div class="card-head"><span class="card-title">감사한 점</span><span class="muted">GRATITUDE</span></div><form class="reflection-form" data-reflection-form="gratitude"><textarea name="text" placeholder="오늘 감사했던 일을 적어보세요" required></textarea><button class="primary-button" type="submit">기록 쌓기</button></form><div class="reflection-list">${reflectionList('gratitude', state.faithNotes.gratitude)}</div></section><section class="paper-card faith-card"><div class="card-head"><span class="card-title">기도 제목</span><span class="muted">PRAYER</span></div><form class="reflection-form" data-reflection-form="prayer"><textarea name="text" placeholder="기도 제목을 적어보세요" required></textarea><button class="primary-button" type="submit">기록 쌓기</button></form><div class="reflection-list">${reflectionList('prayer', state.faithNotes.prayer)}</div></section></div>`;

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (form.id === 'shopping-wish-form') {
      event.preventDefault();
      const data = new FormData(form);
      state.wishlist.shopping.unshift({ id: `shop-${Date.now()}`, item: String(data.get('item')).trim(), price: String(data.get('price') || '').replace(/[^0-9]/g, ''), logs: [] });
      persistWishlist(); render(); return;
    }
    if (form.id === 'content-wish-form') {
      event.preventDefault();
      const data = new FormData(form);
      state.wishlist.content.unshift({ id: `content-${Date.now()}`, category: String(data.get('category')).trim(), title: String(data.get('title')).trim(), purpose: String(data.get('purpose') || '').trim() });
      persistWishlist(); render(); return;
    }
    if (form.matches('[data-price-log-form]')) {
      event.preventDefault();
      const item = state.wishlist.shopping.find((wish) => wish.id === form.dataset.priceLogForm);
      const note = String(new FormData(form).get('note') || '').trim();
      if (!item || !note) return;
      item.logs = item.logs || [];
      item.logs.unshift({ date: dateStamp(), note });
      persistWishlist(); render(); return;
    }
    if (form.matches('[data-reflection-form]')) {
      event.preventDefault();
      const kind = form.dataset.reflectionForm;
      const data = new FormData(form);
      const text = String(data.get('text') || '').trim();
      if (!text) return;
      state.faithNotes[kind].unshift({ id: `note-${Date.now()}`, date: dateStamp(), text, reference: String(data.get('reference') || '').trim() });
      persistFaithNotes(); render();
    }
  });
  document.addEventListener('click', (event) => {
    const wishToggle = event.target.closest('[data-toggle-wish]');
    if (wishToggle) {
      const [kind, id] = wishToggle.dataset.toggleWish.split(':');
      const collection = kind === 'shopping' ? state.wishlist.shopping : state.wishlist.content;
      const item = collection.find((wish) => wish.id === id);
      if (item) {
        item.done = !item.done;
        persistWishlist();
        render();
      }
      return;
    }
    const shoppingDelete = event.target.closest('[data-remove-shopping-wish]');
    if (shoppingDelete) { state.wishlist.shopping = state.wishlist.shopping.filter((item) => item.id !== shoppingDelete.dataset.removeShoppingWish); persistWishlist(); render(); return; }
    const contentDelete = event.target.closest('[data-remove-content-wish]');
    if (contentDelete) { state.wishlist.content = state.wishlist.content.filter((item) => item.id !== contentDelete.dataset.removeContentWish); persistWishlist(); render(); return; }
    const reflectionDelete = event.target.closest('[data-remove-reflection]');
    if (reflectionDelete) { const [kind, id] = reflectionDelete.dataset.removeReflection.split(':'); state.faithNotes[kind] = state.faithNotes[kind].filter((item) => item.id !== id); persistFaithNotes(); render(); }
  });
  const weeklyDayDates = { MON: '2026-09-28', TUE: '2026-09-29', WED: '2026-09-30', THU: '2026-10-01', FRI: '2026-10-02', SAT: '2026-10-03', SUN: '2026-10-04' };
  const fixedAmountTotal = () => state.fixedExpenses.reduce((sum, item) => sum + (Number(String(item.amount).replace(/[^0-9]/g, '')) || 0), 0);
  const fixedIncomeTotal = () => state.fixedIncomes.reduce((sum, item) => sum + (Number(String(item.amount).replace(/[^0-9]/g, '')) || 0), 0);
  const moneyRows = () => Object.entries(state.weeklyFields).flatMap(([day, fields]) => ['expense', 'income'].filter((kind) => fields[kind]).map((kind) => ({ day, date: weeklyDayDates[day] ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(`${weeklyDayDates[day]}T12:00:00`)) : day, sortDate: weeklyDayDates[day] || '', kind, amount: (Number(String(fields[kind]).replace(/[^0-9]/g, '')) || 0).toLocaleString(), category: fields[`${kind}Category`] || '', source: fields[`${kind}Source`] || '', item: fields[`${kind}Item`] || '' }))).sort((a, b) => b.sortDate.localeCompare(a.sortDate) || a.kind.localeCompare(b.kind));
  const nextBillDate = (dueDay) => { const now = new Date(); let year = now.getFullYear(), month = now.getMonth(); let day = Math.min(Number(dueDay), new Date(year, month + 1, 0).getDate()); let due = new Date(year, month, day); if (due < new Date(year, month, now.getDate())) { month += 1; year += Math.floor(month / 12); month %= 12; day = Math.min(Number(dueDay), new Date(year, month + 1, 0).getDate()); due = new Date(year, month, day); } return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(due); };
  views.money = () => {
    const rows = moneyRows();
    const weeklyExpense = moneyRecordTotal('expense');
    const weeklyIncome = moneyRecordTotal('income');
    const fixedRows = state.fixedExpenses.slice().sort((a, b) => Number(a.dueDay) - Number(b.dueDay));
    const fixedIncomeRows = state.fixedIncomes.slice().sort((a, b) => Number(a.dueDay) - Number(b.dueDay));
    return `<p class="view-intro">Weekly 기록은 자동 누적되고, 매달 반복되는 지출과 예상 수입을 미리 반영해 월 예산을 살펴볼 수 있어요.</p><div class="money-overview"><section class="weekly-total"><small>WEEKLY EXPENSES</small><strong>₩${weeklyExpense.toLocaleString()}</strong></section><section class="weekly-total"><small>WEEKLY INCOME</small><strong>₩${weeklyIncome.toLocaleString()}</strong></section><section class="weekly-total"><small>WEEKLY BALANCE</small><strong>₩${(weeklyIncome - weeklyExpense).toLocaleString()}</strong></section><section class="weekly-total fixed-total"><small>EXPECTED FIXED INCOME</small><strong>₩${fixedIncomeTotal().toLocaleString()}</strong></section><section class="weekly-total fixed-total"><small>FIXED EXPENSES</small><strong>−₩${fixedAmountTotal().toLocaleString()}</strong></section><section class="weekly-total budget-total"><small>STARTING MONTH BUDGET</small><strong>₩${(fixedIncomeTotal() - fixedAmountTotal()).toLocaleString()}</strong></section></div><section class="paper-card money-ledger-card"><div class="card-head"><span class="card-title">WEEKLY LEDGER</span><span class="muted">Weekly 입력 내역 ${rows.length}건</span></div><div class="money-ledger-list">${rows.map((row) => `<article class="money-ledger-row"><span class="ledger-kind ${row.kind}">${row.kind === 'expense' ? '−' : '+'}</span><div class="ledger-description"><strong>${row.kind === 'expense' ? '지출' : '수입'} · ₩${escapeHtml(row.amount)}</strong><span>${escapeHtml(row.item || '항목 없음')}</span><small>${row.date || row.day} · ${escapeHtml(row.source || '처 없음')} · ${escapeHtml(row.category || '분류 없음')}</small></div><span class="tag ${row.category}">${escapeHtml(row.category || '미분류')}</span></article>`).join('') || '<p class="money-empty">Weekly에 지출이나 수입을 입력하면 여기에 날짜별로 쌓여요.</p>'}</div></section><section class="paper-card fixed-expense-card"><div class="card-head"><span class="card-title">FIXED EXPENSES</span><span class="muted">매달 반복 지출</span></div><form id="fixed-expense-form" class="fixed-expense-form"><label>금액<input name="amount" inputmode="numeric" placeholder="예: 59000" required></label><label>분류<select name="category">${optionList()}</select></label><label>지출처<input name="source" placeholder="예: 통신사"></label><label>항목<input name="item" placeholder="예: 휴대폰 요금" required></label><label>매달 지출일<input name="dueDay" type="number" min="1" max="31" placeholder="1–31일" required></label><button type="submit" class="primary-button">고정 지출 추가</button></form><div class="fixed-expense-list">${fixedRows.map((item) => `<article class="fixed-expense-row"><span class="fixed-expense-icon">↻</span><div><strong>${escapeHtml(item.item)}</strong><small>${escapeHtml(item.source || '지출처 미입력')} · 매달 ${escapeHtml(item.dueDay)}일 · 다음 지출일 ${nextBillDate(item.dueDay)}</small></div><strong class="fixed-expense-amount">₩${Number(String(item.amount).replace(/[^0-9]/g, '')).toLocaleString()}</strong><button type="button" class="fixed-expense-remove" data-remove-fixed-expense="${item.id}" aria-label="${escapeHtml(item.item)} 고정 지출 삭제">×</button></article>`).join('') || '<p class="money-empty">매달 나가는 고정 지출을 등록해보세요.</p>'}</div></section><section class="paper-card fixed-income-card"><div class="card-head"><span class="card-title">EXPECTED FIXED INCOME</span><span class="muted">월 초 예산에 미리 반영 · 지급일에 Monthly 표시</span></div><form id="fixed-income-form" class="fixed-expense-form"><label>금액<input name="amount" inputmode="numeric" placeholder="예: 3000000" required></label><label>분류<select name="category">${optionList()}</select></label><label>수입처<input name="source" placeholder="예: 급여"></label><label>항목<input name="item" placeholder="예: 월급" required></label><label>매달 지급일<input name="dueDay" type="number" min="1" max="31" placeholder="1–31일" required></label><button type="submit" class="primary-button">고정 수입 추가</button></form><div class="fixed-expense-list">${fixedIncomeRows.map((item) => `<article class="fixed-expense-row"><span class="fixed-income-icon">↗</span><div><strong>${escapeHtml(item.item)}</strong><small>${escapeHtml(item.source || '수입처 미입력')} · 매달 ${escapeHtml(item.dueDay)}일 · 다음 지급일 ${nextBillDate(item.dueDay)}</small></div><strong class="fixed-expense-amount">+₩${Number(String(item.amount).replace(/[^0-9]/g, '')).toLocaleString()}</strong><button type="button" class="fixed-expense-remove" data-remove-fixed-income="${item.id}" aria-label="${escapeHtml(item.item)} 고정 수입 삭제">×</button></article>`).join('') || '<p class="money-empty">매달 반복되는 예상 수입을 등록해보세요.</p>'}</div></section>`;
  };

  document.addEventListener('submit', (event) => {
    if (!['fixed-expense-form', 'fixed-income-form'].includes(event.target.id)) return;
    event.preventDefault();
    const form = event.target;
    const entry = Object.fromEntries(new FormData(form).entries());
    if (!entry.amount.trim() || !entry.item.trim() || !entry.dueDay) return;
    if (form.id === 'fixed-income-form') {
      state.fixedIncomes.push({ ...entry, id: `income-${Date.now()}`, amount: entry.amount.replace(/[^0-9]/g, '') });
      localStorage.setItem('folio-fixed-incomes', JSON.stringify(state.fixedIncomes));
    } else {
      state.fixedExpenses.push({ ...entry, id: `fixed-${Date.now()}`, amount: entry.amount.replace(/[^0-9]/g, '') });
      localStorage.setItem('folio-fixed-expenses', JSON.stringify(state.fixedExpenses));
    }
    render();
  });

  document.addEventListener('click', (event) => {
    const removeFixed = event.target.closest('[data-remove-fixed-expense]');
    if (removeFixed) {
      state.fixedExpenses = state.fixedExpenses.filter((item) => item.id !== removeFixed.dataset.removeFixedExpense);
      localStorage.setItem('folio-fixed-expenses', JSON.stringify(state.fixedExpenses));
      render();
      return;
    }
    const removeIncome = event.target.closest('[data-remove-fixed-income]');
    if (removeIncome) {
      state.fixedIncomes = state.fixedIncomes.filter((item) => item.id !== removeIncome.dataset.removeFixedIncome);
      localStorage.setItem('folio-fixed-incomes', JSON.stringify(state.fixedIncomes));
      render();
    }
  });

  const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  state.journalEntries = JSON.parse(localStorage.getItem('folio-journals') || '{}');
  state.selectedJournalDate = localDateKey();
  state.selectedJournalMonth = state.selectedJournalDate.slice(0, 7);
  const previousJournal = localStorage.getItem('folio-journal') || '';
  if (previousJournal && !Object.keys(state.journalEntries).length) {
    state.journalEntries[state.selectedJournalDate] = previousJournal;
    localStorage.setItem('folio-journals', JSON.stringify(state.journalEntries));
  }
  const journalDateLabel = (key, options) => new Intl.DateTimeFormat('ko-KR', options).format(new Date(`${key}T12:00:00`));
  const journalStopWords = new Set(['그리고', '그래서', '하지만', '그런데', '오늘은', '오늘도', '정말', '너무', '조금', '그냥', '다시', '때문에', '같아서', '같았다', '했다', '하는', '하고', '있는', '있었다', '없었다', '것이', '것을', '나는', '내가', '우리는', '저는', '에서', '에게', '으로', '부터', '까지', '하며', '하면', '해서', '해도', '같은']);
  const journalEmotionTerms = {
    '기쁨·감사': ['기뻤', '행복', '즐거', '좋았', '웃었', '설레', '뿌듯', '감사', '고마웠', '사랑', '기대', '만족', '편안', '신났'],
    '슬픔·서운함': ['슬펐', '우울', '외롭', '서운', '속상', '눈물', '허전', '그리웠', '아쉬웠', '슬픔'],
    '불안·걱정': ['불안', '걱정', '초조', '두렵', '무서웠', '긴장', '떨렸', '막막', '조마조마'],
    '화·답답함': ['화났', '짜증', '분했', '억울', '답답', '싫었', '불쾌', '화가'],
    '피로·부담': ['힘들', '지쳤', '피곤', '벅찼', '스트레스', '지겨', '번아웃', '고단']
  };
  const journalInsightMarkup = (text) => {
    const normalized = String(text || '').trim();
    if (!normalized) return '<span class="muted">일기를 쓰면 감정과 자주 등장한 키워드를 정리해볼게요.</span>';
    const scores = Object.entries(journalEmotionTerms).map(([emotion, terms]) => ({ emotion, score: terms.reduce((count, term) => count + (normalized.includes(term) ? 1 : 0), 0) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    const emotionSummary = scores.length ? scores.slice(0, 2).map((item) => item.emotion).join(' · ') : '뚜렷한 감정 단어가 적어요';
    const words = normalized.match(/[가-힣A-Za-z]{2,}/g) || [];
    const counts = new Map();
    words.forEach((word) => { if (!journalStopWords.has(word)) counts.set(word, (counts.get(word) || 0) + 1); });
    const keywords = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word]) => word);
    return `<div class="insight-heading"><span>오늘의 감정 추정</span><strong>${emotionSummary}</strong></div><div class="insight-keywords"><span>키워드</span>${keywords.map((word) => `<i>${escapeHtml(word)}</i>`).join('') || '<small>조금 더 쓰면 키워드가 보여요.</small>'}</div><small class="insight-disclaimer">일기 속 단어를 바탕으로 브라우저에서 가볍게 정리한 참고용 추정이에요.</small>`;
  };
  const saveJournalDraft = () => {
    const input = document.querySelector('#daily-journal-text');
    if (input && input.value.trim() && input.value !== (state.journalEntries[state.selectedJournalDate] || '')) {
      state.journalEntries[state.selectedJournalDate] = input.value;
      localStorage.setItem('folio-journals', JSON.stringify(state.journalEntries));
    }
  };
  views.daily = () => {
    const selectedDate = state.selectedJournalDate;
    const savedDates = Object.keys(state.journalEntries).filter((date) => state.journalEntries[date]?.trim()).sort((a, b) => b.localeCompare(a));
    const months = [...new Set([...savedDates.map((date) => date.slice(0, 7)), state.selectedJournalMonth])].sort((a, b) => b.localeCompare(a));
    const monthEntries = savedDates.filter((date) => date.startsWith(state.selectedJournalMonth));
    const planetNames = ['수성', '금성', '지구', '화성', '목성', '토성', '천왕성', '해왕성', '명왕성'];
    const planetButtons = months.map((month) => { const monthNumber = Number(month.slice(5, 7)); const planetIndex = (monthNumber - 1) % planetNames.length; return `<button type="button" class="diary-planet ${month === state.selectedJournalMonth ? 'active' : ''} planet-${planetIndex}" data-open-month="${month}" aria-pressed="${month === state.selectedJournalMonth}" title="${journalDateLabel(`${month}-01`, { year: 'numeric', month: 'long' })}"><span class="planet-orb">${String(monthNumber).padStart(2, '0')}</span><small class="planet-month">${journalDateLabel(`${month}-01`, { year: 'numeric', month: 'short' })}</small></button>`; }).join('');
    const stars = monthEntries.map((date) => {
      const day = Number(date.slice(-2));
      const x = 7 + ((day * 47) % 84);
      const y = 17 + ((day * 31) % 62);
      const fullDate = journalDateLabel(date, { year: 'numeric', month: 'long', day: 'numeric' });
      return `<button type="button" class="diary-star ${date === selectedDate ? 'active' : ''}" data-open-journal="${date}" aria-label="${fullDate} 일기 열기" title="${fullDate}" style="--star-x:${x}%;--star-y:${y}%;--star-delay:${(day % 8) * 55}ms"><span class="star-orb" aria-hidden="true"></span></button>`;
    }).join('');
    const selectedMonthLabel = journalDateLabel(`${state.selectedJournalMonth}-01`, { year: 'numeric', month: 'long' });
    const hasEntry = Boolean(state.journalEntries[selectedDate]?.trim());
    const today = localDateKey();
    const journalText = state.journalEntries[selectedDate] || '';
    return `<p class="view-intro">과거의 하루도 꺼내 적고, 달마다 쌓이는 일기를 별자리처럼 모아보세요.</p><section class="journal-archive paper-card"><div class="card-head"><span class="card-title">MY DIARY UNIVERSE</span><span class="muted">${savedDates.length}개의 별</span></div><div class="diary-planets">${planetButtons}</div><div class="diary-sky"><div class="sky-caption"><span>${selectedMonthLabel}</span><small>${monthEntries.length}개의 일기</small></div>${stars || '<span class="sky-empty">아직 이 행성에 반짝이는 일기가 없어요.</span>'}</div><div class="diary-date-picker"><label for="past-diary-date">과거 날짜에 쓰기</label><input id="past-diary-date" type="date" max="${today}" value="${selectedDate}"><button type="button" class="soft-button" id="open-diary-date">이 날짜 열기</button></div></section><section class="journal-page"><div class="journal-paper"><div class="journal-date">${journalDateLabel(selectedDate, { year: 'numeric', month: 'long', day: 'numeric' })}</div><div class="journal-title">${hasEntry ? '이 일기 고치기' : '새 일기 쓰기'}</div><textarea class="journal-text" id="daily-journal-text" placeholder="이날 어떤 하루를 보냈나요?">${escapeHtml(journalText)}</textarea><section class="journal-insight" id="journal-insight" aria-live="polite">${journalInsightMarkup(journalText)}</section><div class="journal-save-row"><span class="muted">${hasEntry ? '수정 후 저장하면 이 별에 반영돼요.' : '저장하면 이 날짜에 별 하나가 추가돼요.'}</span><button class="primary-button" id="save-daily-journal">${hasEntry ? '수정 저장' : '일기 저장'}</button></div></div></section>`;
  };

  document.addEventListener('click', (event) => {
    const planet = event.target.closest('[data-open-month]');
    if (planet) {
      saveJournalDraft();
      state.selectedJournalMonth = planet.dataset.openMonth;
      const latestDate = Object.keys(state.journalEntries).filter((date) => date.startsWith(state.selectedJournalMonth) && state.journalEntries[date]?.trim()).sort((a, b) => b.localeCompare(a))[0];
      state.selectedJournalDate = latestDate || (state.selectedJournalMonth === localDateKey().slice(0, 7) ? localDateKey() : `${state.selectedJournalMonth}-01`);
      render();
      return;
    }
    const dateButton = event.target.closest('[data-open-journal]');
    if (dateButton) {
      saveJournalDraft();
      state.selectedJournalDate = dateButton.dataset.openJournal;
      state.selectedJournalMonth = state.selectedJournalDate.slice(0, 7);
      render();
      return;
    }
    if (event.target.closest('#open-diary-date')) {
      saveJournalDraft();
      const date = document.querySelector('#past-diary-date').value;
      if (!date || date > localDateKey()) return;
      state.selectedJournalDate = date;
      state.selectedJournalMonth = date.slice(0, 7);
      render();
      return;
    }
    if (event.target.closest('#save-daily-journal')) {
      const text = document.querySelector('#daily-journal-text').value.trim();
      if (!text) return;
      state.journalEntries[state.selectedJournalDate] = text;
      localStorage.setItem('folio-journals', JSON.stringify(state.journalEntries));
      render();
      const saveButton = document.querySelector('#save-daily-journal');
      if (saveButton) saveButton.textContent = '저장됨 ✓';
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.id !== 'daily-journal-text') return;
    const insight = document.querySelector('#journal-insight');
    if (insight) insight.innerHTML = journalInsightMarkup(event.target.value);
  });

  views.brain = () => {
    const entries = state.records.filter((record) => record.type === 'brain').slice().reverse();
    return `<p class="view-intro">떠오르는 생각을 편하게 적어두세요. Enter로 바로 저장하고, 줄바꿈은 Shift+Enter를 사용해요.</p><section class="paper-card brain-dump-page"><div class="card-head"><span class="card-title">BRAIN DUMP INBOX</span><span class="muted">${entries.length}개의 기록</span></div><form id="brain-dump-form"><textarea id="brain-dump-entry" placeholder="생각나는 것을 적고 Enter를 눌러 바로 저장…"></textarea><div class="brain-dump-actions"><span class="muted">Enter 저장 · Shift+Enter 줄바꿈</span><button class="primary-button" type="submit">인박스에 쌓기</button></div></form><div class="brain-dump-list">${entries.map((entry) => { const when = entry.createdAt ? new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.createdAt)) : '이전 기록'; return `<article class="brain-dump-entry"><div class="brain-entry-meta"><span>✎ 생각 메모</span><time>${when}</time></div><p>${escapeHtml(entry.text).replace(/\n/g, '<br>')}</p></article>`; }).join('') || '<div class="brain-empty">아직 쌓인 메모가 없어요. 첫 생각을 기록해보세요.</div>'}</div></section>`;
  };

  document.addEventListener('submit', (event) => {
    if (event.target.id !== 'brain-dump-form') return;
    event.preventDefault();
    const input = document.querySelector('#brain-dump-entry');
    const text = input.value.trim();
    if (!text) return;
    state.records.push({ id: `brain-${Date.now()}`, type: 'brain', category: 'voice', text, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() });
    localStorage.setItem('folio-records', JSON.stringify(state.records));
    render();
    document.querySelector('#brain-dump-entry')?.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.id === 'brain-dump-entry' && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      document.querySelector('#brain-dump-form').requestSubmit();
    }
  });

  const expenseSourceData = () => {
    const totals = new Map();
    Object.values(state.weeklyFields).forEach((fields) => {
      const amount = Number(String(fields.expense || '').replace(/[^0-9]/g, '')) || 0;
      if (!amount) return;
      const source = String(fields.expenseSource || '').trim() || '지출처 미입력';
      totals.set(source, (totals.get(source) || 0) + amount);
    });
    return [...totals.entries()].map(([source, amount]) => ({ source, amount })).sort((a, b) => b.amount - a.amount);
  };
  const renderBeforeExpenseChart = render;
  render = () => {
    renderBeforeExpenseChart();
    if (state.view !== 'money') return;
    document.querySelectorAll('.fixed-expense-form select[name="category"]').forEach((select) => {
      const selected = moneyCategories.includes(select.value) ? select.value : '';
      select.innerHTML = moneyCategoryOptions(selected);
    });
    const overview = document.querySelector('.money-overview');
    if (!overview) return;
    const sources = expenseSourceData();
    const total = sources.reduce((sum, item) => sum + item.amount, 0);
    const colors = ['#d99da4', '#93b8ce', '#91ad8b', '#b5a6c7', '#e2bf75', '#d49b75', '#86b9ad', '#9c9cae'];
    let angle = 0;
    const slices = sources.map((item, index) => {
      const end = total ? angle + item.amount / total * 100 : 0;
      const slice = `${colors[index % colors.length]} ${angle}% ${end}%`;
      angle = end;
      return slice;
    });
    const background = slices.length ? `conic-gradient(${slices.join(',')})` : 'conic-gradient(#eee9e2 0% 100%)';
    const chart = `<section class="paper-card expense-source-card"><div class="card-head"><span class="card-title">SPENDING BY MERCHANT</span><span class="muted">Weekly 입력 지출처 기준</span></div><div class="expense-source-content"><div class="expense-donut" style="--donut-background:${background}"><div><strong>₩${total.toLocaleString()}</strong><small>총 지출</small></div></div><div class="expense-source-legend">${sources.map((item, index) => `<div class="source-legend-row"><span class="source-color" style="--source-color:${colors[index % colors.length]}"></span><span class="source-name">${escapeHtml(item.source)}</span><strong>₩${item.amount.toLocaleString()}</strong><small>${total ? (item.amount / total * 100).toFixed(1) : '0.0'}%</small></div>`).join('') || '<p class="money-empty">Weekly에 지출 금액과 지출처를 입력하면 금액 비중이 여기에 보여요.</p>'}</div></div></section>`;
    overview.insertAdjacentHTML('afterend', chart);
  };

  render();
})();
