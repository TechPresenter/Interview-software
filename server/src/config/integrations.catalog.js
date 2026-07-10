/**
 * Catalog of supported tracking / analytics / marketing integrations.
 *
 * Each entry is data-driven so the admin UI can render it and the public
 * `/content/tracking` endpoint can build the client-side snippet automatically.
 *
 *  - fields[].secret  → stored + masked; never exposed on the public endpoint.
 *  - inject           → client-side snippet template. `{{fieldKey}}` placeholders
 *                       are replaced with the saved values. Presence of `inject`
 *                       means the tool runs in the browser (public/global).
 *  - test             → how the "Test connection" action verifies it
 *                       ('webhook' pings the URL; otherwise a presence/format check).
 *
 * Public IDs (measurement id, pixel id, …) are NOT secret — they are visible in
 * page source anyway — so they can be returned by the public snippet builder.
 */

export const CATEGORIES = [
  { key: 'analytics', label: 'Web Analytics' },
  { key: 'product', label: 'Product Analytics' },
  { key: 'ads', label: 'Ads & Pixels' },
  { key: 'support', label: 'Support & Chat' },
  { key: 'crm', label: 'CRM & Email' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'automation', label: 'Automation & Webhooks' },
  { key: 'custom', label: 'Custom & Advanced' },
];

