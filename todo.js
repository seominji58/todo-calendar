// 로그인 확인: 로그인하지 않았으면 로그인 화면으로 이동
const currentUser = localStorage.getItem("currentUser");
if (!currentUser) {
  location.href = "index.html";
}

// 사용자별로 일정 목록을 따로 저장 (키: "todos_아이디")
const STORAGE_KEY = "todos_" + currentUser;

/*
  일정 하나의 구조
  {
    id: 1731800000000,          // 고유 번호 (만든 시각)
    text: "자료구조 과제",
    createdAt: "2026-11-17 10:30", // 일정을 추가한 날짜/시간 (자동 기록)
    start: "2026-11-17",          // 작업 시작일
    end: "2026-11-20",            // 마감일 (언제까지)
    done: false
  }
*/

const DAY = 24 * 60 * 60 * 1000;

// Date → "YYYY-MM-DD" (toISOString은 UTC 기준이라 한국 시간에서 날짜가 밀릴 수 있어 직접 만듦)
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Date → "YYYY-MM-DD HH:mm"
function fmtDateTime(d) {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${fmt(d)} ${h}:${min}`;
}

// "YYYY-MM-DD" → Date (자정 기준)
function parse(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "2026-11-17" → "11/17"
function short(str) {
  return str.slice(5).replace("-", "/");
}

const todayStr = fmt(new Date());

// 저장된 데이터 불러오기 + 예전 형식(date 하나만 있던 것) 변환
let todos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").map((t) => {
  const created = t.createdAt || fmtDateTime(new Date(t.id));
  const start = t.start || t.date || created.slice(0, 10);
  const end = t.end || t.date || start;
  return { id: t.id, text: t.text, createdAt: created, start, end, done: !!t.done };
});

let filter = "all";        // all | active | done
let selectedDate = null;   // 캘린더에서 선택한 날짜 (null이면 전체)
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth(); // 0~11

const addForm = document.getElementById("addForm");
const todoInput = document.getElementById("todoInput");
const startInput = document.getElementById("startInput");
const endInput = document.getElementById("endInput");
const formMsg = document.getElementById("formMsg");
const todoList = document.getElementById("todoList");
const countEl = document.getElementById("count");
const filterBtns = document.querySelectorAll(".filters button");
const calDays = document.getElementById("calDays");
const monthLabel = document.getElementById("monthLabel");
const listTitle = document.getElementById("listTitle");
const clearDateBtn = document.getElementById("clearDateBtn");

document.getElementById("welcome").textContent = currentUser + "님, 환영합니다!";
startInput.value = todayStr;
endInput.value = todayStr;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// 해당 날짜가 일정 기간(start ~ end) 안에 있는지
function inRange(todo, dateStr) {
  return todo.start <= dateStr && dateStr <= todo.end;
}

// 마감까지 남은 상태 계산 → { label, cls }
function dueStatus(todo) {
  if (todo.done) return { label: "완료", cls: "st-done" };
  const diff = Math.round((parse(todo.end) - parse(todayStr)) / DAY);
  if (diff < 0) return { label: `기한 ${-diff}일 지남`, cls: "st-over" };
  if (diff === 0) return { label: "오늘 마감", cls: "st-today" };
  if (diff === 1) return { label: "D-1", cls: "st-d1" };
  if (todo.start > todayStr) return { label: `D-${diff} (시작 전)`, cls: "st-wait" };
  return { label: `D-${diff}`, cls: "st-normal" };
}

// 기간 검사: 마감일이 시작일보다 빠르면 안 됨
function validRange(start, end) {
  return start && end && start <= end;
}

// ---------- 기능 (추가 / 완료 / 수정 / 삭제) ----------
function addTodo(text, start, end) {
  const now = new Date();
  todos.push({
    id: now.getTime(),
    text,
    createdAt: fmtDateTime(now),
    start,
    end,
    done: false,
  });
  save();
  render();
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (todo) todo.done = !todo.done;
  save();
  render();
}

function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  save();
  render();
}

function updateTodo(id, text, start, end) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  todo.text = text;
  todo.start = start;
  todo.end = end;
  save();
  render();
}

// 마감일 빠른 순 정렬 (완료된 일정은 뒤로)
function sortedTodos(list) {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.end.localeCompare(b.end) || a.start.localeCompare(b.start) || a.id - b.id;
  });
}

// ---------- 캘린더 그리기 ----------
function renderCalendar() {
  calDays.innerHTML = "";
  monthLabel.textContent = `${viewYear}년 ${viewMonth + 1}월`;

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();       // 1일의 요일
  const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();  // 그 달의 마지막 날

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("div");
    blank.className = "cal-day blank";
    calDays.appendChild(blank);
  }

  for (let d = 1; d <= lastDate; d++) {
    const dateStr = fmt(new Date(viewYear, viewMonth, d));
    const dayTodos = sortedTodos(todos.filter((t) => inRange(t, dateStr)));
    const weekday = (firstDay + d - 1) % 7;

    const cell = document.createElement("div");
    cell.className = "cal-day";
    if (weekday === 0) cell.classList.add("sun");
    if (weekday === 6) cell.classList.add("sat");
    if (dateStr === todayStr) cell.classList.add("today");
    if (dateStr === selectedDate) cell.classList.add("selected");
    if (dayTodos.length > 0) cell.classList.add("has-todo");

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = d;
    cell.appendChild(num);

    // 칸에는 최대 2개까지 보여주고 나머지는 +N
    // 기간 일정은 시작일~마감일 모든 칸에 표시되고, 마감일 칸에는 "마감" 표시
    dayTodos.slice(0, 2).forEach((t) => {
      const item = document.createElement("div");
      item.className = "cal-item";
      // 색상: 완료=초록 / 기한 지남·D-1=빨강 / 마감일(오늘 마감 포함)=주황
      const st = dueStatus(t).cls;
      if (st === "st-done") item.classList.add("done");
      else if (st === "st-over" || st === "st-d1") item.classList.add("red");
      else if (st === "st-today" || dateStr === t.end) item.classList.add("due");
      if (t.start !== t.end) {
        if (dateStr === t.start) item.classList.add("bar-start");
        else if (dateStr === t.end) item.classList.add("bar-end");
        else item.classList.add("bar-mid");
      }
      item.textContent = (dateStr === t.end && t.start !== t.end ? "[마감] " : "") + t.text;
      item.title = `${t.text}\n기간: ${t.start} ~ ${t.end}\n추가일: ${t.createdAt}`;
      cell.appendChild(item);
    });
    if (dayTodos.length > 2) {
      const more = document.createElement("div");
      more.className = "cal-more";
      more.textContent = `+${dayTodos.length - 2}개`;
      cell.appendChild(more);
    }

    // 날짜 클릭 → 그 날짜 선택 (다시 클릭하면 선택 해제)
    cell.addEventListener("click", () => {
      selectedDate = selectedDate === dateStr ? null : dateStr;
      if (selectedDate) {
        startInput.value = selectedDate;
        if (endInput.value < selectedDate) endInput.value = selectedDate;
      }
      render();
      if (selectedDate) todoInput.focus();
    });

    calDays.appendChild(cell);
  }
}

// ---------- 목록 그리기 ----------
function renderList() {
  todoList.innerHTML = "";

  if (selectedDate) {
    const [y, m, d] = selectedDate.split("-");
    listTitle.textContent = `${y}년 ${Number(m)}월 ${Number(d)}일에 진행 중인 일정`;
    clearDateBtn.style.display = "inline";
  } else {
    listTitle.textContent = "전체 일정";
    clearDateBtn.style.display = "none";
  }

  const base = selectedDate ? todos.filter((t) => inRange(t, selectedDate)) : todos;
  const visible = sortedTodos(
    base.filter((t) => (filter === "done" ? t.done : filter === "active" ? !t.done : true))
  );

  if (visible.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "일정이 없습니다.";
    todoList.appendChild(empty);
  }

  visible.forEach((todo) => todoList.appendChild(makeItem(todo)));

  const left = base.filter((t) => !t.done).length;
  countEl.textContent = `남은 일정 ${left}개 / 전체 ${base.length}개`;
}

// 목록의 일정 한 줄 만들기
function makeItem(todo) {
  const li = document.createElement("li");
  if (todo.done) li.classList.add("done");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = todo.done;
  checkbox.title = "완료 체크";
  checkbox.addEventListener("change", () => toggleTodo(todo.id));

  const body = document.createElement("div");
  body.className = "item-body";

  const top = document.createElement("div");
  top.className = "item-top";

  const span = document.createElement("span");
  span.className = "text";
  span.textContent = todo.text; // textContent 사용 → HTML 주입 방지
  span.title = "더블클릭하여 수정";
  span.addEventListener("dblclick", () => startEdit(li, todo));

  const st = dueStatus(todo);
  if (st.cls === "st-done") li.classList.add("row-done");
  else if (st.cls === "st-d1" || st.cls === "st-over") li.classList.add("row-red");
  else if (st.cls === "st-today") li.classList.add("row-due");

  const badge = document.createElement("span");
  badge.className = "status " + st.cls;
  badge.textContent = st.label;

  top.append(span, badge);

  const meta = document.createElement("div");
  meta.className = "item-meta";
  const days = Math.round((parse(todo.end) - parse(todo.start)) / DAY) + 1;
  const period = todo.start === todo.end
    ? `${short(todo.end)} 까지 (하루)`
    : `${short(todo.start)} ~ ${short(todo.end)} 까지 (${days}일간)`;
  meta.textContent = `기간: ${period} · 추가일: ${todo.createdAt}`;

  body.append(top, meta);

  const editBtn = document.createElement("button");
  editBtn.textContent = "수정";
  editBtn.addEventListener("click", () => startEdit(li, todo));

  const delBtn = document.createElement("button");
  delBtn.textContent = "삭제";
  delBtn.addEventListener("click", () => {
    if (confirm(`"${todo.text}" 일정을 삭제할까요?`)) deleteTodo(todo.id);
  });

  li.append(checkbox, body, editBtn, delBtn);
  return li;
}

// 수정 모드: 내용 / 시작일 / 마감일을 입력창으로 바꾸기
function startEdit(li, todo) {
  li.innerHTML = "";
  li.classList.add("editing");

  const textEdit = document.createElement("input");
  textEdit.type = "text";
  textEdit.className = "edit-input";
  textEdit.value = todo.text;

  const startEditInput = document.createElement("input");
  startEditInput.type = "date";
  startEditInput.className = "edit-date";
  startEditInput.value = todo.start;

  const tilde = document.createElement("span");
  tilde.textContent = "~";

  const endEditInput = document.createElement("input");
  endEditInput.type = "date";
  endEditInput.className = "edit-date";
  endEditInput.value = todo.end;

  const createdInfo = document.createElement("span");
  createdInfo.className = "item-meta";
  createdInfo.textContent = `추가일: ${todo.createdAt}`;

  const err = document.createElement("span");
  err.className = "msg";

  const doSave = () => {
    const text = textEdit.value.trim();
    if (!text) return (err.textContent = "내용을 입력하세요.");
    if (!validRange(startEditInput.value, endEditInput.value))
      return (err.textContent = "마감일은 시작일 이후여야 합니다.");
    updateTodo(todo.id, text, startEditInput.value, endEditInput.value);
  };

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "저장";
  saveBtn.className = "save-btn";
  saveBtn.addEventListener("click", doSave);

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "취소";
  cancelBtn.addEventListener("click", render);

  [textEdit, startEditInput, endEditInput].forEach((input) =>
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSave();
      if (e.key === "Escape") render();
    })
  );

  const row1 = document.createElement("div");
  row1.className = "edit-row";
  row1.append(textEdit);

  const row2 = document.createElement("div");
  row2.className = "edit-row";
  row2.append(startEditInput, tilde, endEditInput, saveBtn, cancelBtn);

  const row3 = document.createElement("div");
  row3.className = "edit-row";
  row3.append(createdInfo, err);

  li.append(row1, row2, row3);
  textEdit.focus();
}

function render() {
  renderCalendar();
  renderList();
}

// ---------- 이벤트 ----------
// 시작일을 마감일보다 뒤로 바꾸면 마감일도 같이 맞춰줌
startInput.addEventListener("change", () => {
  if (endInput.value < startInput.value) endInput.value = startInput.value;
});

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  formMsg.textContent = "";
  if (!text) return (formMsg.textContent = "할 일을 입력하세요.");
  if (!validRange(startInput.value, endInput.value))
    return (formMsg.textContent = "시작일과 마감일을 확인하세요. (마감일 ≥ 시작일)");

  addTodo(text, startInput.value, endInput.value);

  // 추가한 일정의 시작 달로 캘린더 이동
  const [y, m] = startInput.value.split("-").map(Number);
  viewYear = y;
  viewMonth = m - 1;
  render();

  todoInput.value = "";
  todoInput.focus();
});

document.getElementById("prevMonth").addEventListener("click", () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});

document.getElementById("todayBtn").addEventListener("click", () => {
  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth();
  selectedDate = todayStr;
  startInput.value = todayStr;
  if (endInput.value < todayStr) endInput.value = todayStr;
  render();
});

clearDateBtn.addEventListener("click", () => {
  selectedDate = null;
  render();
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.filter;
    renderList();
  });
});

document.getElementById("clearDoneBtn").addEventListener("click", () => {
  if (!todos.some((t) => t.done)) return;
  if (!confirm("완료된 일정을 모두 삭제할까요?")) return;
  todos = todos.filter((t) => !t.done);
  save();
  render();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("currentUser");
  location.href = "index.html";
});

save(); // 예전 형식 데이터를 새 형식으로 저장
render();
