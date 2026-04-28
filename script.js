const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const priorityInput = document.getElementById("priorityInput");
const dateInput = document.getElementById("dateInput");
const timeInput = document.getElementById("timeInput");
const searchInput = document.getElementById("searchInput");
const taskList = document.getElementById("taskList");
const emptyMessage = document.getElementById("emptyMessage");

const totalTasks = document.getElementById("totalTasks");
const completedTasks = document.getElementById("completedTasks");
const pendingTasks = document.getElementById("pendingTasks");
const missedTasks = document.getElementById("missedTasks");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");

const filterButtons = document.querySelectorAll(".filter-btn");

let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
let currentFilter = "all";

/* =========================
   Alert ringtone setup
========================= */

let audioContext = null;

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

function unlockAlertSound() {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    context.resume().catch(() => {
      console.log("Audio could not be unlocked yet.");
    });
  }
}

function playTone(context, frequency, startTime, duration, volume) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.05);
}

function playMissedTaskRingtone() {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    context.resume().then(() => {
      playRingtonePattern(context);
    }).catch(() => {
      console.log("Browser blocked the alert sound.");
    });

    return;
  }

  playRingtonePattern(context);
}

function playRingtonePattern(context) {
  const now = context.currentTime + 0.05;

  playTone(context, 880, now, 0.18, 0.22);
  playTone(context, 660, now + 0.25, 0.18, 0.22);
  playTone(context, 880, now + 0.50, 0.18, 0.22);
  playTone(context, 660, now + 0.75, 0.18, 0.22);
  playTone(context, 1046, now + 1.05, 0.35, 0.24);
}

/* 
  Browsers usually allow sound only after the user interacts
  with the page at least once.
*/
document.addEventListener("click", unlockAlertSound, { once: true });
document.addEventListener("keydown", unlockAlertSound, { once: true });

/* =========================
   Task planner logic
========================= */

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function getSafePriority(priority) {
  const validPriorities = ["Low", "Medium", "High"];

  if (validPriorities.includes(priority)) {
    return priority;
  }

  return "Medium";
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
    return `${formattedDate} at 11:59 PM`;
  }

  return `${formattedDate} at ${dueTime}`;
}

function showMissedAlert(missedList) {
  const taskNames = missedList
    .map(task => `• ${task.title}`)
    .join("\n");

  playMissedTaskRingtone();

  if ("Notification" in window && Notification.permission === "granted") {
    const notificationText = missedList
      .map(task => task.title)
      .join(", ");

    new Notification("Missed Task Alert", {
      body: `Overdue task(s): ${notificationText}`
    });
  }

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
    const hasJustBeenMissed = newlyMissedTasks.some(
      missedTask => missedTask.id === task.id
    );

    if (hasJustBeenMissed) {
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
  checkMissedTasks();
}

function editTask(id) {
  const task = tasks.find(task => task.id === id);

  if (!task) {
    return;
  }

  const updatedTitle = prompt("Edit your task:", task.title);

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
  const searchText = searchInput.value.toLowerCase();

  return tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchText);
    const missed = isTaskMissed(task);

    if (currentFilter === "completed") {
      return task.completed && matchesSearch;
    }

    if (currentFilter === "pending") {
      return !task.completed && !missed && matchesSearch;
    }

    if (currentFilter === "missed") {
      return missed && matchesSearch;
    }

    return matchesSearch;
  });
}

function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const missed = tasks.filter(task => isTaskMissed(task)).length;

  const pending = tasks.filter(task => {
    return !task.completed && !isTaskMissed(task);
  }).length;

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
    emptyMessage.classList.remove("hidden");
  } else {
    emptyMessage.classList.add("hidden");
  }

  filteredTasks.forEach(task => {
    const missed = isTaskMissed(task);
    const safePriority = getSafePriority(task.priority);

    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""} ${missed ? "missed" : ""}`;

    li.innerHTML = `
      <input
        type="checkbox"
        class="task-checkbox"
        ${task.completed ? "checked" : ""}
        aria-label="Mark task as complete"
      />

      <div class="task-info">
        <p class="task-title">${escapeHTML(task.title)}</p>

        <div class="task-meta">
          <span class="meta-pill priority ${safePriority}">
            ${safePriority}
          </span>

          <span class="meta-pill due-date ${missed ? "missed-date" : ""}">
            ${missed ? "Missed: " : "Due: "}
            ${formatDateTime(task.dueDate, task.dueTime)}
          </span>

          ${task.completed ? `<span class="meta-pill completed-pill">Completed</span>` : ""}

          ${missed ? `<span class="meta-pill missed-pill">Missed</span>` : ""}
        </div>
      </div>

      <div class="task-actions">
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
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

taskForm.addEventListener("submit", event => {
  event.preventDefault();

  requestNotificationPermission();
  unlockAlertSound();

  const title = taskInput.value.trim();
  const priority = priorityInput.value;
  const dueDate = dateInput.value;
  const dueTime = timeInput.value;

  if (title === "") {
    alert("Please enter a task.");
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

renderTasks();
checkMissedTasks();

setInterval(checkMissedTasks, 30000);