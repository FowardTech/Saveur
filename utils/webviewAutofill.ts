import {AutofillProfile} from 'services/autofillProfileService';

// ---------------------------------------------------------------------------
// webviewAutofill — the actual "fill in the job application form" engine
// (product request item 2). Runs entirely inside the loaded page via
// WebView.injectJavaScript, the same mechanism WebViewScreen.tsx already
// uses for its application-submitted/dead-posting detection (see that
// file's own comment on why a WebView can observe the DOM of the page it
// renders even though it can't make cross-origin network calls).
//
// Deliberately FILL-ONLY, never submits anything: it sets field values and
// dispatches the same input/change/blur events a real keystroke would
// (needed so React/Vue/Angular-controlled inputs on the target site
// actually register the change, not just the raw DOM attribute), then
// stops. No button is ever clicked, no form is ever submitted — the user
// always reviews and taps Submit/Apply themselves. It also never touches
// password, file, hidden, or any button/submit input, and never
// overwrites a field that already has a value.
//
// Field matching is a generic heuristic (autocomplete attribute first,
// then id/name/placeholder/aria-label/nearby-<label> text against a
// keyword table) rather than per-ATS-platform selectors — there's no
// reliable, exhaustive list of every employer careers page's exact DOM
// shape, so this trades perfect coverage on any one site for reasonable
// coverage across all of them (this generic approach still fully covers
// major ATS platforms like Greenhouse/Lever/Workday/LinkedIn Easy Apply,
// since they all use standard autocomplete attributes and conventional
// field naming — it just isn't hand-tuned to any one of them specifically).
// ---------------------------------------------------------------------------

export interface AutofillFieldResult {
  key: string;
  label: string;
}

export interface AutofillMessage {
  type: 'autofill_result' | 'autofill_error';
  filledCount?: number;
  fields?: AutofillFieldResult[];
  message?: string;
}

