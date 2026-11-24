# Barangay Bugo Resident Assistance Management System

A web-based resident assistance application, tracking, and record management system developed for **Barangay Bugo, Cagayan de Oro City, Misamis Oriental, Philippines**.

---

## 🌟 Key Features

### 1. 44 Citizen & LGU Assistance Services
- Complete catalog of **44 distinct Barangay services** across 7 official sectors:
  - Administrative clearances and certifications
  - Health, medical clinic, and dental care
  - Senior citizen pensions and financial subsidies
  - PWD accessibility equipment (wheelchairs, crutches)
  - Daycare early childhood education and youth sports programs
  - Agricultural seeds, organic fertilizers, and farming tools
  - Civil registration and legal document assistance
  - Disaster emergency rescue and calamity assistance

### 2. Resident Profile & Account Management
- **Strong Password Policy**: Enforces 5 security criteria (minimum 8 characters, uppercase, lowercase, numbers, and special symbols) with real-time visual progress meters and checklist feedback.
- **Two-Step Verification for Password Updates**: Modifying account credentials requires prior verification via **Old Password** or a **6-digit One-Time Security Code (OTP)**.
- **PBKDF2-SHA512 Cryptographic Hashing**: Salted password protection with brute-force rate-limiting on authentication endpoints.
- **AI-Powered ID Document Inspection**: Multimodal Gemini 3.8 Flash Vision integration to verify authenticity and legibility of uploaded citizen identification cards.

### 3. Benefit Application & QR Claim Vouchers
- Online application wizard with step-by-step document submission.
- Real-time application tracking with timeline updates and administrative review notes.
- **HMAC-SHA256 Tamper-Proof QR Vouchers**: Cryptographically signed claim vouchers that verify benefit authenticity at the Treasury and Cashier Window.
- **COA-Compliant Treasury Disbursement**: Recording of Official Receipt (O.R.) numbers, disbursing officer details, and automated transaction archiving into the records registry.

### 4. Community Demographics & Census
- Population and household demographics across Zones 1 through 10.
- Interactive analytics for registered voters, senior citizens, working-age residents, and minors.

### 5. Relational Database & Defense Verification
- **Production MySQL DDL Schema**: Complete 8-table schema (`users`, `assistance_programs`, `assistance_applications`, `announcements`, `census_puroks`, `notifications`, `activity_logs`, `archived_records`).
- **System Explorer UI**: Live visualizer at `/?view=database`, `/?view=testing`, and `/?view=deployment`.
- **Postman API Collection**: Automated integration tests in `tests/Barangay_Bugo_API.postman_collection.json`.
- **Automated Test Suite**: Verified test suite across security, database integrity, and business logic (`npm test`).

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js (v18 or higher)
- npm or bun

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd bugo-resident-assistance

# Install dependencies
npm install

# Start the full-stack development server
npm run dev
```

The application runs on `http://localhost:3000`.

### Running Tests
```bash
npm test
```

### Building & Deploying (Render)
```bash
npm run build
npm start
```
See `DEPLOYMENT.md` and `render.yaml` for the full **Render** Web Service deployment guide.

---

## 🔑 Default Accounts (Demo)

| Role | Name | Email | Password | Resident ID |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | Hon. Juan Dela Cruz | `admin@bugo.gov.ph` | `Admin@Bugo2026!` | `BG-ADMIN-001` |
| **Resident** | Joshua Abella Laurio | `resident@bugo.gov.ph` | `Resident@Bugo2026!` | `BG-2026-04829` |

---

## 🛠️ Technology Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Leaflet + OpenStreetMap, Lucide Icons, Canvas Confetti, QR Code
- **Backend**: Node.js, Express, tsx
- **Deployment**: Render (`render.yaml` Web Service Blueprint)
- **Cryptographic Security**: Bcrypt / PBKDF2-SHA512 Password Hashing, HMAC-SHA256 Voucher Tokens
- **AI Integration**: `@google/genai` (Gemini 3.8 Flash Vision for ID card scrutiny)
- **Database**: Local JSON persistence + Complete MySQL 8.0 Relational DDL & Prisma ORM
