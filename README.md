<div align="center">
  
  # 🏢 Rental Property Management System
  
  **A beautifully designed, enterprise-grade application for managing rental properties, tenants, and finances.**

  [![React](https://img.shields.io/badge/React-19.0+-blue.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-5.0+-646CFF.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E.svg?style=for-the-badge&logo=supabase)](https://supabase.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000.svg?style=for-the-badge&logo=vercel)](https://vercel.com/)

</div>

<br />

## ✨ Features

- 🏠 **Property Management**: Complete CRUD operations for owned properties, occupancy rates, and revenue tracking — plus a separate "leased-in" module for properties rented *from* landlords (agreements, outgoing payments).
- 👥 **Tenant Tracking**: Manage active, vacated, and transferred tenant assignments, with automatic 5%-every-11-months rent escalation and full rent-revision history.
- 💰 **Financial Dashboard**: Upload CSV payments, auto-classify early/on-time/late timing, track security deposits separately from rent, and view revenue analytics.
- 🛠️ **Maintenance Billing**: Create per-property maintenance bills, split costs across tenants (equal or custom), and track charges/payments per tenant.
- 🔐 **Role-based Authentication**: Admin and standard user roles enforced via Supabase Row Level Security (RLS); admin-only user management runs through server-verified edge functions.
- 🎨 **Premium UI/UX**: Glassmorphism design system, dark mode, responsive layout, and a shared design-token stylesheet.
- 🆘 **Help Center**: Integrated support hub for user guidance and onboarding.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the codebase is organized and how these pieces fit together.

## 💻 Tech Stack

- **Frontend Framework**: React 19 + Vite
- **Language**: TypeScript
- **Styling**: Custom CSS per view/component (Glassmorphism & Modern UI)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Backend & Database**: Supabase (PostgreSQL, Auth, Storage, Edge Functions, pg_cron)

## 🚀 Quick Start

Follow these steps to get the project up and running locally.

### 1. Clone the repository

```bash
git clone https://github.com/P-Prajeeth-Shetty/rental-application.git
cd rental-application
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Database Setup

Apply the migrations in `supabase/migrations` in order (via `supabase db push` or the Supabase SQL editor). They create the full schema — properties, tenants, tenant assignments, rent revisions, payments, maintenance billing, leased-in properties/landlords, reminders/notebooks, profiles, roles, and audit logs — along with the RLS policies, storage buckets, and the `pg_cron` job that drives automatic rent escalation.

Then deploy the edge functions in `supabase/functions` (`supabase functions deploy`). See [ARCHITECTURE.md](ARCHITECTURE.md#supabase-edge-functions) for what each one does.

### 5. Start the development server

```bash
npm run dev
```

Your app will be running at `http://localhost:5173`.

## 🌐 Deployment (Vercel)

This project is optimized for deployment on Vercel.

1. Connect your GitHub repository to Vercel.
2. In the Vercel project settings, add the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your Environment Variables.
3. Deploy!

---

<div align="center">
  <i>Built with ❤️ for better property management.</i>
</div>
