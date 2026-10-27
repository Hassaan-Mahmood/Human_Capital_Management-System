# HCM Lite — Premium Human Capital Management System

> **Saylani Hackathon — Beginner Track**  
> **Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES6+), Browser `localStorage`  
> **CDNs:** Chart.js, Lucide Icons, SweetAlert2, Google Fonts (Inter)

---

## 1. Project Overview

**HCM Lite** is an enterprise-grade, lightweight Human Capital Management (HCM) web application built for small-to-medium businesses and modern organizations. Designed with inspiration from world-class SaaS interfaces such as Linear, Stripe, and Notion, it provides an end-to-end digital HR operational workflow entirely inside the browser without requiring any backend servers, databases, or npm build pipelines.

All data persists reliably across page reloads and browser sessions using standard browser `localStorage`. The application starts with zero dummy records, allowing hackathon judges to experience an authentic first-run setup wizard.

---

## 2. Key Features

### 🏢 Organization & First-Run Setup
- **First-Run Setup Wizard (`index.html`):** Detects if a company exists. If not, guides the user through setting up company details, working days, grace period, leave quota, and creating the root administrator account.
- **Role-Based Authentication & Route Guard (`auth.js`):** Protects administrative pages from regular employees, prevents unauthenticated access, and remembers sessions.
- **Dark & Light Mode:** Seamless theme toggling with instant icon transitions, persisted under `hcm_theme`.
- **System Backup & Restore (`settings.html`):** One-click JSON backup export and restore, plus a safe factory data wipe option.

### 👥 Employee Management (`employees.html`)
- **Add / Edit / Delete Employees:** Comprehensive profile management with department, job title, phone, joining date, and monthly basic salary.
- **Automated Login Account Creation:** Registering an employee automatically creates their credentials with role `employee` and unique ID (`EMP-XXXX`).
- **Validation Engine:** Rejects duplicate emails (case-insensitive & trimmed), validates positive salaries (`> 0`), and requires strong passwords.
- **Export to CSV:** Instant download of all active staff records in CSV format.
- **Deletion Policy:** Deleting an employee automatically cleans up their associated attendance logs and leave records, preventing orphaned database entries.

### ⏱️ Attendance & Punctuality Engine (`attendance.js`)
- **Single Daily Check-In:** Employees can punch in only once per scheduled working day.
- **Grace Period & Lateness:** Automatically flags check-ins after `officeStartTime + gracePeriod` as "Late" with exact minute offsets.
- **Check-Out & Half-Day Calculation:** Computes total work hours. Completed shifts under 5.0 hours are flagged as "Half-Day".
- **Absence Computation:** Unlogged past scheduled working days are dynamically identified as absent without marking upcoming or active working days prematurely.
- **Webcam Biometric Punch (Bonus Feature):** Accesses camera via `navigator.mediaDevices.getUserMedia` with snapshot capture and optional geolocation verification fallback.

### 📅 Leave Management (`leaves.html` & `employee.html`)
- **Time-Off Application:** Employees can request Casual, Sick, Annual, or Unpaid leave.
- **Working-Day Calculator:** Automatically calculates business days between start and end dates, skipping non-working days (e.g. Saturdays & Sundays).
- **Quota & Balance Enforcement:** Validates remaining annual quota before application. Approved paid leaves deduct from the annual quota; unpaid leaves do not consume quota.
- **Overlap Prevention:** Blocks overlapping leave requests for the same employee.
- **Administrative Decision Workflow:** Administrators can approve or reject requests with mandatory rejection feedback visible to the employee.

### 💵 Certified Monthly Payslip (`payslip.html`)
- **Strict Hackathon Formula Implementation:**
  $$\text{Per-Day Salary} = \frac{\text{Monthly Salary}}{\text{Working Days in Month}}$$
  $$\text{Deduction} = \text{Per-Day Salary} \times (\text{Absent Days} + 0.5 \times \text{Half-Day Days})$$
  $$\text{Net Salary} = \text{Monthly Salary} - \text{Deduction}$$
- **Role Privacy:** Employees can access only their own salary voucher; administrators can select any employee.
- **Print & PDF Export:** Dedicated `@media print` stylesheet strips sidebars, navigation, and widgets for a clean, formal corporate salary voucher with signature boxes.

### 📢 Company Announcements (`announcements.js`)
- Broadcasts announcements with priority tags (Normal, High, Urgent).
- Displayed across Admin and Employee dashboards.
- Full administrative management with deletion confirmation.

