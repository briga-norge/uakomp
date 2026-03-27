/**
 * SCORM 1.2 API Wrapper
 * Handles communication with the Moodle LMS via the SCORM 1.2 API
 */

var SCORM = (function () {
  var _api = null;
  var _initialized = false;
  var _data = {};

  // Find the SCORM API in parent frames
  function findAPI(win) {
    var attempts = 0;
    while (win.API == null && win.parent != null && win.parent != win) {
      attempts++;
      if (attempts > 10) return null;
      win = win.parent;
    }
    return win.API || null;
  }

  function getAPI() {
    if (_api) return _api;
    _api = findAPI(window);
    if (!_api && window.opener) _api = findAPI(window.opener);
    return _api;
  }

  function init() {
    var api = getAPI();
    if (!api) { console.warn('SCORM API not found – running in standalone mode'); return false; }
    var result = api.LMSInitialize('');
    _initialized = (result === 'true' || result === true);
    if (_initialized) {
      // Set lesson status to incomplete on start if not already passed
      var status = getValue('cmi.core.lesson_status');
      if (status !== 'passed' && status !== 'completed') {
        setValue('cmi.core.lesson_status', 'incomplete');
      }
    }
    return _initialized;
  }

  function getValue(key) {
    var api = getAPI();
    if (!api || !_initialized) return _data[key] || '';
    return api.LMSGetValue(key);
  }

  function setValue(key, value) {
    var api = getAPI();
    _data[key] = value;
    if (!api || !_initialized) return false;
    return api.LMSSetValue(key, value);
  }

  function commit() {
    var api = getAPI();
    if (!api || !_initialized) return false;
    return api.LMSCommit('');
  }

  function finish() {
    var api = getAPI();
    if (!api || !_initialized) return false;
    commit();
    return api.LMSFinish('');
  }

  // Set score (raw 0-100, min 0, max 100) and update lesson status
  function setScore(raw, min, max) {
    min = min || 0;
    max = max || 100;
    setValue('cmi.core.score.raw', raw);
    setValue('cmi.core.score.min', min);
    setValue('cmi.core.score.max', max);

    // SCORM 1.2 mastery score is set in manifest as 70
    var mastery = 70;
    if (raw >= mastery) {
      setValue('cmi.core.lesson_status', 'passed');
    } else {
      setValue('cmi.core.lesson_status', 'failed');
    }
    commit();
  }

  function setCompleted() {
    setValue('cmi.core.lesson_status', 'completed');
    commit();
  }

  // Track time spent
  var _startTime = new Date();
  function getSessionTime() {
    var elapsed = Math.floor((new Date() - _startTime) / 1000);
    var h = Math.floor(elapsed / 3600);
    var m = Math.floor((elapsed % 3600) / 60);
    var s = elapsed % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function finalise(score) {
    setValue('cmi.core.session_time', getSessionTime());
    if (score !== undefined) setScore(score);
    finish();
  }

  // Public API
  return { init: init, getValue: getValue, setValue: setValue, commit: commit, finish: finish, setScore: setScore, setCompleted: setCompleted, finalise: finalise };
})();

// Auto-init and auto-finish on unload
window.addEventListener('load', function () { SCORM.init(); });
window.addEventListener('beforeunload', function () { SCORM.finish(); });
