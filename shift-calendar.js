// ======================== КАЛЕНДАРЬ СМЕН ========================

let calendarMonth = new Date().getMonth();
let calendarYear  = new Date().getFullYear();

const SHIFT_COLORS = {
  'A': { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  'B': { bg: '#fed7aa', border: '#f59e0b', text: '#9a3412' },
  'C': { bg: '#e9d5ff', border: '#8b5cf6', text: '#5b21b6' }
};

function renderShiftCalendar() {
  const cont = document.getElementById('shiftCalendarContent');
  const title = document.getElementById('shiftCalendarTitle');
  if (!cont) return;

  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                      'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  if (title) title.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

  const section = getCurrentSection();
  const posts = section.posts || [];
  const todayStr = formatDate();

  const firstDay = new Date(calendarYear, calendarMonth, 1);
  let startDow = firstDay.getDay();
  if (startDow === 0) startDow = 6; else startDow -= 1;

  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  let html = '<div class="cal-grid">';
  weekdays.forEach(d => {
    html += `<div class="cal-weekday">${d}</div>`;
  });

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDow + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      html += '<div class="cal-day cal-day-empty"></div>';
      continue;
    }
    const dateObj = new Date(calendarYear, calendarMonth, dayNum);
    const dateStr = formatDate(dateObj);
    const dow = dateObj.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isToday = dateStr === todayStr;

    const shiftDataList = SHIFTS.map(sh => {
      const shiftData = section.shifts[sh];
      if (!shiftData) return { shift: sh, ops: 0, present: 0, filled: 0, total: posts.length };
      const realOps = (shiftData.operators || []).filter(o => o.role !== 'НУ');
      const day = shiftData.days?.[dateStr];
      let present = 0;
      realOps.forEach(o => {
        if ((day?.attendance?.[o.id] || 'Я') === 'Я') present++;
      });
      let filled = 0;
      posts.forEach(p => {
        const list = day ? normalizeAssignment(day.assignments?.[p.id]) : [];
        if (list.length > 0) filled++;
      });
      return { shift: sh, ops: realOps.length, present, filled, total: posts.length };
    });

    const cls = 'cal-day' + (isWeekend ? ' cal-weekend' : '') + (isToday ? ' cal-today' : '');
    html += `<div class="${cls}" onclick="openCalendarDay('${escapeAttr(dateStr)}')">`;
    html += `<div class="cal-day-num">${dayNum}</div>`;
    html += '<div class="cal-shifts">';
    shiftDataList.forEach(sd => {
      const col = SHIFT_COLORS[sd.shift];
      const pct = sd.total ? Math.round((sd.filled / sd.total) * 100) : 0;
      const title = `Смена ${sd.shift}: ${sd.present}/${sd.ops} явка · ${sd.filled}/${sd.total} постов`;
      // ← ПРАВКА (задача №9): клик по строке смены открывает расстановку для этой смены
      html += `<div class="cal-shift-row" style="background:${col.bg};border-left:3px solid ${col.border};color:${col.text};" title="${title}" onclick="event.stopPropagation(); openCalendarDay('${escapeAttr(dateStr)}', '${sd.shift}')">`;
      html += `<span class="cal-shift-label">${sd.shift}</span>`;
      html += `<span class="cal-shift-stat">${sd.present}/${sd.ops}</span>`;
      html += `<span class="cal-shift-stat">${pct}%</span>`;
      html += `</div>`;
    });
    html += '</div>';
    html += '</div>';
  }
  html += '</div>';

  cont.innerHTML = html;
}

function calPrevMonth() {
  calendarMonth--;
  if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
  renderShiftCalendar();
}
function calNextMonth() {
  calendarMonth++;
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
  renderShiftCalendar();
}
function calToday() {
  const now = new Date();
  calendarMonth = now.getMonth();
  calendarYear = now.getFullYear();
  renderShiftCalendar();
}

// ← ПРАВКА (задача №9): добавлен необязательный параметр shift
function openCalendarDay(dateStr, shift) {
  setCurrentDate(dateStr);
  if (shift) setCurrentShift(shift);
  const se8Btn = Array.from(document.querySelectorAll('.tab')).find(t =>
    t.textContent.includes('Расстановка')
  );
  if (se8Btn) se8Btn.click();
  refreshAll();
}