
"use strict";

const $ = id => document.getElementById(id);
const KEY = "lifeos-dark-crystal-v1";
const TODAY = () => iso(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function iso(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function shift(dateString, amount) {
  const d = new Date(dateString + "T12:00:00");
  d.setDate(d.getDate() + amount);
  return iso(d);
}
function monthDays(date) {
  const [y,m] = date.split("-").map(Number);
  return new Date(y,m,0).getDate();
}
function monthKey(date) { return date.slice(0,7); }
function monthTitle(date) {
  return new Date(date + "-15T12:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"});
}
function niceDate(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-IN",{
    weekday:"long",day:"numeric",month:"long",year:"numeric"
  });
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}
function cloneDefaults() {
  return {
    profile:"My Universe",
    habits:[
      {id:"h1",name:"Morning routine"},
      {id:"h2",name:"Exercise / gym"},
      {id:"h3",name:"Reading"},
      {id:"h4",name:"Personal care"},
      {id:"h5",name:"Study / learning"},
      {id:"h6",name:"Drink enough water"},
      {id:"h7",name:"Sleep on time"}
    ],
    checks:{},
    tasks:[],
    goals:[
      {id:"g1",name:"Build my future",progress:20,deadline:""},
      {id:"g2",name:"Improve fitness",progress:10,deadline:""}
    ],
    notes:{},
    focus:{work:25,rest:5,seconds:1500,mode:"work",sessions:0,totalMinutes:0}
  };
}
function validData(d) {
  return d && Array.isArray(d.habits) && d.checks && Array.isArray(d.tasks) &&
    Array.isArray(d.goals) && d.notes && d.focus;
}
function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (validData(parsed)) return {...cloneDefaults(),...parsed};
    }
  } catch(e) { console.warn("LifeOS data could not be loaded.",e); }
  return cloneDefaults();
}

let data = loadData();
let view = "home";
let taskFilter = "all";
let calendarMonth = monthKey(TODAY());
let habitHalf = "first";
let timerId = null;
let timerEnd = 0;
let toastTimeout = null;

function save() {
  try {
    localStorage.setItem(KEY,JSON.stringify(data));
    $("saveStatus").textContent = "ALL CHANGES SAVED LOCALLY";
  } catch(e) {
    $("saveStatus").textContent = "STORAGE UNAVAILABLE";
  }
}
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(()=>el.classList.remove("show"),2300);
}
function checked(habitId,date) {
  return data.checks[habitId+"|"+date] === true;
}
function doneHabits(date) {
  return data.habits.filter(h=>checked(h.id,date)).length;
}
function percent(done,total) {
  return total ? Math.round(done/total*100) : 0;
}
function habitPercent(date) {
  return percent(doneHabits(date),data.habits.length);
}
function dailyTaskList(date) {
  return data.tasks.filter(t=>t.date===date);
}
function weekStats(date) {
  let done=0,total=0;
  for(let i=6;i>=0;i--) {
    const day=shift(date,-i);
    done+=doneHabits(day);
    total+=data.habits.length;
  }
  return {done,total,pct:percent(done,total)};
}
function ring(value,label,color) {
  return `<div class="ring" style="--value:${value}%;--ring-color:${color}">
    <div class="ring-content"><strong>${value}%</strong><small>${label}</small></div>
  </div>`;
}
function heading(kicker,title,subtitle,action="") {
  return `<section class="page-heading"><div>
    <p class="eyebrow">${kicker}</p><h1>${title}</h1>
    <p class="subtitle">${subtitle}</p>
  </div>${action}</section>`;
}
function cardHead(title,icon="✦",tile="tile-purple",extra="") {
  return `<div class="card-head"><div><h2>${title}</h2></div>
    <div style="display:flex;align-items:center;gap:8px">${extra}<span class="icon-tile ${tile}">${icon}</span></div></div>`;
}
function empty(title,message) {
  return `<div class="empty-state"><strong>${title}</strong>${message}</div>`;
}
function taskRows(tasks) {
  if(!tasks.length) return empty("A little breathing room","No tasks here yet. Add one when you're ready.");
  return tasks.map(t=>`<div class="list-row">
    <input class="check" type="checkbox" data-action="task-check" data-id="${esc(t.id)}" ${t.completed?"checked":""} aria-label="Complete ${esc(t.title)}">
    <div class="row-copy ${t.completed?"completed":""}">
      <strong>${esc(t.title)}</strong><small>${esc(t.date)} · ${esc(t.priority||"Normal")} priority</small>
    </div>
    <span class="pill ${t.priority==="High"?"orange-pill":""}">${t.completed?"Done":esc(t.priority||"Normal")}</span>
    <button class="delete-button" data-action="task-delete" data-id="${esc(t.id)}" aria-label="Delete task">✕</button>
  </div>`).join("");
}
function goalRows() {
  if(!data.goals.length) return empty("Dream something bigger","Add your first goal above.");
  return data.goals.map(g=>`<div class="goal-row">
    <div class="goal-row-top"><span class="icon-tile tile-purple">◎</span>
      <div class="row-copy"><strong>${esc(g.name)}</strong><small>${g.deadline?"Target: "+esc(g.deadline):"Keep moving forward"}</small></div>
      <strong class="goal-percent">${Number(g.progress)||0}%</strong>
      <button class="delete-button" data-action="goal-delete" data-id="${esc(g.id)}">✕</button>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${Math.max(0,Math.min(100,Number(g.progress)||0))}%"></div></div>
    <input type="range" min="0" max="100" step="5" value="${Math.max(0,Math.min(100,Number(g.progress)||0))}" data-action="goal-progress" data-id="${esc(g.id)}" aria-label="Goal progress">
  </div>`).join("");
}
function weekChart() {
  return `<div class="chart-bars">${Array.from({length:7},(_,i)=>{
    const date=shift(TODAY(),i-6),p=habitPercent(date);
    const day=new Date(date+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short"});
    return `<div class="chart-column"><strong>${p}%</strong><div class="bar-wrap"><div class="chart-bar" style="height:${p}%"></div></div><small>${day}</small></div>`;
  }).join("")}</div>`;
}

