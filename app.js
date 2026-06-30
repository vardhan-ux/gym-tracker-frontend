/* =========================================================
   GYM TRACKER — Dashboard logic (API-backed)
   ========================================================= */
let user = null;
let allWorkouts = [];
let allPlans = [];

(async function init() {
  user = await requireAuthAsync();
  if (!user) return; // already redirected to login

  document.getElementById('sidebarName').textContent = user.name;
  document.getElementById('greeting').textContent = `Welcome back, ${user.name.split(' ')[0]}`;

  try {
    [allWorkouts, allPlans] = await Promise.all([Api.getWorkouts(), Api.getPlans()]);
  } catch (err) {
    showToast('Could not reach server. Check backend is running.');
    return;
  }

  renderOverview();
  renderLogTable();
  renderPlans();

  document.getElementById('bmiHeight').value = user.height || '';
  document.getElementById('bmiWeight').value = user.weight || '';

  const params = new URLSearchParams(window.location.search);
  if (params.get('welcome')) showToast(`Welcome to IRONLOG, ${user.name.split(' ')[0]}!`);
})();

/* ---------- Tab navigation ---------- */
const navItems = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.tab-panel');
const mobileNav = document.getElementById('mobileNav');

function activateTab(tab) {
  panels.forEach(p => p.style.display = (p.id === `tab-${tab}`) ? 'block' : 'none');
  navItems.forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
  mobileNav.value = tab;
  if (tab === 'progress') renderProgressCharts();
}
navItems.forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));
mobileNav.addEventListener('change', () => activateTab(mobileNav.value));

document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  Api.logout();
  window.location.href = 'index.html';
});

/* ---------- Toast helper ---------- */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Overview ---------- */
function renderOverview() {
  document.getElementById('statTotal').textContent = allWorkouts.length;
  document.getElementById('statPlan').textContent = user.activePlan ? user.activePlan.name : 'None';

  const today = new Date();
  const last7 = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    last7.add(d.toDateString());
  }
  const daysTrained = new Set(
    allWorkouts.map(w => new Date(w.date).toDateString()).filter(d => last7.has(d))
  );
  const count = daysTrained.size;
  const circumference = 264;
  const offset = circumference - (count / 7) * circumference;
  document.getElementById('ringFg').style.strokeDashoffset = offset;
  document.getElementById('ringLabel').textContent = `${count}/7`;

  const tbody = document.querySelector('#recentTable tbody');
  tbody.innerHTML = '';
  const recent = allWorkouts.slice(0, 5);
  document.getElementById('recentEmpty').style.display = recent.length ? 'none' : 'block';
  document.getElementById('recentTable').style.display = recent.length ? 'table' : 'none';
  recent.forEach(w => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${formatDate(w.date)}</td><td>${escapeHtml(w.exercise)}</td><td>${w.sets}</td><td>${w.reps}</td><td>${w.weight} kg</td>`;
    tbody.appendChild(tr);
  });
}

/* ---------- Log Workout ---------- */
const logForm = document.getElementById('logForm');
logForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const exercise = document.getElementById('exExercise').value.trim();
  const sets = Number(document.getElementById('exSets').value);
  const reps = Number(document.getElementById('exReps').value);
  const weight = Number(document.getElementById('exWeight').value);
  if (!exercise || !sets || !reps || weight < 0) return;

  const submitBtn = logForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const workout = await Api.addWorkout({ exercise, sets, reps, weight });
    allWorkouts.unshift(workout);
    logForm.reset();
    document.getElementById('exExercise').focus();
    showToast('Workout logged ✓');
    renderLogTable();
    renderOverview();
  } catch (err) {
    showToast(err.message || 'Could not save workout');
  } finally {
    submitBtn.disabled = false;
  }
});

function renderLogTable() {
  const tbody = document.querySelector('#logTable tbody');
  tbody.innerHTML = '';
  document.getElementById('logEmpty').style.display = allWorkouts.length ? 'none' : 'block';
  document.getElementById('logTable').style.display = allWorkouts.length ? 'table' : 'none';

  allWorkouts.forEach(w => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(w.date)}</td>
      <td>${escapeHtml(w.exercise)}</td>
      <td>${w.sets}</td>
      <td>${w.reps}</td>
      <td>${w.weight} kg</td>
      <td><button class="del-btn" data-id="${w._id}">Remove</button></td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await Api.deleteWorkout(btn.dataset.id);
        allWorkouts = allWorkouts.filter(w => w._id !== btn.dataset.id);
        showToast('Entry removed');
        renderLogTable();
        renderOverview();
      } catch (err) {
        showToast(err.message || 'Could not delete');
      }
    });
  });
}

/* ---------- Plans ---------- */
function renderPlans() {
  const grid = document.getElementById('plansGrid');
  grid.innerHTML = '';

  allPlans.forEach(plan => {
    const isActive = user.activePlan && user.activePlan.id === plan.id;
    const card = document.createElement('div');
    card.className = 'plan-card';
    card.innerHTML = `
      <span class="tag">${plan.tag}</span>
      <h3>${plan.name}</h3>
      <div style="color:var(--muted);font-size:0.82rem;">${plan.goal}</div>
      <ul>
        ${plan.days.map(d => `<li><strong>${d.day}:</strong> ${d.exercises.join(', ')}</li>`).join('')}
      </ul>
      <button class="use-btn" data-id="${plan.id}">${isActive ? '✓ Active Plan' : 'Set as Active'}</button>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.use-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const plan = allPlans.find(p => p.id === btn.dataset.id);
      try {
        const updatedUser = await Api.updateProfile({ activePlan: plan });
        user = updatedUser;
        showToast(`"${plan.name}" set as active plan`);
        renderPlans();
        renderOverview();
      } catch (err) {
        showToast(err.message || 'Could not update plan');
      }
    });
  });
}

