/**
 * StreakForge - Developer Momentum & Habit Tracker
 * Author: Hunain Ahmed
 */

(function () {
  'use strict';

  // --- State & LocalStorage Keys ---
  const STORAGE_KEY = 'streakforge_data_v1';

  const defaultState = {
    activities: {}, // Format: { "YYYY-MM-DD": count }
    tasks: [
      { id: '1', text: 'Commit code to GitHub', completed: true },
      { id: '2', text: 'Deep work focus sprint (25m)', completed: false },
      { id: '3', text: 'Read / Learn documentation or new tech', completed: false }
    ],
    focusMinutesToday: 0,
    focusSessionsCount: 0
  };

  let state = loadState();

  // Ensure today's win is pre-recorded so the user has an immediate streak win!
  const todayKey = getLocalDateKey(new Date());
  if (!state.activities[todayKey]) {
    state.activities[todayKey] = 1;
    saveState();
  }

  // --- Timer State ---
  let timerInterval = null;
  let timerMode = 'work'; // 'work', 'shortBreak', 'longBreak'
  let totalTime = 25 * 60;
  let remainingTime = 25 * 60;
  let isRunning = false;

  // --- DOM Elements ---
  const currentDateBadge = document.getElementById('currentDateBadge');
  const currentStreakEl = document.getElementById('currentStreak');
  const longestStreakEl = document.getElementById('longestStreak');
  const streakStatusText = document.getElementById('streakStatusText');
  const focusTimeTodayEl = document.getElementById('focusTimeToday');
  const focusSessionsCountEl = document.getElementById('focusSessionsCount');
  const goalsRatioEl = document.getElementById('goalsRatio');
  const goalsPercentEl = document.getElementById('goalsPercent');
  const heatmapGrid = document.getElementById('heatmapGrid');
  const quickLogBtn = document.getElementById('quickLogBtn');

  const timerDigits = document.getElementById('timerDigits');
  const timerStateLabel = document.getElementById('timerStateLabel');
  const startTimerBtn = document.getElementById('startTimerBtn');
  const pauseTimerBtn = document.getElementById('pauseTimerBtn');
  const resetTimerBtn = document.getElementById('resetTimerBtn');
  const ringStroke = document.getElementById('ringStroke');
  const modeButtons = document.querySelectorAll('.mode-btn');

  const addTaskForm = document.getElementById('addTaskForm');
  const taskInput = document.getElementById('taskInput');
  const taskList = document.getElementById('taskList');
  const taskProgressFill = document.getElementById('taskProgressFill');

  const exportDataBtn = document.getElementById('exportDataBtn');
  const importDataBtn = document.getElementById('importDataBtn');
  const importFileInput = document.getElementById('importFileInput');

  // --- Helper Functions ---
  function getLocalDateKey(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load state from localStorage', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state', e);
    }
  }

  // Web Audio Synth Chime
  function playAlertChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (err) {
      // AudioContext could be blocked by browser policy until interaction
    }
  }

  // --- Streak Calculations ---
  function calculateStreaks() {
    const dates = Object.keys(state.activities)
      .filter((k) => state.activities[k] > 0)
      .sort();

    if (dates.length === 0) {
      return { current: 0, longest: 0, isActiveToday: false };
    }

    const todayStr = getLocalDateKey(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateKey(yesterday);

    const activeSet = new Set(dates);
    const isActiveToday = activeSet.has(todayStr);

    // Current streak
    let current = 0;
    let checkDate = new Date();
    if (!isActiveToday && !activeSet.has(yesterdayStr)) {
      current = 0;
    } else {
      if (!isActiveToday) {
        checkDate = yesterday;
      }
      while (true) {
        const key = getLocalDateKey(checkDate);
        if (activeSet.has(key)) {
          current++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Longest streak
    let longest = 0;
    let tempCount = 0;
    let prevTime = null;

    for (const dStr of dates) {
      const [y, m, d] = dStr.split('-').map(Number);
      const currentTime = new Date(y, m - 1, d).getTime();

      if (prevTime === null) {
        tempCount = 1;
      } else {
        const diffDays = Math.round((currentTime - prevTime) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempCount++;
        } else {
          tempCount = 1;
        }
      }
      prevTime = currentTime;
      if (tempCount > longest) {
        longest = tempCount;
      }
    }

    return { current, longest, isActiveToday };
  }

  // --- Render UI ---
  function renderHeaderDate() {
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    currentDateBadge.textContent = now.toLocaleDateString(undefined, options);
  }

  function renderStats() {
    const { current, longest, isActiveToday } = calculateStreaks();
    currentStreakEl.innerHTML = `${current} <span class="stat-unit">days</span>`;
    longestStreakEl.innerHTML = `${Math.max(longest, current)} <span class="stat-unit">days</span>`;

    if (isActiveToday) {
      streakStatusText.textContent = 'Streak protected for today! 🔥';
      streakStatusText.style.color = '#10b981';
    } else {
      streakStatusText.textContent = 'Log activity to maintain streak!';
      streakStatusText.style.color = '#f59e0b';
    }

    focusTimeTodayEl.innerHTML = `${state.focusMinutesToday} <span class="stat-unit">mins</span>`;
    focusSessionsCountEl.textContent = `${state.focusSessionsCount} sessions completed`;

    const totalTasks = state.tasks.length;
    const completedTasks = state.tasks.filter((t) => t.completed).length;
    goalsRatioEl.textContent = `${completedTasks}/${totalTasks}`;
    const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
    goalsPercentEl.textContent = `${percent}% finished`;
    taskProgressFill.style.width = `${percent}%`;
  }

  function renderHeatmap() {
    heatmapGrid.innerHTML = '';
    const totalDays = 7 * 12; // 12 weeks
    const days = [];
    const today = new Date();

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      days.push(d);
    }

    days.forEach((date) => {
      const key = getLocalDateKey(date);
      const count = state.activities[key] || 0;

      let level = 0;
      if (count >= 4) level = 4;
      else if (count >= 3) level = 3;
      else if (count >= 2) level = 2;
      else if (count >= 1) level = 1;

      const cell = document.createElement('div');
      cell.className = `heatmap-day level-${level}`;
      cell.title = `${date.toDateString()}: ${count} win${count === 1 ? '' : 's'}`;

      cell.addEventListener('click', () => {
        state.activities[key] = (state.activities[key] || 0) + 1;
        saveState();
        playAlertChime();
        renderHeatmap();
        renderStats();
      });

      heatmapGrid.appendChild(cell);
    });
  }

  function renderTasks() {
    taskList.innerHTML = '';
    state.tasks.forEach((task) => {
      const li = document.createElement('li');
      li.className = `task-item ${task.completed ? 'completed' : ''}`;

      const left = document.createElement('div');
      left.className = 'task-left';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task.completed;
      checkbox.addEventListener('change', () => {
        task.completed = checkbox.checked;
        saveState();
        renderTasks();
        renderStats();
      });

      const span = document.createElement('span');
      span.className = 'task-text';
      span.textContent = task.text;

      left.appendChild(checkbox);
      left.appendChild(span);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'task-delete';
      deleteBtn.innerHTML = '×';
      deleteBtn.title = 'Remove task';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.tasks = state.tasks.filter((t) => t.id !== task.id);
        saveState();
        renderTasks();
        renderStats();
      });

      li.appendChild(left);
      li.appendChild(deleteBtn);
      taskList.appendChild(li);
    });
  }

  // --- Timer Operations ---
  const circumference = 2 * Math.PI * 45; // r = 45 -> ~282.74

  function updateTimerDisplay() {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    timerDigits.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const offset = circumference - (remainingTime / totalTime) * circumference;
    ringStroke.style.strokeDashoffset = offset;
  }

  function setTimerMode(mode, minutes) {
    if (isRunning) pauseTimer();
    timerMode = mode;
    totalTime = minutes * 60;
    remainingTime = totalTime;
    ringStroke.style.strokeDashoffset = '0';

    modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    timerStateLabel.textContent =
      mode === 'work' ? 'FOCUS SESSION' : mode === 'shortBreak' ? 'SHORT RECHARGE' : 'LONG RECHARGE';

    updateTimerDisplay();
  }

  function startTimer() {
    if (isRunning) return;
    isRunning = true;
    startTimerBtn.disabled = true;
    pauseTimerBtn.disabled = false;
    timerStateLabel.textContent = 'RUNNING';

    timerInterval = setInterval(() => {
      remainingTime--;
      updateTimerDisplay();

      if (remainingTime <= 0) {
        clearInterval(timerInterval);
        isRunning = false;
        startTimerBtn.disabled = false;
        pauseTimerBtn.disabled = true;
        playAlertChime();

        if (timerMode === 'work') {
          state.focusMinutesToday += Math.round(totalTime / 60);
          state.focusSessionsCount += 1;
          const today = getLocalDateKey(new Date());
          state.activities[today] = (state.activities[today] || 0) + 1;
          saveState();
          renderStats();
          renderHeatmap();
        }

        timerStateLabel.textContent = 'COMPLETED! 🎉';
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!isRunning) return;
    clearInterval(timerInterval);
    isRunning = false;
    startTimerBtn.disabled = false;
    pauseTimerBtn.disabled = true;
    timerStateLabel.textContent = 'PAUSED';
  }

  function resetTimer() {
    pauseTimer();
    remainingTime = totalTime;
    updateTimerDisplay();
    timerStateLabel.textContent = 'RESET';
  }

  // --- Event Listeners ---
  quickLogBtn.addEventListener('click', () => {
    const today = getLocalDateKey(new Date());
    state.activities[today] = (state.activities[today] || 0) + 1;
    saveState();
    playAlertChime();
    renderStats();
    renderHeatmap();

    quickLogBtn.style.transform = 'scale(0.96)';
    setTimeout(() => {
      quickLogBtn.style.transform = '';
    }, 150);
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const time = parseInt(btn.dataset.time, 10);
      setTimerMode(mode, time);
    });
  });

  startTimerBtn.addEventListener('click', startTimer);
  pauseTimerBtn.addEventListener('click', pauseTimer);
  resetTimerBtn.addEventListener('click', resetTimer);

  addTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) return;

    state.tasks.push({
      id: Date.now().toString(),
      text,
      completed: false
    });
    taskInput.value = '';
    saveState();
    renderTasks();
    renderStats();
  });

  // Export / Import
  exportDataBtn.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `streakforge-backup-${getLocalDateKey(new Date())}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  importDataBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported && typeof imported === 'object') {
          state = Object.assign({}, defaultState, imported);
          saveState();
          renderStats();
          renderHeatmap();
          renderTasks();
          alert('StreakForge data imported successfully!');
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  });

  // --- Initialize ---
  function init() {
    renderHeaderDate();
    renderStats();
    renderHeatmap();
    renderTasks();
    updateTimerDisplay();
  }

  init();
})();