function homeView() {
  const today=TODAY(), tasks=dailyTaskList(today), completed=tasks.filter(t=>t.completed).length;
  const week=weekStats(today), day=habitPercent(today);
  const greeting=new Date().getHours()<12?"Good morning":new Date().getHours()<18?"Good afternoon":"Good evening";

  return `${heading("YOUR PERSONAL UNIVERSE",`${greeting}, <span>${esc(data.profile)}.</span>`,"Your life, your habits, your next level.",'<button class="primary-button" data-view="tasks">＋ Add a task</button>')}

    <section class="stats-grid">
      <article class="card stat-card"><div class="card-head"><span class="mini-label">DAILY CONSISTENCY</span><span class="icon-tile tile-purple">◉</span></div>
        <div class="stat-number">${day}<span>%</span></div><div class="stat-foot">${doneHabits(today)} of ${data.habits.length} habits complete</div>
        <div class="progress-track"><div class="progress-fill" style="width:${day}%"></div></div></article>
      <article class="card stat-card"><div class="card-head"><span class="mini-label">WEEKLY CONSISTENCY</span><span class="icon-tile tile-blue">↗</span></div>
        <div class="stat-number">${week.pct}<span>%</span></div><div class="stat-foot">${week.done} completed check-ins this week</div>
        <div class="progress-track"><div class="progress-fill fill-blue" style="width:${week.pct}%"></div></div></article>
      <article class="card stat-card"><div class="card-head"><span class="mini-label">TASKS COMPLETED</span><span class="icon-tile tile-green">✓</span></div>
        <div class="stat-number">${completed}<span> / ${tasks.length}</span></div><div class="stat-foot">Your plan for today</div>
        <div class="progress-track"><div class="progress-fill fill-green" style="width:${percent(completed,tasks.length)}%"></div></div></article>
      <article class="card stat-card"><div class="card-head"><span class="mini-label">ACTIVE GOALS</span><span class="icon-tile tile-orange">◎</span></div>
        <div class="stat-number">${data.goals.filter(g=>g.progress<100).length}</div><div class="stat-foot">Goals still in progress</div>
        <div class="progress-track"><div class="progress-fill fill-orange" style="width:${percent(data.goals.filter(g=>g.progress>=100).length,data.goals.length)}%"></div></div></article>
    </section>

    <section class="habit-layout">
      <article class="card">
        ${cardHead("Your consistency grid","▦","tile-purple",'<button class="secondary-button small-button" data-view="habits">Full tracker ↗</button>')}
        <div class="habit-toolbar"><div><h2 style="font-size:12px">THIS MONTH · ${monthTitle(monthKey(today)).toUpperCase()}</h2><p class="subtitle">Tap a square to check in. Every day counts.</p></div>
          <div class="day-pills"><button class="day-pill ${habitHalf==="first"?"active":""}" data-action="half" data-half="first">01–15</button><button class="day-pill ${habitHalf==="second"?"active":""}" data-action="half" data-half="second">16–end</button></div>
        </div>
        ${habitGrid(true)}
        <div class="stat-foot" style="margin-top:12px">✦ A glowing square means you completed that habit.</div>
      </article>

      <div class="habit-side">
        <article class="card">
          ${cardHead("Your consistency","◉","tile-purple")}
          <div class="circle-row">
            <div class="circle-card"><span class="mini-label">TODAY</span>${ring(day,"DAILY","#a58bff")}<small>${doneHabits(today)}/${data.habits.length} habits</small></div>
            <div class="circle-card"><span class="mini-label">THIS WEEK</span>${ring(week.pct,"WEEKLY","#7daaff")}<small>Last 7 days</small></div>
          </div>
          <div class="insight-box" style="margin-top:15px"><strong>Consistency is your superpower.</strong><p>Small wins compound. Show up again today, even if yesterday wasn't perfect.</p></div>
        </article>
        <article class="card">
          ${cardHead("Today's progress","↗","tile-green")}
          <div class="stat-number">${doneHabits(today)}<span> / ${data.habits.length}</span></div>
          <div class="stat-foot">Habits checked today</div>
          <div class="progress-track"><div class="progress-fill fill-green" style="width:${day}%"></div></div>
          <button class="secondary-button" style="width:100%;margin-top:15px" data-view="habits">Open habit tracker →</button>
        </article>
      </div>
    </section>

    <section class="content-grid" style="margin-top:16px">
      <article class="card">${cardHead("Today's plan","✓","tile-green",'<button class="secondary-button small-button" data-view="tasks">View all</button>')}
        <div class="list">${taskRows(tasks.slice(0,5))}</div>
      </article>
      <article class="card">${cardHead("Your weekly rhythm","↗","tile-blue")}
        ${weekChart()}
      </article>
    </section>
    <section class="card">${cardHead("A thought for today","✎","tile-purple")}
      <textarea id="homeNote" placeholder="What went well today? What will you improve tomorrow?" rows="3">${esc(data.notes[today]||"")}</textarea>
      <p class="stat-foot">Saved automatically to this browser.</p>
    </section>`;
}

