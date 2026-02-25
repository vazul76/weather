// ─────────────────────────────────────────────
//  Weather Widget DIY – JavaScript
// ─────────────────────────────────────────────

const API_KEY   = '7fd4f3f1f879b0efee537d6d514f8ad2';
const CITIES    = ['Bantul', 'Sleman', 'Yogyakarta', 'Wates', 'Wonosari'];
const CITY_NAMES = {
    Bantul     : 'Bantul',
    Sleman     : 'Sleman',
    Yogyakarta : 'Yogyakarta',
    Wates      : 'Kulonprogo',
    Wonosari   : 'Gunung Kidul',
};

const weatherWidget = document.getElementById('weather-widget');
let currentCityIndex = 0;

// ─── SVG Animation Engine ───────────────────────────────────────────────────

const NS          = 'http://www.w3.org/2000/svg';
const wxPrecip    = document.getElementById('wx-precip');
const wxLightning = document.getElementById('wx-lightning');

let wxRAF             = null;
let wxDrops           = [];
let wxSnow            = [];
let wxCurrentType     = '';
let wxLightningTimeout = null;
let wxSettings        = { rainCount: 0, snowCount: 0, windSpeed: 0.6 };

function getAnimationType(iconCode) {
    if (!iconCode) return 'clear';
    const id = iconCode.slice(0, 2);
    if (id === '09') return 'drizzle';
    if (id === '10') return 'rain';
    if (id === '11') return 'thunder';
    return 'clear';
}

function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

function getWxSize() {
    return { w: weatherWidget.offsetWidth, h: weatherWidget.offsetHeight };
}

// ─── Rain ───────────────────────────────────────────────────────────────────

function spawnRainDrop() {
    const sz       = getWxSize();
    const isDrizzle = wxCurrentType === 'drizzle';
    const isThunder = wxCurrentType === 'thunder';
    const wind      = wxSettings.windSpeed * 9;
    const x         = 15 + Math.random() * (sz.w - 30);

    if (isDrizzle) {
        const len  = 4 + Math.random() * 3;
        const speed = 1.2 + Math.random() * 0.8;
        const line  = svgEl('line', {
            x1: x, y1: -len,
            x2: x + wind * 0.05, y2: 0,
            stroke: '#90c0e0',
            'stroke-width': 0.8 + Math.random() * 0.5,
            'stroke-linecap': 'round',
            opacity: 0.45 + Math.random() * 0.25,
        });
        wxPrecip.appendChild(line);
        wxDrops.push({ el: line, x, y: -len, speed, len, windX: wind * 0.008, isCircle: false });
    } else {
        const len   = isThunder ? 20 : 13;
        const sw    = isThunder ? 1.6 + Math.random() : 0.8 + Math.random() * 0.6;
        const speed = isThunder ? 10 + Math.random() * 5 : 5.5 + Math.random() * 4;
        const color = isThunder ? '#8090ae' : '#7aa8e8';
        const line  = svgEl('line', {
            x1: x, y1: -len,
            x2: x + wind * 0.12, y2: 0,
            stroke: color, 'stroke-width': sw,
            'stroke-linecap': 'round', opacity: 0.65,
        });
        wxPrecip.appendChild(line);
        wxDrops.push({ el: line, x, y: -len, speed, len, windX: wind * 0.02, isCircle: false });
    }
}

function makeSplash(x, baseY) {
    const sz        = getWxSize();
    if (x < 2 || x > sz.w - 2) return;
    const isThunder = wxCurrentType === 'thunder';
    const up        = -(14 + Math.random() * (isThunder ? 55 : 30));
    const dx        = (Math.random() - 0.5) * 50;
    const color     = isThunder ? '#8090ae' : '#7aa8e8';
    const arc       = svgEl('path', {
        d: `M${x},${baseY} Q${x + dx},${baseY + up} ${x + dx * 1.8},${baseY + 14}`,
        fill: 'none', stroke: color, 'stroke-width': 0.9, opacity: 0.75,
    });
    wxPrecip.appendChild(arc);
    let op = 0.75;
    const fade = () => {
        op -= 0.06;
        arc.setAttribute('opacity', Math.max(0, op));
        if (op > 0) requestAnimationFrame(fade);
        else arc.remove();
    };
    requestAnimationFrame(fade);
}