export function buildAutofillScript(profile: AutofillProfile): string {
  const profileJson = JSON.stringify(profile ?? {});
  return `
    (function () {
      try {
        var profile = ${profileJson};
        var FIELD_RULES = [
          {key: 'firstName', autocomplete: ['given-name'], patterns: [/first\\s*name/i, /given\\s*name/i, /\\bfname\\b/i]},
          {key: 'lastName', autocomplete: ['family-name'], patterns: [/last\\s*name/i, /family\\s*name/i, /surname/i, /\\blname\\b/i]},
          {key: 'fullName', autocomplete: ['name'], patterns: [/full\\s*name/i, /^\\s*name\\s*$/i, /your\\s*name/i, /applicant\\s*name/i, /candidate\\s*name/i]},
          {key: 'email', autocomplete: ['email'], types: ['email'], patterns: [/e-?mail/i]},
          {key: 'phone', autocomplete: ['tel'], types: ['tel'], patterns: [/phone/i, /mobile/i, /\\bcell\\b/i]},
          {key: 'addressLine1', autocomplete: ['address-line1', 'street-address'], patterns: [/street\\s*address/i, /address\\s*line\\s*1/i, /^\\s*address\\s*$/i]},
          {key: 'city', autocomplete: ['address-level2'], patterns: [/\\bcity\\b/i, /\\btown\\b/i]},
          {key: 'state', autocomplete: ['address-level1'], patterns: [/\\bstate\\b/i, /\\bprovince\\b/i, /\\bregion\\b/i]},
          {key: 'postalCode', autocomplete: ['postal-code'], patterns: [/zip/i, /postal\\s*code/i]},
          {key: 'country', autocomplete: ['country', 'country-name'], patterns: [/\\bcountry\\b/i]},
          {key: 'linkedinUrl', patterns: [/linkedin/i]},
          {key: 'portfolioUrl', autocomplete: ['url'], patterns: [/portfolio/i, /personal\\s*website/i, /personal\\s*site/i]},
          {key: 'githubUrl', patterns: [/github/i]},
          {key: 'currentTitle', patterns: [/current\\s*title/i, /job\\s*title/i, /\\bposition\\b/i, /\\brole\\b/i]},
          {key: 'currentCompany', patterns: [/current\\s*(company|employer)/i, /\\bemployer\\b/i]},
          {key: 'school', patterns: [/school/i, /university/i, /college/i]},
        ];
        var SKIP_TYPES = {password: 1, file: 1, hidden: 1, submit: 1, button: 1, checkbox: 1, radio: 1, image: 1, reset: 1};

        function escapeId(id) {
          try { return window.CSS && CSS.escape ? CSS.escape(id) : id.replace(/[^a-zA-Z0-9_-]/g, ''); }
          catch (e) { return ''; }
        }

        function fieldSignature(el) {
          var parts = [];
          if (el.id) parts.push(el.id);
          if (el.name) parts.push(el.name);
          if (el.placeholder) parts.push(el.placeholder);
          var aria = el.getAttribute('aria-label');
          if (aria) parts.push(aria);
          if (el.id) {
            var escaped = escapeId(el.id);
            if (escaped) {
              var lbl = document.querySelector('label[for="' + escaped + '"]');
              if (lbl) parts.push(lbl.innerText || lbl.textContent || '');
            }
          }
          var wrappingLabel = el.closest ? el.closest('label') : null;
          if (wrappingLabel) parts.push(wrappingLabel.innerText || wrappingLabel.textContent || '');
          return parts.join(' | ');
        }

        function isVisible(el) {
          var style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          return el.offsetWidth > 0 && el.offsetHeight > 0;
        }

        function matchField(el, type) {
          var autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
          var sig = fieldSignature(el);
          var i, j, rule;
          for (i = 0; i < FIELD_RULES.length; i++) {
            rule = FIELD_RULES[i];
            if (rule.autocomplete && autocomplete && rule.autocomplete.indexOf(autocomplete) !== -1) return rule.key;
          }
          for (i = 0; i < FIELD_RULES.length; i++) {
            rule = FIELD_RULES[i];
            if (rule.types && rule.types.indexOf(type) !== -1) return rule.key;
          }
          for (i = 0; i < FIELD_RULES.length; i++) {
            rule = FIELD_RULES[i];
            for (j = 0; j < rule.patterns.length; j++) {
              if (rule.patterns[j].test(sig)) return rule.key;
            }
          }
          return null;
        }

        function setNativeValue(el, value) {
          var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
          if (descriptor && descriptor.set) {
            descriptor.set.call(el, value);
          } else {
            el.value = value;
          }
          el.dispatchEvent(new Event('input', {bubbles: true}));
          el.dispatchEvent(new Event('change', {bubbles: true}));
          el.dispatchEvent(new Event('blur', {bubbles: true}));
        }

        var filled = [];
        var candidates = document.querySelectorAll('input, textarea');
        for (var i = 0; i < candidates.length; i++) {
          var el = candidates[i];
          var type = (el.type || 'text').toLowerCase();
          if (SKIP_TYPES[type]) continue;
          if (el.disabled || el.readOnly) continue;
          if (el.value && String(el.value).trim()) continue; // never overwrite something already filled
          if (!isVisible(el)) continue;
          var key = matchField(el, type);
          if (!key) continue;
          var value = profile[key];
          if (value == null || value === '') continue;
          if (Array.isArray(value)) value = value.join(', ');
          value = String(value);
          try {
            setNativeValue(el, value);
            el.style.outline = '2px solid #0063f8';
            el.style.outlineOffset = '2px';
            filled.push({key: key, label: el.name || el.id || key});
          } catch (e) {}
        }

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'autofill_result',
          filledCount: filled.length,
          fields: filled,
        }));
      } catch (e) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'autofill_error', message: String(e)}));
        } catch (e2) {}
      }
    })();
    true;
  `;
}
