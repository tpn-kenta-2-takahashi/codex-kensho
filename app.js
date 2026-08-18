const STORAGE_KEY = "hitomazu-task-note-v1";
const LAYOUT_KEY = "hitomazu-task-note-layout-v1";

const periods = [
  { id: "today", name: "今日" },
  { id: "week", name: "今週" },
  { id: "month", name: "今月" },
  { id: "someday", name: "いつか" },
  { id: "free", name: "暇なとき" },
  { id: "habit", name: "習慣" },
  { id: "unsorted", name: "未整理" },
];

const priorities = [
  { id: "important", name: "大事", weight: 0 },
  { id: "normal", name: "ふつう", weight: 1 },
  { id: "low", name: "低め", weight: 2 },
];

let state = loadState();
let currentView = { type: "period", id: "today" };
let selectedTaskId = state.tasks[0]?.id || null;
let searchText = "";

const els = {
  workspace: document.querySelector("#workspace"),
  periodNav: document.querySelector("#periodNav"),
  customListNav: document.querySelector("#customListNav"),
  quickAddForm: document.querySelector("#quickAddForm"),
  quickAddInput: document.querySelector("#quickAddInput"),
  searchInput: document.querySelector("#searchInput"),
  taskList: document.querySelector("#taskList"),
  completedList: document.querySelector("#completedList"),
  completedSection: document.querySelector("#completedSection"),
  emptyState: document.querySelector("#emptyState"),
  sampleButton: document.querySelector("#sampleButton"),
  viewKind: document.querySelector("#viewKind"),
  viewTitle: document.querySelector("#viewTitle"),
  taskCount: document.querySelector("#taskCount"),
  detailPane: document.querySelector("#detailPane"),
  addListButton: document.querySelector("#addListButton"),
  menuButton: document.querySelector("#menuButton"),
  menuPanel: document.querySelector("#menuPanel"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  helpButton: document.querySelector("#helpButton"),
  helpDialog: document.querySelector("#helpDialog"),
};

applySavedLayout();
bindColumnResizers();
syncSelectionToCurrentView();
render();

els.quickAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = els.quickAddInput.value.trim();
  if (!title) return;

  const task = createTask(title);
  if (currentView.type === "period") {
    task.period = currentView.id;
  } else {
    task.period = "unsorted";
    task.listId = currentView.id;
  }

  state.tasks.push(task);
  selectedTaskId = task.id;
  els.quickAddInput.value = "";
  persistAndRender();
});

els.searchInput.addEventListener("input", (event) => {
  searchText = event.target.value.trim().toLowerCase();
  syncSelectionToCurrentView();
  render();
});

els.addListButton.addEventListener("click", () => {
  const name = prompt("リスト名を入力してください");
  if (!name?.trim()) return;
  const list = { id: makeId("list"), name: name.trim() };
  state.lists.push(list);
  currentView = { type: "list", id: list.id };
  persistAndRender();
});

els.menuButton.addEventListener("click", () => {
  els.menuPanel.classList.toggle("hidden");
});

els.exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hitomazu-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  els.menuPanel.classList.add("hidden");
});

els.importInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported.tasks) || !Array.isArray(imported.lists)) {
      throw new Error("invalid shape");
    }
    if (!confirm("現在のデータを読み込んだデータで置き換えます。よろしいですか？")) return;
    state = normalizeState(imported);
    selectedTaskId = state.tasks[0]?.id || null;
    persistAndRender();
  } catch {
    alert("読み込めないJSONファイルです。");
  } finally {
    event.target.value = "";
    els.menuPanel.classList.add("hidden");
  }
});

els.helpButton.addEventListener("click", () => {
  els.menuPanel.classList.add("hidden");
  els.helpDialog.showModal();
});

els.sampleButton.addEventListener("click", () => {
  const list = { id: makeId("list"), name: "Claude環境作成" };
  state.lists.push(list);
  state.tasks.push({
    ...createTask("Claudeの環境作成"),
    period: "week",
    listId: list.id,
    priority: "important",
    memo: "参考URLや作業メモをここにまとめておけます。",
    subtasks: [
      { id: makeId("sub"), title: "フォルダ構成を学ぶ", done: false },
      { id: makeId("sub"), title: "実際に使える環境にしていく", done: false },
      { id: makeId("sub"), title: "pptxを作らせる", done: false },
    ],
  });
  currentView = { type: "period", id: "week" };
  selectedTaskId = state.tasks.at(-1).id;
  persistAndRender();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
    event.preventDefault();
    els.searchInput.focus();
  }
  if (event.key === "Escape") {
    els.menuPanel.classList.add("hidden");
    if (els.helpDialog.open) els.helpDialog.close();
  }
});

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeState(JSON.parse(saved));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return { lists: [], tasks: [] };
}