function habitGrid(compact=false) {
  const today=TODAY(),days=monthDays(today);
  const start=habitHalf==="first"?1:16;
  const end=habitHalf==="first"?15:days;
  const dates=Array.from({length:Math.max(0,end-start+1)},(_,i)=>`${monthKey(today)}-${String(start+i).padStart(2,"0")}`);

  if(!data.habits.length) return empty("Your habit list is empty","Add a habit below to begin tracking.");

  return `<div class="habit-table-wrap"><table class="habit-table">
    <thead><tr><th>HABIT / ACTIVITY</th>${dates.map(d=>`<th>${d.slice(-2)}</th>`).join("")}<th>DONE</th></tr></thead>
    <tbody>${data.habits.map(h=>{
      const count=dates.filter(d=>checked(h.id,d)).length;
      return `<tr><td class="habit-name">${esc(h.name)}</td>
        ${dates.map(d=>{const yes=checked(h.id,d),future=d>today;return `<td><button class="habit-cell ${yes?"checked":""} ${d===today?"today-cell":""}" data-action="habit-check" data-id="${esc(h.id)}" data-date="${d}" ${future?"disabled":""} aria-pressed="${yes}" aria-label="${esc(h.name)} on ${d}: ${yes?"complete":"incomplete"}">${yes?"✓":"·"}</button></td>`}).join("")}
        <td>${count}/${dates.length}</td></tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

function habitsView() {
  const today=TODAY(),week=weekStats(today),day=habitPercent(today);
  const monthStart=monthKey(today)+"-01",monthEnd=monthKey(today)+"-"+String(monthDays(today)).padStart(2,"0");
  let done=0,total=0;
  for(let d=monthStart;d<=monthEnd;d=shift(d,1)){done+=doneHabits(d);total+=data.habits.length;}
  return `${heading("YOUR PERSONAL SCOREBOARD","Habit tracker","Your notebook, reimagined in crystal glass. Track each habit day by day.")}
    <section class="stats-grid">
      <article class="card stat-card"><span class="mini-label">DAILY SCORE</span>${ring(day,"TODAY","#a58bff")}<div class="stat-foot">${doneHabits(today)} of ${data.habits.length} done</div></article>
      <article class="card stat-card"><span class="mini-label">WEEKLY SCORE</span>${ring(week.pct,"WEEK","#7daaff")}<div class="stat-foot">Last seven days</div></article>
      <article class="card stat-card"><span class="mini-label">MONTHLY SCORE</span>${ring(percent(done,total),"MONTH","#71e5bd")}<div class="stat-foot">${done} total check-ins</div></article>
      <article class="card stat-card"><span class="mini-label">YOUR ACTIVITIES</span><div class="stat-number">${data.habits.length}</div><div class="stat-foot">Habits you are building</div><button class="secondary-button small-button" data-action="scroll-habits">Manage habits ↓</button></article>
    </section>
    <section class="card">
      ${cardHead("Monthly consistency matrix","▦","tile-purple")}
      <div class="habit-toolbar"><div><h2 style="font-size:12px">${monthTitle(monthKey(today)).toUpperCase()}</h2><p class="subtitle">Each box is clickable. Past and current days can be tracked.</p></div>
        <div class="day-pills"><button class="day-pill ${habitHalf==="first"?"active":""}" data-action="half" data-half="first">Days 01–15</button><button class="day-pill ${habitHalf==="second"?"active":""}" data-action="half" data-half="second">Days 16–end</button></div>
      </div>
      ${habitGrid()}
    </section>
    <section class="content-grid" id="manageHabits" style="margin-top:16px">
      <article class="card">${cardHead("Manage your habits","＋","tile-purple")}
        <form id="habitForm" class="inline-form"><input name="name" maxlength="70" placeholder="e.g. Meditate for 10 minutes" required><button class="primary-button">Add habit</button></form>
        <div class="list">${data.habits.map(h=>`<div class="list-row"><span class="icon-tile tile-green">◉</span><div class="row-copy"><strong>${esc(h.name)}</strong><small>${doneHabits(today)} check-ins are tracked across your habits</small></div><button class="delete-button" data-action="habit-delete" data-id="${esc(h.id)}">Remove</button></div>`).join("")}</div>
      </article>
      <article class="card">${cardHead("Your weekly rhythm","↗","tile-blue")}${weekChart()}<div class="insight-box"><strong>Progress, not perfection.</strong><p>Missed a day? No problem. Keep your focus on what you can do today.</p></div></article>
    </section>`;
}

function tasksView() {
  const tasks=[...data.tasks].sort((a,b)=>a.date.localeCompare(b.date));
  const filtered=tasks.filter(t=>taskFilter==="all"||(taskFilter==="open"&&!t.completed)||(taskFilter==="done"&&t.completed));
  return `${heading("PLAN WITH INTENTION","Daily tasks","Make your priorities visible. Then take the next step.")}
    <section class="card">${cardHead("Create a task","＋","tile-purple")}
      <form id="taskForm" class="form-stack">
        <label>What do you need to do?<input name="title" maxlength="120" placeholder="Finish assignment, work out, read..." required></label>
        <div class="form-row"><label>Date<input type="date" name="date" value="${TODAY()}" required></label>
          <label>Priority<select name="priority"><option>Normal</option><option>High</option><option>Low</option></select></label>
          <button class="primary-button" type="submit">＋ Create task</button></div>
      </form>
    </section>
    <section class="card" style="margin-top:16px">${cardHead("Your task list","✓","tile-green")}
      <div class="habit-toolbar"><p class="subtitle">${data.tasks.filter(t=>t.completed).length} of ${data.tasks.length} tasks completed</p>
        <select id="taskFilter" aria-label="Filter tasks" style="width:auto"><option value="all" ${taskFilter==="all"?"selected":""}>All tasks</option><option value="open" ${taskFilter==="open"?"selected":""}>Open tasks</option><option value="done" ${taskFilter==="done"?"selected":""}>Completed</option></select>
      </div><div class="list">${taskRows(filtered)}</div>
    </section>`;
}

function goalsView() {
  return `${heading("YOUR BIGGER PICTURE","Goals & ambitions","Turn the person you want to become into daily progress.")}
    <section class="card">${cardHead("Set a new goal","◎","tile-orange")}
      <form id="goalForm" class="form-stack"><label>Goal name<input name="name" maxlength="100" placeholder="e.g. Build a portfolio website" required></label>
        <label>Target date (optional)<input name="deadline" type="date"></label><button class="primary-button">＋ Create goal</button></form>
    </section>
    <section class="card" style="margin-top:16px">${cardHead("Your journey","✦","tile-purple")}<div>${goalRows()}</div></section>`;
}

function calendarView() {
  const [year,month]=calendarMonth.split("-").map(Number);
  const first= new Date(year,month-1,1);
  const count=new Date(year,month,0).getDate();
  const offset=(first.getDay()+6)%7;
  const cells=Math.ceil((offset+count)/7)*7;
  const start=shift(`${calendarMonth}-01`,-offset);
  const end=shift(start,cells-1);
  const tasks=data.tasks.filter(t=>t.date>=start&&t.date<=end);

  return `${heading("TIME WITH INTENTION","Your calendar","Select any date to view its tasks or add something new.",
    '<button class="secondary-button" data-action="calendar-today">Today</button>')}
    <section class="card">
      <div class="card-head"><div class="calendar-controls" style="display:flex;align-items:center;gap:15px">
        <button class="secondary-button" data-action="month-prev">←</button><h2>${monthTitle(calendarMonth)}</h2><button class="secondary-button" data-action="month-next">→</button></div>
      </div>
      <div class="calendar-grid">${["MON","TUE","WED","THU","FRI","SAT","SUN"].map(d=>`<div class="calendar-weekday">${d}</div>`).join("")}
      ${Array.from({length:cells},(_,i)=>{
        const d=shift(start,i),items=tasks.filter(t=>t.date===d);
        return `<button class="calendar-day ${monthKey(d)!==calendarMonth?"outside":""} ${d===TODAY()?"today":""}" data-action="calendar-pick" data-date="${d}">
          <span class="day-number">${Number(d.slice(-2))}</span>
          <div class="calendar-dots">${items.slice(0,4).map(t=>`<span class="${t.completed?"done-dot":""}"></span>`).join("")}</div>
          ${items.length?`<small style="display:block;margin-top:6px;font-size:9px;color:#929bb6">${items.length} task${items.length===1?"":"s"}</small>`:""}
        </button>`;
      }).join("")}</div>
    </section>
    <section class="card" style="margin-top:16px">${cardHead("Tasks in this view","☷","tile-green")}
      <div class="list">${taskRows(tasks.sort((a,b)=>a.date.localeCompare(b.date)))}</div>
    </section>`;
}

function focusView() {
  const f=data.focus;
  const full=(f.mode==="work"?f.work:f.rest)*60;
  const remaining=Math.max(0,f.seconds);
  const p=percent(full-remaining,full);
  return `${heading("PROTECT YOUR ATTENTION","Focus room","One task. One session. No unnecessary distractions.")}
    <section class="content-grid">
      <article class="card timer-panel">
        <span class="pill ${f.mode==="rest"?"green-pill":""}">${f.mode==="work"?"FOCUS SESSION":"BREAK TIME"}</span>
        <div class="ring" id="timerRing" style="--value:${p}%;--ring-color:${f.mode==="work"?"#a58bff":"#71e5bd"}"><div class="ring-content"><strong id="timerText">${formatTime(remaining)}</strong><small>${f.mode==="work"?"STAY IN THE ZONE":"TAKE A BREATH"}</small></div></div>
        <div class="timer-controls"><button class="primary-button" id="timerStart">${timerId?"Pause":"Start focus"}</button><button class="secondary-button" data-action="timer-reset">Reset</button><button class="secondary-button" data-action="timer-switch">${f.mode==="work"?"Take a break":"Back to focus"}</button></div>
        <p class="subtitle">Completed focus sessions: <strong>${f.sessions}</strong></p>
      </article>
      <article class="card">${cardHead("Timer settings","⚙","tile-purple")}
        <form id="timerForm" class="form-stack"><label>Focus length (minutes)<input type="number" name="work" min="1" max="180" value="${f.work}" required></label><label>Break length (minutes)<input type="number" name="rest" min="1" max="60" value="${f.rest}" required></label><button class="secondary-button">Save timer settings</button></form>
        <div class="insight-box" style="margin-top:20px"><strong>Your focus is an asset.</strong><p>Give one important task your full attention before switching to something else.</p></div>
        <div class="stat-number">${f.totalMinutes}<span> minutes</span></div><div class="stat-foot">Total completed focus minutes</div>
      </article>
    </section>`;
}
function formatTime(seconds) {
  seconds=Math.max(0,Math.ceil(seconds));
  return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
}

function notesView() {
  const today=TODAY();
  return `${heading("REFLECT · RESET · GROW","Daily journal","Capture your thoughts, lessons, and small victories.")}
    <section class="card">${cardHead("Today's reflection","✎","tile-purple")}
      <p class="journal-date">${niceDate(today)}</p>
      <label>WHAT WENT WELL TODAY?<textarea id="noteWin" rows="4" placeholder="What are you proud of today?">${esc(data.notes[today]?.win||"")}</textarea></label>
      <label style="margin-top:17px">WHAT CAN YOU IMPROVE TOMORROW?<textarea id="noteImprove" rows="4" placeholder="One thing you can do better...">${esc(data.notes[today]?.improve||"")}</textarea></label>
      <label style="margin-top:17px">THOUGHTS & GRATITUDE<textarea id="noteThoughts" rows="4" placeholder="Write freely...">${esc(data.notes[today]?.thoughts||"")}</textarea></label>
      <p class="stat-foot">Your writing is saved locally as you type.</p>
    </section>
    <section class="card" style="margin-top:16px">${cardHead("Previous reflections","◷","tile-blue")}
      <div class="list">${Object.keys(data.notes).filter(d=>d!==today&&typeof data.notes[d]==="object").sort().reverse().slice(0,10).map(d=>`<div class="list-row"><div class="row-copy"><strong>${esc(niceDate(d))}</strong><small>${esc(data.notes[d].win||data.notes[d].thoughts||data.notes[d].improve||"Reflection saved")}</small></div><button class="secondary-button small-button" data-action="note-open" data-date="${d}">Open</button></div>`).join("")||empty("Your story starts today","Your saved reflections will appear here.")}</div>
    </section>`;
}

function settingsView() {
  return `${heading("YOUR SPACE · YOUR RULES","Settings & backup","Personalize LifeOS and keep your data safe.")}
    <section class="settings-grid">
      <article class="card">${cardHead("Your profile","✎","tile-purple")}
        <form id="profileForm" class="form-stack"><label>Display name<input name="profile" maxlength="40" value="${esc(data.profile)}" required></label><button class="primary-button">Save profile</button></form>
      </article>
      <article class="card">${cardHead("Backup & restore","↓","tile-blue")}
        <p class="subtitle">Export a backup before changing browsers or clearing browser data.</p>
        <div class="form-actions" style="margin-top:16px"><button class="primary-button" data-action="export">Export JSON</button><button class="secondary-button" data-action="import">Import JSON</button></div>
      </article>
      <article class="card">${cardHead("Your local storage","▤","tile-green")}
        <div class="setting-row"><div><strong>Storage</strong><small>Saved on this browser</small></div><span class="pill green-pill">Active</span></div>
        <div class="setting-row"><div><strong>Habits</strong><small>${data.habits.length} activities</small></div><span>◉</span></div>
        <div class="setting-row"><div><strong>Tasks</strong><small>${data.tasks.length} saved tasks</small></div><span>☷</span></div>
        <div class="setting-row"><div><strong>Goals</strong><small>${data.goals.length} saved goals</small></div><span>◎</span></div>
      </article>
      <article class="card">${cardHead("Reset app data","↺","tile-orange")}
        <p class="subtitle">This deletes all LifeOS data stored by this app in this browser. Export a backup first.</p>
        <button class="danger-button" style="margin-top:16px" data-action="reset">Delete all app data</button>
      </article>
    </section>`;
}

const titles={home:"Overview",habits:"Habit tracker",tasks:"Daily tasks",calendar:"Calendar",goals:"Goals",focus:"Focus room",notes:"Daily journal",settings:"Settings & backup"};

function render() {
  $("breadcrumb").textContent=titles[view]||"Overview";
  $("sideName").textContent=data.profile||"My Universe";
  $("avatar").textContent=($("sideName").textContent.trim()[0]||"O").toUpperCase();
  $("topAvatar").textContent=$("avatar").textContent;
  $("taskBadge").textContent=data.tasks.filter(t=>!t.completed).length;
  $("topDate").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
  document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));

  const views={home:homeView,habits:habitsView,tasks:tasksView,calendar:calendarView,goals:goalsView,focus:focusView,notes:notesView,settings:settingsView};
  $("viewRoot").innerHTML=(views[view]||homeView)();
  save();
}
function navigate(next) {
  if(!titles[next]) return;
  view=next;
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}

