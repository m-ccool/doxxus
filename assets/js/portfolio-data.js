/**
 * portfolio-data.js — the single source of truth for every portfolio carousel.
 * Edit a card here and each [data-portfolio-carousel] mount updates with it.
 *
 * type:
 *   'mobile' — phone bezel over a backdrop; needs `screens`
 *   'demo'   — Mac-style window holding `code`; never a link
 *   'image'  — backdrop image only (used until phone screenshots exist)
 * `title` and `description` are required; an entry without both is skipped.
 */
window.DOXXUS_PORTFOLIO = [
    {
        id: 'acnh-live-editor',
        title: 'ACNH Live Editor',
        description: 'Island save editor',
        type: 'mobile',
        url: 'https://m-ccool.github.io/acnh-live-editor/',
        backdrop: 'assets/img/mockups/acnh-1.png',
        screens: [
            { src: 'assets/img/mockups/acnh-1.png', alt: 'ACNH Live Editor — villagers panel' },
            { src: 'assets/img/mockups/acnh-2.png', alt: 'ACNH Live Editor — village inventory' },
            { src: 'assets/img/mockups/acnh-3.png', alt: 'ACNH Live Editor — map diagnostics' }
        ]
    },
    {
        id: 'fitndex',
        title: 'FITNDEX',
        description: 'Fitness rating app',
        type: 'mobile',
        url: 'https://m-ccool.github.io/fitndex/',
        backdrop: 'assets/img/mockups/fitndex-1.png',
        screens: [
            { src: 'assets/img/mockups/fitndex-1.png', alt: 'FITNDEX — home dashboard' },
            { src: 'assets/img/mockups/fitndex-2.png', alt: 'FITNDEX — 12-axis radar rating' },
            { src: 'assets/img/mockups/fitndex-3.png', alt: 'FITNDEX — transparent scoring breakdown' }
        ]
    },
    {
        id: 'a-new-leaf',
        title: 'A New Leaf',
        description: 'Plant care app',
        type: 'mobile',
        url: 'https://m-ccool.github.io/a-new-leaf/',
        backdrop: 'assets/img/mockups/anewleaf-1.png',
        screens: [
            { src: 'assets/img/mockups/anewleaf-1.png', alt: 'A New Leaf — garden home screen' }
        ]
    },
    {
        id: 'rabit-habit',
        title: 'Rabit Habit',
        description: 'Habit tracking app',
        type: 'image',
        url: 'https://m-ccool.github.io/Rabit-Habit-v2/',
        backdrop: 'assets/img/ex-rabithabit.png',
        screens: []
    },
    {
        id: 'pokemon-cards',
        title: 'Pokemon Cards',
        description: 'Holo card carousel',
        type: 'demo',
        url: null,
        backdrop: 'assets/img/ex-pkmncards.png',
        // Placeholder until the real snippet is supplied.
        code: [
            '// snippet placeholder — real code coming soon',
            'function example(input) {',
            '  const result = input.map(x => x * 2);',
            '  return result;',
            '}'
        ].join('\n')
    },
    {
        id: 'forecast',
        title: 'Forecast',
        description: 'Weather dashboard',
        type: 'mobile',
        url: 'https://m-ccool.github.io/weather-dashboard/',
        backdrop: 'assets/img/mockups/weather-dashboard-web-detroit.png',
        screens: [
            { src: 'assets/img/mockups/weather-dashboard-mobile-home.png', alt: 'Weather Dashboard mobile search screen' },
            { src: 'assets/img/mockups/weather-dashboard-mobile-detroit.png', alt: 'Weather Dashboard mobile Detroit forecast' }
        ]
    },
    {
        id: 'pink-omega',
        title: 'Pink Omega',
        description: 'Musician fan site',
        type: 'image',
        url: null,
        backdrop: 'assets/img/ex-pinkguy.png',
        screens: []
    }
];
