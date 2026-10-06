/**
 * portfolio-data.js — the single source of truth for every portfolio carousel.
 * Edit a card here and each [data-portfolio-carousel] mount updates with it.
 *
 * Every card is a phone: `screens` lists the screenshots shown in the bezel.
 * `standIn: true` marks a desktop image used until a real mobile screenshot exists.
 * `title` and `description` are required; an entry without both is skipped.
 */
window.DOXXUS_PORTFOLIO = [
    {
        id: 'acnh-live-editor',
        title: 'ACNH Live Editor',
        description: 'Island save editor',
        url: 'https://m-ccool.github.io/acnh-live-editor/',
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
        url: 'https://m-ccool.github.io/fitndex/',
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
        url: 'https://m-ccool.github.io/a-new-leaf/',
        screens: [
            { src: 'assets/img/mockups/anewleaf-1.png', alt: 'A New Leaf — garden home screen' }
        ]
    },
    {
        id: 'rabit-habit',
        title: 'Rabit Habit',
        description: 'Habit tracking app',
        url: 'https://m-ccool.github.io/Rabit-Habit-v2/',
        standIn: true,
        screens: [
            { src: 'assets/img/ex-rabithabit.png', alt: 'Rabit Habit — habit tracker' }
        ]
    },
    {
        id: 'pokemon-cards',
        title: 'Pokemon Cards',
        description: 'Holo card carousel',
        url: null,
        standIn: true,
        screens: [
            { src: 'assets/img/ex-pkmncards.png', alt: 'Pokemon Cards — holo card carousel' }
        ]
    },
    {
        id: 'forecast',
        title: 'Forecast',
        description: 'Weather dashboard',
        url: 'https://m-ccool.github.io/weather-dashboard/',
        screens: [
            { src: 'assets/img/mockups/weather-dashboard-mobile-home.png', alt: 'Weather Dashboard mobile search screen' },
            { src: 'assets/img/mockups/weather-dashboard-mobile-detroit.png', alt: 'Weather Dashboard mobile Detroit forecast' }
        ]
    },
    {
        id: 'pink-omega',
        title: 'Pink Omega',
        description: 'Musician fan site',
        url: null,
        standIn: true,
        screens: [
            { src: 'assets/img/ex-pinkguy.png', alt: 'Pink Omega — musician fan site' }
        ]
    }
];