### 🤖 Smart Helper Chat Assistant (`helper.js`)
- Floating rule-based chat widget embedded in both dashboards.
- Answers real-time questions derived from live `localStorage` data using NLP keyword matching.
- **Role-Gated Answers:**
  - *Admin:* "How many employees do we have?", "Who was late today?", "Who is on leave today?", "How many employees are absent today?", "How many pending leave requests are there?", "How many employees are in each department?".
  - *Employee:* "How many leaves do I have left?", "Was I late today?", "What time did I check in?", "How many hours did I work this week?", "What is my attendance this month?", "What is my leave request status?".
- Never discloses other employees' confidential details to employees.

---

## 3. Project Structure

```
HCM Lite/
├── index.html            # First-Run Setup Wizard and Sign-In page
├── admin.html            # Administrator Overview & Real-Time Dashboard
├── employees.html        # Staff Directory & Account Management
├── leaves.html           # Administrator Leave Approvals & History
├── settings.html         # Organization Config & Attendance Policies
├── employee.html         # Personalized Employee Self-Service Dashboard
├── payslip.html          # Monthly Salary Voucher & Print Generator
├── css/
│   ├── style.css         # Design system, CSS variables, themes, buttons, cards, modals
│   ├── auth.css          # Split-screen login & setup wizard styling
│   ├── dashboard.css     # KPI stats cards, Chart.js wrappers, Smart Helper UI
│   ├── forms.css         # Form controls, validation states, day selector pills
│   ├── tables.css        # Responsive data tables, search filters, badges
│   ├── responsive.css    # Breakpoints for mobile drawers & tablet layouts
│   └── print.css         # Clean printable styling for salary vouchers
├── js/
│   ├── storage.js        # Core LocalStorage engine, schema validation, ID generators
│   ├── auth.js           # Route guards, session management, login/setup handlers
│   ├── common.js         # Theme toggle, mobile drawers, modals, toast alerts
│   ├── employees.js      # Employee CRUD, duplicate validation, CSV export
│   ├── attendance.js     # Check-in/out, lateness, webcam bonus, absence detection
│   ├── leave.js          # Leave calculations, approvals, quota balance tracking
│   ├── settings.js       # Company settings form, backup download & restore
│   ├── payslip.js        # Salary formulas, working day counts, voucher rendering
│   ├── helper.js         # Rule-based Smart Helper chat assistant
│   └── announcements.js  # Announcements publishing & feed rendering
├── assets/
│   └── logo.svg          # HCM Lite vector mark
└── README.md             # Project documentation & testing guide
```

---

## 4. LocalStorage Schema & Architecture

All application states are persisted under structured keys in `localStorage`:

| Key | Purpose | Example Value |
|---|---|---|
| `hcm_company` | Company metadata, start time, grace period, quota, working days | `{"name":"Acme Corp","startTime":"09:00","gracePeriod":15,"annualLeaveQuota":20,"workingDays":[1,2,3,4,5]}` |
| `hcm_users` | Accounts for Admins and Employees, salaries, and departments | `[{"id":"EMP-1001","name":"Alex","email":"alex@co.com","role":"employee","salary":120000,...}]` |
| `hcm_attendance` | Daily check-in/out logs, work hours, and punctuality status | `[{"id":"ATT-1001","userId":"EMP-1001","date":"2026-10-27","checkIn":"09:12","status":"present",...}]` |
| `hcm_leaves` | Leave applications, dates, working days, status, and comments | `[{"id":"LEV-1001","userId":"EMP-1001","startDate":"...","status":"approved","workingDays":3,...}]` |
| `hcm_session` | Currently authenticated user session | `{"userId":"ADM-1001","name":"Sarah","role":"admin","email":"admin@co.com"}` |
| `hcm_announcements` | Company broadcasts and announcements | `[{"id":"ANN-1001","title":"Townhall","priority":"High",...}]` |
| `hcm_theme` | Selected UI theme (`"light"` or `"dark"`) | `"light"` |

---

## 5. How to Run Locally

Because HCM Lite is built as a pure static web application, no Node.js or server installation is needed!

### Option A: Direct Browser Opening
1. Double-click or open `index.html` directly in any modern browser (Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari).

### Option B: Local Static Server (Recommended for Webcam API)
Some browsers restrict camera access over `file://` protocol. To test the optional camera check-in feature:
```powershell
# Using Python
python -m http.server 8000

# Or using VS Code Live Server extension
# Click "Go Live" at the bottom right of VS Code
```
Then visit `http://localhost:8000` in your browser.

---

## 6. Testing & Demonstration Guide

