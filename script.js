const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const priorityInput = document.getElementById("priorityInput");
const dateInput = document.getElementById("dateInput");
const timeInput = document.getElementById("timeInput");
const searchInput = document.getElementById("searchInput");
const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");

const totalTasks = document.getElementById("totalTasks");
const completedTasks = document.getElementById("completedTasks");
const pendingTasks = document.getElementById("pendingTasks");
const missedTasks = document.getElementById("missedTasks");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");

const filterButtons = document.querySelectorAll(".filter-btn");
const soundToggleBtn = document.getElementById("soundToggleBtn");

let currentFilter = "all";
let audioContext = null;

let soundEnabled = JSON.parse(localStorage.getItem("soundEnabled"));
if (soundEnabled === null) {
  soundEnabled = true;
}

let tasks = JSON.parse(localStorage.getItem("smartTaskPlannerTasks")) || [];

/*
  This normalizes old saved tasks from earlier versions.
  So your app will not break if localStorage has older task structures.
*/
tasks = tasks.map(task => {
  return {
    id: task.id || Date.now() + Math.random(),
    title: task.title || task.text || "Untitled Task",
    priority: task.priority || "Medium",
    dueDate: task.dueDate || task.date || "",
    dueTime: task.dueTime || task.time || "",
    completed: Boolean(task.completed || task.done),
    missedAlertShown: Boolean(task.missedAlertShown || task.alerted)
  };
});

saveTasks();

function saveTasks() {
  localStorage.setItem("smartTaskPlannerTasks", JSON.stringify(tasks));
}

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
  }

  return audioContext;
}

function unlockSound() {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }
}

function playTone(context, frequency, startTime, duration, volume) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.025);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.04);
}

function playMissedTaskRingtone() {
  if (!soundEnabled) {
    return;
  }

  const context = getAudioContext();

  if (!context) {
    return;
  }

  const playPattern = () => {
    const now = context.currentTime + 0.05;

    playTone(context, 880, now, 0.18, 0.22);
    playTone(context, 660, now + 0.25, 0.18, 0.22);
    playTone(context, 880, now + 0.50, 0.18, 0.22);
    playTone(context, 660, now + 0.75, 0.18, 0.22);
    playTone(context, 1046, now + 1.05, 0.35, 0.25);
  };

  if (context.state === "suspended") {
    context.resume().then(playPattern).catch(() => {});
    return;
  }

  playPattern();
}

function updateSoundButton() {
  if (soundEnabled) {
    soundToggleBtn.textContent = "🔊 Sound On";
    soundToggleBtn.classList.remove("off");
  } else {
    soundToggleBtn.textContent = "🔇 Sound Off";
    soundToggleBtn.classList.add("off");
  }
}

function getDueDateTime(task) {
  if (!task.dueDate) {
    return null;
  }

  const dueTime = task.dueTime && task.dueTime.trim() !== ""
    ? task.dueTime
    : "23:59";

  return new Date(`${task.dueDate}T${dueTime}:00`);
}

function isTaskMissed(task) {
  const dueDateTime = getDueDateTime(task);

  if (!dueDateTime) {
    return false;
  }

  if (task.completed) {
    return false;
  }

  return new Date() > dueDateTime;
}

function formatDateTime(dueDate, dueTime) {
  if (!dueDate) {
    return "No due date";
  }

  const date = new Date(`${dueDate}T00:00:00`);

  const formattedDate = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  if (!dueTime) {
    return `${formattedDate} at 23:59`;
  }

  return `${formattedDate} at ${dueTime}`;
}

function getPriorityClass(priority) {
  if (priority === "Low") {
    return "priority-low";
  }

  if (priority === "High") {
    return "priority-high";
  }

  return "priority-medium";
}

function addTask(title, priority, dueDate, dueTime) {
  const newTask = {
    id: Date.now(),
    title,
    priority,
    dueDate,
    dueTime,
    completed: false,
    missedAlertShown: false
  };

  tasks.push(newTask);
  saveTasks();
  renderTasks();
  checkMissedTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  saveTasks();
  renderTasks();
}

function toggleTask(id) {
  tasks = tasks.map(task => {
    if (task.id === id) {
      return {
        ...task,
        completed: !task.completed
      };
    }

    return task;
  });

  saveTasks();
  renderTasks();
}

function editTask(id) {
  const task = tasks.find(task => task.id === id);

  if (!task) {
    return;
  }

  const updatedTitle = prompt("Edit task name:", task.title);

  if (updatedTitle === null) {
    return;
  }

  const cleanTitle = updatedTitle.trim();

  if (cleanTitle === "") {
    alert("Task name cannot be empty.");
    return;
  }

  tasks = tasks.map(task => {
    if (task.id === id) {
      return {
        ...task,
        title: cleanTitle
      };
    }

    return task;
  });

  saveTasks();
  renderTasks();
}

