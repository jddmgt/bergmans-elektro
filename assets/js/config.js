// Tilly.HR careers integration. Only these two values are site-specific.
//
//   origin: the Tilly environment that hosts the careers page of this company
//   slug:   the careers slug of the company (Rekrutering > Instellingen > Careers-pagina)
//
// For a demo you can also override both without redeploying: open any page with
//   ?tilly=<slug>&tillyOrigin=https://app.tilly-hr.com
// once; the values are remembered in this browser. Add ?tillyReset=1 to forget them.
window.TILLY_CONFIG = {
  origin: 'https://dev.tilly-hr.com',
  slug: 'bergmans-elektrotechniek-3a8gnqm2',
};
