# Flyt – Kanban-board

Et mobilvennlig Kanban-board laget med HTML, CSS og JavaScript. Oppgaver lagres lokalt i nettleseren.

## Kjør lokalt

Åpne `index.html` direkte, eller start en enkel lokal webserver i denne mappen.

## Publisering

Hele løsningen er statisk og kan publiseres gratis på GitHub Pages, Netlify, Vercel eller Cloudflare Pages.

## Supabase-oppsett

1. Åpne Supabase-prosjektet og velg **SQL Editor**.
2. Lim inn hele `supabase-setup.sql` og kjør spørringen én gang.
3. Under **Authentication → URL Configuration** setter du Site URL til `https://lordsilkendor.github.io/LordKandan/`.
4. Legg samme adresse til under Redirect URLs.
5. Publiser filene til GitHub Pages og logg inn med administratoradressen.

Første innlogging importerer eksisterende lokale prosjekter dersom databasen er tom. Nye brukere må logge inn én gang før administratoren kan gi dem prosjekttilgang.
