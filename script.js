(function(){
  "use strict";

  // ===================== КОНФІГУРАЦІЯ =====================
  // Telegram: URL вашого Cloudflare Worker (проксі), який ховає токен бота.
  // Інструкція з налаштування — розділ 3 у SETUP.md.
  var TELEGRAM_PROXY_URL = "https://guardian-site.kostyastrochan.workers.dev";

  // Google Sheets (необов'язково): URL Apps Script Web App, що закінчується на /exec.
  // Якщо залишити плейсхолдер — архів у таблицю просто не викликається,
  // сайт продовжує працювати лише через Telegram. Інструкція — SETUP.md.
  var GOOGLE_SHEETS_URL = "ВАШ_APPS_SCRIPT_URL_ТУТ";

  var FALLBACK_PHONE = "+380 93 728 60 75"; // показується, якщо надсилання не вдалось
  // ==========================================================

  var form = document.getElementById('lead-form');
  var fieldsWrap = document.getElementById('form-fields');
  var successPanel = document.getElementById('success-panel');
  var successCheck = successPanel ? successPanel.querySelector('.check-draw-success') : null;
  var msgBox = document.getElementById('form-msg');
  var submitBtn = document.getElementById('submit-btn');

  function showMsg(text, type){
    msgBox.textContent = text;
    msgBox.className = 'form-msg show ' + type;
  }

  function isPlaceholder(v){
    return !v || v.indexOf('ВАШ_') === 0;
  }

  if(isPlaceholder(TELEGRAM_PROXY_URL)){
    console.warn('Сайт страхового агента: вкажіть TELEGRAM_PROXY_URL у script.js перед публікацією (див. SETUP.md).');
  }

  // ---------- Архів заявок у Google Таблиці (необов'язково, паралельно з Telegram) ----------
  function logToSheet(data){
    if(isPlaceholder(GOOGLE_SHEETS_URL)) return;
    fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors', // Apps Script не повертає CORS-заголовки; відповідь прочитати не можна, але дані доходять
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    }).catch(function(err){
      console.warn('Не вдалося записати заявку в Google Таблицю (Telegram все одно надіслано):', err);
    });
  }

  // ---------- Форма ----------
  if(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();

      // Пастка для ботів — якщо приховане поле заповнене, тихо ігноруємо
      if(document.getElementById('f-company').value){
        return;
      }

      var name = document.getElementById('f-name').value.trim();
      var phone = document.getElementById('f-phone').value.trim();
      var type = document.getElementById('f-type').value;
      var comment = document.getElementById('f-comment').value.trim();
      var consent = document.getElementById('f-consent').checked;

      if(!name || !phone || !type){
        showMsg('Заповніть, будь ласка, обовʼязкові поля.', 'err');
        return;
      }
      var phoneDigits = phone.replace(/[\s\-()]/g, '');
      if(!/^(\+?380|0)\d{9}$/.test(phoneDigits)){
        showMsg('Перевірте номер телефону — формат +380XXXXXXXXX.', 'err');
        return;
      }
      if(!consent){
        showMsg('Потрібна згода на обробку персональних даних.', 'err');
        return;
      }

      if(isPlaceholder(TELEGRAM_PROXY_URL)){
        showMsg('Форму ще не підключено до Telegram. Зателефонуйте: ' + FALLBACK_PHONE, 'err');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Надсилаємо…';

      fetch(TELEGRAM_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, phone: phone, type: type, comment: comment })
      })
      .then(function(res){ return res.json().catch(function(){ return { ok:false }; }); })
      .then(function(result){
        if(!result || !result.ok) throw new Error('Proxy error');

        // Архів у Google Таблиці — паралельно, не блокує успішний стан форми
        logToSheet({ name: name, phone: phone, type: type, comment: comment });

        fieldsWrap.style.display = 'none';
        successPanel.classList.add('show');
        if(successCheck){ successCheck.classList.add('animate'); }
      })
      .catch(function(){
        showMsg('Не вдалося надіслати заявку автоматично. Зателефонуйте, будь ласка: ' + FALLBACK_PHONE, 'err');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Надіслати заявку';
      });
    });
  }

  // ---------- Ефекти ----------
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Індикатор прогресу скролу
  var progressBar = document.getElementById('scroll-progress');
  if(progressBar){
    var updateProgress = function(){
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = pct + '%';
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive:true });
    window.addEventListener('resize', updateProgress);
  }

  // Мобільне меню: гамбургер <-> хрестик, панель з посиланнями
  var menuBtn = document.getElementById('menu-btn');
  var mobileNav = document.getElementById('mobile-nav');
  if(menuBtn && mobileNav){
    var closeMenu = function(){
      mobileNav.classList.remove('open');
      menuBtn.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    };
    menuBtn.addEventListener('click', function(){
      var isOpen = mobileNav.classList.toggle('open');
      menuBtn.classList.toggle('open', isOpen);
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    mobileNav.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click', closeMenu);
    });
    window.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ closeMenu(); }
    });
  }

  // Тінь і компактніший хедер під час скролу
  var headerEl = document.querySelector('header');
  if(headerEl){
    var onScrollHeader = function(){
      headerEl.classList.toggle('scrolled', window.scrollY > 10);
    };
    onScrollHeader();
    window.addEventListener('scroll', onScrollHeader, { passive:true });
  }

  // Плавна поява елементів при скролі (одноразово, без анімації при reduce-motion)
  if(!reduceMotion && 'IntersectionObserver' in window){
    var revealTargets = document.querySelectorAll('.reveal');
    var revealObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealTargets.forEach(function(el){ revealObserver.observe(el); });

    // Лінія-таймлайн у секції "Як це працює" — з'являється, коли секція у полі зору
    var stepsEl = document.querySelector('.steps');
    if(stepsEl){
      var stepsObserver = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            entry.target.classList.add('in-view');
            stepsObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });
      stepsObserver.observe(stepsEl);
    }
  } else {
    document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in-view'); });
    var stepsElFallback = document.querySelector('.steps');
    if(stepsElFallback){ stepsElFallback.classList.add('in-view'); }
  }

  // М'яка "пляма світла", що плавно тягнеться за курсором у hero-секції
  if(!reduceMotion){
    var heroEl = document.querySelector('.hero');
    if(heroEl){
      var targetX = 72, targetY = 30, curX = 72, curY = 30;
      var raf = null;
      function animateGlow(){
        curX += (targetX - curX) * 0.08;
        curY += (targetY - curY) * 0.08;
        heroEl.style.setProperty('--mx', curX + '%');
        heroEl.style.setProperty('--my', curY + '%');
        if(Math.abs(targetX - curX) > 0.1 || Math.abs(targetY - curY) > 0.1){
          raf = requestAnimationFrame(animateGlow);
        } else {
          raf = null;
        }
      }
      heroEl.addEventListener('mousemove', function(e){
        var rect = heroEl.getBoundingClientRect();
        targetX = ((e.clientX - rect.left) / rect.width) * 100;
        targetY = ((e.clientY - rect.top) / rect.height) * 100;
        if(!raf){ raf = requestAnimationFrame(animateGlow); }
      });
    }
  }

  // FAQ-акордеон (одне питання відкрите за раз)
  document.querySelectorAll('.faq-item').forEach(function(item){
    var btn = item.querySelector('.faq-q');
    if(!btn) return;
    btn.addEventListener('click', function(){
      var willOpen = !item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function(openItem){
        openItem.classList.remove('open');
        var openBtn = openItem.querySelector('.faq-q');
        if(openBtn){ openBtn.setAttribute('aria-expanded', 'false'); }
      });
      if(willOpen){
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Підсвічування активного пункту меню під час скролу
  var navLinkEls = document.querySelectorAll('.nav-links a[href^="#"]');
  var trackedSections = [];
  navLinkEls.forEach(function(link){
    var id = link.getAttribute('href').slice(1);
    var section = document.getElementById(id);
    if(section){ trackedSections.push({ link: link, section: section }); }
  });
  if(trackedSections.length && 'IntersectionObserver' in window){
    var navObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        var match = trackedSections.find(function(t){ return t.section === entry.target; });
        if(!match) return;
        if(entry.isIntersecting){
          navLinkEls.forEach(function(l){ l.classList.remove('active'); });
          match.link.classList.add('active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    trackedSections.forEach(function(t){ navObserver.observe(t.section); });
  }

  // Кнопка "нагору"
  var backToTop = document.getElementById('back-to-top');
  if(backToTop){
    var toggleBackToTop = function(){
      backToTop.classList.toggle('show', window.scrollY > 600);
    };
    toggleBackToTop();
    window.addEventListener('scroll', toggleBackToTop, { passive:true });
    backToTop.addEventListener('click', function(){
      window.scrollTo({ top:0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }
})();
