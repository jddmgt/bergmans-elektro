/*
 * Bergmans Elektrotechniek <-> Tilly.HR careers integration.
 *
 * Talks to the anonymous Tilly careers API (GET only, CORS-enabled) and renders the
 * published vacancies inside this site's own design. Applying happens on the hosted
 * Tilly application form, so no candidate data ever touches this website.
 *
 * Hooks (data attributes):
 *   [data-tilly-count]            -> number of open positions
 *   [data-tilly-list]             -> vacancy cards; data-limit="3", data-filters="true",
 *                                    data-detail-base="vacature.html"
 *   [data-tilly-detail]           -> the vacancy named by ?v=<slug>
 *   [data-tilly-hosted-link]      -> href of the hosted Tilly careers page
 */
(function () {
  'use strict';

  // ---- configuration ---------------------------------------------------------------
  function resolveConfig() {
    var base = window.TILLY_CONFIG || {};
    var cfg = { origin: base.origin, slug: base.slug };
    var params = new URLSearchParams(location.search);
    try {
      if (params.has('tillyReset')) {
        localStorage.removeItem('tilly.override');
      }
      if (params.has('tilly') || params.has('tillyOrigin')) {
        var override = {
          slug: params.get('tilly') || cfg.slug,
          origin: params.get('tillyOrigin') || cfg.origin,
        };
        localStorage.setItem('tilly.override', JSON.stringify(override));
      }
      var stored = localStorage.getItem('tilly.override');
      if (stored) {
        var parsed = JSON.parse(stored);
        if (parsed.slug) cfg.slug = parsed.slug;
        if (parsed.origin) cfg.origin = parsed.origin;
      }
    } catch (e) {
      /* storage unavailable: live with the static config */
    }
    cfg.origin = String(cfg.origin || '').replace(/\/+$/, '');
    return cfg;
  }

  var cfg = resolveConfig();

  function api(path) {
    return fetch(cfg.origin + '/api/public/careers/' + encodeURIComponent(cfg.slug) + path, {
      headers: { 'Accept-Language': 'nl' },
    }).then(function (response) {
      if (!response.ok) {
        var error = new Error('Tilly answered ' + response.status);
        error.status = response.status;
        throw error;
      }
      return response.json();
    });
  }

  var pagePromise = null;
  function fetchPage() {
    if (!pagePromise) pagePromise = api('');
    return pagePromise;
  }
  function fetchVacancy(slug) {
    return api('/vacancies/' + encodeURIComponent(slug));
  }

  function hostedUrl() {
    return cfg.origin + '/careers/' + encodeURIComponent(cfg.slug);
  }
  function applyUrl(vacancySlug) {
    return hostedUrl() + '/jobs/' + encodeURIComponent(vacancySlug) + '/apply';
  }

  // ---- formatting ------------------------------------------------------------------
  var TYPES = {
    FullTime: 'Voltijds',
    PartTime: 'Deeltijds',
    Contract: 'Contract',
    Internship: 'Stage',
    Student: 'Studentenjob',
    Temporary: 'Tijdelijk',
  };
  var PERIODS = { month: 'per maand', year: 'per jaar', hour: 'per uur', day: 'per dag' };
  var money = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  var dateFmt = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' });

  function typeLabel(type) {
    return TYPES[type] || type || '';
  }
  function salaryLabel(salary) {
    if (!salary || (salary.min == null && salary.max == null)) return '';
    var range;
    if (salary.min != null && salary.max != null) range = money.format(salary.min) + ' – ' + money.format(salary.max);
    else if (salary.min != null) range = 'vanaf ' + money.format(salary.min);
    else range = 'tot ' + money.format(salary.max);
    return range + ' ' + (PERIODS[salary.period || 'month'] || salary.period);
  }
  function dateLabel(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? '' : dateFmt.format(d);
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // ---- renderers -------------------------------------------------------------------
  function renderUnavailable(container, error) {
    container.innerHTML = '';
    var box = el('div', 'tilly-empty');
    var notConfigured = error && error.status === 404;
    box.appendChild(el('h3', null, notConfigured ? 'Vacatures nog niet gekoppeld' : 'Vacatures laden lukt even niet'));
    box.appendChild(
      el(
        'p',
        null,
        notConfigured
          ? 'De vacaturepagina van Tilly is nog niet gekoppeld aan deze website. Zet de careers-slug in assets/js/config.js.'
          : 'Probeer het straks opnieuw, of bekijk onze openstaande jobs rechtstreeks op onze vacaturepagina.'
      )
    );
    var link = el('a', 'btn btn-ghost', 'Open de vacaturepagina');
    link.href = hostedUrl();
    link.target = '_blank';
    link.rel = 'noopener';
    box.appendChild(link);
    container.appendChild(box);
  }

  function vacancyCard(vacancy, detailBase) {
    var card = el('a', 'job-card');
    card.href = detailBase + '?v=' + encodeURIComponent(vacancy.slug);

    var head = el('div', 'job-card-head');
    head.appendChild(el('h3', 'job-card-title', vacancy.title));
    if (vacancy.departmentName) head.appendChild(el('span', 'tag', vacancy.departmentName));
    card.appendChild(head);

    if (vacancy.excerpt) card.appendChild(el('p', 'job-card-excerpt', vacancy.excerpt));

    var meta = el('ul', 'job-meta');
    if (vacancy.location) meta.appendChild(metaItem('pin', vacancy.location));
    meta.appendChild(metaItem('clock', typeLabel(vacancy.employmentType)));
    var salary = salaryLabel(vacancy.salary);
    if (salary) meta.appendChild(metaItem('euro', salary));
    card.appendChild(meta);

    var foot = el('div', 'job-card-foot');
    foot.appendChild(el('span', 'job-card-date', vacancy.publishedOn ? 'Geplaatst op ' + dateLabel(vacancy.publishedOn) : ''));
    foot.appendChild(el('span', 'job-card-more', 'Bekijk vacature →'));
    card.appendChild(foot);
    return card;
  }

  var ICONS = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    euro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 6.5A6.5 6.5 0 0 0 7 10m0 4a6.5 6.5 0 0 0 10.5 3.5M4 10h9M4 14h9"/></svg>',
    team: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a6.5 6.5 0 0 1 3.5 6.5"/></svg>',
  };
  function metaItem(icon, text) {
    var li = el('li');
    li.innerHTML = ICONS[icon] || '';
    li.appendChild(document.createTextNode(text));
    return li;
  }

  function renderList(container) {
    var limit = parseInt(container.getAttribute('data-limit') || '0', 10);
    var withFilters = container.getAttribute('data-filters') === 'true';
    var detailBase = container.getAttribute('data-detail-base') || 'vacature.html';

    container.innerHTML = '';
    var skeleton = el('div', 'job-skeleton');
    for (var i = 0; i < (limit || 3); i++) skeleton.appendChild(el('div', 'job-skeleton-card'));
    container.appendChild(skeleton);

    fetchPage()
      .then(function (page) {
        container.innerHTML = '';
        var all = page.vacancies || [];
        var state = { query: '', department: '' };
        var grid = el('div', 'job-grid');

        if (withFilters) {
          var bar = el('div', 'job-filters');
          var search = el('input', 'job-search');
          search.type = 'search';
          search.placeholder = 'Zoek op functie of plaats…';
          search.setAttribute('aria-label', 'Zoek in vacatures');
          bar.appendChild(search);

          var chips = el('div', 'chips');
          var departments = page.departments && page.departments.length ? page.departments : uniqueDepartments(all);
          chips.appendChild(chip('Alle teams', '', true));
          departments.forEach(function (d) {
            chips.appendChild(chip(d, d, false));
          });
          bar.appendChild(chips);
          container.appendChild(bar);

          search.addEventListener('input', function () {
            state.query = search.value.trim().toLowerCase();
            draw();
          });
          chips.addEventListener('click', function (event) {
            var target = event.target.closest('button[data-dept]');
            if (!target) return;
            state.department = target.getAttribute('data-dept');
            chips.querySelectorAll('button').forEach(function (b) {
              b.classList.toggle('is-active', b === target);
              b.setAttribute('aria-pressed', b === target ? 'true' : 'false');
            });
            draw();
          });
        }

        var summary = el('p', 'job-summary');
        if (withFilters) container.appendChild(summary);
        container.appendChild(grid);

        function draw() {
          var shown = all.filter(function (v) {
            if (state.department && v.departmentName !== state.department) return false;
            if (!state.query) return true;
            var hay = [v.title, v.location, v.departmentName, v.excerpt].join(' ').toLowerCase();
            return hay.indexOf(state.query) !== -1;
          });
          if (limit > 0) shown = shown.slice(0, limit);
          grid.innerHTML = '';
          if (shown.length === 0) {
            var none = el('div', 'tilly-empty');
            none.appendChild(el('h3', null, all.length ? 'Geen vacature die hierbij past' : 'Geen openstaande vacatures'));
            none.appendChild(
              el('p', null, all.length ? 'Pas je zoekopdracht aan of solliciteer spontaan: we horen graag van je.' : 'Solliciteer gerust spontaan. Goede technici kunnen we altijd gebruiken.')
            );
            grid.appendChild(none);
          }
          shown.forEach(function (v) {
            grid.appendChild(vacancyCard(v, detailBase));
          });
          summary.textContent =
            all.length === 0 ? '' : shown.length === all.length ? all.length + ' openstaande vacature' + (all.length === 1 ? '' : 's') : shown.length + ' van ' + all.length + ' vacatures';
        }
        draw();
      })
      .catch(function (error) {
        renderUnavailable(container, error);
      });
  }

  function uniqueDepartments(vacancies) {
    var seen = {};
    return vacancies
      .map(function (v) {
        return v.departmentName;
      })
      .filter(function (d) {
        if (!d || seen[d]) return false;
        seen[d] = true;
        return true;
      });
  }

  function chip(label, value, active) {
    var button = el('button', 'chip' + (active ? ' is-active' : ''), label);
    button.type = 'button';
    button.setAttribute('data-dept', value);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    return button;
  }

  function renderCount(node) {
    fetchPage()
      .then(function (page) {
        var n = page.totalOpenings != null ? page.totalOpenings : (page.vacancies || []).length;
        node.textContent = n;
        var suffix = node.getAttribute('data-suffix');
        if (suffix) node.textContent += ' ' + (n === 1 ? suffix.split('|')[0] : suffix.split('|')[1] || suffix);
      })
      .catch(function () {
        node.textContent = node.getAttribute('data-fallback') || '';
      });
  }

  function renderDetail(container) {
    var slug = new URLSearchParams(location.search).get('v');
    var listUrl = container.getAttribute('data-list-url') || './';
    if (!slug) {
      location.replace(listUrl);
      return;
    }
    fetchVacancy(slug)
      .then(function (v) {
        document.title = v.title + ' · Werken bij Bergmans Elektrotechniek';
        container.innerHTML = '';

        var header = el('header', 'job-detail-head');
        var crumbs = el('nav', 'crumbs');
        crumbs.setAttribute('aria-label', 'Kruimelpad');
        var back = el('a', null, 'Alle vacatures');
        back.href = listUrl;
        crumbs.appendChild(back);
        crumbs.appendChild(document.createTextNode(' / '));
        crumbs.appendChild(el('span', null, v.title));
        header.appendChild(crumbs);
        if (v.departmentName) header.appendChild(el('span', 'eyebrow', v.departmentName));
        header.appendChild(el('h1', null, v.title));

        var facts = el('ul', 'job-meta job-meta-lg');
        if (v.location) facts.appendChild(metaItem('pin', v.location));
        facts.appendChild(metaItem('clock', typeLabel(v.employmentType)));
        var salary = salaryLabel(v.salary);
        if (salary) facts.appendChild(metaItem('euro', salary));
        if (v.departmentName) facts.appendChild(metaItem('team', 'Team ' + v.departmentName));
        header.appendChild(facts);

        var actions = el('div', 'job-actions');
        var apply = el('a', 'btn btn-primary btn-lg', 'Solliciteer nu');
        apply.href = applyUrl(v.slug);
        actions.appendChild(apply);
        if (v.publishedOn) actions.appendChild(el('span', 'job-card-date', 'Geplaatst op ' + dateLabel(v.publishedOn)));
        header.appendChild(actions);
        container.appendChild(header);

        var layout = el('div', 'job-detail-layout');
        var body = el('article', 'prose job-description');
        // The HTML comes from Tilly's public API, which serves it sanitised for its own hosted page.
        body.innerHTML = v.descriptionHtml || '<p>Deze vacature heeft nog geen omschrijving.</p>';
        layout.appendChild(body);

        var aside = el('aside', 'job-aside');
        if (v.benefits && v.benefits.length) {
          var card = el('div', 'aside-card');
          card.appendChild(el('h3', null, 'Wat je krijgt'));
          var ul = el('ul', 'check-list');
          v.benefits.forEach(function (b) {
            ul.appendChild(el('li', null, b));
          });
          card.appendChild(ul);
          aside.appendChild(card);
        }
        var cta = el('div', 'aside-card aside-cta');
        cta.appendChild(el('h3', null, 'Zin om mee te bouwen?'));
        cta.appendChild(el('p', null, 'Solliciteren duurt twee minuten. Je krijgt binnen drie werkdagen een antwoord van Hanne.'));
        var apply2 = el('a', 'btn btn-primary', 'Solliciteer nu');
        apply2.href = applyUrl(v.slug);
        cta.appendChild(apply2);
        var contact = el('p', 'aside-contact');
        contact.innerHTML =
          'Vragen over deze job? Bel <a href="tel:+3215300120">015 30 01 20</a> of mail <a href="mailto:jobs@bergmans-elektro.be">jobs@bergmans-elektro.be</a>.';
        cta.appendChild(contact);
        aside.appendChild(cta);

        var share = el('div', 'aside-card');
        share.appendChild(el('h3', null, 'Ken je iemand voor deze job?'));
        var shareRow = el('div', 'share-row');
        var mail = el('a', 'btn btn-ghost btn-sm', 'Deel via mail');
        mail.href =
          'mailto:?subject=' + encodeURIComponent('Vacature bij Bergmans: ' + v.title) + '&body=' + encodeURIComponent('Misschien iets voor jou? ' + location.href);
        shareRow.appendChild(mail);
        var copy = el('button', 'btn btn-ghost btn-sm', 'Kopieer link');
        copy.type = 'button';
        copy.addEventListener('click', function () {
          navigator.clipboard && navigator.clipboard.writeText(location.href);
          copy.textContent = 'Gekopieerd';
          setTimeout(function () {
            copy.textContent = 'Kopieer link';
          }, 1500);
        });
        shareRow.appendChild(copy);
        share.appendChild(shareRow);
        aside.appendChild(share);

        layout.appendChild(aside);
        container.appendChild(layout);

        var related = document.querySelector('[data-tilly-related]');
        if (related) renderRelated(related, v.slug);
      })
      .catch(function (error) {
        container.innerHTML = '';
        var related = document.querySelector('[data-tilly-related]');
        if (related) renderRelated(related, slug);
        if (error.status === 404 || error.status === 410) {
          var gone = el('div', 'tilly-empty');
          gone.appendChild(el('h3', null, 'Deze vacature is niet meer open'));
          gone.appendChild(el('p', null, 'Ze is ingevuld of ingetrokken. Bekijk gerust onze andere openstaande jobs.'));
          var link = el('a', 'btn btn-primary', 'Alle vacatures');
          link.href = listUrl;
          gone.appendChild(link);
          container.appendChild(gone);
        } else {
          renderUnavailable(container, error);
        }
      });
  }

  function renderRelated(container, currentSlug) {
    fetchPage()
      .then(function (page) {
        var others = (page.vacancies || []).filter(function (v) {
          return v.slug !== currentSlug;
        });
        if (!others.length) {
          container.hidden = true;
          return;
        }
        var grid = container.querySelector('.job-grid') || container;
        grid.innerHTML = '';
        others.slice(0, 3).forEach(function (v) {
          grid.appendChild(vacancyCard(v, 'vacature.html'));
        });
      })
      .catch(function () {
        container.hidden = true;
      });
  }

  function init() {
    document.querySelectorAll('[data-tilly-list]').forEach(renderList);
    document.querySelectorAll('[data-tilly-count]').forEach(renderCount);
    document.querySelectorAll('[data-tilly-detail]').forEach(renderDetail);
    document.querySelectorAll('[data-tilly-hosted-link]').forEach(function (a) {
      a.href = hostedUrl();
    });
  }

  window.Tilly = { config: cfg, fetchPage: fetchPage, fetchVacancy: fetchVacancy, applyUrl: applyUrl, hostedUrl: hostedUrl };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