function pauseTimer() {
  if(timerId) clearInterval(timerId);
  timerId=null;
  timerEnd=0;
}
function tickTimer() {
  data.focus.seconds=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));
  if(data.focus.seconds<=0) {
    pauseTimer();
    if(data.focus.mode==="work") {
      data.focus.sessions++;
      data.focus.totalMinutes+=data.focus.work;
      data.focus.mode="rest";
      data.focus.seconds=data.focus.rest*60;
      toast("Focus complete! Take a well-earned break.");
    } else {
      data.focus.mode="work";
      data.focus.seconds=data.focus.work*60;
      toast("Break complete. Ready to focus?");
    }
    render();
    return;
  }
  const text=$("timerText");
  const ring=$("timerRing");
  if(text) text.textContent=formatTime(data.focus.seconds);
  if(ring) {
    const full=(data.focus.mode==="work"?data.focus.work:data.focus.rest)*60;
    ring.style.setProperty("--value",`${percent(full-data.focus.seconds,full)}%`);
  }
}
function startTimer() {
  if(timerId) {
    pauseTimer(); save(); render(); return;
  }
  if(data.focus.seconds<=0) data.focus.seconds=(data.focus.mode==="work"?data.focus.work:data.focus.rest)*60;
  timerEnd=Date.now()+data.focus.seconds*1000;
  timerId=setInterval(tickTimer,250);
  render();
}