function getFilteredTasks() {
  const searchText = searchInput.value.toLowerCase().trim();

  return tasks.filter(task => {
    const missed = isTaskMissed(task);
    const matchesSearch = task.title.toLowerCase().includes(searchText);

    if (!matchesSearch) {
      return false;
    }

    if (currentFilter === "pending") {
      return !task.completed && !missed;
    }

    if (currentFilter === "completed") {
      return task.completed;
    }

    if (currentFilter === "missed") {
      return missed;
    }

    return true;
  });
}

function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const missed = tasks.filter(task => isTaskMissed(task)).length;
  const pending = tasks.filter(task => !task.completed && !isTaskMissed(task)).length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  totalTasks.textContent = total;
  completedTasks.textContent = completed;
  pendingTasks.textContent = pending;
  missedTasks.textContent = missed;

  progressText.textContent = `${progress}%`;
  progressFill.style.width = `${progress}%`;
}

function renderTasks() {
  taskList.innerHTML = "";

  const filteredTasks = getFilteredTasks();

  if (filteredTasks.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }

  filteredTasks.forEach(task => {
    const missed = isTaskMissed(task);
    const priorityClass = getPriorityClass(task.priority);

    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""} ${missed ? "missed" : ""}`;

    const dueLabel = missed ? "Missed:" : "Due:";
    const statusPill = task.completed
      ? `<span class="pill completed-pill">✅ Completed</span>`
      : missed
        ? `<span class="pill missed-pill">🚨 Missed</span>`
        : "";

    li.innerHTML = `
      <input
        class="task-checkbox"
        type="checkbox"
        ${task.completed ? "checked" : ""}
        aria-label="Mark task completed"
      />

      <div class="task-content">
        <div class="task-title">${escapeHTML(task.title)}</div>

        <div class="task-meta">
          <span class="pill ${priorityClass}">⚑ ${task.priority}</span>
          <span class="pill ${missed ? "missed-pill" : "due-pill"}">◷ ${dueLabel} ${formatDateTime(task.dueDate, task.dueTime)}</span>
          ${statusPill}
        </div>
      </div>

      <div class="actions">
        <button class="action-btn edit-btn" type="button">✎ Edit</button>
        <button class="action-btn delete-btn" type="button">🗑 Delete</button>
      </div>
    `;

    const checkbox = li.querySelector(".task-checkbox");
    const editButton = li.querySelector(".edit-btn");
    const deleteButton = li.querySelector(".delete-btn");

    checkbox.addEventListener("change", () => toggleTask(task.id));
    editButton.addEventListener("click", () => editTask(task.id));
    deleteButton.addEventListener("click", () => deleteTask(task.id));

    taskList.appendChild(li);
  });

  updateStats();
}

function showMissedAlert(missedList) {
  const taskNames = missedList
    .map(task => `• ${task.title}`)
    .join("\n");

  playMissedTaskRingtone();

  setTimeout(() => {
    alert(`Missed Task Alert!\n\nYou missed these task(s):\n${taskNames}`);
  }, 250);
}

function checkMissedTasks() {
  const newlyMissedTasks = tasks.filter(task => {
    return isTaskMissed(task) && !task.missedAlertShown;
  });

  if (newlyMissedTasks.length === 0) {
    updateStats();
    return;
  }

  showMissedAlert(newlyMissedTasks);

  tasks = tasks.map(task => {
    const shouldMarkAlertShown = newlyMissedTasks.some(missedTask => {
      return missedTask.id === task.id;
    });

    if (shouldMarkAlertShown) {
      return {
        ...task,
        missedAlertShown: true
      };
    }

    return task;
  });

  saveTasks();
  renderTasks();
}

taskForm.addEventListener("submit", event => {
  event.preventDefault();

  unlockSound();

  const title = taskInput.value.trim();
  const priority = priorityInput.value;
  const dueDate = dateInput.value;
  const dueTime = timeInput.value;

  if (title === "") {
    alert("Please enter a task name.");
    return;
  }

  if (dueTime && !dueDate) {
    alert("Please select a due date when adding a due time.");
    return;
  }

  addTask(title, priority, dueDate, dueTime);

  taskForm.reset();
  priorityInput.value = "Medium";
});

searchInput.addEventListener("input", renderTasks);

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    filterButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");

    currentFilter = button.dataset.filter;
    renderTasks();
  });
});

soundToggleBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("soundEnabled", JSON.stringify(soundEnabled));
  updateSoundButton();
  unlockSound();
});

document.addEventListener("click", unlockSound, { once: true });
document.addEventListener("keydown", unlockSound, { once: true });

updateSoundButton();
renderTasks();
checkMissedTasks();

setInterval(checkMissedTasks, 30000);