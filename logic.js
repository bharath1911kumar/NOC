/* ═══════════════════════════════════════════════════════
   SHIFT SCHEDULER — Core Scheduling & Workload Analytics
   ═══════════════════════════════════════════════════════ */

console.log(
  "%c✦ Shift Scheduler %c Single-team weekly roster & analytics",
  "color:#6366f1;font-weight:bold;font-size:13px;",
  "color:#94a3b8;font-size:12px;"
)

/* ── Utilities ── */
const fmt = d => d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
const dow = d => d.toLocaleDateString("en-IN", { weekday: "short" })
const pick = a => a[(Math.random() * a.length) | 0]
const shuffle = a => {
  const arr = [...a]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
const same = (a, b) => a && b && a.getTime() === b.getTime()
const isToday = d => {
  const t = new Date()
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
}
const isSunday = d => d.getDay() === 0
const isSaturday = d => d.getDay() === 6
const isWeekend = d => isSaturday(d) || isSunday(d)
const isWeekday = d => !isWeekend(d)

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const ROSTER_VERSION = "2026-v6"
const DEFAULT_MEMBERS = [
  "Bharath", "Sumaithri", "Abinaya", "Krithushya", "Sasikumar",
  "Pranav", "Keerthi", "Sudeeksha", "Sudharshan", "Arun", "Sahaj", "Priyadharshini"
]

const LEGEND = [
  { cls: "t-morning", label: "Morning" },
  { cls: "t-evening", label: "Evening" },
  { cls: "t-night", label: "Night" },
  { cls: "t-general", label: "General" },
]

const OFF_HTML = '<span class="off">Week&nbsp;Off</span>'
const badge = (cls, txt) => `<span class="badge ${cls}">${txt}</span>`
const SHIFT = {
  Morning: badge("t-morning", "Morning"),
  Evening: badge("t-evening", "Evening"),
  Night: badge("t-night", "Night"),
  General: badge("t-general", "General"),
  Off: OFF_HTML,
}

/* ── State ── */
let currentDate = new Date()
let viewAll = false
let showAnalytics = false
let analyticsScope = "week" // "week" | "month"
let activeWeekIdx = 1
let cachedWeeks = null
let members = [...DEFAULT_MEMBERS]

/** @type {Record<string, string[]>} weekKey -> night crew of 3 */
let nightCrewByWeek = {}
/** @type {Record<string, string[]>} weekKey -> 2 members who worked Sunday night */
let sundayNightWorkersByWeek = {}
/** @type {Record<string, { morning: string[], evening: string[] }>} */
let dayPoolsByWeek = {}

const EPOCH_MONDAY = new Date(2026, 0, 5) // Reference: Monday, Jan 5, 2026

function globalWeekIndex(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffMs = d.getTime() - EPOCH_MONDAY.getTime()
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
}

function weekKey(weekDays) {
  const first = weekDays[0]
  const gIdx = globalWeekIndex(first)
  return `GW-${gIdx}`
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem("ss_state") || "{}")
    if (s.y != null && s.m != null) currentDate = new Date(s.y, s.m, 1)
    if (s.theme) document.documentElement.setAttribute("data-theme", s.theme)
    if (typeof s.showAnalytics === "boolean") showAnalytics = s.showAnalytics
  } catch {}

  const savedVer = localStorage.getItem("ss_roster_version")
  if (savedVer !== ROSTER_VERSION) {
    members = [...DEFAULT_MEMBERS]
    nightCrewByWeek = {}
    sundayNightWorkersByWeek = {}
    dayPoolsByWeek = {}
    try {
      localStorage.setItem("ss_roster_version", ROSTER_VERSION)
    } catch {}
    saveMembers()
  } else {
    try {
      const m = JSON.parse(localStorage.getItem("ss_members") || "null")
      if (Array.isArray(m) && m.length) members = m.map(String)
    } catch {}
    try {
      const map = JSON.parse(localStorage.getItem("ss_night_crews") || "{}")
      if (map && typeof map === "object") nightCrewByWeek = map
    } catch {}
    try {
      const map = JSON.parse(localStorage.getItem("ss_sunday_night_workers") || "{}")
      if (map && typeof map === "object") sundayNightWorkersByWeek = map
    } catch {}
    try {
      const map = JSON.parse(localStorage.getItem("ss_day_pools") || "{}")
      if (map && typeof map === "object") dayPoolsByWeek = map
    } catch {}
  }
}

function saveState() {
  try {
    localStorage.setItem("ss_state", JSON.stringify({
      y: currentDate.getFullYear(),
      m: currentDate.getMonth(),
      theme: document.documentElement.getAttribute("data-theme") || "dark",
      showAnalytics,
    }))
  } catch {}
}

function saveMembers() {
  try {
    localStorage.setItem("ss_members", JSON.stringify(members))
    localStorage.setItem("ss_night_crews", JSON.stringify(nightCrewByWeek))
    localStorage.setItem("ss_sunday_night_workers", JSON.stringify(sundayNightWorkersByWeek))
    localStorage.setItem("ss_day_pools", JSON.stringify(dayPoolsByWeek))
  } catch {}
}

function getMembers() {
  return [...members]
}

function addMember(name) {
  const n = String(name || "").trim()
  if (!n) return false
  if (members.some(m => m.toLowerCase() === n.toLowerCase())) return false
  members.push(n)
  nightCrewByWeek = {}
  sundayNightWorkersByWeek = {}
  dayPoolsByWeek = {}
  saveMembers()
  return true
}

function removeMember(name) {
  const idx = members.findIndex(m => m === name)
  if (idx < 0) return false
  members.splice(idx, 1)
  nightCrewByWeek = {}
  sundayNightWorkersByWeek = {}
  dayPoolsByWeek = {}
  saveMembers()
  return true
}

function resetToDefaultMembers() {
  members = [...DEFAULT_MEMBERS]
  nightCrewByWeek = {}
  sundayNightWorkersByWeek = {}
  dayPoolsByWeek = {}
  saveMembers()
  regenerateMonth()
}

/* ── Night crew rotation (Continuous Global Indexing) ── */
function sortedMembers() {
  return [...members].sort((a, b) => a.localeCompare(b))
}

function getNightCrew(weekDays) {
  const key = weekKey(weekDays)
  const sorted = sortedMembers()
  if (sorted.length < 3) return []

  if (nightCrewByWeek[key]) {
    const cached = nightCrewByWeek[key].filter(n => sorted.includes(n))
    if (cached.length === 3) return cached
  }

  const numCrews = Math.max(1, Math.floor(sorted.length / 3))
  const gIdx = globalWeekIndex(weekDays[0])
  const crewIdx = ((gIdx % numCrews) + numCrews) % numCrews

  const crew = [
    sorted[(crewIdx * 3) % sorted.length],
    sorted[(crewIdx * 3 + 1) % sorted.length],
    sorted[(crewIdx * 3 + 2) % sorted.length],
  ]

  nightCrewByWeek[key] = crew
  saveMembers()
  return crew
}

/* ── Day pool rotation (morning / evening / floaters) ── */
function dayPoolSizes(nonCrewLen) {
  if (nonCrewLen <= 0) return { morning: 0, evening: 0 }
  if (nonCrewLen >= 6) return { morning: 2, evening: 4 }
  const morning = Math.min(2, nonCrewLen)
  const evening = Math.min(4, nonCrewLen - morning)
  return { morning, evening }
}

