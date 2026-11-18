# 🎓 Ed-Tech Learning & Monetization Platform

An end-to-end, full-stack Ed-Tech platform featuring hierarchical syllabus browsing, dynamic entitlement-based access control, pure pricing calculation with upgrade credits, Razorpay payment processing (Test Mode), pessimistic row-locked order settlement, 3-second status polling, and printable GST tax invoices.

Built with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, **Node.js**, **Express**, **PostgreSQL**, **Prisma ORM**, and the **Razorpay SDK**.

---

## 📑 Table of Contents
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Prerequisites & Environment Variables](#-prerequisites--environment-variables)
- [Setup & Installation](#-setup--installation)
- [Seed Accounts & Test Data](#-seed-accounts--test-data)
- [Database Schema (Mermaid ER Diagram)](#-database-schema-mermaid-er-diagram)
- [Running Automated Tests](#-running-automated-tests)
- [Exposing Webhooks via ngrok](#-exposing-webhooks-via-ngrok)
- [Key Design Decisions](#-key-design-decisions)
- [Future Enhancements & Unfinished Work](#-future-enhancements--unfinished-work)

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Lucide Icons.
- **Backend**: Node.js, Express, TypeScript, Prisma ORM, Multer, Zod, bcryptjs, jsonwebtoken, express-rate-limit.
- **Database**: PostgreSQL 16 (via Docker Compose or local installation).
- **Payment Gateway**: Razorpay Node SDK (TEST mode strictly; public keys only exposed to client).
- **Testing**: Vitest test runner for pure pricing, access control, concurrency locking, and webhook deduplication.

---

## 🔐 Prerequisites & Environment Variables

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v9 or higher)
- [Docker & Docker Compose](https://www.docker.com/) (or a local PostgreSQL instance on port 5432)

---

### Environment Variables

#### Backend (`backend/.env`)

Create a `backend/.env` file (copied from `backend/.env.example`):

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Connection (PostgreSQL)
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/edtech_db?schema=public"

# Authentication & Security
JWT_SECRET="edtech_super_secret_jwt_key_2026_secure!"

# Razorpay Test Mode Credentials
RAZORPAY_KEY_ID="rzp_test_placeholder"
RAZORPAY_KEY_SECRET="placeholder_secret"
RAZORPAY_WEBHOOK_SECRET="placeholder_webhook_secret"

# Frontend URL (for CORS credentials transmission)
FRONTEND_URL="http://localhost:5173"
```

> **Note**: For testing with real Razorpay test credentials, replace `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` with your Razorpay Test Dashboard keys.

---

## 🚀 Setup & Installation

Follow these steps to run the application locally:

### 1. Clone the repository and start PostgreSQL
```bash
# Clone the repository
git clone <repo-url>
cd "Ed-Tech App"

# Start PostgreSQL database in the background
docker compose up -d
```

### 2. Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Run Prisma Migrations and Seed Database
```bash
cd ../backend

# Generate Prisma Client
npm run prisma:generate

# Run Database Migrations
npx prisma migrate dev --name init

# Seed Catalogue, Products, Coupons, and Test Accounts
npm run prisma:seed
```

### 4. Run the Development Servers

Open two terminal windows:

**Terminal 1 (Backend API on `http://localhost:5000`):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend Client on `http://localhost:5173`):**
```bash
cd frontend
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 👥 Seed Accounts & Test Data

The seed script (`backend/prisma/seed.ts`) populates the database with:
- **1 Board**: CBSE
- **2 Classes**: Class 10, Class 11
- **6 Subjects**: Mathematics, Physics, Chemistry, etc.
- **30 Chapters**: 5 chapters per subject (**First chapter of each subject is marked `isFree = true`**)
- **34 Products**: Individual chapters (₹99), Subject packs (₹399), Monthly passes (₹499), Annual passes (₹2,999)
- **2 Promotional Coupons**:
  - `FLAT50`: Flat ₹50 discount
  - `SAVE20`: 20% discount (up to ₹200)

### Pre-Configured Test Accounts

| Role | Email | Password | Privileges |
|---|---|---|---|
| **Student** | `student@test.com` | `password123` | Catalogue, Cart, Checkout, My Library, PDF Reader |
| **Admin** | `admin@test.com` | `password123` | Everything + Admin Orders Management & Tax Invoices |

*(A one-click shortcut for each account is provided on the `/auth` page for fast evaluation.)*

---

## 📊 Database Schema (Mermaid ER Diagram)

All 12 relational models, constraints, and relationships in `backend/prisma/schema.prisma`:

```mermaid
erDiagram
    User ||--o{ Order : places
    User ||--o{ Entitlement : holds
    Board ||--|{ Class : contains
    Class ||--|{ Subject : contains
    Subject ||--|{ Chapter : contains
    Chapter ||--o{ Material : includes
    Order ||--|{ OrderItem : contains
    Order ||--o{ Payment : records
    Order ||--o{ Entitlement : grants
    Product ||--o{ OrderItem : purchased_in

    User {
        string id PK
        string email UK
        string password
        string name
        enum role "STUDENT | ADMIN"
        datetime createdAt
    }

    Board {
        string id PK
        string name UK
        datetime createdAt
    }

    Class {
        string id PK
        string name
        string boardId FK
        datetime createdAt
    }

    Subject {
        string id PK
        string name
        string classId FK
        datetime createdAt
    }

    Chapter {
        string id PK
        string name
        boolean isFree
        int order
        string subjectId FK
        datetime createdAt
    }

    Material {
        string id PK
        string title
        string filePath
        string chapterId FK
        datetime createdAt
    }

    Product {
        string id PK
        string title
        string description
        enum type "CHAPTER | SUBJECT_PACK | MONTHLY_PASS | ANNUAL_PASS"
        string targetId
        int pricePaise
        boolean active
        datetime createdAt
    }

    Coupon {
        string id PK
        string code UK
        enum discountType "FLAT | PERCENT"
        int discountValue
        int maxDiscountPaise
        int minOrderPaise
        int usageLimit
        int usageCount
        datetime expiresAt
        boolean active
        datetime createdAt
    }

    Order {
        string id PK
        string userId FK
        enum status "CREATED | PAID | FAILED"
        int amountPaise
        string razorpayOrderId UK
        datetime createdAt
    }

    OrderItem {
        string id PK
        string orderId FK
        string productId FK
        int pricePaise
        datetime createdAt
    }

    Payment {
        string id PK
        string orderId FK
        string razorpayPaymentId UK
        string razorpaySignature
        int amountPaise
        string status
        datetime createdAt
    }

    WebhookEvent {
        string id PK
        string eventId UK
        json payload
        datetime createdAt
    }

    Entitlement {
        string id PK
        string userId FK
        enum scope "CHAPTER | SUBJECT | CLASS_PASS"
        string refId
        datetime expiresAt
        string sourceOrderId FK
        datetime revokedAt
        string reason
        datetime createdAt
    }
```

---

## 🧪 Running Automated Tests

The backend includes a comprehensive suite of unit and integration tests powered by **Vitest**:

```bash
cd backend
npm test
```

### Test Coverage Highlights (17 Tests across 3 Suites)
1. **Pricing Engine (`src/services/pricing.test.ts`)**:
   - Upgrade credit deduction for previously purchased chapters.
   - Upgrade credit above price (clamps to min 0).
   - Flat discount coupon application.
   - Percentage discount coupon with max cap.
   - Expired coupon rejection.
   - 18% GST split calculation (`base = round(total * 100 / 118)`).
   - Dropping already owned items.
2. **Order Settlement & Webhooks (`src/services/settleOrder.test.ts`)**:
   - Valid HMAC-SHA256 signature verification passes.
   - Tampered signatures rejected with `400 Bad Request`.
   - Idempotent deduplication: identical webhook `eventId` sent twice is ignored, granting entitlements only once.
   - Pessimistic row locking (`SELECT ... FOR UPDATE`) prevents concurrent double-settlement.
   - Wrong amount paid (`payment.amount !== order.amountPaise`) grants zero entitlements.
   - Pass extension: `newExpiry = max(now, existingExpiry) + 30 days`.
3. **Admin Orders & Invoice (`src/routes/admin.orders.test.ts`)**:
   - Enforces role guards (unauthenticated $\to$ 401, student $\to$ 403, admin $\to$ 200).
   - Status filters (`PAID`, `CREATED`, `FAILED`) and date range queries.
   - Invoice 18% GST split math (Base + 9% CGST + 9% SGST = Total).
   - Access control prevents students from viewing other users' invoices.

---

## 🌐 Exposing Webhooks via ngrok

To receive real-time asynchronous webhook events from Razorpay during local development:

### 1. Install & Launch ngrok
```bash
# If not installed: npm install -g ngrok
ngrok http 5000
```
ngrok will display a forwarding URL, for example: `https://a1b2-c3d4.ngrok-free.app`.

### 2. Configure Razorpay Dashboard
1. Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com/) and ensure you are in **Test Mode**.
2. Navigate to **Settings** $\to$ **Webhooks** $\to$ **Add New Webhook**.
3. **Webhook URL**:
   ```
   https://<your-ngrok-subdomain>.ngrok-free.app/api/webhooks/razorpay
   ```
4. **Secret**: Enter the exact secret configured in your `backend/.env` (`RAZORPAY_WEBHOOK_SECRET`).
5. **Active Events**: Check:
   - `payment.captured`
   - `payment.failed`
6. Click **Create Webhook**.

### 3. Verify
When a test payment completes, Razorpay sends the raw payload to the webhook endpoint. The backend:
- Validates the `X-Razorpay-Signature` against the unparsed raw buffer using `crypto.timingSafeEqual`.
- Logs the event in `WebhookEvent` (ignoring duplicates via unique constraint `P2002`).
- Settles the order and grants entitlements in a transaction.

---

## 💡 Key Design Decisions

### 1. Integer-Only Money Representation (Paise)
- **Problem**: Floating-point numbers in JavaScript (`0.1 + 0.2 !== 0.3`) introduce rounding drift, reconciliation discrepancies, and potential vulnerabilities.
- **Solution**: All monetary values throughout the database, business logic, calculations, and APIs are stored strictly as **integers in paise** (1 INR = 100 paise).
- **GST Split**:
  $$\text{basePaise} = \text{Math.round}\left(\frac{\text{totalPaise} \times 100}{118}\right)$$
  $$\text{gstPaise} = \text{totalPaise} - \text{basePaise}$$

### 2. Decoupled Entitlements Table for Access Control
- **Problem**: Querying `Orders` or `Payments` to determine user access creates brittle queries that fail when handling lifetime upgrades, pass extensions, refunds, or manual revocations.
- **Solution**: The authorization engine (`hasAccess()`) queries **ONLY** the `Entitlement` table.
  - Purchases grant `Entitlement` rows with scopes: `CHAPTER`, `SUBJECT`, or `CLASS_PASS`.
  - Pass extensions simply update `expiresAt = max(now, existingExpiry) + duration`.
  - Content revocation sets `revokedAt = new Date()`, leaving order financial histories intact.

### 3. Idempotent SettleOrder with Row-Level Pessimistic Locking
- **Problem**: Concurrent requests from both client verification (`POST /payments/verify`) and webhook callbacks (`POST /webhooks/razorpay`) could race and grant duplicate entitlements.
- **Solution**:
  - `settleOrder()` wraps all mutations in a Prisma transaction.
  - Locks the target row immediately:
    ```sql
    SELECT * FROM "Order" WHERE "id" = $1 FOR UPDATE
    ```
  - If `order.status === 'PAID'`, it exits early without repeating entitlement grants.
  - Validates that `paymentDetails.amountPaise === order.amountPaise` before marking paid.

### 4. Server-Side Price Authority
- The server **never** trusts client prices. Checkouts load authoritative prices directly from PostgreSQL, run pure pricing rules, and pass the computed paise total to Razorpay.
- Private keys (`RAZORPAY_KEY_SECRET`, `JWT_SECRET`) are never sent to the browser.

### 5. Secure Streaming PDF Reader
- PDF materials are stored on disk with random hashes.
- File paths are never exposed over APIs.
- The viewer requests `/materials/:id/file` with session credentials; the backend executes `hasAccess()` and pipes the file stream. If locked, HTTP 403 Forbidden is returned and the UI renders a lock screen.

---

## 🔮 Future Enhancements & Unfinished Work

While the core assessment requirements and user journeys are fully implemented, tested, and committed, here is how I would scale and extend the platform for enterprise production:

1. **Real-Time Order Updates via WebSockets / Server-Sent Events (SSE)**:
   - *Current*: The frontend polls `GET /orders/:id` every 3 seconds.
   - *Production Solution*: Use Socket.io or SSE to push instant `ORDER_PAID` events to the client as soon as the Razorpay webhook fires, reducing server polling overhead.
2. **Cloud Object Storage (AWS S3 / Cloudflare R2)**:
   - *Current*: PDF uploads are stored on the local filesystem (`backend/uploads/`).
   - *Production Solution*: Store files in private S3 buckets. The `/materials/:id/file` endpoint would generate short-lived pre-signed S3 URLs or pipe S3 GetObject streams, enabling horizontal container scaling without shared volume mounts.
3. **Full Admin CRUD Frontend UI for Catalogue**:
   - *Current*: The backend has full CRUD routes and Multer upload endpoints for Boards, Classes, Subjects, Chapters, and Materials (verified with tests); the frontend includes the Admin Orders & Tax Invoice Management UI.
   - *Production Solution*: Build an admin curriculum management dashboard with drag-and-drop PDF uploading and free/paid chapter toggles.
4. **Automated Transactional Emails**:
   - *Current*: Printable tax invoices are viewable on the `/orders/:id/invoice` page.
   - *Production Solution*: Integrate Resend or AWS SES to automatically generate a PDF invoice using `puppeteer` and email it to the student upon `payment.captured`.
5. **Subscription Recurring Billing**:
   - *Current*: Monthly and Annual passes are one-time payments that extend access by 30 or 365 days.
   - *Production Solution*: Integrate Razorpay Subscriptions API with auto-debit mandates (e-Mandate / UPI Autopay).

---

## 📄 License
This project was developed for technical evaluation and assessment purposes.
