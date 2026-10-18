const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Screen A HTML Template
function getScreenAHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aubrey Rankings — Screen A: Social Homepage (Modern Cinema Editorial)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            display: ['Bebas Neue', 'sans-serif'],
            editorial: ['Newsreader', 'Georgia', 'serif'],
            ui: ['Plus Jakarta Sans', 'sans-serif'],
          },
          colors: {
            cinemaBg: '#121212',
            cinemaSurface: '#1B1B19',
            cinemaElevated: '#242321',
            cinemaPrimary: '#F2EFE9',
            cinemaSecondary: '#9C9993',
            cinemaBorder: '#2A2926',
            cinemaVermilion: '#D93829',
            cinemaGold: '#D89B38',
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #121212; color: #F2EFE9; font-family: 'Plus Jakarta Sans', sans-serif; }
    .film-grain { background-image: radial-gradient(rgba(242, 239, 233, 0.04) 1px, transparent 0); background-size: 24px 24px; }
  </style>
</head>
<body class="min-h-screen bg-[#121212] text-[#F2EFE9] flex flex-col film-grain">
  <!-- Prototype Top Nav Switcher -->
  <div class="sticky top-0 z-50 bg-[#181816]/95 backdrop-blur-md border-b border-[#2A2926] px-4 py-2.5 text-xs">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="px-2.5 py-0.5 rounded-full bg-[#D93829] text-white font-bold tracking-wider text-[10px] uppercase">
          Stage 1 Prototype
        </span>
        <span class="text-[#9C9993] text-xs font-medium">Modern Cinema Editorial Design Language</span>
      </div>
      <div class="flex items-center gap-1.5 bg-[#121212] p-1 rounded-xl border border-[#2A2926]">
        <span class="px-3 py-1 rounded-lg bg-[#262523] text-[#F2EFE9] text-xs font-semibold border border-[#383632]">Screen A: Social Home</span>
        <span class="px-3 py-1 text-[#9C9993] text-xs">Screen B: Ranking Detail</span>
        <span class="px-3 py-1 text-[#9C9993] text-xs">Screen C: User Profile</span>
      </div>
      <div class="flex items-center gap-2 text-[#9C9993] text-xs font-mono">
        <span class="px-2 py-0.5 rounded bg-[#1B1B19] border border-[#2A2926]">1440 Desktop / 390 Mobile</span>
      </div>
    </div>
  </div>

  <!-- Cinematic Masthead -->
  <header class="border-b border-[#2A2926] bg-[#141414]/90 backdrop-blur-md sticky top-10 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="h-11 w-11 rounded-xl bg-[#1B1B19] border border-[#383632] flex items-center justify-center font-display text-2xl text-[#F2EFE9] shadow-inner">
          A
        </div>
        <div>
          <span class="font-display text-2xl tracking-wider text-[#F2EFE9] block leading-none">AUBREY RANKINGS</span>
          <span class="text-[10px] font-mono tracking-widest text-[#D93829] uppercase">The Cinema Dossier</span>
        </div>
      </div>
      <div class="flex items-center gap-6 text-xs uppercase tracking-wider font-semibold text-[#9C9993]">
        <span class="text-[#F2EFE9] border-b-2 border-[#D93829] pb-1">Dispatch</span>
        <span>Auteur Indexes</span>
        <span>Rankings</span>
        <span>Journal</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="px-3 py-1.5 rounded-lg bg-[#1B1B19] border border-[#2A2926] text-xs text-[#9C9993] font-mono">Search TMDB...</span>
        <div class="h-8 w-8 rounded-full bg-[#D93829] text-white flex items-center justify-center font-bold text-xs">
          A
        </div>
      </div>
    </div>
  </header>

  <!-- Main Hero Lead Story -->
  <main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
    <section class="relative rounded-3xl overflow-hidden bg-[#161614] border border-[#2A2926] p-8 sm:p-12 lg:p-16">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div class="lg:col-span-7 space-y-6">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#20201D] border border-[#343331] text-[11px] font-bold text-[#F2EFE9] uppercase tracking-widest">
              <span class="h-1.5 w-1.5 rounded-full bg-[#D93829] animate-pulse"></span>
              Featured Editorial Critique
            </span>
            <span class="px-2.5 py-0.5 rounded-full bg-[#181816] border border-[#2E2D2A] text-[10px] font-mono text-[#D89B38]">
              ★ Kodi / Jellyfin ClearLOGO Active
            </span>
          </div>

          <!-- Authentic ClearLOGO Transparent PNG Logo -->
          <div class="py-1">
            <img src="https://image.tmdb.org/t/p/original/bQGVstVOI79nDmswbo3umB0lmrp.png" alt="Black Mirror ClearLOGO" class="h-16 w-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)] filter brightness-110">
          </div>

          <h1 class="font-display text-5xl sm:text-7xl lg:text-8xl tracking-tight text-[#F2EFE9] leading-[0.9] uppercase">
            EVERY EPISODE,
            <span class="text-[#D93829] font-editorial italic normal-case text-4xl sm:text-6xl lg:text-7xl block pt-2">
              ranked and calibrated.
            </span>
          </h1>

          <p class="font-editorial text-xl text-[#9C9993] leading-relaxed max-w-xl italic">
            &ldquo;Charlie Brooker's dystopian anthologies dissected and calibrated by sensory weight: Writing (8x), Acting (8x), Cinematography (7x), Music (3x), and unvarnished Vibes (8x).&rdquo;
          </p>

          <div class="pt-2 border-t border-[#262523] flex flex-wrap gap-5 text-xs font-mono text-[#9C9993]">
            <div><span class="font-bold text-[#D89B38]">#01</span> San Junipero <span class="opacity-60">(9.6)</span></div>
            <div><span class="font-bold text-[#D89B38]">#02</span> White Christmas <span class="opacity-60">(9.5)</span></div>
            <div><span class="font-bold text-[#D89B38]">#03</span> USS Callister <span class="opacity-60">(9.4)</span></div>
          </div>

          <div class="flex items-center gap-4 pt-4">
            <button class="px-6 py-3.5 rounded-xl bg-[#D93829] text-white font-semibold text-sm shadow-xl shadow-[#D93829]/20 hover:scale-105 transition-all">
              Explore Complete Ranking &rarr;
            </button>
            <button class="px-5 py-3.5 rounded-xl bg-[#20201D] text-[#F2EFE9] border border-[#343331] font-semibold text-sm">
              View @aubrey's Profile
            </button>
          </div>
        </div>

        <!-- Right Side: Film Still Layered Composition -->
        <div class="lg:col-span-5 relative">
          <div class="aspect-[16/11] rounded-2xl overflow-hidden border border-[#383632] shadow-2xl relative bg-black">
            <img src="https://image.tmdb.org/t/p/original/9w27Lgeq8KVxhz4ysygT6ranxf1.jpg" alt="San Junipero Still" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
            <div class="absolute bottom-4 left-5 right-5 flex items-end justify-between">
              <div>
                <span class="font-display text-sm tracking-widest text-[#D93829] uppercase">#01 Champion</span>
                <h3 class="font-bold text-white text-lg">San Junipero (S3, Ep 4)</h3>
              </div>
              <span class="px-2.5 py-1 rounded-md bg-black/80 border border-[#D89B38]/40 text-[#D89B38] font-bold text-sm">★ 9.6</span>
            </div>
          </div>
          <!-- Overlapping Secondary Still -->
          <div class="absolute -bottom-6 -left-6 w-48 aspect-video rounded-xl overflow-hidden border-2 border-[#161614] shadow-2xl bg-black">
            <img src="https://image.tmdb.org/t/p/original/c62HKSbeTRkatK223O3m58CmmPd.jpg" alt="USS Callister Still" class="w-full h-full object-cover">
          </div>
        </div>
      </div>
    </section>

    <!-- Curated Index Strip -->
    <section class="space-y-6">
      <div class="flex items-center justify-between pb-3 border-b border-[#262523]">
        <h2 class="font-display text-3xl tracking-wide uppercase">AUTEUR & STUDIO SPOTLIGHT</h2>
        <span class="text-xs font-mono text-[#9C9993]">Volume IV, Issue 2</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="rounded-2xl bg-[#181816] border border-[#2A2926] p-6 space-y-3">
          <span class="text-xs font-mono text-[#D89B38]">Auteur Focus</span>
          <h3 class="font-display text-2xl uppercase">Christopher Nolan: 70mm Sagas</h3>
          <p class="font-editorial text-sm text-[#9C9993] italic">Ranked by narrative puzzle complexity and practical mechanical scale.</p>
        </div>
        <div class="rounded-2xl bg-[#181816] border border-[#2A2926] p-6 space-y-3">
          <span class="text-xs font-mono text-[#D89B38]">Studio Dossier</span>
          <h3 class="font-display text-2xl uppercase">A24 Dread & Transcendence</h3>
          <p class="font-editorial text-sm text-[#9C9993] italic">Graded on atmospheric sound design and existential lingering dread.</p>
        </div>
        <div class="rounded-2xl bg-[#181816] border border-[#2A2926] p-6 space-y-3">
          <span class="text-xs font-mono text-[#D89B38]">Auteur Focus</span>
          <h3 class="font-display text-2xl uppercase">David Fincher: Clinical Precision</h3>
          <p class="font-editorial text-sm text-[#9C9993] italic">From Se7en through The Killer: obsession, rhythm, and color grading.</p>
        </div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

// Screen B HTML Template (Ranking Detail with ClearLOGO and 4K Fanart Backdrop)
function getScreenBHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aubrey Rankings — Screen B: Ranking Detail (ClearLOGO & 4K Fanart Backdrop)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            display: ['Bebas Neue', 'sans-serif'],
            editorial: ['Newsreader', 'Georgia', 'serif'],
            ui: ['Plus Jakarta Sans', 'sans-serif'],
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #10100E; color: #F2EFE9; font-family: 'Plus Jakarta Sans', sans-serif; }
  </style>
</head>
<body class="min-h-screen bg-[#10100E] text-[#F2EFE9] flex flex-col">
  <!-- Prototype Nav Switcher -->
  <div class="sticky top-0 z-50 bg-[#181816]/95 backdrop-blur-md border-b border-[#2A2926] px-4 py-2.5 text-xs">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="px-2.5 py-0.5 rounded-full bg-[#D93829] text-white font-bold tracking-wider text-[10px] uppercase">
          Stage 1 Prototype
        </span>
        <span class="text-[#9C9993] text-xs font-medium">Screen B: Ranking Detail</span>
      </div>
      <div class="flex items-center gap-1.5 bg-[#121212] p-1 rounded-xl border border-[#2A2926]">
        <span class="px-3 py-1 text-[#9C9993] text-xs">Screen A: Social Home</span>
        <span class="px-3 py-1 rounded-lg bg-[#262523] text-[#F2EFE9] text-xs font-semibold border border-[#383632]">Screen B: Ranking Detail</span>
        <span class="px-3 py-1 text-[#9C9993] text-xs">Screen C: User Profile</span>
      </div>
      <div class="flex items-center gap-2 text-[#9C9993] text-xs font-mono">
        <span class="px-2 py-0.5 rounded bg-[#1B1B19] border border-[#2A2926]">1440 Desktop / 390 Mobile</span>
      </div>
    </div>
  </div>

  <!-- ATMOSPHERIC 4K HEADER WITH AUTHENTIC CLEARLOGO (Kodi / Jellyfin / Plex Inspiration) -->
  <header class="relative overflow-hidden bg-[#10100E] border-b border-[#2A2926]">
    <!-- 4K Fanart Backdrop with Vignette -->
    <div class="absolute inset-0 z-0">
      <img src="https://image.tmdb.org/t/p/original/38aCLy0BdFbOAIEfuDladoITHN0.jpg" alt="Black Mirror 4K Backdrop" class="w-full h-full object-cover object-top opacity-30 filter contrast-125 saturate-110 scale-105">
      <div class="absolute inset-0 bg-gradient-to-t from-[#10100E] via-[#10100E]/75 to-[#10100E]/30"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-[#10100E] via-[#10100E]/40 to-[#10100E]"></div>
    </div>

    <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-14 space-y-6">
      <div class="flex items-center justify-between text-xs font-mono text-[#9C9993]">
        <div class="flex items-center gap-2">
          <span>&larr; Back to Dispatch</span>
          <span>/</span>
          <span class="text-[#D93829]">TV Anthology</span>
          <span>/</span>
          <span class="text-[#F2EFE9]">Black Mirror</span>
        </div>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181816]/90 border border-[#302F2C] text-[10px] text-[#D89B38]">
          ★ ClearLOGO &bull; 4K Fanart &bull; Criterion Key Art
        </span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
        <div class="lg:col-span-8 space-y-5">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1F1E1B] border border-[#343331] text-[11px] font-mono text-[#D89B38]">
            <span>Aubrey's Correct &amp; Definitive Ratings</span>
          </div>

          <!-- Authentic Kodi-Style ClearLOGO -->
          <div class="pt-1 pb-1">
            <img src="https://image.tmdb.org/t/p/original/bQGVstVOI79nDmswbo3umB0lmrp.png" alt="Black Mirror ClearLOGO" class="h-20 w-auto object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.9)] filter brightness-110">
          </div>

          <h1 class="font-display text-4xl sm:text-6xl lg:text-7xl tracking-tight text-[#F2EFE9] leading-[0.95] uppercase">
            AUBREY'S AWESOME AND CORRECT
            <span class="text-[#D93829] font-editorial italic normal-case block pt-1 text-3xl sm:text-5xl lg:text-6xl">
              The Unassailable Episode Hierarchy
            </span>
          </h1>

          <p class="font-editorial text-lg text-[#9C9993] max-w-2xl leading-relaxed italic">
            A mathematical and aesthetic breakdown of every single episode from Season 1 through Season 6. Graded on Aubrey's custom weighted rubric to establish the true, unassailable hierarchy.
          </p>

          <div class="flex items-center gap-4 text-xs text-[#9C9993]">
            <div class="flex items-center gap-2 text-[#F2EFE9]">
              <div class="h-6 w-6 rounded-full bg-[#D93829] text-white flex items-center justify-center font-display text-xs">A</div>
              <span class="font-semibold">Curated by Aubrey (@aubrey)</span>
            </div>
            <span>&bull;</span>
            <span>Public Ranking</span>
            <span>&bull;</span>
            <span class="font-mono text-[#D89B38]">33 Episodes Ranked</span>
          </div>
        </div>

        <!-- Right Side: Alternative Poster & Rubric Breakdown -->
        <div class="lg:col-span-4 space-y-4">
          <!-- Alternative Key Art Card -->
          <div class="p-4 rounded-2xl bg-[#161614]/90 backdrop-blur-md border border-[#2A2926] flex items-center gap-4">
            <div class="w-16 h-24 rounded-lg overflow-hidden border border-[#3A3935] shadow-lg flex-shrink-0 bg-black">
              <img src="https://image.tmdb.org/t/p/original/seN6rRfN0I6n8iDXjlSMk1QjNcq.jpg" alt="Criterion Poster" class="w-full h-full object-cover">
            </div>
            <div class="space-y-1 text-xs">
              <span class="font-mono text-[10px] text-[#D89B38] uppercase tracking-wider block">Alternative Key Art</span>
              <p class="font-semibold text-[#F2EFE9]">Criterion-Grade Poster &amp; ClearLOGO</p>
              <p class="text-[#9C9993] text-[11px]">Kodi / Jellyfin Fanart library asset integration</p>
            </div>
          </div>

          <!-- Weighted Category Rubric -->
          <div class="p-5 rounded-2xl bg-[#161614]/90 backdrop-blur-md border border-[#2A2926] space-y-2.5 text-xs font-mono">
            <div class="flex justify-between items-center text-xs uppercase tracking-wider text-[#F2EFE9] font-bold pb-1 border-b border-[#242321]">
              <span>Weighted Category Rubric</span>
              <span class="text-[#D89B38]">Scale 1–10</span>
            </div>
            <div class="flex justify-between text-[#9C9993]"><span>Writing &amp; Narrative</span><span class="text-[#F2EFE9] font-bold">8x</span></div>
            <div class="flex justify-between text-[#9C9993]"><span>Acting &amp; Performance</span><span class="text-[#F2EFE9] font-bold">8x</span></div>
            <div class="flex justify-between text-[#9C9993]"><span>Cinematography &amp; Direction</span><span class="text-[#F2EFE9] font-bold">7x</span></div>
            <div class="flex justify-between text-[#9C9993]"><span>Music &amp; Sound Design</span><span class="text-[#F2EFE9] font-bold">3x</span></div>
            <div class="flex justify-between text-[#9C9993]"><span>Vibes &amp; Resonant Dread</span><span class="text-[#F2EFE9] font-bold">8x</span></div>
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- RANKING LIST WITH 16:9 TITLE CARDS & ASYMMETRIC HIERARCHY -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
    <!-- #01 HEROIC CHAMPION -->
    <div class="rounded-3xl bg-[#181816] border-2 border-[#D89B38]/60 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div class="lg:col-span-7 aspect-video rounded-2xl overflow-hidden border border-[#383632] relative bg-black">
          <img src="https://image.tmdb.org/t/p/original/9w27Lgeq8KVxhz4ysygT6ranxf1.jpg" alt="San Junipero 1080p Still" class="w-full h-full object-cover">
          <div class="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/85 border border-[#D89B38] text-[#D89B38] font-mono font-bold text-xs">
            ★ 16:9 Cinematic Title Card
          </div>
        </div>
        <div class="lg:col-span-5 space-y-4">
          <div class="flex items-center gap-3">
            <span class="font-display text-5xl text-[#D89B38]">#01</span>
            <span class="px-2.5 py-1 rounded bg-[#D93829] text-white font-bold text-xs uppercase tracking-wider">Definitive Champion</span>
          </div>
          <h2 class="font-display text-4xl sm:text-5xl uppercase tracking-tight text-[#F2EFE9]">San Junipero</h2>
          <span class="text-xs font-mono text-[#9C9993]">Season 3, Episode 4 &bull; 2016</span>
          <p class="font-editorial italic text-base text-[#9C9993] leading-relaxed">
            &ldquo;A rare transcendent romance in an otherwise bleak anthology. Clint Mansell's synth score and Gugu Mbatha-Raw's acting elevate it to sublime art.&rdquo;
          </p>
          <div class="pt-3 border-t border-[#262523] flex items-center justify-between">
            <span class="text-xs font-mono text-[#D89B38] font-bold">Overall Weighted Score</span>
            <span class="text-2xl font-mono font-extrabold text-[#D89B38]">9.6 / 10</span>
          </div>
        </div>
      </div>
    </div>

    <!-- #02 & #03 FEATURE DUO -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div class="rounded-2xl bg-[#181816] border border-[#2A2926] p-6 space-y-4">
        <div class="aspect-video rounded-xl overflow-hidden bg-black relative">
          <img src="https://image.tmdb.org/t/p/original/bptfVGEQuv6vDTIMVCHjJ9Dz8PX.jpg" alt="White Christmas Still" class="w-full h-full object-cover">
          <span class="absolute top-3 left-3 px-2.5 py-0.5 rounded bg-black/80 font-display text-xl text-[#F2EFE9]">#02</span>
        </div>
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-display text-3xl uppercase">White Christmas</h3>
            <span class="text-xs font-mono text-[#9C9993]">Season 2, Episode 4 (2014)</span>
          </div>
          <span class="text-xl font-mono font-bold text-[#D89B38]">9.5</span>
        </div>
        <p class="font-editorial text-sm text-[#9C9993] italic">Three interwoven horrors culminating in the most terrifying punishment ever conceived on television.</p>
      </div>

      <div class="rounded-2xl bg-[#181816] border border-[#2A2926] p-6 space-y-4">
        <div class="aspect-video rounded-xl overflow-hidden bg-black relative">
          <img src="https://image.tmdb.org/t/p/original/c62HKSbeTRkatK223O3m58CmmPd.jpg" alt="USS Callister Still" class="w-full h-full object-cover">
          <span class="absolute top-3 left-3 px-2.5 py-0.5 rounded bg-black/80 font-display text-xl text-[#F2EFE9]">#03</span>
        </div>
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-display text-3xl uppercase">USS Callister</h3>
            <span class="text-xs font-mono text-[#9C9993]">Season 4, Episode 1 (2017)</span>
          </div>
          <span class="text-xl font-mono font-bold text-[#D89B38]">9.4</span>
        </div>
        <p class="font-editorial text-sm text-[#9C9993] italic">Toby Haynes balances high-camp Star Trek technicolor pastiche with genuinely chilling psychological workplace abuse.</p>
      </div>
    </div>
  </main>
</body>
</html>`;
}

// Screen C HTML Template (User Profile with Dossier & ClearLOGO)
function getScreenCHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aubrey Rankings — Screen C: User Profile @aubrey</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            display: ['Bebas Neue', 'sans-serif'],
            editorial: ['Newsreader', 'Georgia', 'serif'],
            ui: ['Plus Jakarta Sans', 'sans-serif'],
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #121212; color: #F2EFE9; font-family: 'Plus Jakarta Sans', sans-serif; }
  </style>
</head>
<body class="min-h-screen bg-[#121212] text-[#F2EFE9] flex flex-col">
  <!-- Nav Switcher -->
  <div class="sticky top-0 z-50 bg-[#181816]/95 backdrop-blur-md border-b border-[#2A2926] px-4 py-2.5 text-xs">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="px-2.5 py-0.5 rounded-full bg-[#D93829] text-white font-bold tracking-wider text-[10px] uppercase">
          Stage 1 Prototype
        </span>
        <span class="text-[#9C9993] text-xs font-medium">Screen C: User Profile</span>
      </div>
      <div class="flex items-center gap-1.5 bg-[#121212] p-1 rounded-xl border border-[#2A2926]">
        <span class="px-3 py-1 text-[#9C9993] text-xs">Screen A: Social Home</span>
        <span class="px-3 py-1 text-[#9C9993] text-xs">Screen B: Ranking Detail</span>
        <span class="px-3 py-1 rounded-lg bg-[#262523] text-[#F2EFE9] text-xs font-semibold border border-[#383632]">Screen C: User Profile</span>
      </div>
      <div class="flex items-center gap-2 text-[#9C9993] text-xs font-mono">
        <span class="px-2 py-0.5 rounded bg-[#1B1B19] border border-[#2A2926]">1440 Desktop / 390 Mobile</span>
      </div>
    </div>
  </div>

  <!-- Profile Masthead / Dossier -->
  <header class="relative overflow-hidden bg-[#10100E] border-b border-[#2A2926]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-12 space-y-8">
      <div class="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-[#242321]">
        <div class="flex items-start gap-6">
          <div class="h-28 w-28 rounded-2xl bg-[#D93829] text-white flex items-center justify-center font-display text-6xl shadow-2xl border-2 border-[#383632]">
            A
          </div>
          <div class="space-y-2">
            <div class="flex items-center gap-3">
              <h1 class="font-display text-5xl text-[#F2EFE9] tracking-tight uppercase leading-none">AUBREY</h1>
              <span class="px-3 py-0.5 rounded-full bg-[#1B1B19] border border-[#383632] text-xs font-mono text-[#D89B38]">Founding Critic</span>
            </div>
            <span class="font-mono text-sm text-[#D93829] block">@aubrey</span>
            <p class="font-editorial italic text-lg text-[#9C9993] max-w-xl leading-relaxed">
              &ldquo;Evaluating media by narrative rigor, visual texture, and mathematical sensory weights. Creator of Aubrey Rankings.&rdquo;
            </p>
          </div>
        </div>

        <button class="px-6 py-2.5 rounded-xl bg-[#242321] text-[#F2EFE9] border border-[#383632] font-semibold text-xs tracking-wider uppercase">
          &check; Following Critic (1,420)
        </button>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono text-xs">
        <div class="p-4 rounded-xl bg-[#161614] border border-[#2A2926]"><span class="text-2xl font-bold text-[#F2EFE9] block font-display">482</span><span class="text-[#9C9993]">Films Graded</span></div>
        <div class="p-4 rounded-xl bg-[#161614] border border-[#2A2926]"><span class="text-2xl font-bold text-[#F2EFE9] block font-display">14</span><span class="text-[#9C9993]">Rankings Published</span></div>
        <div class="p-4 rounded-xl bg-[#161614] border border-[#2A2926]"><span class="text-2xl font-bold text-[#D89B38] block font-display">8.4</span><span class="text-[#9C9993]">Mean Rating</span></div>
        <div class="p-4 rounded-xl bg-[#161614] border border-[#2A2926]"><span class="text-2xl font-bold text-[#D93829] block font-display">1.4K</span><span class="text-[#9C9993]">Journal Followers</span></div>
      </div>
    </div>
  </header>

  <!-- Section 2: Pinned Collections with Kodi ClearLOGO -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
    <div class="space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-[#262523]">
        <h2 class="font-display text-3xl uppercase tracking-wide">AUBREY'S CURATED RANKINGS</h2>
        <span class="text-xs font-mono text-[#D89B38]">Pinned Collection</span>
      </div>

      <!-- Pinned Black Mirror Dossier Card -->
      <div class="rounded-2xl bg-[#181816] border border-[#2A2926] p-6 sm:p-8 space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div class="md:col-span-4 aspect-[16/10] rounded-xl overflow-hidden bg-black relative border border-[#2A2926]">
            <img src="https://image.tmdb.org/t/p/original/38aCLy0BdFbOAIEfuDladoITHN0.jpg" alt="Black Mirror Pinned" class="w-full h-full object-cover opacity-80">
            <div class="absolute inset-0 flex items-center justify-center p-6 bg-gradient-to-t from-black/80 via-transparent to-black/30">
              <img src="https://image.tmdb.org/t/p/original/bQGVstVOI79nDmswbo3umB0lmrp.png" alt="Black Mirror ClearLOGO" class="w-3/4 max-h-12 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)]">
            </div>
            <div class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-[#D89B38]">★ 9.6 Avg</div>
            <div class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-[#D93829] text-white text-[9px] font-bold">PINNED</div>
          </div>

          <div class="md:col-span-8 space-y-3">
            <div class="flex items-center gap-2 text-xs font-mono text-[#6B6862]">
              <span class="text-[#D93829] font-semibold">TV Anthology</span>
              <span>&bull;</span>
              <span>33 Episodes Ranked</span>
              <span>&bull;</span>
              <span class="text-[#D89B38]">Weighted Rubric</span>
            </div>
            <h3 class="font-display text-3xl uppercase text-[#F2EFE9]">AUBREY'S AWESOME AND CORRECT BLACK MIRROR RATINGS</h3>
            <p class="font-editorial italic text-sm text-[#9C9993]">The complete mathematical hierarchy of Charlie Brooker's dystopian television series.</p>
            <div class="pt-2 flex items-center gap-4 text-xs font-mono text-[#D89B38]">
              <span>Writing (8x)</span> &bull; <span>Acting (8x)</span> &bull; <span>Cinema (7x)</span> &bull; <span>Music (3x)</span> &bull; <span>Vibes (8x)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</body>
</html>`;
}

async function run() {
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/screen-a') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getScreenAHtml());
    } else if (req.url === '/screen-b' || req.url === '/ranking') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getScreenBHtml());
    } else if (req.url === '/screen-c' || req.url === '/profile') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getScreenCHtml());
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  const PORT = 3099;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log('HTTP Preview server listening on port', PORT);

  const browser = await chromium.launch({ headless: true });
  const outputDir = path.resolve(__dirname, '../public/prototype-previews');

  const targets = [
    { url: 'http://localhost:3099/screen-a', name: 'screen-a' },
    { url: 'http://localhost:3099/screen-b', name: 'screen-b' },
    { url: 'http://localhost:3099/screen-c', name: 'screen-c' },
  ];

  for (const target of targets) {
    // Desktop Viewport (1440x900)
    console.log(`Capturing Desktop (1440x900) for ${target.name}...`);
    const pageDesk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await pageDesk.goto(target.url, { waitUntil: 'networkidle', timeout: 30000 });
    // Wait an extra second for webfonts and TMDB images
    await new Promise(r => setTimeout(r, 1500));
    await pageDesk.screenshot({ path: path.join(outputDir, `${target.name}-desktop.png`), fullPage: false });
    await pageDesk.close();

    // Mobile Viewport (390x844 - iPhone 14/15/16)
    console.log(`Capturing Mobile (390x844) for ${target.name}...`);
    const pageMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await pageMobile.goto(target.url, { waitUntil: 'networkidle', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    await pageMobile.screenshot({ path: path.join(outputDir, `${target.name}-mobile.png`), fullPage: false });
    await pageMobile.close();
  }

  await browser.close();
  server.close();
  console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY in', outputDir);
}

run().catch(err => {
  console.error('Capture script error:', err);
  process.exit(1);
});