### Step 1: Initial Setup Wizard
1. Open `index.html`. Because localStorage is initially empty, the **System Setup Wizard** will appear.
2. Enter:
   - **Company Name:** `Apex Global Solutions`
   - **Admin Name:** `Sarah Connor`
   - **Admin Email:** `admin@apex.com`
   - **Password:** `admin123`
   - **Start Time:** `09:00`
   - **Grace Period:** `15` mins
   - **Leave Quota:** `20` days
   - **Working Days:** Keep Mon–Fri checked.
3. Click **Complete Setup & Launch Portal**. You are logged in and redirected to `admin.html`.

### Step 2: Add Employees
1. Navigate to **Employees** (`employees.html`).
2. Click **Add Employee** and create a team member:
   - **Name:** `John Doe`
   - **Email:** `john@apex.com`
   - **Password:** `john123`
   - **Department:** `Engineering`
   - **Designation:** `Frontend Engineer`
   - **Salary:** `150000`
   - **Joining Date:** Today's date
3. Try adding another employee with `john@apex.com` to verify duplicate email prevention.

### Step 3: Test Employee Portal & Attendance
1. Log out via the top-right button.
2. Sign in as the employee (`john@apex.com` / `john123`).
3. You are redirected to `employee.html`.
4. Test the **Check In** button. Notice:
   - Arrival is logged immediately.
   - If current time is after 09:15, lateness is recorded automatically.
   - You can also test the **Webcam Punch (Bonus)** modal.
5. Click **Check Out**. Observe the calculated work duration and half-day status if under 5 hours.

### Step 4: Apply for Leave
1. In `employee.html`, scroll to **Apply for Time Off**.
2. Select dates covering a upcoming weekday. Notice the live working days calculator.
3. Submit the request. It appears as **Pending** in your Leave History.

### Step 5: Admin Approval & Payslip Review
1. Log out and sign back in as Administrator (`admin@apex.com` / `admin123`).
2. Notice the pending leave counter on `admin.html`.
3. Open `leaves.html` and click **Approve**. Add an approval note.
4. Navigate to `payslip.html`.
5. Select `John Doe` and the current month.
6. Review the salary formula breakdown:
   - Basic Monthly Salary
   - Working Days in Month
   - Per-Day Salary
   - Absence & Half-Day deductions
   - Net Payable Salary
7. Click **Print / Save as PDF** to preview the clean printable format.

### Step 6: Test Smart Helper
1. Click the floating robot icon at the bottom-right.
2. Try asking:
   - *"How many employees do we have?"*
   - *"Who is on leave today?"*
   - *"Who was late today?"*
   - *"How many pending leave requests are there?"*
3. Notice how answers are calculated in real time directly from localStorage!

---

## 7. Known Limitations of Browser-Only Storage

1. **Client-Side Authentication:** In a browser-only environment without a server backend, user accounts and session keys are stored locally in the browser's `localStorage`. This is suitable for rapid hackathon demonstrations and educational prototypes, but production enterprise deployments require server-side authentication (e.g. JWT, OAuth2, Bcrypt hashing).
2. **Browser Sandbox Isolation:** Data stored in `localStorage` is tied to the specific browser origin (`protocol + domain + port`). Clearing browser cookies or cache will erase local records. Use the **Export LocalStorage Backup** button in Settings to save your dataset.

---

## 8. Deployment Instructions

This project is 100% static and can be deployed in seconds to any static hosting provider:

### Deploy to GitHub Pages
1. Push the project repository to GitHub.
2. Go to repository **Settings** &rarr; **Pages**.
3. Under **Branch**, select `main` (or `master`) and folder `/ (root)`.
4. Click **Save**. Your site will be live at `https://<username>.github.io/<repo-name>/`.

### Deploy to Netlify / Vercel
1. Drag and drop the `HCM Lite` folder directly onto the [Netlify Drop](https://app.netlify.com/drop) dashboard.
2. Or run `vercel` in the project root if using the Vercel CLI.

---

## 9. Hackathon Track Compliance Checklist

- [x] HTML5, CSS3, Vanilla ES6+ JavaScript exclusively
- [x] Persistent browser `localStorage` integration
- [x] Zero external frameworks (No React, Vue, Bootstrap, or Tailwind)
- [x] Zero backend server dependencies
- [x] Starts with zero dummy data (clean first-run setup)
- [x] All 7 required pages implemented with matching filenames
- [x] Strict salary formula calculation implemented
- [x] Dynamic Chart.js and SweetAlert2 integration
- [x] Responsive layout with mobile drawer and light/dark mode
- [x] Data-based Smart Helper chat assistant
- [x] Bonus features: Webcam punch, Geolocation check, CSV export, Print styling

---

**Developed for Saylani Hackathon — Beginner Track.**