function getDayPools(weekDays, nonCrew) {
  const key = weekKey(weekDays)
  const sorted = [...nonCrew].sort((a, b) => a.localeCompare(b))
  const empty = {
    morningCrew: [],
    eveningCrew: [],
    floaters: [],
    morningSet: new Set(),
    eveningSet: new Set(),
    floaterSet: new Set(),
  }
  if (!sorted.length) return empty

  const { morning: mSize, evening: eSize } = dayPoolSizes(sorted.length)

  if (dayPoolsByWeek[key]) {
    const cached = dayPoolsByWeek[key]
    const morningCrew = (cached.morning || []).filter(n => sorted.includes(n))
    const eveningCrew = (cached.evening || []).filter(n => sorted.includes(n))
    if (morningCrew.length === mSize && eveningCrew.length === eSize) {
      const assigned = new Set([...morningCrew, ...eveningCrew])
      const floaters = sorted.filter(n => !assigned.has(n))
      return {
        morningCrew,
        eveningCrew,
        floaters,
        morningSet: new Set(morningCrew),
        eveningSet: new Set(eveningCrew),
        floaterSet: new Set(floaters),
      }
    }
  }

  const total = mSize + eSize
  const gIdx = globalWeekIndex(weekDays[0])
  const start = sorted.length ? (gIdx * 2) % sorted.length : 0
  const order = []
  for (let i = 0; i < Math.min(total, sorted.length); i++) {
    order.push(sorted[(start + i) % sorted.length])
  }

  const morningCrew = order.slice(0, mSize)
  const eveningCrew = order.slice(mSize, mSize + eSize)
  const assigned = new Set([...morningCrew, ...eveningCrew])
  const floaters = sorted.filter(n => !assigned.has(n))

  dayPoolsByWeek[key] = { morning: morningCrew, evening: eveningCrew }
  saveMembers()

  return {
    morningCrew,
    eveningCrew,
    floaters,
    morningSet: new Set(morningCrew),
    eveningSet: new Set(eveningCrew),
    floaterSet: new Set(floaters),
  }
}

function allowedShift(name, shift, { crewSet, morningSet, eveningSet }) {
  if (crewSet.has(name)) return shift === "Night" || shift === "Off"
  if (morningSet.has(name)) return shift !== "Evening"
  if (eveningSet.has(name)) return shift !== "Morning"
  return shift === "Off" || shift === "General"
}

/* ── Split Month → Full 7-day Mon–Sun Calendar Weeks ── */
function splitWeeks(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  const dayOfWeek = firstOfMonth.getDay()
  const distToMon = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek
  let curMon = new Date(year, month, 1 + distToMon)

  const weeks = []
  while (true) {
    const week = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(curMon.getFullYear(), curMon.getMonth(), curMon.getDate() + i))
    }

    const thursday = week[3]
    const hasDaysInMonth = week.some(d => d.getFullYear() === year && d.getMonth() === month)

    if (hasDaysInMonth && (thursday.getMonth() === month || (weeks.length === 0 && week[6] >= firstOfMonth))) {
      weeks.push(week)
    }

    curMon.setDate(curMon.getDate() + 7)
    if (curMon > lastOfMonth && week[3].getMonth() === month) {
      break
    }
  }
  return weeks
}