function normalizeState(value) {
  return {
    lists: Array.isArray(value.lists) ? value.lists : [],
    tasks: Array.isArray(value.tasks)
      ? value.tasks.map((task) => ({
          id: task.id || makeId("task"),
          title: task.title || "",
          period: task.period || "unsorted",
          listId: task.listId || "",
          priority: task.priority || "normal",
          done: Boolean(task.done),
          memo: task.memo || "",
          subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
          dueDate: task.dueDate || "",
          createdAt: task.createdAt || now(),
          updatedAt: task.updatedAt || now(),
          completedAt: task.completedAt || null,
        }))
      : [],
  };
}

function createTask(title) {
  const timestamp = now();
  return {
    id: makeId("task"),
    title,
    period: "unsorted",
    listId: "",
    priority: "normal",
    done: false,
    memo: "",
    subtasks: [],
    dueDate: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };
}

function persistAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function render() {
  renderNav();
  renderTaskCollections();
  renderDetail();
}

function renderTaskCollections() {
  const visible = getVisibleTasks();
  const openTasks = visible.filter((task) => !task.done).sort(compareTasks);
  const completedToday = visible.filter((task) => task.done && isToday(task.completedAt)).sort(compareUpdated);

  els.viewTitle.textContent = getViewName();
  els.viewKind.textContent = currentView.type === "period" ? "時期" : "リスト";
  els.taskCount.textContent = `${openTasks.length}件`;
  els.emptyState.classList.toggle("hidden", openTasks.length > 0 || completedToday.length > 0);
  els.taskList.innerHTML = openTasks.map(renderTaskCard).join("");
  els.completedList.innerHTML = completedToday.map(renderTaskCard).join("");
  els.completedSection.classList.toggle("hidden", completedToday.length === 0);
  bindTaskCards();
}

function renderNav() {
  els.periodNav.innerHTML = periods
    .map((period) => navButton("period", period.id, period.name, countFor("period", period.id)))
    .join("");
  els.customListNav.innerHTML = state.lists.length
    ? state.lists.map((list) => navButton("list", list.id, list.name, countFor("list", list.id))).join("")
    : `<p class="muted">まだリストはありません。</p>`;

  document.querySelectorAll("[data-nav-type]").forEach((button) => {
    button.addEventListener("click", () => {
      currentView = { type: button.dataset.navType, id: button.dataset.navId };
      syncSelectionToCurrentView();
      render();
    });
  });
}

function navButton(type, id, name, count) {
  const active = currentView.type === type && currentView.id === id ? " active" : "";
  return `<button class="nav-item${active}" type="button" data-nav-type="${type}" data-nav-id="${id}">
    <span>${escapeHtml(name)}</span><span class="nav-count">${count}</span>
  </button>`;
}

function countFor(type, id) {
  return state.tasks.filter((task) => !task.done && matchesView(task, { type, id })).length;
}

function getVisibleTasks() {
  return state.tasks.filter((task) => {
    if (task.done && !isToday(task.completedAt)) return false;
    if (!matchesView(task, currentView)) return false;
    if (!searchText) return true;
    return taskMatchesSearch(task);
  });
}

function syncSelectionToCurrentView() {
  const visibleOpenTasks = getVisibleTasks().filter((task) => !task.done).sort(compareTasks);
  const selectedIsVisible = selectedTaskId && visibleOpenTasks.some((task) => task.id === selectedTaskId);
  selectedTaskId = selectedIsVisible ? selectedTaskId : visibleOpenTasks[0]?.id || null;
}

function matchesView(task, view) {
  return view.type === "period" ? task.period === view.id : task.listId === view.id;
}

function taskMatchesSearch(task) {
  const listName = state.lists.find((list) => list.id === task.listId)?.name || "";
  const haystack = [
    task.title,
    task.memo,
    listName,
    ...task.subtasks.map((subtask) => subtask.title),
  ].join(" ").toLowerCase();
  return haystack.includes(searchText);
}

function renderTaskCard(task) {
  const list = state.lists.find((item) => item.id === task.listId);
  const period = periods.find((item) => item.id === task.period);
  const priority = priorities.find((item) => item.id === task.priority) || priorities[1];
  const doneCount = task.subtasks.filter((subtask) => subtask.done).length;
  const excerpt = task.memo || task.subtasks.map((subtask) => subtask.title).join(" / ");
  const selected = selectedTaskId === task.id ? " selected" : "";
  const done = task.done ? " done" : "";

  return `<button class="task-card${selected}${done}" type="button" data-task-id="${task.id}">
    <span class="task-main">
      <span class="check" data-check="${task.id}"></span>
      <span class="task-title">${escapeHtml(task.title || "無題")}</span>
    </span>
    ${excerpt ? `<span class="task-excerpt">${escapeHtml(truncate(excerpt, 78))}</span>` : ""}
    <span class="task-meta">
      <span class="pill priority-${priority.id}">${priority.name}</span>
      ${task.dueDate ? `<span class="pill ${isOverdue(task.dueDate) ? "due-overdue" : ""}">${formatDue(task.dueDate)}</span>` : ""}
      <span class="pill">${period?.name || "未整理"}</span>
      ${list ? `<span class="pill">${escapeHtml(list.name)}</span>` : ""}
      ${task.subtasks.length ? `<span>${doneCount}/${task.subtasks.length}</span>` : ""}
    </span>
  </button>`;
}