function exportBackup() {
  const blob=new Blob([JSON.stringify({app:"LifeOS",version:1,exportedAt:new Date().toISOString(),data},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=`lifeos-backup-${TODAY()}.json`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast("Backup download started.");
}

function importBackup(file) {
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const parsed=JSON.parse(reader.result);
      const imported=parsed.data||parsed.state||parsed;
      if(!validData(imported)) throw new Error("Invalid backup");
      if(!confirm("Replace your current LifeOS data with this backup? Export your current data first if needed.")) return;
      pauseTimer();
      data={...cloneDefaults(),...imported};
      render();toast("Backup restored successfully.");
    } catch(e) { toast("Invalid LifeOS backup file."); }
    $("importFile").value="";
  };
  reader.readAsText(file);
}

document.addEventListener("click",event=>{
  const nav=event.target.closest("[data-view]");
  if(nav){event.preventDefault();navigate(nav.dataset.view);return;}

  const b=event.target.closest("[data-action]");
  if(!b)return;
  const {action,id,date}=b.dataset;

  if(action==="half"){habitHalf=b.dataset.half;render();return;}

  if(action==="habit-check") {
    const key=id+"|"+date;
    if(date>TODAY()){toast("Future check-ins are disabled.");return;}
    if(checked(id,date)) delete data.checks[key]; else data.checks[key]=true;
    render();return;
  }
  if(action==="task-check") {
    const t=data.tasks.find(t=>t.id===id);
    if(t)t.completed=b.checked;
    render();return;
  }
  if(action==="task-delete") {
    data.tasks=data.tasks.filter(t=>t.id!==id);
    render();toast("Task deleted.");return;
  }
  if(action==="habit-delete") {
    if(!confirm("Remove this habit and its saved check-ins?"))return;
    data.habits=data.habits.filter(h=>h.id!==id);
    Object.keys(data.checks).forEach(k=>{if(k.startsWith(id+"|"))delete data.checks[k];});
    render();toast("Habit removed.");return;
  }
  if(action==="goal-delete") {
    data.goals=data.goals.filter(g=>g.id!==id);
    render();toast("Goal deleted.");return;
  }
  if(action==="goal-progress") return;

  if(action==="month-prev"||action==="month-next") {
    const [y,m]=calendarMonth.split("-").map(Number);
    const d=new Date(y,m-1+(action==="month-next"?1:-1),1);
    calendarMonth=iso(d).slice(0,7);render();return;
  }
  if(action==="calendar-today"){calendarMonth=monthKey(TODAY());render();return;}
  if(action==="calendar-pick") {
    const selected=date;
    view="tasks";render();
    const input=document.querySelector('#taskForm [name="date"]');
    if(input)input.value=selected;
    const title=document.querySelector('#taskForm [name="title"]');
    if(title)title.focus();
    return;
  }
  if(action==="timer-reset") {
    pauseTimer();data.focus.mode="work";data.focus.seconds=data.focus.work*60;render();return;
  }
  if(action==="timer-switch") {
    pauseTimer();data.focus.mode=data.focus.mode==="work"?"rest":"work";
    data.focus.seconds=(data.focus.mode==="work"?data.focus.work:data.focus.rest)*60;
    render();return;
  }
  if(action==="export"){exportBackup();return;}
  if(action==="import"){$("importFile").click();return;}
  if(action==="reset") {
    if(confirm("Permanently delete all LifeOS data stored in this browser?")) {
      pauseTimer();data=cloneDefaults();localStorage.removeItem(KEY);view="home";render();toast("LifeOS has been reset.");
    }
    return;
  }
  if(action==="scroll-habits") {
    $("manageHabits")?.scrollIntoView({behavior:"smooth",block:"start"});return;
  }
  if(action==="note-open") {
    view="notes";render();toast("Your previous reflection is saved. Today is ready to edit.");return;
  }
});

document.addEventListener("change",event=>{
  const t=event.target;
  if(t.id==="taskFilter"){taskFilter=t.value;render();return;}
  if(t.id==="importFile"){importBackup(t.files[0]);return;}
});

document.addEventListener("input",event=>{
  const t=event.target;
  if(t.dataset.action==="goal-progress") {
    const g=data.goals.find(g=>g.id===t.dataset.id);
    if(!g)return;
    g.progress=Number(t.value);
    const row=t.closest(".goal-row");
    if(row) {
      row.querySelector(".goal-percent").textContent=g.progress+"%";
      row.querySelector(".progress-fill").style.width=g.progress+"%";
    }
    save();return;
  }
  if(t.id==="homeNote") {
    data.notes[TODAY()]=t.value;save();return;
  }
  if(["noteWin","noteImprove","noteThoughts"].includes(t.id)) {
    const day=TODAY();
    if(typeof data.notes[day]!=="object"||data.notes[day]===null)data.notes[day]={};
    const key={noteWin:"win",noteImprove:"improve",noteThoughts:"thoughts"}[t.id];
    data.notes[day][key]=t.value;save();
  }
});

document.addEventListener("submit",event=>{
  const form=event.target;
  event.preventDefault();
  const fd=new FormData(form);

  if(form.id==="taskForm") {
    const title=String(fd.get("title")||"").trim();
    if(!title)return;
    data.tasks.push({id:uid(),title,date:String(fd.get("date")||TODAY()),priority:String(fd.get("priority")||"Normal"),completed:false});
    render();toast("Task created.");return;
  }
  if(form.id==="habitForm") {
    const name=String(fd.get("name")||"").trim();
    if(!name)return;
    if(data.habits.some(h=>h.name.toLowerCase()===name.toLowerCase())){toast("That habit already exists.");return;}
    data.habits.push({id:uid(),name});render();toast("Habit added.");return;
  }
  if(form.id==="goalForm") {
    const name=String(fd.get("name")||"").trim();
    if(!name)return;
    data.goals.push({id:uid(),name,progress:0,deadline:String(fd.get("deadline")||"")});
    render();toast("Goal created.");return;
  }
  if(form.id==="profileForm") {
    data.profile=String(fd.get("profile")||"").trim()||"My Universe";
    render();toast("Profile updated.");return;
  }
  if(form.id==="timerForm") {
    const work=Number(fd.get("work")),rest=Number(fd.get("rest"));
    if(!Number.isInteger(work)||work<1||work>180||!Number.isInteger(rest)||rest<1||rest>60){toast("Enter valid timer lengths.");return;}
    pauseTimer();data.focus.work=work;data.focus.rest=rest;
    data.focus.seconds=(data.focus.mode==="work"?work:rest)*60;
    render();toast("Timer settings saved.");return;
  }
});

document.addEventListener("click",event=>{
  if(event.target.id==="timerStart")startTimer();
});

function init() {
  $("viewRoot").addEventListener("submit",()=>{});
  render();
}
init();