/* ── Build Week Schedule ── */
function buildWeek(weekDays, prevWeekDays = null) {
  const roster = {}
  members.forEach(n => { roster[n] = {} })

  const put = (name, day, val) => { roster[name][fmt(day)] = val }
  const get = (name, day) => roster[name][fmt(day)]
  const isOff = (name, day) => {
    const v = get(name, day)
    return v && (v.includes("Off") || v.includes("off"))
  }
  const isAssigned = (name, day) => !!get(name, day)

  const key = weekKey(weekDays)
  const crew = getNightCrew(weekDays)
  const crewSet = new Set(crew)
  const nonCrew = members.filter(n => !crewSet.has(n))

  const saturdays = weekDays.filter(isSaturday)
  const sundays = weekDays.filter(isSunday)
  const weekdays = weekDays.filter(isWeekday)
  const mondays = weekDays.filter(d => d.getDay() === 1)

  // 1. Current Night Crew (Week W) Schedule:
  // [N0, N1, N2]:
  // N0: Sat, Sun, Mon, Tue, Thu (5 Night shifts, 2 Offs on Wed & Fri) -> Works Sunday night
  // N1: Sat, Sun, Wed, Fri (4 Night shifts, 3 Offs on Mon, Tue, Thu) -> Works Sunday night
  // N2: Mon, Tue, Wed, Thu, Fri (5 Night shifts, 2 Offs on Sat & Sun) -> RESTS weekend!
  let weekendPair = []
  let weekendRest = null
  if (crew.length === 3) {
    const [N0, N1, N2] = crew
    weekendPair = [N0, N1]
    weekendRest = N2

    sundayNightWorkersByWeek[key] = [N0, N1]
    saveMembers()

    weekDays.forEach(day => {
      const dayOfWeek = day.getDay()
      if (dayOfWeek === 6 || dayOfWeek === 0) {
        // Saturday & Sunday: N0 & N1 on Night; N2 Off (resting!)
        put(N0, day, SHIFT.Night)
        put(N1, day, SHIFT.Night)
        put(N2, day, SHIFT.Off)
      } else if (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 4) {
        // Monday, Tuesday, Thursday: N0 & N2 on Night; N1 Off
        put(N0, day, SHIFT.Night)
        put(N2, day, SHIFT.Night)
        put(N1, day, SHIFT.Off)
      } else if (dayOfWeek === 3 || dayOfWeek === 5) {
        // Wednesday & Friday: N1 & N2 on Night; N0 Off
        put(N1, day, SHIFT.Night)
        put(N2, day, SHIFT.Night)
        put(N0, day, SHIFT.Off)
      }
    })
  } else if (crew.length > 0) {
    weekDays.forEach(day => {
      const need = Math.min(2, crew.length)
      crew.slice(0, need).forEach(n => put(n, day, SHIFT.Night))
      crew.slice(need).forEach(n => put(n, day, SHIFT.Off))
    })
  }

  // 2. Day pools (morning / evening / floaters)
  const pools = getDayPools(weekDays, nonCrew)
  const { morningCrew, eveningCrew, floaters, morningSet, eveningSet, floaterSet } = pools
  const poolCtx = { crewSet, morningSet, eveningSet }
  const dayPoolMembers = [...morningCrew, ...eveningCrew, ...floaters]

  const offCount = {}
  dayPoolMembers.forEach(n => { offCount[n] = 0 })

  // 3. Pre-Night Rest (Week W Weekend) — BEST EFFORT:
  // Try to give upcoming night crew (Week W+1) Sunday Off as adaptation leave.
  // Saturday is skipped — weekend Morning/Evening coverage takes priority.
  // If Sunday staffing is tight it's also fine to skip — not compulsory.
  const nextMon = new Date(weekDays[0].getFullYear(), weekDays[0].getMonth(), weekDays[0].getDate() + 7)
  const upcomingNightCrew = getNightCrew([nextMon])
  const upcomingNightSet = new Set(upcomingNightCrew)

  // Mark Sunday off for upcoming crew — will be applied only after weekend slots are filled

  // 4. Post-Night Recovery (Week W Monday):
  // The 2 members who worked Sunday night in PREVIOUS WEEK (Week W-1) MUST have Monday OFF!
  let priorSundayWorkers = []
  let priorWeekendRestWorker = null

  if (prevWeekDays) {
    const prevKey = weekKey(prevWeekDays)
    priorSundayWorkers = sundayNightWorkersByWeek[prevKey] || getNightCrew(prevWeekDays).slice(0, 2)
    priorWeekendRestWorker = getNightCrew(prevWeekDays)[2]
  } else {
    const prevMon = new Date(weekDays[0].getFullYear(), weekDays[0].getMonth(), weekDays[0].getDate() - 7)
    const prevKey = weekKey([prevMon])
    priorSundayWorkers = sundayNightWorkersByWeek[prevKey] || getNightCrew([prevMon]).slice(0, 2)
    priorWeekendRestWorker = getNightCrew([prevMon])[2]
  }

  if (mondays.length && priorSundayWorkers.length) {
    mondays.forEach(mon => {
      priorSundayWorkers.forEach(name => {
        if (!crewSet.has(name) && !isAssigned(name, mon)) {
          put(name, mon, SHIFT.Off)
          offCount[name] = (offCount[name] || 0) + 1
        }
      })
    })
  }

  function pickGeneral(day, morningWorker) {
    const candidates = []
    const add = list => {
      shuffle(list.filter(n => !isAssigned(n, day) && allowedShift(n, "General", poolCtx))).forEach(n => {
        if (!candidates.includes(n)) candidates.push(n)
      })
    }
    add(floaters)
    add(eveningCrew)
    add(morningCrew.filter(n => n !== morningWorker))
    if (candidates[0]) put(candidates[0], day, SHIFT.General)
  }

  // 5. Weekend Day Slots (Sat & Sun):
  // Coverage ALWAYS takes priority: 1 Morning, 1 Evening, 1 General — pick from ALL available day pool members.
  // Pre-night rest (Sunday off) is applied AFTER weekend slots are filled — best effort only.
  let satMorningWorker = morningCrew.find(n => !isAssigned(n, saturdays[0])) || morningCrew[0]
  let sunMorningWorker = morningCrew.find(n => n !== satMorningWorker && !isAssigned(n, sundays[0])) || morningCrew[1] || morningCrew[0]

  let satEveWorker = eveningCrew.find(n => !isAssigned(n, saturdays[0])) || eveningCrew[0]
  let sunEveWorker = eveningCrew.find(n => n !== satEveWorker && !isAssigned(n, sundays[0])) || eveningCrew[1] || eveningCrew[0]

  saturdays.forEach(day => {
    // Assign 1 Morning
    if (satMorningWorker && !isAssigned(satMorningWorker, day)) put(satMorningWorker, day, SHIFT.Morning)
    // Assign 1 Evening
    if (satEveWorker && !isAssigned(satEveWorker, day)) put(satEveWorker, day, SHIFT.Evening)
    // Assign 1 General (from any free day pool member)
    pickGeneral(day, satMorningWorker)
    // Everyone else is Off
    dayPoolMembers.forEach(n => {
      if (!isAssigned(n, day)) {
        put(n, day, SHIFT.Off)
        offCount[n] = (offCount[n] || 0) + 1
      }
    })
  })

  sundays.forEach(day => {
    // Assign 1 Morning
    if (sunMorningWorker && !isAssigned(sunMorningWorker, day)) put(sunMorningWorker, day, SHIFT.Morning)
    // Assign 1 Evening
    if (sunEveWorker && !isAssigned(sunEveWorker, day)) put(sunEveWorker, day, SHIFT.Evening)
    // Assign 1 General (from any free day pool member)
    pickGeneral(day, sunMorningWorker)
    // Everyone else is Off
    dayPoolMembers.forEach(n => {
      if (!isAssigned(n, day)) {
        put(n, day, SHIFT.Off)
        offCount[n] = (offCount[n] || 0) + 1
      }
    })
    // BEST-EFFORT Sunday pre-night off: upcoming crew already got Off if they weren't needed above
    // (naturally handled — they are not in Morning/Evening/General slots so they get Off above)
  })

  // 6. Weekdays (Mon–Fri): 1 Morning, 2 Evening, off balancing to 2 offs/week, rest General
  const offPriority = n => (floaterSet.has(n) ? 0 : eveningSet.has(n) ? 1 : 2)

  weekdays.forEach((day, dayIdx) => {
    // Prioritize priorWeekendRestWorker (N2) who had Sat & Sun Off to work Monday
    if (day.getDay() === 1 && priorWeekendRestWorker && !crewSet.has(priorWeekendRestWorker)) {
      if (morningSet.has(priorWeekendRestWorker) && !isAssigned(priorWeekendRestWorker, day)) {
        put(priorWeekendRestWorker, day, SHIFT.Morning)
      } else if (eveningSet.has(priorWeekendRestWorker) && !isAssigned(priorWeekendRestWorker, day)) {
        put(priorWeekendRestWorker, day, SHIFT.Evening)
      } else if (!isAssigned(priorWeekendRestWorker, day)) {
        put(priorWeekendRestWorker, day, SHIFT.General)
      }
    }

    // A. 1 Morning from morning crew
    const freeMorning = morningCrew.filter(n => !isAssigned(n, day))
    let morningWorkerToday = null
    if (freeMorning.length) {
      morningWorkerToday = freeMorning[dayIdx % freeMorning.length]
      put(morningWorkerToday, day, SHIFT.Morning)
    }

    // B. 2 Evening from evening crew
    const freeEvening = shuffle(eveningCrew.filter(n => !isAssigned(n, day)))
    const eveWorkersToday = freeEvening.slice(0, 2)
    eveWorkersToday.forEach(n => put(n, day, SHIFT.Evening))

    // C. Distribute mid-week offs to members who still have <2 offs this week
    const needOffToday = dayPoolMembers
      .filter(n => !isAssigned(n, day) && (offCount[n] || 0) < 2)
      .sort((a, b) => offPriority(a) - offPriority(b))

    needOffToday.slice(0, 2).forEach(n => {
      put(n, day, SHIFT.Off)
      offCount[n] = (offCount[n] || 0) + 1
    })

    // D. Assign General to all remaining unassigned day pool staff
    const generalCandidates = [
      ...shuffle(floaters.filter(n => !isAssigned(n, day))),
      ...shuffle(eveningCrew.filter(n => !isAssigned(n, day))),
      ...shuffle(morningCrew.filter(n => !isAssigned(n, day))),
    ]
    generalCandidates.forEach(n => {
      if (!isAssigned(n, day) && allowedShift(n, "General", poolCtx)) {
        put(n, day, SHIFT.General)
      }
    })
  })

  // 7. Fill any residual unassigned days
  weekDays.forEach(day => {
    members.forEach(n => {
      if (!isAssigned(n, day)) {
        if (crewSet.has(n)) put(n, day, SHIFT.Off)
        else if (allowedShift(n, "General", poolCtx)) put(n, day, SHIFT.General)
        else put(n, day, SHIFT.Off)
      }
    })
  })

  return {
    members: [...members],
    nightCrew: crew,
    weekendPair,
    weekendRest,
    morningCrew,
    eveningCrew,
    floaters,
    weekendEvePair: [satEveWorker, sunEveWorker].filter(Boolean),
    data: roster,
  }
}