export const INTEGRATIONS = [
  /* ── Web Analytics ─────────────────────────────────────── */
  {
    key: 'ga4', name: 'Google Analytics 4', category: 'analytics',
    description: 'Traffic, sessions, events and conversions in Google Analytics.',
    docs: 'https://support.google.com/analytics/answer/9304153',
    fields: [{ key: 'measurementId', label: 'Measurement ID', placeholder: 'G-XXXXXXXXXX' }],
    inject: `<script async src="https://www.googletagmanager.com/gtag/js?id={{measurementId}}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','{{measurementId}}');</script>`,
  },
  {
    key: 'gtm', name: 'Google Tag Manager', category: 'analytics',
    description: 'Manage all your tags from one container without code changes.',
    docs: 'https://support.google.com/tagmanager',
    fields: [{ key: 'containerId', label: 'Container ID', placeholder: 'GTM-XXXXXXX' }],
    inject: `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','{{containerId}}');</script>`,
  },
  {
    key: 'gsc', name: 'Google Search Console', category: 'analytics',
    description: 'Verify site ownership via the HTML meta tag.',
    docs: 'https://search.google.com/search-console',
    fields: [{ key: 'verification', label: 'Verification code', placeholder: 'content value of the meta tag' }],
    inject: `<meta name="google-site-verification" content="{{verification}}" />`,
  },
  {
    key: 'clarity', name: 'Microsoft Clarity', category: 'analytics',
    description: 'Free heatmaps and session recordings.',
    docs: 'https://clarity.microsoft.com',
    fields: [{ key: 'projectId', label: 'Project ID', placeholder: 'abcdefghij' }],
    inject: `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","{{projectId}}");</script>`,
  },
  {
    key: 'plausible', name: 'Plausible Analytics', category: 'analytics',
    description: 'Lightweight, privacy-friendly analytics.',
    docs: 'https://plausible.io/docs',
    fields: [{ key: 'domain', label: 'Data domain', placeholder: 'example.com' }],
    inject: `<script defer data-domain="{{domain}}" src="https://plausible.io/js/script.js"></script>`,
  },
  {
    key: 'matomo', name: 'Matomo', category: 'analytics',
    description: 'Self-hosted, open-source web analytics.',
    docs: 'https://matomo.org/docs',
    fields: [
      { key: 'url', label: 'Matomo URL', placeholder: 'https://analytics.example.com/' },
      { key: 'siteId', label: 'Site ID', placeholder: '1' },
    ],
    inject: `<script>var _paq=window._paq=window._paq||[];_paq.push(['trackPageView']);_paq.push(['enableLinkTracking']);(function(){var u="{{url}}";_paq.push(['setTrackerUrl',u+'matomo.php']);_paq.push(['setSiteId','{{siteId}}']);var d=document,g=d.createElement('script'),s=d.getElementsByTagName('script')[0];g.async=true;g.src=u+'matomo.js';s.parentNode.insertBefore(g,s);})();</script>`,
  },
  {
    key: 'cloudflare', name: 'Cloudflare Web Analytics', category: 'analytics',
    description: 'Privacy-first analytics with no cookies.',
    docs: 'https://developers.cloudflare.com/web-analytics',
    fields: [{ key: 'token', label: 'Beacon token', placeholder: 'from the CF dashboard' }],
    inject: `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "{{token}}"}'></script>`,
  },

  /* ── Product Analytics ─────────────────────────────────── */
  {
    key: 'posthog', name: 'PostHog', category: 'product',
    description: 'Product analytics, session replay and feature flags.',
    docs: 'https://posthog.com/docs',
    fields: [
      { key: 'apiKey', label: 'Project API key', placeholder: 'phc_...' },
      { key: 'host', label: 'API host', placeholder: 'https://us.i.posthog.com' },
    ],
    inject: `<script>!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('{{apiKey}}',{api_host:'{{host}}'});</script>`,
  },
  {
    key: 'mixpanel', name: 'Mixpanel', category: 'product',
    description: 'Event-based product analytics.',
    docs: 'https://docs.mixpanel.com',
    fields: [{ key: 'token', label: 'Project token', placeholder: 'from Project Settings' }],
    inject: `<script>(function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};a.people.toString=function(){return a.toString(1)+".people (stub)"};i="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");for(h=0;h<i.length;h++)g(a,i[h]);var j="set set_once union unset remove delete".split(" ");a.get_group=function(){function b(c){d[c]=function(){call2_args=arguments;call2=[c].concat(Array.prototype.slice.call(call2_args,0));a.push([e,call2])}}for(var d={},e=["get_group"].concat(Array.prototype.slice.call(arguments,0)),c=0;c<j.length;c++)b(j[c]);return d};b._i.push([e,f,c])};b.__SV=1.2;e=f.createElement("script");e.type="text/javascript";e.async=!0;e.src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";g=f.getElementsByTagName("script")[0];g.parentNode.insertBefore(e,g)}})(document,window.mixpanel||[]);mixpanel.init('{{token}}',{track_pageview:true});</script>`,
  },
  {
    key: 'amplitude', name: 'Amplitude', category: 'product',
    description: 'Digital analytics and experimentation.',
    docs: 'https://amplitude.com/docs',
    fields: [{ key: 'apiKey', label: 'API key', placeholder: 'from project settings' }],
    inject: `<script src="https://cdn.amplitude.com/script/{{apiKey}}.js"></script>\n<script>window.amplitude.init('{{apiKey}}',{"fetchRemoteConfig":true,"autocapture":true});</script>`,
  },
  {
    key: 'segment', name: 'Segment', category: 'product',
    description: 'Customer data platform — collect once, send everywhere.',
    docs: 'https://segment.com/docs',
    fields: [{ key: 'writeKey', label: 'Write key', placeholder: 'from Source settings' }],
    inject: `<script>!function(){var i="analytics",analytics=window[i]=window[i]||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","screen","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware","register"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var key=analytics.methods[e];analytics[key]=analytics.factory(key)}analytics.load=function(key,e){var t=document.createElement("script");t.type="text/javascript";t.async=!0;t.src="https://cdn.segment.com/analytics.js/v1/"+key+"/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(t,n);analytics._loadOptions=e};analytics._writeKey="{{writeKey}}";analytics.SNIPPET_VERSION="4.15.3";analytics.load("{{writeKey}}");analytics.page()}}();</script>`,
  },
  {
    key: 'hotjar', name: 'Hotjar', category: 'product',
    description: 'Heatmaps, recordings and feedback.',
    docs: 'https://help.hotjar.com',
    fields: [{ key: 'siteId', label: 'Site ID', placeholder: '1234567' }],
    inject: `<script>(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:{{siteId}},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');</script>`,
  },

  /* ── Ads & Pixels ──────────────────────────────────────── */
  {
    key: 'meta_pixel', name: 'Meta (Facebook) Pixel', category: 'ads',
    description: 'Track conversions from Facebook & Instagram ads.',
    docs: 'https://www.facebook.com/business/help/952192354843755',
    fields: [{ key: 'pixelId', label: 'Pixel ID', placeholder: '1234567890' }],
    inject: `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','{{pixelId}}');fbq('track','PageView');</script>`,
  },
  {
    key: 'meta_capi', name: 'Meta Conversions API', category: 'ads',
    description: 'Server-side conversion events (event forwarding configured next phase).',
    docs: 'https://developers.facebook.com/docs/marketing-api/conversions-api',
    fields: [
      { key: 'pixelId', label: 'Pixel ID' },
      { key: 'accessToken', label: 'Access token', secret: true },
    ],
  },
  {
    key: 'google_ads', name: 'Google Ads Conversion', category: 'ads',
    description: 'Conversion tracking for Google Ads campaigns.',
    docs: 'https://support.google.com/google-ads/answer/6095821',
    fields: [{ key: 'conversionId', label: 'Conversion ID', placeholder: 'AW-XXXXXXXXX' }],
    inject: `<script async src="https://www.googletagmanager.com/gtag/js?id={{conversionId}}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','{{conversionId}}');</script>`,
  },
  {
    key: 'google_merchant', name: 'Google Merchant Center', category: 'ads',
    description: 'Product feed / shopping integration (server-side, config only).',
    docs: 'https://support.google.com/merchants',
    fields: [{ key: 'merchantId', label: 'Merchant ID' }],
  },
  {
    key: 'linkedin', name: 'LinkedIn Insight Tag', category: 'ads',
    description: 'Conversion tracking and retargeting for LinkedIn ads.',
    docs: 'https://www.linkedin.com/help/lms/answer/a418880',
    fields: [{ key: 'partnerId', label: 'Partner ID', placeholder: '1234567' }],
    inject: `<script>_linkedin_partner_id="{{partnerId}}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);</script>\n<script async src="https://snap.licdn.com/li.lms-analytics/insight.min.js"></script>`,
  },
  {
    key: 'ms_ads', name: 'Microsoft Ads (UET)', category: 'ads',
    description: 'Universal Event Tracking for Microsoft Advertising.',
    docs: 'https://help.ads.microsoft.com',
    fields: [{ key: 'tagId', label: 'UET Tag ID', placeholder: '12345678' }],
    inject: `<script>(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[],f=function(){var o={ti:"{{tagId}}"};o.q=w[u],w[u]=new UET(o),w[u].push("pageLoad")},n=d.createElement(t),n.src=r,n.async=1,n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)},i=d.getElementsByTagName(t)[0],i.parentNode.insertBefore(n,i)})(window,document,"script","//bat.bing.com/bat.js","uetq");</script>`,
  },
  {
    key: 'tiktok', name: 'TikTok Pixel', category: 'ads',
    description: 'Measure conversions from TikTok ads.',
    docs: 'https://ads.tiktok.com/help',
    fields: [{ key: 'pixelId', label: 'Pixel ID' }],
    inject: `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('{{pixelId}}');ttq.page();}(window,document,'ttq');</script>`,
  },
  {
    key: 'snapchat', name: 'Snapchat Pixel', category: 'ads',
    description: 'Conversion tracking for Snapchat ads.',
    docs: 'https://businesshelp.snapchat.com',
    fields: [{ key: 'pixelId', label: 'Pixel ID' }],
    inject: `<script>(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','{{pixelId}}');snaptr('track','PAGE_VIEW');</script>`,
  },
  {
    key: 'pinterest', name: 'Pinterest Tag', category: 'ads',
    description: 'Track conversions from Pinterest ads.',
    docs: 'https://help.pinterest.com/en/business/article/track-conversions-with-pinterest-tag',
    fields: [{ key: 'tagId', label: 'Tag ID' }],
    inject: `<script>!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");pintrk('load','{{tagId}}');pintrk('page');</script>`,
  },
  {
    key: 'twitter', name: 'X (Twitter) Pixel', category: 'ads',
    description: 'Conversion tracking for X ads.',
    docs: 'https://business.twitter.com/en/help/campaign-measurement-and-analytics',
    fields: [{ key: 'pixelId', label: 'Pixel ID' }],
    inject: `<script>!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments)},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');twq('config','{{pixelId}}');</script>`,
  },
  {
    key: 'reddit', name: 'Reddit Pixel', category: 'ads',
    description: 'Conversion tracking for Reddit ads.',
    docs: 'https://business.reddithelp.com',
    fields: [{ key: 'pixelId', label: 'Advertiser ID', placeholder: 't2_...' }],
    inject: `<script>!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);rdt('init','{{pixelId}}');rdt('track','PageVisit');</script>`,
  },
  {
    key: 'quora', name: 'Quora Pixel', category: 'ads',
    description: 'Conversion tracking for Quora ads.',
    docs: 'https://www.quora.com/business',
    fields: [{ key: 'pixelId', label: 'Pixel ID' }],
    inject: `<script>!function(q,e,v,n,t,s){if(q.qp)return;n=q.qp=function(){n.qp?n.qp.apply(n,arguments):n.queue.push(arguments)};n.queue=[];t=e.createElement(v);t.async=!0;t.src=n;s=e.getElementsByTagName(v)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://a.quora.com/qevents.js');qp('init','{{pixelId}}');qp('track','ViewContent');</script>`,
  },

  /* ── Support & Chat ────────────────────────────────────── */
  {
    key: 'crisp', name: 'Crisp Chat', category: 'support',
    description: 'Live chat and customer messaging.',
    docs: 'https://help.crisp.chat',
    fields: [{ key: 'websiteId', label: 'Website ID', placeholder: 'UUID from Crisp' }],
    inject: `<script>window.$crisp=[];window.CRISP_WEBSITE_ID="{{websiteId}}";(function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();</script>`,
  },
  {
    key: 'intercom', name: 'Intercom', category: 'support',
    description: 'Customer messaging and support.',
    docs: 'https://developers.intercom.com',
    fields: [{ key: 'appId', label: 'App ID', placeholder: 'abcd1234' }],
    inject: `<script>window.intercomSettings={app_id:"{{appId}}"};(function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){ic('reattach_activator');ic('update',w.intercomSettings)}else{var d=document;var i=function(){i.c(arguments)};i.q=[];i.c=function(args){i.q.push(args)};w.Intercom=i;var l=function(){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://widget.intercom.io/widget/{{appId}}';var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x)};if(document.readyState==='complete'){l()}else if(w.attachEvent){w.attachEvent('onload',l)}else{w.addEventListener('load',l,false)}}})();</script>`,
  },
  {
    key: 'zendesk', name: 'Zendesk', category: 'support',
    description: 'Zendesk Web Widget for support.',
    docs: 'https://support.zendesk.com',
    fields: [{ key: 'key', label: 'Widget key', placeholder: 'snippet key' }],
    inject: `<script id="ze-snippet" src="https://static.zdassets.com/ekr/snippet.js?key={{key}}"></script>`,
  },

  /* ── CRM & Email ───────────────────────────────────────── */
  {
    key: 'hubspot', name: 'HubSpot', category: 'crm',
    description: 'CRM tracking code and forms.',
    docs: 'https://developers.hubspot.com',
    fields: [{ key: 'portalId', label: 'Portal / Hub ID', placeholder: '1234567' }],
    inject: `<script type="text/javascript" id="hs-script-loader" async defer src="https://js.hs-scripts.com/{{portalId}}.js"></script>`,
  },
  {
    key: 'mailchimp', name: 'Mailchimp', category: 'crm',
    description: 'Audience sync and marketing email (server-side, config only).',
    docs: 'https://mailchimp.com/developer',
    fields: [
      { key: 'apiKey', label: 'API key', secret: true },
      { key: 'audienceId', label: 'Audience (List) ID' },
    ],
  },
  {
    key: 'brevo', name: 'Brevo (Sendinblue)', category: 'crm',
    description: 'Email + SMS marketing (server-side, config only).',
    docs: 'https://developers.brevo.com',
    fields: [{ key: 'apiKey', label: 'API key', secret: true }],
  },

  /* ── Monitoring ────────────────────────────────────────── */
  {
    key: 'sentry', name: 'Sentry', category: 'monitoring',
    description: 'Front-end error and performance monitoring.',
    docs: 'https://docs.sentry.io',
    fields: [{ key: 'dsn', label: 'DSN', placeholder: 'https://xxx@oyyy.ingest.sentry.io/zzz' }],
    inject: `<script src="https://browser.sentry-cdn.com/7.120.0/bundle.tracing.min.js" crossorigin="anonymous"></script>\n<script>if(window.Sentry){Sentry.init({dsn:"{{dsn}}",tracesSampleRate:0.1});}</script>`,
  },
  {
    key: 'logrocket', name: 'LogRocket', category: 'monitoring',
    description: 'Session replay for debugging.',
    docs: 'https://docs.logrocket.com',
    fields: [{ key: 'appId', label: 'App ID', placeholder: 'org/app' }],
    inject: `<script src="https://cdn.logrocket.io/LogRocket.min.js" crossorigin="anonymous"></script>\n<script>window.LogRocket&&window.LogRocket.init('{{appId}}');</script>`,
  },

  /* ── Automation & Webhooks ─────────────────────────────── */
  {
    key: 'slack', name: 'Slack Webhook', category: 'automation',
    description: 'Post notifications to a Slack channel.',
    docs: 'https://api.slack.com/messaging/webhooks',
    fields: [{ key: 'webhookUrl', label: 'Incoming webhook URL', secret: true, placeholder: 'https://hooks.slack.com/services/...' }],
    test: 'webhook',
  },
  {
    key: 'discord', name: 'Discord Webhook', category: 'automation',
    description: 'Post notifications to a Discord channel.',
    docs: 'https://support.discord.com/hc/en-us/articles/228383668',
    fields: [{ key: 'webhookUrl', label: 'Webhook URL', secret: true, placeholder: 'https://discord.com/api/webhooks/...' }],
    test: 'webhook',
  },
  {
    key: 'zapier', name: 'Zapier', category: 'automation',
    description: 'Trigger Zaps via a catch hook.',
    docs: 'https://zapier.com/apps/webhook/integrations',
    fields: [{ key: 'webhookUrl', label: 'Catch hook URL', secret: true, placeholder: 'https://hooks.zapier.com/...' }],
    test: 'webhook',
  },
  {
    key: 'make', name: 'Make (Integromat)', category: 'automation',
    description: 'Trigger Make scenarios via a webhook.',
    docs: 'https://www.make.com/en/help/tools/webhooks',
    fields: [{ key: 'webhookUrl', label: 'Webhook URL', secret: true, placeholder: 'https://hook.make.com/...' }],
    test: 'webhook',
  },
  {
    key: 'custom_webhook', name: 'Custom Webhook', category: 'automation',
    description: 'POST platform events to any HTTPS endpoint.',
    docs: '',
    fields: [
      { key: 'webhookUrl', label: 'Endpoint URL', secret: true, placeholder: 'https://api.yourapp.com/hook' },
      { key: 'secret', label: 'Signing secret (optional)', secret: true },
    ],
    test: 'webhook',
  },

  /* ── Custom & Advanced ─────────────────────────────────── */
  {
    key: 'rest_connector', name: 'REST API Connector', category: 'custom',
    description: 'Base URL + bearer token for an outbound REST connector (server-side).',
    docs: '',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.example.com' },
      { key: 'token', label: 'Bearer token', secret: true },
    ],
  },
  {
    key: 'oauth', name: 'OAuth Integration', category: 'custom',
    description: 'Client credentials for an outbound OAuth app (server-side).',
    docs: '',
    fields: [
      { key: 'clientId', label: 'Client ID' },
      { key: 'clientSecret', label: 'Client secret', secret: true },
      { key: 'authUrl', label: 'Authorize URL' },
      { key: 'tokenUrl', label: 'Token URL' },
    ],
  },
  {
    key: 'custom_head', name: 'Custom Header Scripts', category: 'custom',
    description: 'Raw HTML/JS injected into the <head> on every page.',
    docs: '',
    fields: [{ key: 'code', label: 'Header code', type: 'textarea', placeholder: '<script>…</script>' }],
    inject: `{{code}}`,
  },
  {
    key: 'custom_footer', name: 'Custom Footer Scripts', category: 'custom',
    description: 'Raw HTML/JS injected before </body> on every page.',
    docs: '',
    fields: [{ key: 'code', label: 'Footer code', type: 'textarea', placeholder: '<script>…</script>' }],
    injectFooter: `{{code}}`,
  },
  {
    key: 'custom_js', name: 'Custom JavaScript', category: 'custom',
    description: 'Plain JavaScript executed on every page load.',
    docs: '',
    fields: [{ key: 'code', label: 'JavaScript', type: 'textarea', placeholder: "console.log('hello');" }],
    injectJs: `{{code}}`,
  },
];

/** Fast lookup by key. */
export const INTEGRATION_MAP = Object.fromEntries(INTEGRATIONS.map((i) => [i.key, i]));

/** Replace {{field}} placeholders in a template with the saved config values. */
export function renderTemplate(template, values = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, k) => (values[k] != null ? String(values[k]) : ''));
}

export default INTEGRATIONS;
