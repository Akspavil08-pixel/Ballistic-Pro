# Ballistic Calculator (Ballistic Pro)

Полноценный веб‑калькулятор внешней баллистики с PWA, офлайн режимом, профилями и визуализациями.

## Структура

- frontend — React + Vite + Tailwind + Chart.js + Three.js
- backend — FastAPI + NumPy + SciPy + SQLite
- G1/G7 drag tables — `backend/app/ballistics/g1.csv`, `backend/app/ballistics/g7.csv`
- Профили сеток — `frontend/src/reticle/reticleProfiles.ts`

## Запуск backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend доступен на `http://localhost:8000`.

## Запуск frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend доступен на `http://localhost:5173`.

## PWA и офлайн

- Манифест: `frontend/public/manifest.json`
- Service Worker: `frontend/public/sw.js`

После `npm run build` и размещения статики сервис‑воркер кеширует приложение для офлайн режима.

### Установка на телефон

1. Откройте сайт в браузере.
2. iOS: "Поделиться" → "На экран Домой".
3. Android: меню браузера → "Установить приложение".

## Примечания по ретиклам

В интерфейсе можно выбрать сетку прицела и вариант (если есть). Субтензии отображаются в блоке «Прицел».