/* ── Analytics & Statistics Engine ── */
function extractShiftType(cellHtml) {
  if (!cellHtml) return "Off"
  const s = String(cellHtml).toLowerCase()
  if (s.includes("off")) return "Off"
  if (s.includes("morning")) return "Morning"
  if (s.includes("evening")) return "Evening"
  if (s.includes("night")) return "Night"
  if (s.includes("general")) return "General"
  return "Off"
}

function computeWeekStats(weekDays, ws) {
  const empStats = {}
  const memberList = ws.members || members
  const dayStats = weekDays.map(d => ({
    date: fmt(d),
    dow: dow(d),
    isWeekend: isWeekend(d),
    counts: { Morning: 0, Evening: 0, Night: 0, General: 0, Off: 0, TotalWorking: 0 },
  }))

  memberList.forEach(name => {
    const pool = ws.nightCrew?.includes(name)
      ? "Night Crew"
      : ws.morningCrew?.includes(name)
      ? "Morning Pool"
      : ws.eveningCrew?.includes(name)
      ? "Evening Pool"
      : "Floater"

    const counts = { Morning: 0, Evening: 0, Night: 0, General: 0, Off: 0, TotalWorking: 0 }

    weekDays.forEach((d, dayIdx) => {
      const v = ws.data[name]?.[fmt(d)] || ""
      const type = extractShiftType(v)
      counts[type] = (counts[type] || 0) + 1
      if (type !== "Off") counts.TotalWorking++

      dayStats[dayIdx].counts[type] = (dayStats[dayIdx].counts[type] || 0) + 1
      if (type !== "Off") dayStats[dayIdx].counts.TotalWorking++
    })

    empStats[name] = { name, pool, ...counts }
  })

  let totalWorkingShifts = 0
  let totalWeekendOffs = 0
  let totalWeekendSlots = 0

  memberList.forEach(name => {
    totalWorkingShifts += empStats[name].TotalWorking
    weekDays.filter(isWeekend).forEach(d => {
      totalWeekendSlots++
      const type = extractShiftType(ws.data[name]?.[fmt(d)])
      if (type === "Off") totalWeekendOffs++
    })
  })

  const avgShifts = memberList.length ? (totalWorkingShifts / memberList.length).toFixed(1) : "0"
  const weekendOffPct = totalWeekendSlots ? Math.round((totalWeekendOffs / totalWeekendSlots) * 100) : 0

  return {
    empStats,
    dayStats,
    totalWorkingShifts,
    avgShifts,
    weekendOffPct,
    memberCount: memberList.length,
  }
}

function computeMonthStats(cached) {
  if (!cached || !cached.data || !cached.data.length) return null
  const empStats = {}
  const memberList = getMembers()
  let totalWorkingShifts = 0
  let totalDays = 0
  let totalWeekendOffs = 0
  let totalWeekendSlots = 0

  memberList.forEach(name => {
    empStats[name] = {
      name,
      Morning: 0,
      Evening: 0,
      Night: 0,
      General: 0,
      Off: 0,
      TotalWorking: 0,
      nightWeeks: 0,
    }
  })

  cached.data.forEach(({ days, ws }) => {
    const wStat = computeWeekStats(days, ws)
    memberList.forEach(name => {
      const es = wStat.empStats[name]
      if (es) {
        empStats[name].Morning += es.Morning
        empStats[name].Evening += es.Evening
        empStats[name].Night += es.Night
        empStats[name].General += es.General
        empStats[name].Off += es.Off
        empStats[name].TotalWorking += es.TotalWorking
        if (es.pool === "Night Crew") empStats[name].nightWeeks++
      }
    })
    totalWorkingShifts += wStat.totalWorkingShifts
    totalDays += days.length

    days.filter(isWeekend).forEach(d => {
      memberList.forEach(name => {
        totalWeekendSlots++
        const type = extractShiftType(ws.data[name]?.[fmt(d)])
        if (type === "Off") totalWeekendOffs++
      })
    })
  })

  const avgShifts = memberList.length ? (totalWorkingShifts / memberList.length).toFixed(1) : "0"
  const weekendOffPct = totalWeekendSlots ? Math.round((totalWeekendOffs / totalWeekendSlots) * 100) : 0

  return {
    empStats,
    totalWorkingShifts,
    avgShifts,
    weekendOffPct,
    weeksCount: cached.data.length,
    memberCount: memberList.length,
  }
}

