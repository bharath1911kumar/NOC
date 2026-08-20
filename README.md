# RoRoNoA Shift Scheduler & Workload Analytics

A high-performance **single-team weekly roster generator and workload analytics dashboard** built with vanilla **HTML5, CSS3, and JavaScript**.  
It rotates night crews, schedules morning, evening, and general shifts from role-specific weekly pools, balances weekend off days, validates staffing coverage, and exports clean Excel workbooks and CSV datasets.

---

## Key Features

- **Weekly Role Pools**: Automatic rotation of Night Crew (3), Morning Pool (2), Evening Pool (4), and Floaters.
- **Fair Workload & Off Balancing**: Every team member averages **4–5 working shifts** and **2–3 Off days** per week.
- **Weekend Optimization**: Maximizes weekend rest (7 out of 12 members Off on Sat & Sun) while ensuring coverage (1 Morning + 1 Evening + 1 General + 2 Night).
- **Interactive Analytics & Shift Distribution Charts**:
  - Employee shift breakdown (M, E, N, G, Off counts and proportional stacked bar charts).
  - Active Week vs. Full Month aggregate views.
  - Daily staffing coverage validation matrix with compliance tags.
  - Key Performance Indicators (Total Shifts, Avg Workload, Weekend Off Rate %, Role Integrity).
- **Comprehensive Multi-Format Exporting**:
  - **Download Week**: Single week `.xls` table with employee distribution summary and daily coverage counts.
  - **Export Month (All-in-One)**: Single unified `.xls` workbook with monthly summary table + all individual weekly schedules in one download.
  - **Export CSV**: Clean standard `.csv` dataset for Google Sheets or external payroll/BI tools.
- **Team Roster Management**: Add / remove members dynamically with persistent localStorage sync.
- **Theme & Keyboard Navigation**: Dark / Light theme toggle, fullscreen mode, keyboard shortcuts (`← / →` for weeks, `Ctrl + ← / →` for months).

---

## Scheduling Rules Matrix

| Pool / Area | Size | Allowed Shifts | Scheduling & Coverage Rules |
| :--- | :---: | :--- | :--- |
| **Night Crew** | 3 | **Night, Off only** | Fixed pair works Sat & Sun Night; 3rd member rests. Recovery gives Monday Off (+ 50% chance Tue Off). 2 on Night weekdays. |
| **Morning Pool** | 2 | **Morning, General, Off** (Never Evening) | 1 Morning on Saturday, 1 Morning on Sunday. 1 Morning per weekday (alternating). Spare member works General or takes Off. |
| **Evening Pool** | 4 | **Evening, General, Off** (Never Morning) | Fixed pair alternates on weekend (A Sat Eve, B Sun Eve); other 2 get weekend Off. 2 on Evening weekdays. Others work General or Off. |
| **Floaters** | Remainder | **General, Off** | First choice for Weekend General slots. Assigned General or Off on weekdays. |
| **Weekend Targets** | — | **5 Working, 7 Off** | **1 Morning + 1 Evening + 1 General + 2 Night** each day (Sat & Sun). |
| **Weekday Targets** | — | **~9 Working, ~3 Off** | **1 Morning + 2 Evening + 2 Night + remaining on General / Off** (Mon–Fri). |
| **Weekly Balance** | — | **~2 Offs / Week** | Day-pool members target 2 Offs per week, distributed smoothly. |

---

## Project Structure

```
Weekly-Shift-Scheduler/
 ┣ index.html        # UI shell, team management, action bar, analytics dashboard
 ┣ logic.js          # Core scheduler, pool rotation, stats calculation, Excel/CSV exports
 ┣ styles.css        # Glassmorphic design system, analytics charts, print styles
 ┗ README.md         # Documentation & scheduling rules
```

---

## Installation & Usage


```
Open `index.html` in any modern web browser.
Manage your team in the **Team Roster** panel, click **Regenerate** to reshuffle daily assignments, or click **Analytics & Charts** to view distribution charts and coverage reports.

---

## Export Options

- **Download Week** — Exports the currently active week as a styled `.xls` sheet with employee shift summary.
- **Export Month (All-in-One)** — Exports the entire month (all weeks + monthly aggregate summary table) into a single consolidated `.xls` file.
- **Export CSV** — Downloads the full month's roster and shift statistics as standard CSV data.