function bindTaskCards() {
  document.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      const checkTarget = event.target.closest("[data-check]");
      if (checkTarget) {
        toggleTaskDone(checkTarget.dataset.check);
        return;
      }
      selectedTaskId = card.dataset.taskId;
      render();
    });
  });
}

function renderDetail() {
  const task = state.tasks.find((item) => item.id === selectedTaskId);
  if (!task) {
    els.detailPane.className = "detail-pane empty";
    els.detailPane.innerHTML = `<p class="empty-detail">タスクを選ぶと、ここで詳しく編集できます。</p>`;
    return;
  }

  els.detailPane.className = "detail-pane";
  els.detailPane.innerHTML = `<form class="detail-form">
    <div class="field">
      <label for="detailTitle">タイトル</label>
      <input id="detailTitle" value="${escapeAttribute(task.title)}" />
    </div>
    <div class="field">
      <label for="detailMemo">メモ</label>
      <textarea id="detailMemo">${escapeHtml(task.memo)}</textarea>
    </div>
    <div class="subtasks">
      <h3>小さな手順</h3>
      <div id="subtaskList">
        ${task.subtasks.map((subtask) => renderSubtask(subtask)).join("")}
      </div>
      <div class="subtask-input">
        <input id="subtaskTitle" type="text" placeholder="手順を追加" />
        <button id="addSubtaskButton" type="button">追加</button>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="detailPeriod">時期</label>
        <select id="detailPeriod">${periods.map((period) => option(period.id, period.name, task.period)).join("")}</select>
      </div>
      <div class="field">
        <label for="detailPriority">優先度</label>
        <select id="detailPriority">${priorities.map((priority) => option(priority.id, priority.name, task.priority)).join("")}</select>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="detailList">リスト</label>
        <select id="detailList">
          <option value="">なし</option>
          ${state.lists.map((list) => option(list.id, list.name, task.listId)).join("")}
        </select>
      </div>
      <div class="field">
        <label for="detailDue">期限</label>
        <input id="detailDue" type="date" value="${escapeAttribute(task.dueDate)}" />
      </div>
    </div>
    <p class="date-note">作成: ${formatDateTime(task.createdAt)}<br />更新: ${formatDateTime(task.updatedAt)}</p>
    <button id="deleteTaskButton" class="danger-button" type="button">削除</button>
  </form>`;

  bindDetail(task);
}

function renderSubtask(subtask) {
  return `<div class="subtask" data-subtask-id="${subtask.id}">
    <input type="checkbox" ${subtask.done ? "checked" : ""} aria-label="完了" />
    <input type="text" value="${escapeAttribute(subtask.title)}" />
    <button type="button" aria-label="削除">x</button>
  </div>`;
}

function bindDetail(task) {
  bindField("#detailTitle", "input", (value) => updateTask(task.id, { title: value }));
  bindField("#detailMemo", "input", (value) => updateTask(task.id, { memo: value }));
  bindField("#detailPeriod", "change", (value) => updateTask(task.id, { period: value }));
  bindField("#detailPriority", "change", (value) => updateTask(task.id, { priority: value }));
  bindField("#detailList", "change", (value) => updateTask(task.id, { listId: value }));
  bindField("#detailDue", "change", (value) => updateTask(task.id, { dueDate: value }));

  document.querySelectorAll(".subtask").forEach((row) => {
    const subtaskId = row.dataset.subtaskId;
    row.querySelector('input[type="checkbox"]').addEventListener("change", (event) => {
      mutateSubtask(task.id, subtaskId, { done: event.target.checked });
    });
    row.querySelector('input[type="text"]').addEventListener("input", (event) => {
      mutateSubtask(task.id, subtaskId, { title: event.target.value });
    });
    row.querySelector("button").addEventListener("click", () => {
      const target = state.tasks.find((item) => item.id === task.id);
      target.subtasks = target.subtasks.filter((subtask) => subtask.id !== subtaskId);
      touch(target);
      persistAndRender();
    });
  });

  document.querySelector("#addSubtaskButton").addEventListener("click", addSubtaskFromInput);
  document.querySelector("#subtaskTitle").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSubtaskFromInput();
    }
  });
  document.querySelector("#deleteTaskButton").addEventListener("click", () => {
    if (!confirm("このタスクを削除しますか？")) return;
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    syncSelectionToCurrentView();
    persistAndRender();
  });

  function addSubtaskFromInput() {
    const input = document.querySelector("#subtaskTitle");
    const title = input.value.trim();
    if (!title) return;
    const target = state.tasks.find((item) => item.id === task.id);
    target.subtasks.push({ id: makeId("sub"), title, done: false });
    input.value = "";
    touch(target);
    persistAndRender();
  }
}

