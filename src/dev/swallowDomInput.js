// Stop a floating HTML overlay's input from falling through to the Phaser game beneath it.
//
// Phaser (3.90) hooks its MOUSE and TOUCH listeners onto `window` and deliberately
// processes any event whose target ISN'T the canvas — i.e. events on an HTML overlay —
// so the game keeps tracking the pointer when it leaves the canvas. The side effect: a
// click or slider-drag on a floating dev panel bubbles up to those window listeners, which
// hit-test the sprite behind the panel and dissect/customise it. The listeners are
// bubble-phase, so stopping the event at the overlay before it reaches `window` fixes it.
//
// Crucially Phaser uses mouse/touch events, NOT pointer events — stopping only
// pointer*/click (as we first did) misses the events that actually leak. We swallow a
// superset for safety. stopPropagation (never preventDefault) leaves the panel's own
// sliders/buttons/drag fully working — those run in the target phase first.
const SWALLOW = [
  'mousedown', 'mouseup', 'mousemove',
  'touchstart', 'touchmove', 'touchend', 'touchcancel',
  'pointerdown', 'pointerup', 'pointermove',
  'click', 'dblclick', 'wheel', 'contextmenu',
];

export function swallowDomInput(el) {
  for (const ev of SWALLOW) el.addEventListener(ev, (e) => e.stopPropagation());
}