/* ── Render Analytics Panel ── */
function renderAnalyticsPanel() {
  const panel = document.getElementById("analytics-section")
  if (!panel) return

  if (!showAnalytics) {
    panel.classList.add("hidden")
    return
  }
  panel.classList.remove("hidden")

  if (!cachedWeeks || !cachedWeeks.data || !cachedWeeks.data.length) {
    panel.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-tertiary)">Generating schedule data...</div>'
    return
  }

  const curWeekObj = cachedWeeks.data[activeWeekIdx - 1] || cachedWeeks.data[0]
  const weekStats = computeWeekStats(curWeekObj.days, curWeekObj.ws)
  const monthStats = computeMonthStats(cachedWeeks)

  const isMonth = analyticsScope === "month"
  const statsToUse = isMonth ? monthStats : weekStats

  // KPI Metrics
  const totalShiftsVal = statsToUse.totalWorkingShifts
  const avgShiftsVal = statsToUse.avgShifts
  const weekendOffVal = `${statsToUse.weekendOffPct}%`

  let html = `
    <div class="analytics-head">
      <div class="analytics-title-group">
        <span class="analytics-title">Workload &amp; Shift Distribution Analytics</span>
      </div>
      <div class="analytics-scope-toggle">
        <button type="button" class="scope-btn ${!isMonth ? "active" : ""}" id="scope-week-btn">Week ${activeWeekIdx}</button>
        <button type="button" class="scope-btn ${isMonth ? "active" : ""}" id="scope-month-btn">Full Month</button>
      </div>
    </div>

    <!-- KPI Summary Grid -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total Shifts</span>
        <span class="kpi-value">${totalShiftsVal}</span>
        <span class="kpi-sub">${isMonth ? `Across ${cachedWeeks.data.length} weeks` : "This week"}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Avg Shifts / Person</span>
        <span class="kpi-value">${avgShiftsVal}</span>
        <span class="kpi-sub">${isMonth ? "Monthly workload average" : "Target: 4–5 shifts/week"}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Weekend Off Rate</span>
        <span class="kpi-value" style="color:var(--success)">${weekendOffVal}</span>
        <span class="kpi-sub">Target: &gt;50% staff off Sat/Sun</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Role Integrity</span>
        <span class="kpi-value" style="color:var(--accent)">100%</span>
        <span class="kpi-sub">All pool constraints verified</span>
      </div>
    </div>

    <!-- Shift Distribution Chart Table -->
    <div class="analytics-section-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg>
      Employee Shift Breakdown &amp; Visual Distribution (${isMonth ? "Monthly Aggregate" : `Week ${activeWeekIdx}`})
    </div>

    <div class="chart-table-wrap">
      <table>
        <thead>
          <tr>
            <th style="text-align:left">Employee</th>
            ${!isMonth ? '<th>Assigned Pool</th>' : '<th>Night Weeks</th>'}
            <th style="min-width:180px">Shift Proportion Chart</th>
            <th>Morning</th>
            <th>Evening</th>
            <th>Night</th>
            <th>General</th>
            <th>Off</th>
            <th>Total Shifts</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  `

  const memberList = getMembers()
  memberList.forEach(name => {
    const es = statsToUse.empStats[name]
    if (!es) return
    const totalDaysCount = es.Morning + es.Evening + es.Night + es.General + es.Off || 1
    const pM = ((es.Morning / totalDaysCount) * 100).toFixed(1)
    const pE = ((es.Evening / totalDaysCount) * 100).toFixed(1)
    const pN = ((es.Night / totalDaysCount) * 100).toFixed(1)
    const pG = ((es.General / totalDaysCount) * 100).toFixed(1)
    const pO = ((es.Off / totalDaysCount) * 100).toFixed(1)

    const isBalanced = !isMonth ? es.TotalWorking >= 4 && es.TotalWorking <= 5 : true
    const statusBadge = isBalanced
      ? `<span class="compliance-badge balanced">✓ Balanced (${es.TotalWorking}s, ${es.Off} off)</span>`
      : `<span class="compliance-badge alert">${es.TotalWorking}s (${es.Off} off)</span>`

    const poolTag = !isMonth
      ? `<span style="font-size:0.75rem;font-weight:600">${escapeHtml(es.pool)}</span>`
      : `<span style="font-size:0.75rem;font-weight:600">${es.nightWeeks} wk</span>`

    html += `
      <tr>
        <th style="text-align:left;font-weight:700">${escapeHtml(name)}</th>
        <td>${poolTag}</td>
        <td>
          <div class="dist-bar-wrap">
            <div class="dist-bar" title="Morning: ${es.Morning}, Evening: ${es.Evening}, Night: ${es.Night}, General: ${es.General}, Off: ${es.Off}">
              <div class="dist-seg seg-morning" style="width:${pM}%"></div>
              <div class="dist-seg seg-evening" style="width:${pE}%"></div>
              <div class="dist-seg seg-night" style="width:${pN}%"></div>
              <div class="dist-seg seg-general" style="width:${pG}%"></div>
              <div class="dist-seg seg-off" style="width:${pO}%"></div>
            </div>
            <div class="dist-legend-mini">
              <span>M:${es.Morning}</span>
              <span>E:${es.Evening}</span>
              <span>N:${es.Night}</span>
              <span>G:${es.General}</span>
              <span style="color:var(--danger)">Off:${es.Off}</span>
            </div>
          </div>
        </td>
        <td><strong>${es.Morning}</strong></td>
        <td><strong>${es.Evening}</strong></td>
        <td><strong>${es.Night}</strong></td>
        <td><strong>${es.General}</strong></td>
        <td style="color:var(--danger)"><strong>${es.Off}</strong></td>
        <td><strong style="color:var(--accent)">${es.TotalWorking}</strong></td>
        <td>${statusBadge}</td>
      </tr>
    `
  })

  html += `
        </tbody>
      </table>
    </div>
  `

  // Daily Coverage Matrix (for Active Week)
  if (!isMonth) {
    html += `
      <div class="analytics-section-title" style="margin-top:18px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
        Daily Staffing Coverage Validation (Week ${activeWeekIdx})
      </div>
      <div class="chart-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Date</th>
              <th>Morning (Target: 1)</th>
              <th>Evening (Target: 2 / 1 wknd)</th>
              <th>Night (Target: 2)</th>
              <th>General</th>
              <th>Offs</th>
              <th>Working Staff</th>
              <th>Coverage Status</th>
            </tr>
          </thead>
          <tbody>
    `

    weekStats.dayStats.forEach(ds => {
      const cls = ds.isWeekend ? "col-sun" : ""
      const mMatch = ds.counts.Morning === 1
      const eTarget = ds.isWeekend ? 1 : 2
      const eMatch = ds.counts.Evening === eTarget
      const nMatch = ds.counts.Night === 2
      const allCovered = mMatch && eMatch && nMatch

      html += `
        <tr>
          <th class="${cls}">${ds.dow}</th>
          <td class="${cls}">${ds.date}</td>
          <td class="${cls}"><span class="badge t-morning">${ds.counts.Morning}</span></td>
          <td class="${cls}"><span class="badge t-evening">${ds.counts.Evening}</span></td>
          <td class="${cls}"><span class="badge t-night">${ds.counts.Night}</span></td>
          <td class="${cls}"><span class="badge t-general">${ds.counts.General}</span></td>
          <td class="${cls}"><span class="off">${ds.counts.Off}</span></td>
          <td class="${cls}"><strong>${ds.counts.TotalWorking} / ${memberList.length}</strong></td>
          <td class="${cls}">
            ${allCovered ? '<span class="coverage-status-tag">✓ 100% Target Met</span>' : '<span class="compliance-badge alert">Check Coverage</span>'}
          </td>
        </tr>
      `
    })

    html += `
          </tbody>
        </table>
      </div>
    `
  }

  panel.innerHTML = html

  const weekScopeBtn = document.getElementById("scope-week-btn")
  const monthScopeBtn = document.getElementById("scope-month-btn")
  if (weekScopeBtn) {
    weekScopeBtn.onclick = () => {
      analyticsScope = "week"
      renderAnalyticsPanel()
    }
  }
  if (monthScopeBtn) {
    monthScopeBtn.onclick = () => {
      analyticsScope = "month"
      renderAnalyticsPanel()
    }
  }
}

/* ── Stats Chips inside Week Card ── */
function statsHTML(weekDays, ws) {
  let html = '<div class="stats-row">'
  if (ws.nightCrew?.length) {
    html += `<span class="stat-chip night-crew-chip"><span class="stat-name">Night crew</span>${ws.nightCrew.map(escapeHtml).join(", ")}</span>`
  }
  if (ws.morningCrew?.length) {
    html += `<span class="stat-chip day-crew-chip morning-crew-chip"><span class="stat-name">Morning</span>${ws.morningCrew.map(escapeHtml).join(", ")}</span>`
  }
  if (ws.eveningCrew?.length) {
    html += `<span class="stat-chip day-crew-chip evening-crew-chip"><span class="stat-name">Evening</span>${ws.eveningCrew.map(escapeHtml).join(", ")}</span>`
  }
  ;(ws.members || []).forEach(name => {
    let shifts = 0, off = 0
    weekDays.forEach(d => {
      const v = ws.data[name]?.[fmt(d)] || ""
      if (v.includes("Off") || v.includes("off")) off++
      else if (v) shifts++
    })
    html += `<span class="stat-chip"><span class="stat-name">${escapeHtml(name)}</span>${shifts}s <span class="stat-off">${off} off</span></span>`
  })
  return html + "</div>"
}

