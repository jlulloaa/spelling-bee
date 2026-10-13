/* Buzzy Spelling Bee - the two mascots (a bee and a ladybird) and the icons, as inline SVG. */
(function (root) {
  'use strict';
  var SB = root.SB = root.SB || {};

  var INK = '#25304F';
  var uid = 0;

  /* mood: idle | happy | sad | listening | wink */
  function bee(mood, extraClass) {
    mood = mood || 'idle';
    var id = 'bee' + (++uid);
    var eyes, mouth, extras = '';

    if (mood === 'happy') {
      eyes = '<path d="M84 68 Q90 59 96 68" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>' +
             '<path d="M102 68 Q108 59 114 68" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
      mouth = '<path d="M90 76 Q99 94 108 76 Z" fill="#B3263E" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
              '<path d="M94 84 Q99 90 104 84 Q99 81 94 84 Z" fill="#FF8FA3"/>';
    } else if (mood === 'sad') {
      eyes = '<ellipse cx="90" cy="68" rx="4.5" ry="6" fill="' + INK + '"/><ellipse cx="108" cy="68" rx="4.5" ry="6" fill="' + INK + '"/>' +
             '<circle cx="91.6" cy="66" r="1.8" fill="#fff"/><circle cx="109.6" cy="66" r="1.8" fill="#fff"/>' +
             '<path d="M82 62 L94 56" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
             '<path d="M116 62 L104 56" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>';
      mouth = '<path d="M92 84 Q99 76 106 84" fill="none" stroke="' + INK + '" stroke-width="3.2" stroke-linecap="round"/>';
      extras = '<path d="M83 76 q-4 7 0 10 q4 -3 0 -10 z" fill="#7CC8F0" stroke="#4BA3D4" stroke-width="1.5"/>';
    } else if (mood === 'wink') {
      eyes = '<ellipse cx="90" cy="67" rx="4.5" ry="6" fill="' + INK + '"/><circle cx="91.6" cy="65" r="1.8" fill="#fff"/>' +
             '<path d="M102 68 Q108 62 114 68" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
      mouth = '<path d="M91 77 Q99 87 107 77" fill="none" stroke="' + INK + '" stroke-width="3.2" stroke-linecap="round"/>';
    } else {
      eyes = '<ellipse cx="90" cy="67" rx="4.5" ry="6.4" fill="' + INK + '"/><ellipse cx="108" cy="67" rx="4.5" ry="6.4" fill="' + INK + '"/>' +
             '<circle cx="91.7" cy="64.8" r="1.9" fill="#fff"/><circle cx="109.7" cy="64.8" r="1.9" fill="#fff"/>';
      mouth = mood === 'listening'
        ? '<ellipse cx="99" cy="80" rx="4.5" ry="5" fill="#B3263E" stroke="' + INK + '" stroke-width="2.6"/>'
        : '<path d="M92 77 Q99 85 106 77" fill="none" stroke="' + INK + '" stroke-width="3.2" stroke-linecap="round"/>';
    }
    if (mood === 'listening') {
      extras += '<g class="ears" fill="none" stroke="#FF8A5B" stroke-width="3.5" stroke-linecap="round">' +
        '<path class="ear e1" d="M127 58 q6 8 0 16"/><path class="ear e2" d="M133 52 q10 14 0 28"/></g>';
    }

    return '<svg class="mascot bee mood-' + mood + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<g class="bee-all">' +
        '<g class="wing-g wing-back" style="transform-origin:58px 54px"><ellipse cx="50" cy="32" rx="15" ry="27" transform="rotate(-26 50 32)" fill="#DDF3FC" stroke="#6FB9DC" stroke-width="3.2"/></g>' +
        '<g class="wing-g wing-front" style="transform-origin:72px 54px"><ellipse cx="76" cy="28" rx="15" ry="28" transform="rotate(16 76 28)" fill="#E9F8FE" stroke="#6FB9DC" stroke-width="3.2"/></g>' +
        '<path d="M22 80 L5 86 L20 69 Z" fill="' + INK + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<clipPath id="' + id + '"><ellipse cx="58" cy="78" rx="38" ry="28"/></clipPath>' +
        '<ellipse cx="58" cy="78" rx="38" ry="28" fill="#FFC93C"/>' +
        '<g clip-path="url(#' + id + ')"><rect x="34" y="40" width="11" height="80" fill="' + INK + '"/><rect x="56" y="40" width="11" height="80" fill="' + INK + '"/></g>' +
        '<ellipse cx="58" cy="78" rx="38" ry="28" fill="none" stroke="' + INK + '" stroke-width="4"/>' +
        '<path d="M42 104 v6 M70 104 v6" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M89 44 C86 29 78 25 72 28" fill="none" stroke="' + INK + '" stroke-width="3.6" stroke-linecap="round"/><circle cx="71" cy="28" r="4.4" fill="' + INK + '"/>' +
        '<path d="M106 44 C108 29 116 24 122 27" fill="none" stroke="' + INK + '" stroke-width="3.6" stroke-linecap="round"/><circle cx="123" cy="27.5" r="4.4" fill="' + INK + '"/>' +
        '<circle cx="98" cy="68" r="26" fill="#FFD866" stroke="' + INK + '" stroke-width="4"/>' +
        eyes +
        '<circle cx="82" cy="78" r="5.4" fill="#FF9AA2" opacity=".85"/><circle cx="116" cy="78" r="5.4" fill="#FF9AA2" opacity=".85"/>' +
        mouth + extras +
      '</g></svg>';
  }

  function ladybird(mood, extraClass) {
    mood = mood || 'idle';
    var eyes, mouth, extras = '';
    var eyeWhite = function (cx) { return '<ellipse cx="' + cx + '" cy="67" rx="6.4" ry="7.6" fill="#fff"/>'; };
    if (mood === 'happy') {
      eyes = '<path d="M90 68 Q97 58 104 68" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>' +
             '<path d="M108 68 Q115 58 122 68" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>';
      mouth = '<path d="M98 78 Q106 95 114 78 Z" fill="#B3263E" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>';
    } else if (mood === 'sad') {
      eyes = eyeWhite(97) + eyeWhite(115) +
        '<circle cx="98" cy="70" r="3.4" fill="' + INK + '"/><circle cx="116" cy="70" r="3.4" fill="' + INK + '"/>' +
        '<path d="M89 61 L101 55" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M123 61 L111 55" stroke="#fff" stroke-width="3" stroke-linecap="round"/>';
      mouth = '<path d="M99 86 Q106 78 113 86" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>';
    } else if (mood === 'wink') {
      eyes = eyeWhite(97) + '<circle cx="98.5" cy="68.5" r="3.6" fill="' + INK + '"/><circle cx="99.6" cy="67" r="1.2" fill="#fff"/>' +
             '<path d="M108 68 Q115 61 122 68" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>';
      mouth = '<path d="M98 79 Q106 89 114 79" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>';
    } else {
      eyes = eyeWhite(97) + eyeWhite(115) +
        '<circle cx="98.6" cy="68.5" r="3.6" fill="' + INK + '"/><circle cx="116.6" cy="68.5" r="3.6" fill="' + INK + '"/>' +
        '<circle cx="99.8" cy="67" r="1.2" fill="#fff"/><circle cx="117.8" cy="67" r="1.2" fill="#fff"/>';
      mouth = '<path d="M98 79 Q106 88 114 79" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>';
    }

    return '<svg class="mascot ladybird mood-' + mood + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<g class="lady-all">' +
        '<path d="M30 100 l-6 10 M52 106 v10 M76 106 v10 M96 100 l6 10" stroke="' + INK + '" stroke-width="4" stroke-linecap="round" fill="none"/>' +
        '<path d="M96 46 C94 32 88 26 82 26" fill="none" stroke="' + INK + '" stroke-width="3.6" stroke-linecap="round"/><circle cx="81" cy="26" r="4.4" fill="' + INK + '"/>' +
        '<path d="M116 46 C118 32 124 26 130 27" fill="none" stroke="' + INK + '" stroke-width="3.6" stroke-linecap="round"/><circle cx="131" cy="27" r="4.4" fill="' + INK + '"/>' +
        '<ellipse cx="58" cy="76" rx="44" ry="34" fill="#E5383B" stroke="' + INK + '" stroke-width="4"/>' +
        '<path d="M58 43 L58 109" stroke="' + INK + '" stroke-width="3.6" stroke-linecap="round"/>' +
        '<path d="M30 56 Q38 50 46 56" fill="none" stroke="#FF8A8C" stroke-width="3.2" stroke-linecap="round" opacity=".9"/>' +
        '<circle cx="38" cy="72" r="7" fill="' + INK + '"/><circle cx="76" cy="62" r="7" fill="' + INK + '"/>' +
        '<circle cx="34" cy="92" r="5.6" fill="' + INK + '"/><circle cx="78" cy="90" r="6.2" fill="' + INK + '"/><circle cx="58" cy="100" r="0" fill="' + INK + '"/>' +
        '<circle cx="106" cy="70" r="27" fill="' + INK + '"/>' +
        eyes +
        '<circle cx="90" cy="80" r="5.4" fill="#FF9AA2" opacity=".9"/><circle cx="124" cy="80" r="5.4" fill="#FF9AA2" opacity=".9"/>' +
        mouth + extras +
      '</g></svg>';
  }

  var ICONS = {
    speaker: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<path d="M9 25h11l15-13v40L20 39H9z" fill="#FFC93C" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M43 24q6 8 0 16" fill="none" stroke="#E5383B" stroke-width="4.5" stroke-linecap="round"/>' +
      '<path d="M49 16q12 16 0 32" fill="none" stroke="#E5383B" stroke-width="4.5" stroke-linecap="round"/></svg>',
    book: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<path d="M12 9h34a5 5 0 0 1 5 5v36H17a5 5 0 0 0-5 5z" fill="#3DA35D" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M12 55a5 5 0 0 1 5-5h34v5H17" fill="#FFF8E7" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>' +
      '<text x="31" y="38" text-anchor="middle" font-family="Fredoka, ui-rounded, sans-serif" font-weight="700" font-size="22" fill="#FFF8E7">Aa</text></svg>',
    keyboard: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="4" y="12" width="40" height="25" rx="5" fill="none" stroke="currentColor" stroke-width="3.4"/><path d="M11 20h3M18 20h3M25 20h3M32 20h3M11 27h3M34 27h3M18 29h12" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>',
    backspace: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M17 11h24a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H17L5 24z" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linejoin="round"/><path d="M24 18l10 12M34 18L24 30" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>',
    restart: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M38 24a14 14 0 1 1-4.5-10.3" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/><path d="M36 6v9h-9" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    upload: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M24 33V10M14 19l10-10 10 10M8 34v5a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2v-5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    download: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M24 8v23M14 22l10 10 10-10M8 34v5a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2v-5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M24 10v28M10 24h28" stroke="currentColor" stroke-width="4.4" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M13 13l22 22M35 13L13 35" stroke="currentColor" stroke-width="4.4" stroke-linecap="round"/></svg>',
    home: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M7 22L24 8l17 14v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round"/><path d="M19 41V28h10v13" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round"/></svg>',
    trophy: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M14 8h20v12a10 10 0 0 1-20 0zM14 12H7c0 8 3 11 8 12M34 12h7c0 8-3 11-8 12M24 30v8M16 40h16" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gear: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="6.5" fill="none" stroke="currentColor" stroke-width="3.6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11.3 11.3l4.2 4.2M32.5 32.5l4.2 4.2M36.7 11.3l-4.2 4.2M15.5 32.5l-4.2 4.2" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/></svg>',
    honey: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M14 14h20l3 6v18a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V20z" fill="#FFC93C" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><rect x="13" y="8" width="22" height="7" rx="2.5" fill="#FFF8E7" stroke="' + INK + '" stroke-width="3"/><path d="M24 24l4 2.3v4.6L24 33.2l-4-2.3v-4.6z" fill="#FFF8E7" stroke="' + INK + '" stroke-width="2"/></svg>',
    flower: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g fill="#FF9AA2" stroke="' + INK + '" stroke-width="2.6"><circle cx="24" cy="12" r="6.5"/><circle cx="36" cy="22" r="6.5"/><circle cx="31" cy="35" r="6.5"/><circle cx="17" cy="35" r="6.5"/><circle cx="12" cy="22" r="6.5"/></g><circle cx="24" cy="24" r="6.5" fill="#FFC93C" stroke="' + INK + '" stroke-width="2.6"/></svg>',
    oops: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="17" fill="#FFE3E0" stroke="' + INK + '" stroke-width="3"/><circle cx="17" cy="21" r="2.6" fill="' + INK + '"/><circle cx="31" cy="21" r="2.6" fill="' + INK + '"/><path d="M16 34q8-8 16 0" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/></svg>',
    fire: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M25 5c1 8 10 12 10 22a11 11 0 0 1-22 0c0-5 3-8 5-11 1 3 2 4 4 4 1-4 1-9 3-15z" fill="#FF8A5B" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M24 42a5.5 5.5 0 0 1-5.500-5.500c0-3 2.500-4.500 3.500-7 3 2 7.500 4 7.500 7a5.500 5.500 0 0 1-5.500 5.500z" fill="#FFC93C"/></svg>',
    star: '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M24 5l5.600 11.500 12.600 1.800-9.100 8.900 2.200 12.600L24 33.800 12.700 39.800l2.200-12.600-9.100-8.900 12.600-1.800z" fill="#FFC93C" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/></svg>'
  };

  SB.Mascots = {
    bee: bee,
    ladybird: ladybird,
    icon: function (name) { return ICONS[name] || ''; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