function bindField(selector, eventName, handler) {
  document.querySelector(selector).addEventListener(eventName, (event) => {
    handler(event.target.value);
  });
}

function updateTask(id, patch) {
  const task = state.tasks.find((item) => item.id === id);
  Object.assign(task, patch);
  touch(task);
  if ("period" in patch || "listId" in patch) {
    syncSelectionToCurrentView();
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderNav();
  renderTaskCollections();
}

function mutateSubtask(taskId, subtaskId, patch) {
  const task = state.tasks.find((item) => item.id === taskId);
  const subtask = task.subtasks.find((item) => item.id === subtaskId);
  Object.assign(subtask, patch);
  touch(task);
  persistAndRender();
}

function toggleTaskDone(id) {
  const task = state.tasks.find((item) => item.id === id);
  task.done = !task.done;
  task.completedAt = task.done ? now() : null;
  touch(task);
  persistAndRender();
}

function compareTasks(a, b) {
  return dueRank(a) - dueRank(b)
    || priorityRank(a) - priorityRank(b)
    || new Date(b.updatedAt) - new Date(a.updatedAt);
}

function compareUpdated(a, b) {
  return new Date(b.updatedAt) - new Date(a.updatedAt);
}

function dueRank(task) {
  if (!task.dueDate) return 10;
  const diff = dayDiff(task.dueDate);
  if (diff < 0) return 0;
  if (diff === 0) return 1;
  if (diff === 1) return 2;
  return 3 + Math.min(diff, 6);
}

function priorityRank(task) {
  return priorities.find((priority) => priority.id === task.priority)?.weight ?? 1;
}

function getViewName() {
  if (currentView.type === "period") return periods.find((item) => item.id === currentView.id)?.name || "未整理";
  return state.lists.find((item) => item.id === currentView.id)?.name || "リスト";
}

function option(id, name, selected) {
  return `<option value="${escapeAttribute(id)}" ${id === selected ? "selected" : ""}>${escapeHtml(name)}</option>`;
}

function touch(task) {
  task.updatedAt = now();
}

function now() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
}

function isToday(value) {
  if (!value) return false;
  return new Date(value).toDateString() === new Date().toDateString();
}

function dayDiff(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

function isOverdue(dateString) {
  return dayDiff(dateString) < 0;
}

function formatDue(dateString) {
  const diff = dayDiff(dateString);
  if (diff < 0) return "期限切れ";
  if (diff === 0) return "今日";
  if (diff === 1) return "明日";
  const date = new Date(`${dateString}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function truncate(value, length) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function applySavedLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}");
    if (Number.isFinite(saved.left)) {
      els.workspace.style.setProperty("--left-col", `${saved.left}px`);
    }
    if (Number.isFinite(saved.right)) {
      els.workspace.style.setProperty("--right-col", `${saved.right}px`);
    }
  } catch {
    localStorage.removeItem(LAYOUT_KEY);
  }
}

function bindColumnResizers() {
  document.querySelectorAll("[data-resizer]").forEach((resizer) => {
    resizer.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const side = resizer.dataset.resizer;
      const startX = event.clientX;
      const styles = getComputedStyle(els.workspace);
      const startLeft = Number.parseInt(styles.getPropertyValue("--left-col"), 10);
      const startRight = Number.parseInt(styles.getPropertyValue("--right-col"), 10);
      resizer.classList.add("dragging");
      resizer.setPointerCapture(event.pointerId);

      const onMove = (moveEvent) => {
        if (side === "left") {
          setColumnWidth("left", clamp(startLeft + moveEvent.clientX - startX, 170, 360));
        } else {
          setColumnWidth("right", clamp(startRight - moveEvent.clientX + startX, 300, 720));
        }
      };

      const onUp = () => {
        resizer.classList.remove("dragging");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        saveLayout();
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  });
}

function setColumnWidth(side, width) {
  els.workspace.style.setProperty(side === "left" ? "--left-col" : "--right-col", `${width}px`);
}

function saveLayout() {
  const styles = getComputedStyle(els.workspace);
  localStorage.setItem(LAYOUT_KEY, JSON.stringify({
    left: Number.parseInt(styles.getPropertyValue("--left-col"), 10),
    right: Number.parseInt(styles.getPropertyValue("--right-col"), 10),
  }));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