function tickDrops() {
    const sz = getWxSize();
    for (let i = wxDrops.length - 1; i >= 0; i--) {
        const d = wxDrops[i];
        d.y += d.speed;
        d.x += d.windX;
        if (d.isCircle) {
            d.el.setAttribute('cx', d.x);
            d.el.setAttribute('cy', d.y);
        } else {
            d.el.setAttribute('x1', d.x);
            d.el.setAttribute('y1', d.y);
            d.el.setAttribute('x2', d.x + d.windX * 0.12);
            d.el.setAttribute('y2', d.y + d.len);
        }
        if (d.y > sz.h) {
            if (!d.isCircle && d.speed > 4) makeSplash(d.x, sz.h - 4);
            d.el.remove();
            wxDrops.splice(i, 1);
        }
    }
    const need = wxSettings.rainCount - wxDrops.length;
    if (need > 0) {
        const batch = Math.min(4, need);
        for (let i = 0; i < batch; i++) spawnRainDrop();
    }
}

// ─── Snow ────────────────────────────────────────────────────────────────────

function spawnSnowFlake() {
    const sz = getWxSize();
    const r  = 2.5 + Math.random() * 3;
    const x  = 10 + Math.random() * (sz.w - 20);
    const circle = svgEl('circle', { cx: x, cy: -r, r, fill: '#b8dcf0', opacity: 0.72 });
    wxPrecip.appendChild(circle);
    wxSnow.push({
        el: circle, x, y: -r, r,
        vy: 0.45 + Math.random() * 0.75,
        vx: (Math.random() - 0.5) * 0.35,
        drift: Math.random() * Math.PI * 2,
        driftSpd: 0.012 + Math.random() * 0.01,
    });
}

function tickSnow() {
    const sz = getWxSize();
    for (let i = wxSnow.length - 1; i >= 0; i--) {
        const s = wxSnow[i];
        s.drift += s.driftSpd;
        s.y     += s.vy;
        s.x     += s.vx + Math.sin(s.drift) * 0.4;
        s.el.setAttribute('cx', s.x);
        s.el.setAttribute('cy', s.y);
        if (s.y > sz.h + s.r) { s.el.remove(); wxSnow.splice(i, 1); }
    }
    if (wxSnow.length < wxSettings.snowCount) spawnSnowFlake();
}

// ─── Lightning ───────────────────────────────────────────────────────────────

function triggerLightning() {
    if (wxCurrentType !== 'thunder') return;
    wxLightningTimeout = setTimeout(() => {
        const sz  = getWxSize();
        const px  = 30 + Math.random() * (sz.w - 60);
        const pts = [];
        let lx    = px;
        for (let i = 0; i <= 16; i++) {
            pts.push(`${lx},${(sz.h * 0.7 / 16) * i}`);
            lx += (Math.random() - 0.5) * 26;
        }
        const bolt = svgEl('polyline', {
            points: pts.join(' '), fill: 'none',
            stroke: 'rgba(185,210,255,0.92)',
            'stroke-width': 1.2 + Math.random() * 1.2,
        });
        wxLightning.appendChild(bolt);
        weatherWidget.classList.add('wx-shake');
        setTimeout(() => {
            bolt.remove();
            weatherWidget.classList.remove('wx-shake');
        }, 550);
        triggerLightning();
    }, 2800 + Math.random() * 5500);
}

// ─── Main animation tick ─────────────────────────────────────────────────────

function wxAnimTick() {
    if (wxSettings.rainCount > 0) tickDrops();
    if (wxSettings.snowCount > 0) tickSnow();
    wxRAF = requestAnimationFrame(wxAnimTick);
}