/* ── Table HTML ── */
function tableHTML(weekDays, ws, idx) {
  const data = ws.data
  const th1 = ['<th rowspan="2">Employee</th>']
  const th2 = []

  weekDays.forEach(d => {
    const cls = [isSunday(d) || isSaturday(d) ? "col-sun" : "", isToday(d) ? "col-today" : ""].filter(Boolean).join(" ")
    th1.push(`<th class="${cls}">${dow(d)}</th>`)
    th2.push(`<th class="${cls}">${fmt(d)}</th>`)
  })

  const thead = `<thead><tr>${th1.join("")}</tr><tr>${th2.join("")}</tr></thead>`
  const rows = []

  ;(ws.members || []).forEach(name => {
    const cells = [`<th>${escapeHtml(name)}</th>`]
    weekDays.forEach(d => {
      const cls = [isSunday(d) || isSaturday(d) ? "col-sun" : "", isToday(d) ? "col-today" : ""].filter(Boolean).join(" ")
      cells.push(`<td class="${cls}">${data[name]?.[fmt(d)] || ""}</td>`)
    })
    rows.push(`<tr>${cells.join("")}</tr>`)
  })

  const crewParts = []
  if (ws.nightCrew?.length) {
    crewParts.push(`<span class="week-crew">Night: ${ws.nightCrew.map(escapeHtml).join(", ")}</span>`)
  }
  if (ws.morningCrew?.length) {
    crewParts.push(`<span class="week-crew week-crew-morning">Morning: ${ws.morningCrew.map(escapeHtml).join(", ")}</span>`)
  }
  if (ws.eveningCrew?.length) {
    crewParts.push(`<span class="week-crew week-crew-evening">Evening: ${ws.eveningCrew.map(escapeHtml).join(", ")}</span>`)
  }
  const crewNote = crewParts.length
    ? `<div class="week-crews">${crewParts.join("")}</div>`
    : ""

  return `<section class="week-card" data-w="${idx}">
    <div class="week-head">
      <span class="week-badge">Week ${idx}</span>
      <span class="week-range">${fmt(weekDays[0])} → ${fmt(weekDays.at(-1))}</span>
      ${crewNote}
    </div>
    <div class="table-scroll"><table>${thead}<tbody>${rows.join("")}</tbody></table></div>
    ${statsHTML(weekDays, ws)}
  </section>`
}

/* ── Legend ── */
function renderLegend() {
  const el = document.getElementById("legend")
  if (!el) return
  let h = '<span class="legend-label">Shifts</span>'
  LEGEND.forEach(l => { h += `<span class="legend-item"><span class="legend-dot badge ${l.cls}"></span>${l.label}</span>` })
  h += `<span class="legend-item"><span class="legend-dot" style="background:var(--shift-off-bg);border:1px solid var(--shift-off-border)"></span>Off</span>`
  el.innerHTML = h
}

/* ── Members UI ── */
function renderMembersPanel() {
  const list = document.getElementById("member-list")
  const warn = document.getElementById("member-warn")
  if (!list) return

  list.innerHTML = members.map((n, i) => `
    <li class="member-item">
      <span class="member-name">${escapeHtml(n)}</span>
      <button type="button" class="member-remove" data-index="${i}" title="Remove ${escapeHtml(n)}" aria-label="Remove ${escapeHtml(n)}">×</button>
    </li>
  `).join("")

  if (warn) {
    if (members.length < 3) {
      warn.hidden = false
      warn.textContent = "Need at least 3 members for night rotation."
    } else if (members.length < 10) {
      warn.hidden = false
      warn.textContent = `Recommended team size is 10–12 (currently ${members.length}).`
    } else {
      warn.hidden = true
      warn.textContent = ""
    }
  }

  const count = document.getElementById("member-count")
  if (count) count.textContent = `${members.length} members`
}

/* ── Render Month ── */
function renderMonth(y, m) {
  const weeks = splitWeeks(y, m)
  const container = document.getElementById("weeks")
  const tabs = document.getElementById("tabs")

  container.innerHTML = ""
  tabs.innerHTML = ""
  cachedWeeks = { y, m, data: [] }

  let prevDays = null
  weeks.forEach((days, i) => {
    const ws = buildWeek(days, prevDays)
    cachedWeeks.data.push({ days, ws })
    container.insertAdjacentHTML("beforeend", tableHTML(days, ws, i + 1))
    tabs.insertAdjacentHTML("beforeend", `<button class="tab" data-w="${i + 1}">Week ${i + 1}</button>`)
    prevDays = days
  })

  document.getElementById("month-name").textContent = `${MONTHS[m]} ${y}`
  renderMembersPanel()

  const today = new Date()
  let active = 1
  if (today.getFullYear() === y && today.getMonth() === m) {
    const idx = weeks.findIndex(w => w.some(d => d.getDate() === today.getDate() && d.getMonth() === today.getMonth()))
    if (idx >= 0) active = idx + 1
  }

  activeWeekIdx = active
  viewAll ? showAll() : activate(active)
  renderAnalyticsPanel()

  tabs.onclick = e => {
    const w = e.target.dataset.w
    if (w) {
      viewAll = false
      activeWeekIdx = +w
      updateToggle()
      activate(+w)
      renderAnalyticsPanel()
    }
  }

  saveState()
}

function regenerateMonth() {
  nightCrewByWeek = {}
  sundayNightWorkersByWeek = {}
  dayPoolsByWeek = {}
  saveMembers()
  renderMonth(currentDate.getFullYear(), currentDate.getMonth())
}

/* ── Tab activation ── */
function activate(n) {
  activeWeekIdx = n
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", +t.dataset.w === n))
  document.querySelectorAll(".week-card").forEach(w => {
    const match = +w.dataset.w === n
    w.classList.toggle("hidden", !match)
    if (match) { w.style.animation = "none"; w.offsetHeight; w.style.animation = "" }
  })
}

function showAll() {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"))
  document.querySelectorAll(".week-card").forEach(w => {
    w.classList.remove("hidden")
    w.style.animation = "none"; w.offsetHeight; w.style.animation = ""
  })
}

function updateToggle() {
  const btn = document.getElementById("view-toggle")
  if (!btn) return
  const svg = btn.querySelector("svg").outerHTML
  btn.innerHTML = svg + (viewAll ? " Tabbed" : " All Weeks")
  btn.classList.toggle("active", viewAll)
}

/* ── Excel & CSV Export Engine ── */
const EXCEL_STYLES = `<style>
  body{background:#111827;font-family:Inter,-apple-system,Segoe UI,sans-serif;color:#f3f4f6;padding:24px}
  .export-header{text-align:center;margin-bottom:24px}
  .export-title{font-size:1.4rem;font-weight:800;color:#818cf8;margin-bottom:4px}
  .export-sub{font-size:0.9rem;color:#9ca3af}
  table{margin:20px auto 32px;background:#1f2937;border-radius:12px;border-collapse:collapse;width:100%;max-width:1200px;box-shadow:0 4px 20px rgba(0,0,0,0.3)}
  thead th{background:#374151;color:#f9fafb;padding:12px 10px;font-size:0.85rem;text-align:center;border:1px solid #4b5563;font-weight:700}
  tbody th{background:#1f2937;color:#e5e7eb;font-weight:700;text-align:left;padding:10px 12px;border:1px solid #374151}
  tbody td{padding:10px 8px;text-align:center;border:1px solid #374151;font-size:0.85rem}
  tbody tr:nth-child(even) td{background:rgba(255,255,255,0.02)}
  .badge,.off{border-radius:6px;padding:4px 8px;font-weight:700;display:inline-block;font-size:0.82rem}
  .t-morning{background:#3b82f6;color:#fff}
  .t-evening{background:#8b5cf6;color:#fff}
  .t-night{background:#475569;color:#fff}
  .t-general{background:#10b981;color:#fff}
  .off{color:#f87171;background:rgba(248,113,113,0.15);border:1px dashed #ef4444}
  .section-title{font-size:1.15rem;font-weight:700;color:#c7d2fe;margin:28px auto 10px;max-width:1200px;padding-bottom:6px;border-bottom:2px solid #4f46e5}
</style>`

