(function () {
    'use strict';

    window.DoxxusPrices = {
        packages: {
            launch: { amount: 900, display: '$900' },
            growth: { amount: 1800, display: '$1,800' },
            product: { amount: 3500, display: '$3,500+' }
        },
        addons: {
            scheduling: { amount: 175, display: '$175', plusDisplay: '+$175', fromDisplay: 'from $175' },
            leads: { amount: 150, display: '$150', plusDisplay: '+$150' },
            ai: { amount: 300, display: '$300+', plusDisplay: '+$300' },
            auth: { amount: 500, display: '$500+', plusDisplay: '+$500' },
            commerce: { amount: 600, display: '$600+', plusDisplay: '+$600' },
            database: { amount: 600, display: '$600+', plusDisplay: '+$600' },
            domain: { amount: 75, display: '$75 + domain', plusDisplay: '+$75' },
            maintenance: { amount: 75, display: '$75/mo', plusDisplay: '+$75/mo' }
        },
        it: {
            diagnostic: { amount: 100, appliedDisplay: '$100 · applied to repair' },
            consultation: { amount: 150, display: '$150' }
        },
        ranges: {
            packageTiers: '$900 \u2013 $3,500+',
            addonsFrom: 'from $75'
        }
    };
}());
