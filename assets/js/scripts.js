/* smooth scroll -start */

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault(); // Prevent default instant jump

        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            setTimeout(() => {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }, 500); // 500ms delay
        }
    });
});

/* smooth scroll -end */

/* iphone-bezel hover-cycle -start */

document.querySelectorAll('.iphone-bezel').forEach(bezel => {
    const frames = bezel.querySelectorAll('.iphone-bezel-screen');
    if (frames.length < 2) return; // nothing to cycle

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = 0;
    let timer = null;

    function show(i) {
        frames.forEach((frame, fi) => frame.classList.toggle('is-active', fi === i));
    }

    function start() {
        if (reduceMotion || timer) return;
        timer = setInterval(() => {
            index = (index + 1) % frames.length;
            show(index);
        }, 1600);
    }

    function stop() {
        clearInterval(timer);
        timer = null;
        index = 0;
        show(0);
    }

    bezel.addEventListener('mouseenter', start);
    bezel.addEventListener('mouseleave', stop);
    bezel.addEventListener('focusin', start);
    bezel.addEventListener('focusout', stop);
});

/* iphone-bezel hover-cycle -end */

/* create blurred background layer behind phone preview */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.work-carousel .noraidus .item-img').forEach(itemImg => {
        const bgUrl = itemImg.getAttribute('data-background');
        if (bgUrl) {
            // Create a div for the blurred background
            const blurLayer = document.createElement('div');
            blurLayer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url('${bgUrl}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                filter: blur(4px);
                z-index: 1;
                pointer-events: none;
            `;
            
            // Insert at the start of item-img so it's behind everything
            itemImg.insertAdjacentElement('afterbegin', blurLayer);
        }
    });
});

document.addEventListener('pointerup', function (event) {
    if (event.pointerType !== 'touch') return;

    const skillCard = event.target.closest('.skill-card');
    if (!skillCard) return;

    skillCard.classList.remove('skill-card-touch-active');
    skillCard.offsetWidth;
    skillCard.classList.add('skill-card-touch-active');
});

document.addEventListener('animationend', function (event) {
    if (event.animationName === 'skill-card-touch') {
        event.target.classList.remove('skill-card-touch-active');
    }
});

/* ===============================  GitHub contributions  =============================== */

(function () {
    var username = 'm-ccool';

    function formatDate(date) {
        return date.toISOString().slice(0, 10);
    }

    function renderCalendar(calendar, contributions) {
        var contributionMap = new Map(contributions.map(function (entry) {
            return [entry.date, entry];
        }));
        var today = new Date();
        var start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 364));
        start.setUTCDate(start.getUTCDate() - start.getUTCDay());

        var graph = document.createElement('div');
        graph.className = 'contribution-graph';
        graph.setAttribute('role', 'img');
        graph.setAttribute('aria-label', 'GitHub contributions over the last 12 months');

        for (var dayIndex = 0; dayIndex < 371; dayIndex += 1) {
            var date = new Date(start);
            date.setUTCDate(start.getUTCDate() + dayIndex);
            var dateKey = formatDate(date);
            var entry = contributionMap.get(dateKey) || { count: 0, level: 0 };
            var day = document.createElement('span');
            day.className = 'contribution-day';
            day.dataset.date = dateKey;
            day.dataset.count = String(entry.count);
            day.dataset.level = String(entry.level);
            day.title = entry.count + ' contribution' + (entry.count === 1 ? '' : 's') + ' on ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
            graph.appendChild(day);
        }

        calendar.replaceChildren(graph);
    }

    window.renderContributionCalendars = function () {
        var calendars = Array.prototype.slice.call(document.querySelectorAll('.calendar'));
        if (!calendars.length) return;

        fetch('https://github-contributions-api.jogruber.de/v4/' + username)
            .then(function (response) {
                if (!response.ok) throw new Error('contributions unavailable');
                return response.json();
            })
            .then(function (data) {
                calendars.forEach(function (calendar) {
                    renderCalendar(calendar, Array.isArray(data.contributions) ? data.contributions : []);
                });
            })
            .catch(function () {
                calendars.forEach(function (calendar) {
                    calendar.textContent = 'Contributions are temporarily unavailable.';
                });
            });
    };

    window.renderContributionCalendars();
})();

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-contact-select]').forEach(function (select) {
        const trigger = select.querySelector('.contact-select-trigger');
        const options = select.querySelector('.contact-select-options');
        const input = select.querySelector('input[name="type"]');

        const close = function () {
            options.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        };

        trigger.addEventListener('click', function (event) {
            event.stopPropagation();
            const isOpen = !options.hidden;
            document.querySelectorAll('.contact-select-options').forEach(function (menu) {
                menu.hidden = true;
            });
            options.hidden = isOpen;
            trigger.setAttribute('aria-expanded', String(!isOpen));
        });

        options.addEventListener('click', function (event) {
            const option = event.target.closest('[role="option"]');
            if (!option) return;

            input.value = option.dataset.value;
            trigger.querySelector('span').textContent = option.textContent;
            options.querySelectorAll('[role="option"]').forEach(function (item) {
                item.setAttribute('aria-selected', String(item === option));
            });
            close();
        });

        trigger.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                options.hidden = false;
                trigger.setAttribute('aria-expanded', 'true');
                options.querySelector('[aria-selected="true"]').focus();
            }
        });

        options.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                close();
                trigger.focus();
            }
        });

        document.addEventListener('click', function (event) {
            if (!select.contains(event.target)) close();
        });
    });
});

$(function () {

    "use strict";


    /* ===============================  Navbar Menu  =============================== */

    var wind = $(window);


    /* ======= Navbar scroll state ======= */
    wind.on("scroll", function () {
        if (wind.scrollTop() > 300) {
            $(".navbar").addClass("nav-scroll");
        } else {
            $(".navbar").removeClass("nav-scroll");
        }
    });

    /* ======= Restart last-online animation on each navbar open ======= */
    document.getElementById('navcol-2')?.addEventListener('show.bs.collapse', function () {
        var el = document.getElementById('last-online-mobile');
        if (!el) return;
        el.style.animation = 'none';
        el.offsetHeight; // force reflow
        el.style.animation = '';
    });

    /* ===============================  Swiper slider  =============================== */


    var swiperWorkMetro = new Swiper('.metro .swiper-container', {
        slidesPerView: 2,
        spaceBetween: 0,
        speed: 2000,
        loop: true,
        centeredSlides: true,
        autoplay: {
            delay: 7000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true
        },

        breakpoints: {
            320: {
                slidesPerView: 1,
                spaceBetween: 0
            },
            640: {
                slidesPerView: 1,
                spaceBetween: 0
            },
            767: {
                slidesPerView: 1,
                spaceBetween: 0,
                centeredSlides: false,
            },
            991: {
                slidesPerView: 2,
            }
        },

        pagination: {
            el: '.metro .swiper-pagination',
            type: 'progressbar',
        },

        navigation: {
            nextEl: '.metro .swiper-button-next',
            prevEl: '.metro .swiper-button-prev'
        },
    });

    var swiperWorkCaroul = new Swiper('.caroul .swiper-container', {
        spaceBetween: 0,
        speed: 1000,
        loop: true,

        breakpoints: {
            320: {
                slidesPerView: 1,
                spaceBetween: 0
            },
            767: {
                slidesPerView: 2,
                spaceBetween: 0
            },
            991: {
                slidesPerView: 3,
                spaceBetween: 0
            },
            1024: {
                slidesPerView: 4,
                spaceBetween: 0
            }
        },

        pagination: {
            el: '.caroul .swiper-pagination',
            type: 'progressbar',
        },

        navigation: {
            nextEl: '.caroul .swiper-button-next',
            prevEl: '.caroul .swiper-button-prev'
        },
    });


    var swiperBlogImg = new Swiper('.blog-crv .swiper-img', {
        slidesPerView: 1,
        spaceBetween: 0,
        speed: 800,
        loop: true,
        effect: 'fade',

        pagination: {
            el: '.blog-crv .controls .swiper-pagination',
            type: 'fraction',
        },

        navigation: {
            nextEl: '.next-ctrl',
            prevEl: '.prev-ctrl'
        },
    });

    var swiperBlogContent = new Swiper('.blog-crv .swiper-content', {
        slidesPerView: 1,
        spaceBetween: 0,
        speed: 800,
        loop: true,

        pagination: {
            el: '.blog-crv .controls .swiper-pagination',
            type: 'fraction',
        },

        navigation: {
            nextEl: '.blog-crv .controls .next-ctrl',
            prevEl: '.blog-crv .controls .prev-ctrl'
        },
    });


    /* ===============================  Var Background image  =============================== */

    var pageSection = $(".bg-img, section");
    pageSection.each(function (indx) {

        if ($(this).attr("data-background")) {
            $(this).css("background-image", "url(" + $(this).data("background") + ")");
        }
    });


    /* ===============================  slick Carousel  =============================== */

    $('.testimonials .slic-item').slick({
        slidesToShow: 3,
        slidesToScroll: 1,
        centerMode: true,
        arrows: true,
        prevArrow: '.testimonials .prev',
        nextArrow: '.testimonials .next',
        dots: false,
        autoplay: true,
        responsive: [
            {
                breakpoint: 1024,
                settings: {
                    slidesToShow: 1,
                    centerMode: false,
                }
            },
            {
                breakpoint: 767,
                settings: {
                    slidesToShow: 1,
                    centerMode: false,
                }
            },
            {
                breakpoint: 480,
                settings: {
                    slidesToShow: 1,
                    centerMode: false,
                }
            }
        ]
    });

    $('.testim-box .slic-item').slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        arrows: false,
        dots: true,
        autoplay: true
    });


    /* ===============================  Mouse Hover  =============================== */

    $('.feat .items').on('mouseenter', function () {
        $(this).addClass("active").siblings().removeClass("active");
    });

    document.querySelectorAll('.button').forEach(button => button.innerHTML = '<div><span>' + button.textContent.trim().split('').join('</span><span>') + '</span></div>');


    /* ===============================  YouTubePopUp  =============================== */

    $("a.vid").YouTubePopUp();


    /* ===============================  parallaxie  =============================== */

    $('.parallaxie').parallaxie({
        speed: 0.2,
        size: "cover"
    });


    /* ===============================  magnificPopup  =============================== */

    $('.popup-img , .gallery').magnificPopup({
        delegate: '.popimg',
        type: 'image',
        gallery: {
            enabled: true
        }
    });


    /* ===============================  justifiedGallery  =============================== */

    $('.justified-gallery').justifiedGallery({
        rowHeight: 400,
        lastRow: 'nojustify',
        margins: 15
    });


    /* ===============================  skills-circle  =============================== */

    var c4 = $('.skills-circle .skill');
    var myVal = $(this).attr('data-value');

    $(".skills-circle .skill").each(function () {

        c4.circleProgress({
            startAngle: -Math.PI / 2 * 1,
            value: myVal,
            thickness: 2,
            size: 110,
            fill: { color: "rgb(18, 194, 233)" }
        });

    });

    wind.on('scroll', function () {
        $(".skill-progress .progres").each(function () {
            var bottom_of_object =
                $(this).offset().top + $(this).outerHeight();
            var bottom_of_window =
                $(window).scrollTop() + $(window).height();
            var myVal = $(this).attr('data-value');
            if (bottom_of_window > bottom_of_object) {
                $(this).css({
                    width: myVal
                });
            }
        });
    });


    /* ===============================  countUp  =============================== */

    $('.number-sec .count').countUp({
        delay: 10,
        time: 500
    });


    /* ===============================  tooltip  =============================== */

    $('[data-tooltip-tit]').hover(function () {
        $('<div class="div-tooltip-tit"></div>').text($(this).attr('data-tooltip-tit')).appendTo('body').fadeIn('slow');
    }, function () {
        $('.div-tooltip-tit').remove();
    }).mousemove(function (e) {
        $('.div-tooltip-tit').css({ top: e.pageY + 10, left: e.pageX + 20 })
    });
    $('[data-tooltip-sub]').hover(function () {
        $('<div class="div-tooltip-sub"></div>').text($(this).attr('data-tooltip-sub')).appendTo('body').fadeIn('slow');
    }, function () {
        $('.div-tooltip-sub').remove();
    }).mousemove(function (e) {
        $('.div-tooltip-sub').css({ top: e.pageY + (-15), left: e.pageX + 30 })
    });

});


/* ===============================  Wow Animation  =============================== */

wow = new WOW({
    animateClass: 'animated',
    offset: 100
});
wow.init();


// === window When Loading === //

$(window).on("load", function () {


    /* ===============================  SPLITTING TEXT  =============================== */

    Splitting();


    /* ===============================  thumparallax  =============================== */

    var imageUp = document.getElementsByClassName('thumparallax');
    new simpleParallax(imageUp, {
        delay: 1,
        scale: 1.1
    });

    var imageDown = document.getElementsByClassName('thumparallax-down');
    new simpleParallax(imageDown, {
        orientation: 'down',
        delay: 1,
        scale: 1.1
    });


    /* ===============================  isotope Masonery  =============================== */

    // isotope
    $('.gallery-mons').isotope({
        // options
        itemSelector: '.items',
        masonry: {
            // use element for option
            columnWidth: '.width2'
        }
    });

    $('.gallery').isotope({
        // options
        itemSelector: '.items'
    });

    var $gallery = $('.gallery , .gallery-mons').isotope();

    $('.filtering').on('click', 'span', function () {
        var filterValue = $(this).attr('data-filter');
        $gallery.isotope({ filter: filterValue });
    });

    $('.filtering').on('click', 'span', function () {
        $(this).addClass('active').siblings().removeClass('active');
    });


    /* ===============================  contact validator  =============================== */

    $('#contact-form').validator();

    $('#contact-form').on('submit', function (e) {
        if (!e.isDefaultPrevented()) {
            var url = "contact.php";

            $.ajax({
                type: "POST",
                url: url,
                data: $(this).serialize(),
                success: function (data) {
                    var messageAlert = 'alert-' + data.type;
                    var messageText = data.message;

                    var alertBox = '<div class="alert ' + messageAlert + ' alert-dismissable"><button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>' + messageText + '</div>';
                    if (messageAlert && messageText) {
                        $('#contact-form').find('.messages').html(alertBox);
                        $('#contact-form')[0].reset();
                    }
                }
            });
            return false;
        }
    });

});



/* ===============================  Hide / show navbar  =============================== */

var didScroll;
var lastScrollTop = 0;
var delta = 5;
var navbarHeight = $('#navi').outerHeight();
$(window).on("scroll", function (event) {
    didScroll = true;
});

setInterval(function () {
    if (didScroll) {
        hasScrolled();
        didScroll = false;
    }
}, 250);

function hasScrolled() {
    var st = $(this).scrollTop();

    if (Math.abs(lastScrollTop - st) <= delta)
        return;

    if (st > lastScrollTop && st > navbarHeight) {
        $('#navi').css('top', '-100px');

    } else {

        if (st + $(window).height() < $(document).height()) {
            $('#navi').css('top', '0');
        }
    }

    lastScrollTop = st;
}



/* ===============================  Preloader page  =============================== */

paceOptions = {
    ajax: true,
    document: true,
    eventLag: false
};

Pace.on('done', function () {
    $('#preloader').addClass("isdone");
    $('.loading').addClass("isdone");
});


/* ===============================  Scroll back to top  =============================== */

$(document).ready(function () {
    "use strict";

    var progressPath = document.querySelector('.progress-wrap path');
    if (!progressPath) return;
    var pathLength = progressPath.getTotalLength();
    progressPath.style.transition = progressPath.style.WebkitTransition = 'none';
    progressPath.style.strokeDasharray = pathLength + ' ' + pathLength;
    progressPath.style.strokeDashoffset = pathLength;
    progressPath.getBoundingClientRect();
    progressPath.style.transition = progressPath.style.WebkitTransition = 'stroke-dashoffset 10ms linear';
    var updateProgress = function () {
        var scroll = $(window).scrollTop();
        var height = $(document).height() - $(window).height();
        var progress = pathLength - (scroll * pathLength / height);
        progressPath.style.strokeDashoffset = progress;
    }
    updateProgress();
    $(window).scroll(updateProgress);
    var offset = 150;
    var duration = 550;
    jQuery(window).on('scroll', function () {
        if (jQuery(this).scrollTop() > offset) {
            jQuery('.progress-wrap').addClass('active-progress');
        } else {
            jQuery('.progress-wrap').removeClass('active-progress');
        }
    });
    jQuery('.progress-wrap').on('click', function (event) {
        event.preventDefault();
        jQuery('html, body').animate({ scrollTop: 0 }, duration);
        return false;
    })


});





/* ===============================  Mouse effect  =============================== */

function mousecursor() {
    if (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !window.matchMedia('(pointer: fine)').matches
    ) return;

    // Blurred canvas — soft glow trail + cursor glow
    const trailCanvas = document.createElement('canvas');
    trailCanvas.id = 'cursor-trail-canvas';
    trailCanvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9994;filter:blur(5px);';
    document.body.appendChild(trailCanvas);
    const tCtx = trailCanvas.getContext('2d');

    // Sharp canvas — crisp pixel sparkles only
    const sparkCanvas = document.createElement('canvas');
    sparkCanvas.id = 'cursor-spark-canvas';
    sparkCanvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9995;';
    document.body.appendChild(sparkCanvas);
    const sCtx = sparkCanvas.getContext('2d');

    function resizeCanvas() {
        trailCanvas.width  = sparkCanvas.width  = window.innerWidth;
        trailCanvas.height = sparkCanvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const TRAIL_LEN  = 55;
    const LIFETIME   = 500;
    const MAX_RADIUS = 7;
    const trail    = [];
    const sparkles = [];

    let mx = -200, my = -200;
    let lastSparkleX = -999, lastSparkleY = -999;
    let animationFrameId = null;

    function scheduleRender() {
        if (!animationFrameId && !document.hidden) {
            animationFrameId = requestAnimationFrame(render);
        }
    }

    window.addEventListener('mousemove', function(e) {
        mx = e.clientX;
        my = e.clientY;
        trail.push({ x: mx, y: my, t: Date.now() });
        if (trail.length > TRAIL_LEN) trail.shift();

        const dx = mx - lastSparkleX, dy = my - lastSparkleY;
        if (dx * dx + dy * dy > 120) {
            lastSparkleX = mx; lastSparkleY = my;
            if (sparkles.length < 90) {
                sparkles.push({
                    x:     mx + (Math.random() - 0.5) * 14,
                    y:     my + (Math.random() - 0.5) * 14,
                    alpha: Math.random() * 0.85 + 0.4,
                    vy:    Math.random() * 1.4 + 0.5,
                    vx:    (Math.random() - 0.5) * 0.8,
                    decay: Math.random() * 0.016 + 0.010
                });
            }
        }
        scheduleRender();
    });

    function render() {
        animationFrameId = null;
        const now = Date.now();
        while (trail.length > 0 && now - trail[0].t > LIFETIME) trail.shift();

        // ── Trail + cursor glow on blurred canvas ──
        tCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
        const n = trail.length;
        for (let i = 0; i < n; i++) {
            const p        = trail[i];
            const posRatio = i / Math.max(n - 1, 1);
            const timeFade = Math.max(0, 1 - (now - p.t) / LIFETIME);
            const ratio    = posRatio * timeFade;
            const r        = ratio * MAX_RADIUS;
            if (r < 0.15) continue;

            const grad = tCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
            grad.addColorStop(0, 'rgba(255,255,255,' + (ratio * 0.19).toFixed(3) + ')');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            tCtx.beginPath();
            tCtx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
            tCtx.fillStyle = grad;
            tCtx.fill();
        }
        // cursor glow at live position
        if (mx > -100) {
            const cg = tCtx.createRadialGradient(mx, my, 0, mx, my, 14);
            cg.addColorStop(0, 'rgba(255,255,255,0.225)');
            cg.addColorStop(1, 'rgba(255,255,255,0)');
            tCtx.beginPath();
            tCtx.arc(mx, my, 14, 0, Math.PI * 2);
            tCtx.fillStyle = cg;
            tCtx.fill();
        }

        // ── Sparkles: 1px pixel squares on sharp canvas ──
        sCtx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
        for (let i = sparkles.length - 1; i >= 0; i--) {
            const sp = sparkles[i];
            sp.x    += sp.vx;
            sp.y    += sp.vy;
            sp.alpha -= sp.decay;
            if (sp.alpha <= 0) { sparkles.splice(i, 1); continue; }
            sCtx.fillStyle = 'rgba(255,255,255,' + sp.alpha.toFixed(3) + ')';
            sCtx.fillRect(Math.round(sp.x), Math.round(sp.y), 1, 1);
        }

        if (trail.length || sparkles.length) scheduleRender();
    }

    document.addEventListener('visibilitychange', function() {
        if (document.hidden && animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        } else if (!document.hidden && (trail.length || sparkles.length)) {
            scheduleRender();
        }
    });

    document.addEventListener('mousedown', function(ev) {
        const burst = document.createElement('div');
        burst.className = 'cursor-burst-el';
        burst.style.left = (ev.clientX - 40) + 'px';
        burst.style.top  = (ev.clientY - 40) + 'px';
        document.body.appendChild(burst);
        burst.addEventListener('animationend', () => burst.remove());
    });
};

$(function () {
    mousecursor();
});

/* ===============================  Last Online Status  =============================== */
(function () {
    function setLastOnline(dateValue) {
        var d = new Date(dateValue);
        if (Number.isNaN(d.getTime())) return;
        var text = 'last online ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        document.querySelectorAll('.last-online').forEach(function(el) { el.textContent = text; });
    }

    function getLastContributionDate() {
        var cells = Array.prototype.slice.call(document.querySelectorAll('.contribution-day[data-date]'));
        var latest = null;

        cells.forEach(function(cell) {
            var count = parseInt(cell.getAttribute('data-count') || '0', 10);
            var level = parseInt(cell.getAttribute('data-level') || '0', 10);
            if (count <= 0 && level <= 0) return;

            var dateText = cell.getAttribute('data-date');
            if (!dateText) return;

            var dt = new Date(dateText + 'T00:00:00Z');
            if (Number.isNaN(dt.getTime())) return;
            if (!latest || dt > latest) latest = dt;
        });

        return latest;
    }

    function tryCalendarFallback(attemptsLeft) {
        var contributionDate = getLastContributionDate();
        if (contributionDate) {
            setLastOnline(contributionDate);
            return;
        }

        if (attemptsLeft <= 0) return;
        setTimeout(function() {
            tryCalendarFallback(attemptsLeft - 1);
        }, 700);
    }

    fetch('https://api.github.com/users/m-ccool/events?per_page=1')
        .then(function(r) {
            if (!r.ok) throw new Error('events api unavailable');
            return r.json();
        })
        .then(function(data) {
            if (Array.isArray(data) && data[0] && data[0].created_at) {
                setLastOnline(data[0].created_at);
                return;
            }
            tryCalendarFallback(14);
        })
        .catch(function() {
            tryCalendarFallback(14);
        });
})();

/* ===============================  fixed-slider  =============================== */

$(function () {

    "use strict";

    var slidHeight = $(".fixed-slider").outerHeight();

    $(".main-content").css({
        marginTop: slidHeight
    });

});

$(window).scroll(function () {

    /* ===============================  fade slideshow  =============================== */

    var scrolled = $(this).scrollTop();
    $('.fixed-slider .caption , .fixed-slider .capt .parlx').css({
        'transform': 'translate3d(0, ' + -(scrolled * 0.20) + 'px, 0)',
        'opacity': 1 - scrolled / 600
    });

});



/* ===============================  Swiper showcases with data  =============================== */


$('[data-carousel="swiper"]').each(function () {

    var containe = $(this).find('[data-swiper="container"]').attr('id');
    var pagination = $(this).find('[data-swiper="pagination"]').attr('id');
    var prev = $(this).find('[data-swiper="prev"]').attr('id');
    var next = $(this).find('[data-swiper="next"]').attr('id');
    var items = $(this).data('items');
    var autoplay = $(this).data('autoplay');
    var iSlide = $(this).data('initial');
    var loop = $(this).data('loop');
    var parallax = $(this).data('parallax');
    var space = $(this).data('space');
    var speed = $(this).data('speed');
    var center = $(this).data('center');
    var effect = $(this).data('effect');
    var direction = $(this).data('direction');
    var mousewheel = $(this).data('mousewheel');

    // Configuration
    var conf = {

    };

    // Responsive
    if ($(this).hasClass('showcase-grid')) {
        var conf = {

            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev'
            },

            breakpoints: {
                0: {
                    slidesPerView: 1,
                },
                640: {
                    slidesPerView: 2,
                },
                768: {
                    slidesPerView: 2,
                },
                1024: {
                    slidesPerView: 4,
                },
            }
        };
    };

    if ($(this).hasClass('showcase-carus')) {
        var conf = {

            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev'
            },

            breakpoints: {
                0: {
                    slidesPerView: 1,
                    spaceBetween: 0,
                },
                640: {
                    slidesPerView: 1,
                    spaceBetween: 0,
                },
                768: {
                    slidesPerView: 2,
                    spaceBetween: 30,
                },
                1024: {
                    slidesPerView: 2,
                    spaceBetween: 200,
                },
            }
        };
    };

    if ($(this).hasClass('showstyle')) {
        var conf = {

            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev'
            }
        };
    };

    if ($(this).hasClass('case-study')) {
        var conf = {

            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev'
            }
        };
    };

    if (items) {
        conf.slidesPerView = items
    };
    if (autoplay) {
        conf.autoplay = autoplay
    };
    if (iSlide) {
        conf.initialSlide = iSlide
    };
    if (center) {
        conf.centeredSlides = center
    };
    if (loop) {
        conf.loop = loop
    };
    if (parallax) {
        conf.parallax = parallax
    };
    if (space) {
        conf.spaceBetween = space
    };
    if (speed) {
        conf.speed = speed
    };
    if (mousewheel) {
        conf.mousewheel = mousewheel
    };
    if (effect) {
        conf.effect = effect
    };
    if (direction) {
        conf.direction = direction
    };
    if (prev) {
        conf.prevButton = '#' + prev
    };
    if (next) {
        conf.nextButton = '#' + next
    };
    if (pagination) {
        conf.pagination = '#' + pagination,
            conf.paginationClickable = true
    };

    // Initialization
    if (containe) {
        var initID = '#' + containe;
        var init = new Swiper(initID, conf);
    };
});