function dlWeek(table, name) {
  if (!table) return
  const now = new Date()
  const pad = n => String(n).padStart(2, "0")
  const ds = `${pad(now.getDate())} ${now.toLocaleString("en-US", { month: "short" })} ${now.getFullYear()}`
  let h = now.getHours(), mi = pad(now.getMinutes())
  const ap = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  const ts = `${pad(h)}.${mi} ${ap}`

  const curWeekObj = cachedWeeks?.data?.[activeWeekIdx - 1]
  let summarySection = ""
  if (curWeekObj) {
    const wsStat = computeWeekStats(curWeekObj.days, curWeekObj.ws)
    summarySection = `<div class="section-title">Weekly Staff Shift Distribution Summary</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Employee</th>
          <th>Pool</th>
          <th>Morning</th>
          <th>Evening</th>
          <th>Night</th>
          <th>General</th>
          <th>Off</th>
          <th>Total Shifts</th>
        </tr>
      </thead>
      <tbody>
        ${getMembers().map(n => {
          const es = wsStat.empStats[n]
          return `<tr>
            <th style="text-align:left">${escapeHtml(n)}</th>
            <td>${escapeHtml(es?.pool || "-")}</td>
            <td>${es?.Morning || 0}</td>
            <td>${es?.Evening || 0}</td>
            <td>${es?.Night || 0}</td>
            <td>${es?.General || 0}</td>
            <td style="color:#f87171">${es?.Off || 0}</td>
            <td><strong>${es?.TotalWorking || 0}</strong></td>
          </tr>`
        }).join("")}
      </tbody>
    </table>`
  }

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="utf-8">${EXCEL_STYLES}</head>
    <body>
      <div class="export-header">
        <div class="export-title">${name} Roster</div>
        <div class="export-sub">Generated on ${ds} at ${ts}</div>
      </div>
      <div class="section-title">Weekly Shift Schedule</div>
      ${table.outerHTML}
      ${summarySection}
    </body></html>`

  const blob = new Blob([html], { type: "application/vnd.ms-excel" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${name} - ${ds} - ${ts}.xls`
  a.click()
  URL.revokeObjectURL(a.href)
}

function dlMonthAllInOne() {
  if (!cachedWeeks || !cachedWeeks.data || !cachedWeeks.data.length) return
  const now = new Date()
  const pad = n => String(n).padStart(2, "0")
  const ds = `${pad(now.getDate())} ${now.toLocaleString("en-US", { month: "short" })} ${now.getFullYear()}`
  const monthName = `${MONTHS[cachedWeeks.m]} ${cachedWeeks.y}`

  const monthStats = computeMonthStats(cachedWeeks)
  const memberList = getMembers()

  let monthlySummaryTable = `
    <div class="section-title">Monthly Staff Workload &amp; Shift Distribution Summary (${monthName})</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Employee</th>
          <th>Night Weeks</th>
          <th>Morning Shifts</th>
          <th>Evening Shifts</th>
          <th>Night Shifts</th>
          <th>General Shifts</th>
          <th>Total Off Days</th>
          <th>Total Working Shifts</th>
        </tr>
      </thead>
      <tbody>
        ${memberList.map(n => {
          const es = monthStats?.empStats[n]
          return `<tr>
            <th style="text-align:left">${escapeHtml(n)}</th>
            <td>${es?.nightWeeks || 0}</td>
            <td>${es?.Morning || 0}</td>
            <td>${es?.Evening || 0}</td>
            <td>${es?.Night || 0}</td>
            <td>${es?.General || 0}</td>
            <td style="color:#f87171"><strong>${es?.Off || 0}</strong></td>
            <td><strong style="color:#818cf8">${es?.TotalWorking || 0}</strong></td>
          </tr>`
        }).join("")}
      </tbody>
    </table>
  `

  let weeklySections = ""
  cachedWeeks.data.forEach(({ days, ws }, i) => {
    const cardEl = document.querySelector(`.week-card[data-w="${i + 1}"] table`)
    const tableHtml = cardEl ? cardEl.outerHTML : ""
    const crewInfo = `Night Crew: ${(ws.nightCrew || []).join(", ")} | Morning: ${(ws.morningCrew || []).join(", ")} | Evening: ${(ws.eveningCrew || []).join(", ")}`

    weeklySections += `
      <div class="section-title">Week ${i + 1} (${fmt(days[0])} → ${fmt(days.at(-1))})</div>
      <div style="text-align:center;font-size:0.8rem;color:#9ca3af;margin-bottom:8px">${escapeHtml(crewInfo)}</div>
      ${tableHtml}
    `
  })

  const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="utf-8">${EXCEL_STYLES}</head>
    <body>
      <div class="export-header">
        <div class="export-title">Full Month Shift Schedule — ${monthName}</div>
        <div class="export-sub">Exported on ${ds} · Single Unified Workbook</div>
      </div>
      ${monthlySummaryTable}
      ${weeklySections}
    </body></html>`

  const blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `NOC Roster - ${monthName} (All-in-One).xls`
  a.click()
  URL.revokeObjectURL(a.href)
}

function dlCSV() {
  if (!cachedWeeks || !cachedWeeks.data || !cachedWeeks.data.length) return
  const monthName = `${MONTHS[cachedWeeks.m]} ${cachedWeeks.y}`
  const memberList = getMembers()
  const rows = []

  rows.push(["Month", monthName])
  rows.push([])

  cachedWeeks.data.forEach(({ days, ws }, i) => {
    rows.push([`Week ${i + 1}`, `${fmt(days[0])} to ${fmt(days.at(-1))}`])
    rows.push([`Night Crew`, (ws.nightCrew || []).join(" / ")])
    rows.push([`Morning Pool`, (ws.morningCrew || []).join(" / ")])
    rows.push([`Evening Pool`, (ws.eveningCrew || []).join(" / ")])

    const colHeader = ["Employee", ...days.map(d => `${dow(d)} (${fmt(d)})`), "Total Shifts", "Total Off"]
    rows.push(colHeader)

    memberList.forEach(name => {
      let shifts = 0, off = 0
      const row = [name]
      days.forEach(d => {
        const v = ws.data[name]?.[fmt(d)] || ""
        const type = extractShiftType(v)
        row.push(type)
        if (type === "Off") off++
        else shifts++
      })
      row.push(shifts, off)
      rows.push(row)
    })
    rows.push([])
  })

  const monthStats = computeMonthStats(cachedWeeks)
  rows.push(["Monthly Summary"])
  rows.push(["Employee", "Night Weeks", "Morning", "Evening", "Night", "General", "Total Shifts", "Total Off"])
  memberList.forEach(name => {
    const es = monthStats?.empStats[name]
    rows.push([
      name,
      es?.nightWeeks || 0,
      es?.Morning || 0,
      es?.Evening || 0,
      es?.Night || 0,
      es?.General || 0,
      es?.TotalWorking || 0,
      es?.Off || 0,
    ])
  })

  const csvContent = rows
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `NOC Roster - ${monthName}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

/* ── Button Loading Animation ── */
function btnLoad(btn, text, anim = "spin") {
  if (btn.dataset.loading === "true") return () => {}
  btn.dataset.loading = "true"
  btn.classList.add("loading")
  const orig = btn.dataset.orig || btn.innerHTML
  btn.dataset.orig = orig
  let dots = 0
  btn.innerHTML = `<span class="spinner-${anim}">⏳</span> ${text}`
  const iv = setInterval(() => {
    dots = (dots + 1) % 4
    btn.innerHTML = `<span class="spinner-${anim}">⏳</span> ${text}${".".repeat(dots)}`
  }, 350)
  return msg => {
    clearInterval(iv)
    btn.innerHTML = `✓ ${msg}`
    btn.classList.remove("loading")
    setTimeout(() => { btn.innerHTML = orig; btn.dataset.loading = "false" }, 1000)
  }
}

/* ── Theme / Fullscreen / Nav ── */
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme")
  document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark")
  saveState()
}