/* ---------- BMI ---------- */
document.getElementById('bmiCalcBtn').addEventListener('click', async () => {
  const h = Number(document.getElementById('bmiHeight').value);
  const w = Number(document.getElementById('bmiWeight').value);
  if (!h || !w) return;

  const hM = h / 100;
  const bmi = w / (hM * hM);
  let category;
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi < 25) category = 'Normal weight';
  else if (bmi < 30) category = 'Overweight';
  else category = 'Obese';

  document.getElementById('bmiValue').textContent = bmi.toFixed(1);
  document.getElementById('bmiCategory').textContent = category;
  document.getElementById('bmiResult').style.display = 'block';

  try {
    user = await Api.updateProfile({ height: h, weight: w });
  } catch (err) {
    showToast('BMI calculated, but could not save to profile');
  }
});

/* ---------- Progress charts ---------- */
let freqChartInstance, weightChartInstance;

function renderProgressCharts() {
  document.getElementById('progressEmpty').style.display = allWorkouts.length ? 'none' : 'block';
  if (!allWorkouts.length) return;

  const days = [];
  const counts = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const key = d.toDateString();
    const c = allWorkouts.filter(w => new Date(w.date).toDateString() === key).length;
    days.push(label);
    counts.push(c);
  }

  const freqCtx = document.getElementById('freqChart');
  if (freqChartInstance) freqChartInstance.destroy();
  freqChartInstance = new Chart(freqCtx, {
    type: 'bar',
    data: { labels: days, datasets: [{ label: 'Sessions', data: counts, backgroundColor: '#c8ff00', borderRadius: 4 }] },
    options: chartOptions(false)
  });

  const exercises = [...new Set(allWorkouts.map(w => w.exercise))];
  const select = document.getElementById('progressExerciseSelect');
  const prevValue = select.value;
  select.innerHTML = exercises.map(ex => `<option value="${escapeHtml(ex)}">${escapeHtml(ex)}</option>`).join('');
  if (exercises.includes(prevValue)) select.value = prevValue;

  function drawWeightChart(exercise) {
    const points = allWorkouts
      .filter(w => w.exercise === exercise)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = points.map(p => formatDate(p.date));
    const data = points.map(p => p.weight);

    const ctx = document.getElementById('weightChart');
    if (weightChartInstance) weightChartInstance.destroy();
    weightChartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: exercise, data, borderColor: '#ff5a36', backgroundColor: 'rgba(255,90,54,0.15)', tension: 0.3, fill: true, pointRadius: 3 }] },
      options: chartOptions(true)
    });
  }

  if (exercises.length) {
    drawWeightChart(select.value || exercises[0]);
    select.onchange = () => drawWeightChart(select.value);
  }
}

function chartOptions(showLegend) {
  return {
    responsive: true,
    plugins: { legend: { display: showLegend, labels: { color: '#8a9099' } } },
    scales: {
      x: { ticks: { color: '#8a9099' }, grid: { color: '#2e353c' } },
      y: { ticks: { color: '#8a9099' }, grid: { color: '#2e353c' }, beginAtZero: true }
    }
  };
}
