<div align="center">
  
  # 🏢 Rental Property Management System
  
  **A beautifully designed, enterprise-grade application for managing rental properties, tenants, and finances.**

  [![React](https://img.shields.io/badge/React-19.0+-blue.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-5.0+-646CFF.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E.svg?style=for-the-badge&logo=supabase)](https://supabase.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![Netlify](https://img.shields.io/badge/Netlify-Ready-00C7B7.svg?style=for-the-badge&logo=netlify)](https://www.netlify.com/)

</div>

<br />

## ✨ Features

- 🏠 **Property Management**: Complete CRUD operations for properties, viewing occupancy rates, and calculating total potential revenue.
- 👥 **Tenant Tracking**: Manage active, vacated, and pending tenant assignments with detailed leasing periods and current rent tracking.
- 💰 **Financial Dashboard**: Powerful payment tracking system. Upload CSV payments, monitor on-time vs. late payments, and view beautiful revenue analytics.
- 🛠️ **Maintenance Requests**: Kanban-style maintenance ticketing system to track repair statuses across all your properties.
- 🔐 **Role-based Authentication**: Secure user management with Admin, Manager, and Viewer roles utilizing Supabase Row Level Security (RLS).
- 🎨 **Premium UI/UX**: State-of-the-art glassmorphism design system, smooth animations, and a responsive layout that looks incredible on any screen.

## 💻 Tech Stack

- **Frontend Framework**: React 19 + Vite
- **Language**: TypeScript
- **Styling**: Custom CSS Modules (Glassmorphism & Modern UI)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Backend & Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth

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

Ensure your Supabase project is configured with the necessary tables (`properties`, `tenant_assignments`, `payments`, `profiles`, `audit_logs`). The schema migrations can be found in the `supabase/migrations` folder.

### 5. Start the development server

```bash
npm run dev
```

Your app will be running at `http://localhost:5173`.

## 🌐 Deployment (Netlify)

This project includes a `netlify.toml` file, making it instantly ready to deploy on Netlify!

1. Connect your GitHub repository to Netlify.
2. In the Netlify setup, add the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your Environment Variables.
3. Deploy!

## 📸 Screenshots

*(Add screenshots of your gorgeous dashboard here!)*

| Dashboard | Property Details |
| :---: | :---: |
| <img src="https://via.placeholder.com/600x400.png?text=Dashboard+Screenshot" alt="Dashboard" /> | <img src="https://via.placeholder.com/600x400.png?text=Property+Screenshot" alt="Properties" /> |

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/P-Prajeeth-Shetty/rental-application/issues).

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">
  <i>Built with ❤️ for better property management.</i>
</div>
