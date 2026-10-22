# Bergmans Elektrotechniek - demo website

Static website for the fictional installer Bergmans Elektrotechniek (Tilly.HR demo tenant),
with a careers page that lists the company's published vacancies live from Tilly.HR.

- `index.html` - home
- `jobs/index.html` - careers page (filters, live vacancy list)
- `jobs/vacature.html?v=<slug>` - vacancy detail, applying happens on the hosted Tilly form
- `assets/js/config.js` - the Tilly origin and careers slug; `?tilly=<slug>&tillyOrigin=<url>` overrides them in the browser

Serve locally with `python3 -m http.server 8765` from this folder.