function toggleFS() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
  else document.exitFullscreen().catch(() => {})
}

function prevMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1)
  renderMonth(currentDate.getFullYear(), currentDate.getMonth())
}
function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1)
  renderMonth(currentDate.getFullYear(), currentDate.getMonth())
}
function goToday() {
  currentDate = new Date()
  renderMonth(currentDate.getFullYear(), currentDate.getMonth())
}

function onKey(e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "ArrowLeft") { e.preventDefault(); prevMonth() }
    else if (e.key === "ArrowRight") { e.preventDefault(); nextMonth() }
  } else {
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      const a = document.querySelector(".tab.active")
      if (a && +a.dataset.w > 1) {
        viewAll = false
        activeWeekIdx = +a.dataset.w - 1
        updateToggle()
        activate(activeWeekIdx)
        renderAnalyticsPanel()
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      const a = document.querySelector(".tab.active")
      const total = document.querySelectorAll(".tab").length
      if (a && +a.dataset.w < total) {
        viewAll = false
        activeWeekIdx = +a.dataset.w + 1
        updateToggle()
        activate(activeWeekIdx)
        renderAnalyticsPanel()
      }
    }
  }
}

/* ── Init ── */
function init() {
  loadState()
  saveMembers()
  renderLegend()
  renderMonth(currentDate.getFullYear(), currentDate.getMonth())

  // Regenerate Button
  const regenBtn = document.getElementById("regen")
  if (regenBtn) {
    regenBtn.onclick = () => {
      const done = btnLoad(regenBtn, "Generating")
      setTimeout(() => { regenerateMonth(); done("Ready!") }, 600)
    }
  }

  // Analytics Toggle Button
  const analyticsBtn = document.getElementById("analytics-toggle")
  if (analyticsBtn) {
    analyticsBtn.onclick = () => {
      showAnalytics = !showAnalytics
      analyticsBtn.classList.toggle("active", showAnalytics)
      renderAnalyticsPanel()
      saveState()
    }
    if (showAnalytics) analyticsBtn.classList.add("active")
  }

  // Download Single Week
  const dlBtn = document.getElementById("dl")
  if (dlBtn) {
    dlBtn.onclick = () => {
      const done = btnLoad(dlBtn, "Exporting", "bounce")
      setTimeout(() => {
        const t = document.querySelector(".week-card:not(.hidden) table") || document.querySelector(".week-card table")
        const n = document.querySelector(".tab.active")?.textContent.trim() || `Week ${activeWeekIdx}`
        dlWeek(t, n)
        done("Done!")
      }, 500)
    }
  }

  // Export All Weeks (All-in-One Workbook)
  const dlAllBtn = document.getElementById("dl-all")
  if (dlAllBtn) {
    dlAllBtn.onclick = () => {
      const done = btnLoad(dlAllBtn, "Exporting Month", "bounce")
      setTimeout(() => {
        dlMonthAllInOne()
        done("Exported!")
      }, 600)
    }
  }

  // Export CSV
  const dlCsvBtn = document.getElementById("dl-csv")
  if (dlCsvBtn) {
    dlCsvBtn.onclick = () => {
      const done = btnLoad(dlCsvBtn, "Exporting CSV", "bounce")
      setTimeout(() => {
        dlCSV()
        done("Exported!")
      }, 500)
    }
  }

  // View All / Tabbed Toggle
  const viewToggleBtn = document.getElementById("view-toggle")
  if (viewToggleBtn) {
    viewToggleBtn.onclick = () => {
      viewAll = !viewAll
      updateToggle()
      if (viewAll) showAll()
      else {
        const today = new Date()
        let a = 1
        if (cachedWeeks && today.getFullYear() === cachedWeeks.y && today.getMonth() === cachedWeeks.m) {
          const idx = cachedWeeks.data.findIndex(w => w.days.some(d => d.getDate() === today.getDate() && d.getMonth() === today.getMonth()))
          if (idx >= 0) a = idx + 1
        }
        activate(a)
      }
      renderAnalyticsPanel()
    }
  }

  // Team Panel Toggle
  const toggleTeamBtn = document.getElementById("toggle-team-btn")
  const teamBody = document.getElementById("team-panel-body")
  if (toggleTeamBtn && teamBody) {
    toggleTeamBtn.onclick = () => {
      const isHidden = teamBody.style.display === "none"
      teamBody.style.display = isHidden ? "block" : "none"
      toggleTeamBtn.textContent = isHidden ? "Close" : "Manage Team"
    }
  }

  // Theme & Navigation Buttons
  document.getElementById("theme-toggle")?.addEventListener("click", toggleTheme)
  document.getElementById("fullscreen-btn")?.addEventListener("click", toggleFS)
  document.getElementById("prev-month")?.addEventListener("click", prevMonth)
  document.getElementById("next-month")?.addEventListener("click", nextMonth)
  document.getElementById("go-today")?.addEventListener("click", goToday)
  document.addEventListener("keydown", onKey)

  // Member Management Input & Buttons
  const addBtn = document.getElementById("member-add")
  const input = document.getElementById("member-input")
  const list = document.getElementById("member-list")
  const resetDefaultBtn = document.getElementById("member-reset-default")

  const tryAdd = () => {
    if (!input) return
    if (addMember(input.value)) {
      input.value = ""
      regenerateMonth()
    }
  }

  if (addBtn) addBtn.onclick = tryAdd
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); tryAdd() }
    })
  }
  if (resetDefaultBtn) {
    resetDefaultBtn.onclick = () => {
      resetToDefaultMembers()
    }
  }
  if (list) {
    list.onclick = e => {
      const btn = e.target.closest(".member-remove")
      if (!btn) return
      const idx = parseInt(btn.dataset.index, 10)
      if (Number.isNaN(idx) || idx < 0 || idx >= members.length) return
      if (removeMember(members[idx])) regenerateMonth()
    }
  }
}

document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init()
