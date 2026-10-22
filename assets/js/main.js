(() => {
    'use strict';

    const rand = (min, max) => min + Math.random() * (max - min);
    const shuffle = (items) => {
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
    };

    /* Header: solid background once the page is scrolled
       ---------------------------------------------------------------------- */
    const header = document.querySelector('.site-header');
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    /* Mobile menu
       ---------------------------------------------------------------------- */
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.getElementById('nav-menu');
    const setMenu = (open) => {
        toggle.setAttribute('aria-expanded', String(open));
        header.classList.toggle('menu-open', open);
    };
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (event) => {
        if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setMenu(false);
    });
    window.matchMedia('(min-width: 921px)').addEventListener('change', () => setMenu(false));

    /* Drifting clouds
       Three depth layers: far clouds are small, faint and slow; near clouds
       are big and faster. Negative delays spread them across the sky on load.
       ---------------------------------------------------------------------- */
    const LAYERS = [
        { name: 'far',  count: 5, width: [90, 140],  duration: [160, 220], opacity: [0.45, 0.6] },
        { name: 'mid',  count: 4, width: [170, 240], duration: [110, 150], opacity: [0.7, 0.85] },
        { name: 'near', count: 3, width: [260, 360], duration: [75, 100],  opacity: [0.9, 1] },
    ];
    const SHAPES = ['cloud-a', 'cloud-b', 'cloud-c'];

    const populateSky = (sky) => {
        const scale = Math.min(1, Math.max(0.55, window.innerWidth / 1280));
        // Vertical band the clouds may occupy, in % of the sky height (data-band="min,max").
        const [bandMin, bandMax] = (sky.dataset.band || '-4,78').split(',').map(Number);
        const fragment = document.createDocumentFragment();

        LAYERS.forEach((layer) => {
            const bands = shuffle([...Array(layer.count).keys()]);
            for (let i = 0; i < layer.count; i++) {
                const duration = rand(...layer.duration);
                const cloud = document.createElement('div');
                cloud.className = `cloud cloud--${layer.name}`;
                cloud.style.setProperty('--w', `${Math.round(rand(...layer.width) * scale)}px`);
                cloud.style.setProperty('--top', `${bandMin + ((bands[i] + rand(0.1, 0.9)) / layer.count) * (bandMax - bandMin)}%`);
                cloud.style.setProperty('--o', rand(...layer.opacity).toFixed(2));
                cloud.style.setProperty('--dur', `${duration.toFixed(1)}s`);
                cloud.style.setProperty('--delay', `${(-((i + Math.random()) / layer.count) * duration).toFixed(1)}s`);
                cloud.style.setProperty('--bob', `${rand(7, 12).toFixed(1)}s`);
                const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
                cloud.innerHTML = `<svg viewBox="0 0 200 100" focusable="false"><use href="#${shape}"/></svg>`;
                fragment.appendChild(cloud);
            }
        });
        sky.appendChild(fragment);
    };

    const skies = document.querySelectorAll('.sky');
    skies.forEach(populateSky);

    // Pause skies that are off screen.
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => entry.target.classList.toggle('is-paused', !entry.isIntersecting));
        });
        skies.forEach((sky) => observer.observe(sky));
    }

    /* Translations
       French lives in the HTML; other languages come from lang/<code>.json.
       Elements opt in with data-i18n="key" (inner HTML) and/or
       data-i18n-attr="attribute:key;other-attribute:key".
       ---------------------------------------------------------------------- */
    const LANGS = ['fr', 'en'];
    const DEFAULT_LANG = 'fr';
    const dictionaries = {};
    let originals = null;

    const translatable = () => document.querySelectorAll('[data-i18n], [data-i18n-attr]');
    const attrPairs = (el) => (el.dataset.i18nAttr || '')
        .split(';')
        .filter(Boolean)
        .map((pair) => pair.split(':').map((part) => part.trim()));

    const snapshot = () => {
        originals = new Map();
        translatable().forEach((el) => {
            const attrs = {};
            attrPairs(el).forEach(([attr]) => { attrs[attr] = el.getAttribute(attr); });
            originals.set(el, { html: el.innerHTML, attrs });
        });
    };

    const loadDictionary = async (lang) => {
        if (!dictionaries[lang]) {
            const response = await fetch(`lang/${lang}.json`);
            if (!response.ok) throw new Error(`Cannot load lang/${lang}.json`);
            dictionaries[lang] = await response.json();
        }
        return dictionaries[lang];
    };

    const setLanguage = async (lang) => {
        if (!LANGS.includes(lang)) lang = DEFAULT_LANG;
        if (!originals) snapshot();

        let dict = null;
        if (lang !== DEFAULT_LANG) {
            try {
                dict = await loadDictionary(lang);
            } catch (error) {
                console.error(error);
                return;
            }
        }

        originals.forEach((original, el) => {
            if (el.dataset.i18n) {
                el.innerHTML = dict?.[el.dataset.i18n] ?? original.html;
            }
            attrPairs(el).forEach(([attr, key]) => {
                el.setAttribute(attr, dict?.[key] ?? original.attrs[attr]);
            });
        });

        document.documentElement.lang = lang;
        document.querySelectorAll('[data-lang]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
        });
        try { localStorage.setItem('lang', lang); } catch { /* storage unavailable */ }
    };

    const initialLanguage = () => {
        const fromUrl = new URLSearchParams(window.location.search).get('lang');
        if (LANGS.includes(fromUrl)) {
            try { localStorage.setItem('lang', fromUrl); } catch { /* storage unavailable */ }
            return fromUrl;
        }
        try {
            const saved = localStorage.getItem('lang');
            if (LANGS.includes(saved)) return saved;
        } catch { /* storage unavailable */ }
        const browser = (navigator.languages || [navigator.language || ''])[0].toLowerCase();
        return browser.startsWith('fr') ? 'fr' : 'en';
    };

    document.querySelectorAll('[data-lang]').forEach((button) => {
        button.addEventListener('click', () => setLanguage(button.dataset.lang));
    });

    const startLang = initialLanguage();
    if (startLang !== DEFAULT_LANG) setLanguage(startLang);

    /* Contact form: opens the visitor's mail client with a pre-filled message
       ---------------------------------------------------------------------- */
    const form = document.getElementById('contact-form');
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const name = data.get('name').trim();
        const company = data.get('company').trim();
        const subject = `Contact — ${name}${company ? ` (${company})` : ''}`;
        const body = [
            data.get('message').trim(),
            '',
            '—',
            name,
            company,
            data.get('email').trim(),
        ].filter((line, index) => index < 3 || line).join('\n');

        window.location.href = `mailto:contact@pewty.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });

    /* Copy buttons next to the demo credentials
       ---------------------------------------------------------------------- */
    document.querySelectorAll('.copy-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const value = button.previousElementSibling;
            try {
                await navigator.clipboard.writeText(value.textContent);
            } catch {
                // Clipboard API unavailable: select the text so it can be copied by hand.
                const range = document.createRange();
                range.selectNodeContents(value);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
                return;
            }
            button.classList.add('is-copied');
            setTimeout(() => button.classList.remove('is-copied'), 1500);
        });
    });

    /* Footer year
       ---------------------------------------------------------------------- */
    document.getElementById('year').textContent = new Date().getFullYear();
})();
