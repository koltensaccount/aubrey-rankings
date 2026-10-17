# Aubrey Rankings 🎬

A premium, self-hosted media ranking application for movies, television series, seasons, individual episodes, and custom collections. Inspired by *"Aubrey's Awesome and Correct Black Mirror Ratings"*.

## Key Features
- **Multi-Tenant & Private**: Each user manages their personal library, custom rating systems, and personal reviews.
- **Three Ranking Modes**:
  - **TV Show Rankings**: Episode-by-episode or season-by-season rankings with automatic TMDB metadata and stills.
  - **Movie Franchise Rankings**: Official TMDB collections plus customizable entries.
  - **Custom Collections**: Mix movies, shows, seasons, and episodes with custom manual entries.
- **Personalized Weighted Rating Systems**: Custom scoring categories, editable weights (e.g. Acting, Writing, Vibes, Cinematography, Sound Design), customizable scales (1–5, 1–10, 1–100), and live calculated weighted averages.
- **Rich Media & Artwork Customization**: TMDB posters/stills with support for custom artwork uploads, cropping, and fallback handling.
- **Responsive & Polished**: Designed with dark mode by default, modern typography, fluid animations, and mobile/PWA ergonomics.

## Tech Stack
- **Frontend**: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Motion
- **Backend**: PostgreSQL, Drizzle ORM, Better Auth
- **Integrations**: TMDB API, Resend Transactional Email
- **Deployment**: Docker Compose & Cloudflare Tunnel

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 16+

### Local Setup
1. Copy `.env.example` to `.env.local` and set required environment keys:
   ```bash
   cp .env.example .env.local
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run database migrations:
   ```bash
   npm run db:push
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).
