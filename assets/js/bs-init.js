
if (window.innerWidth < 768) {
	[].slice.call(document.querySelectorAll('[data-bss-disabled-mobile]')).forEach(function (elem) {
		elem.classList.remove('animated');
		elem.removeAttribute('data-bss-hover-animate');
		elem.removeAttribute('data-aos');
		elem.removeAttribute('data-bss-parallax-bg');
		elem.removeAttribute('data-bss-scroll-zoom');
	});
}

document.addEventListener('DOMContentLoaded', function() {
	if ('AOS' in window) {
		// Defaults trigger 120px late and replay on every pass, which made tall
		// blocks like the portfolio carousel appear hundreds of pixels too late.
		AOS.init({
			once: true,
			offset: 40,
			duration: 600,
			easing: 'ease-out-cubic',
			anchorPlacement: 'top-bottom'
		});

		// Lazy images and web fonts shift layout after init, leaving AOS with
		// stale trigger positions. Recalculate once everything has settled.
		var refresh = function () { AOS.refresh(); };
		window.addEventListener('load', refresh);
		window.addEventListener('resize', refresh);
		document.querySelectorAll('img').forEach(function (img) {
			if (!img.complete) img.addEventListener('load', refresh, { once: true });
		});
	}

	var hoverAnimationTriggerList = [].slice.call(document.querySelectorAll('[data-bss-hover-animate]'));
	var hoverAnimationList = hoverAnimationTriggerList.forEach(function (hoverAnimationEl) {
		hoverAnimationEl.addEventListener('mouseenter', function(e){ e.target.classList.add('animated', e.target.dataset.bssHoverAnimate) });
		hoverAnimationEl.addEventListener('mouseleave', function(e){ e.target.classList.remove('animated', e.target.dataset.bssHoverAnimate) });
	});

	var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bss-tooltip]'));
	var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
	  return new bootstrap.Tooltip(tooltipTriggerEl);
	})
}, false);