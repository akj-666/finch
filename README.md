# Finch — Expense Tracker

A modern, responsive, mobile-first web application designed for tracking corporate, operational, and capital expenditures for **Finch**, based in **Kottayam, Kerala, India**.

---

## 🎯 Key Features

- **Brand & Visual Identity:** Styled according to Finch's official brand guidelines:
  - Deep Forest Green (`#0F3B2E`)
  - Warm Ivory (`#FFF8EE`)
  - Muted Gold (`#C89B3C`)
  - Official Finch bird emblem and typography applied across desktop navigation, mobile drawer, modals, PDF reports, and browser favicon.
  - Business location set to **Kottayam, Kerala, India**.
- **Mobile-First Design:**
  - Optimized for smartphone usage where most receipts and expenses are captured.
  - Compact 2×2 KPI summary cards on mobile screens so critical financial metrics fit without excessive scrolling.
  - Sticky modal header and footer buttons (`Cancel` and `Record Expense`) for easy thumb reach on narrow screens.
  - Responsive table on desktop and touch-friendly cards on mobile devices.
- **Bill & Receipt Attachments:**
  - Optional bill/receipt image attachment directly within the expense form.
  - Supports instant mobile camera capture (`Take Photo / Capture`) or photo library selection (`Select from Gallery / Files`).
  - Automatic client-side image compression and downscaling (to ~150–300 KB JPEG) via HTML5 Canvas to handle large camera files smoothly.
  - Browser-local persistence using **IndexedDB** (`finch_receipts_db`), preventing 5MB `localStorage` quota errors and keeping attachments available across reloads.
  - Interactive light-box modal to view, zoom, and download attached receipts.
- **INR Currency Formatting:** All amounts are formatted in the Indian numbering system as `₹` (e.g. `₹1,25,000.00`).
- **Real-Time KPI Summary Cards:**
  - **Period Total Spend**
  - **CapEx Spend** (Capital Costs: machinery, computers, office fixtures, tooling)
  - **OpEx Spend** (Operating Costs: consumables, paper reams, toner, utilities, rent, cloud services)
  - **Top Spending Category** with amount & share percentage
  - **All-Time Spend** comparison metric
- **Interactive Spending Breakdown Chart:**
  - **Donut Chart** with mathematical SVG paths, hover tooltips, and center focus readout.
  - **Bar Chart** toggle showing relative category progress bars and CapEx vs OpEx components.
- **Single-Action Workflow:**
  - **Record Expense** button serves as the single primary entry action.
  - **Download PDF Report** located at the top of the page.
- **Sortable Expense Ledger:**
  - Sort by Date, Amount, Description, Category, or Nature (ascending / descending)
  - Category badges with icons and color coding
  - CapEx & OpEx status tags and payment mode indicators
  - Delete action with confirmation modal
- **Filter & Search Toolbar:**
  - Date presets: All Time, This Month, Last 30 Days, This Quarter, This Year
  - Custom Start Date & End Date pickers
  - Category filter dropdown and Nature filter (CapEx vs OpEx)
  - Instant keyword search across vendor, description, notes, tag, and payment mode
- **Professional PDF Expense Report:**
  - Downloadable multi-page vector PDF powered by `jspdf` and `jspdf-autotable`
  - Finch branding header, location (*Kottayam, Kerala, India*), and timeline indicator
  - Metric summary cards (Total Spend, CapEx, OpEx, Count)
  - Category-wise subtotals table and itemized expense ledger with receipt verification indicators
- **Data Persistence & Backups:**
  - Core ledger state auto-saved to `localStorage`
  - High-resolution receipts persisted to **IndexedDB**
  - **Export JSON** for full offline backup
  - **Import JSON** with schema validation, invalid-row detection, and merge or replace modes
  - **Export CSV** formatted to RFC 4180 standards with escaped values and numeric amounts
  - **Reload Sample Data** option seeded with 15 realistic business expenses

---

## 🛠️ Tech Stack

- **Framework:** React 19 + TypeScript
- **Bundler:** Vite 8
- **Styling:** Tailwind CSS 4
- **Icons:** Lucide React
- **Storage:** LocalStorage (ledger metadata) + IndexedDB (bill/receipt images)
- **PDF Engine:** jsPDF + jspdf-autotable

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Run Tests
```bash
npm test
```

### 4. Build for Production
```bash
npm run build
```
The compiled static assets will be output to `dist/`.