function startAnimation(iconCode) {
    if (wxRAF) { cancelAnimationFrame(wxRAF); wxRAF = null; }
    if (wxLightningTimeout) { clearTimeout(wxLightningTimeout); wxLightningTimeout = null; }

    wxCurrentType = getAnimationType(iconCode);

    wxPrecip.innerHTML    = '';
    wxLightning.innerHTML = '';
    wxDrops = [];
    wxSnow  = [];
    wxSettings.rainCount = 0;
    wxSettings.snowCount = 0;
    wxSettings.windSpeed = 1.2;

    const t = wxCurrentType;
    if (t === 'drizzle') { wxSettings.rainCount = 8;  wxSettings.windSpeed = 0.4; }
    if (t === 'rain')    { wxSettings.rainCount = 30; }
    if (t === 'thunder') { wxSettings.rainCount = 44; wxSettings.windSpeed = 1.8; triggerLightning(); }

    if (wxSettings.rainCount > 0 || wxSettings.snowCount > 0) wxAnimTick();
}

// ─── SVG Icon Builder ────────────────────────────────────────────────────────

function getWeatherIconSVG(iconCode) {
    const id      = iconCode ? iconCode.slice(0, 2) : '';
    const isNight = iconCode && iconCode.endsWith('n');

    const u = (href, x = '', y = '', cls = '', extra = '') =>
        `<use href="#${href}"${x ? ` x="${x}"` : ''}${y ? ` y="${y}"` : ''}${cls ? ` class="${cls}"` : ''}${extra}/>`;

    let inner = '';

    if      (id === '01' && !isNight) {
        inner = u('wx-sym-sun');
    } else if (id === '01' && isNight) {
        inner = u('wx-sym-moon', '0', '5') +
                u('wx-sym-star', '55', '18', 'wx-star') +
                u('wx-sym-star', '70', '30', 'wx-star wx-star-d1') +
                u('wx-sym-star', '62', '48', 'wx-star wx-star-d2');
    } else if (id === '02' && !isNight) {
        inner = u('wx-sym-sun', '-12', '-18') +
                u('wx-sym-grayCloud', '', '', 'wx-floatCloud') +
                u('wx-sym-whiteCloud', '7');
    } else if (id === '02' && isNight) {
        inner = u('wx-sym-moon', '-20', '-15') +
                u('wx-sym-grayCloud', '', '', 'wx-floatCloud') +
                u('wx-sym-whiteCloud', '7');
    } else if (id === '03') {
        inner = u('wx-sym-grayCloud', '', '', 'wx-floatCloud') +
                u('wx-sym-whiteCloud', '7');
    } else if (id === '04') {
        inner = u('wx-sym-grayCloud', '', '', 'wx-floatCloud') +
                u('wx-sym-grayCloud', '25', '10', 'wx-floatCloudR') +
                u('wx-sym-whiteCloud', '7');
    } else if (id === '09') {
        inner = u('wx-sym-grayCloud', '-5', '5', 'wx-floatCloud') +
                u('wx-sym-grayCloud', '28', '15', 'wx-floatCloudR') +
                u('wx-sym-rainDrizzle', '10', '62') +
                u('wx-sym-rainDrizzle', '25', '62') +
                u('wx-sym-rainDrizzle', '40', '62') +
                u('wx-sym-rainDrizzle', '55', '62');
    } else if (id === '10') {
        inner = u('wx-sym-grayCloud', '25', '10', 'wx-floatCloudR') +
                u('wx-sym-whiteCloud', '5', '-7') +
                u('wx-sym-rainDrop', '15', '65', 'wx-drop wx-drop-d08') +
                u('wx-sym-rainDrop', '28', '65', 'wx-drop') +
                u('wx-sym-rainDrop', '41', '65', 'wx-drop wx-drop-d05') +
                u('wx-sym-rainDrop', '54', '65', 'wx-drop wx-drop-d1');
    } else if (id === '11') {
        inner = u('wx-sym-grayCloud', '', '', 'wx-floatCloud') +
                u('wx-sym-grayCloud', '25', '10', 'wx-floatCloudR') +
                u('wx-sym-whiteCloud', '7') +
                u('wx-sym-thunderBolt', '28', '62', 'wx-bolt') +
                u('wx-sym-thunderBolt', '46', '57', 'wx-bolt wx-bolt-d1');
    } else if (id === '13') {
        inner = u('wx-sym-whiteCloud', '10', '-15') +
                u('wx-sym-snowFlake', '20', '55', 'wx-snow') +
                u('wx-sym-snowFlake', '35', '65', 'wx-snow wx-snow-d08') +
                u('wx-sym-snowFlake', '48', '58', 'wx-snow wx-snow-d05') +
                u('wx-sym-snowFlake', '60', '65', 'wx-snow wx-snow-d1');
    } else if (id === '50') {
        inner = u('wx-sym-grayCloud', '', '20', 'wx-floatCloud') +
                u('wx-sym-grayCloud', '30', '30', 'wx-floatCloudR') +
                u('wx-sym-mist', '0', '25', 'wx-mist');
    } else {
        inner = u('wx-sym-sun');
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="weather-icon">${inner}</svg>`;
}

// ─── Condition helpers ───────────────────────────────────────────────────────

function getConditionEmoji(iconCode) {
    const id = iconCode ? iconCode.slice(0, 2) : '';
    const n  = iconCode && iconCode.endsWith('n');
    const map = {
        '01': n ? '🌙' : '☀️',
        '02': n ? '🌙' : '🌤️',
        '03': '🌥️',
        '04': '☁️',
        '09': '🌧️',
        '10': '💧',
        '11': '⚡',
        '13': '❄️',
        '50': '🌫️',
    };
    return map[id] ?? '🌤️';
}

// ─── Fetch & Render ──────────────────────────────────────────────────────────

async function fetchWeather(city) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city},id&appid=${API_KEY}&units=metric&lang=id`;
    try {
        const data = await fetch(apiUrl).then(r => r.json());

        const iconCode   = data.weather[0].icon;
        const iconSVG    = getWeatherIconSVG(iconCode);
        const displayName = CITY_NAMES[city];

        startAnimation(iconCode);

        // Fade out existing content
        const existing = weatherWidget.querySelector('.weather-content');
        if (existing) {
            existing.classList.add('fade-out');
            await new Promise(resolve => setTimeout(resolve, 350));
        }

        weatherWidget.querySelectorAll('.weather-content, .weather-details').forEach(el => el.remove());

        const html = `
            <div class="weather-content">
                <div class="wx-top">
                    <div class="wx-temp-row">
                        <span class="wx-temp">${Math.round(data.main.temp)}&deg;</span>
                        ${iconSVG}
                    </div>
                    <div class="wx-city">${displayName}</div>
                </div>
                <div class="wx-condition">
                    <span class="wx-cond-icon">${getConditionEmoji(iconCode)}</span>
                    <span class="wx-cond-text">${data.weather[0].description}</span>
                </div>
                <div class="wx-details">
                    <div class="wx-detail-item">
                        <span class="wx-detail-label">Angin</span>
                        <span class="wx-detail-val">${data.wind.speed} m/s</span>
                    </div>
                    <div class="wx-detail-item">
                        <span class="wx-detail-label">Kelembapan</span>
                        <span class="wx-detail-val">${data.main.humidity}%</span>
                    </div>
                </div>
            </div>
        `;

        weatherWidget.appendChild(document.createRange().createContextualFragment(html));

        // Fade in
        weatherWidget.querySelectorAll('.weather-content').forEach(el => {
            el.classList.add('fade-in');
            setTimeout(() => el.classList.remove('fade-in'), 500);
        });
    } catch (err) {
        console.error(`Error fetching weather for ${city}:`, err);
        weatherWidget.innerHTML = '<div class="alert alert-danger">Gagal memuat data cuaca.</div>';
    }
}

function updateWeather() {
    fetchWeather(CITIES[currentCityIndex]);
    currentCityIndex = (currentCityIndex + 1) % CITIES.length;
}

// ─── Init ────────────────────────────────────────────────────────────────────

updateWeather();
setInterval(updateWeather, 15_000);
