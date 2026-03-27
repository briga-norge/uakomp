(function () {
  var TOTAL_LESSONS = 14;
  var api = null;
  var initialized = false;
  var terminated = false;

  function findAPI(win) {
    var tries = 0;
    while (win && tries < 20) {
      try {
        if (win.API) return win.API;
        if (win.parent && win.parent !== win) win = win.parent;
        else break;
      } catch (e) {
        break;
      }
      tries += 1;
    }
    return null;
  }

  function initScorm() {
    if (initialized) return true;
    api = findAPI(window) || findAPI(window.opener);
    if (!api) return false;
    var ok = api.LMSInitialize("");
    initialized = ok === "true" || ok === true;
    if (initialized) {
      try {
        var status = api.LMSGetValue("cmi.core.lesson_status");
        if (!status || status === "not attempted") {
          api.LMSSetValue("cmi.core.lesson_status", "incomplete");
        }
        api.LMSSetValue("cmi.core.exit", "suspend");
        api.LMSCommit("");
      } catch (e) {}
    }
    return initialized;
  }

  function finishScorm() {
    if (!initialized || terminated || !api) return;
    try {
      api.LMSCommit("");
      api.LMSFinish("");
      terminated = true;
    } catch (e) {}
  }

  function getSuspendData() {
    if (!initScorm() || !api) return null;
    try {
      return api.LMSGetValue("cmi.suspend_data") || null;
    } catch (e) {
      return null;
    }
  }

  function setSuspendData(value) {
    if (!initScorm() || !api) return;
    try {
      api.LMSSetValue("cmi.suspend_data", value);
      var parsed = null;
      try { parsed = JSON.parse(value); } catch (e) {}
      if (parsed && parsed.prog) {
        var done = Object.keys(parsed.prog).filter(function (k) {
          return (parsed.prog[k] || 0) > 0;
        }).length;
        var score = Math.max(0, Math.min(100, Math.round((done / TOTAL_LESSONS) * 100)));
        api.LMSSetValue("cmi.core.score.min", "0");
        api.LMSSetValue("cmi.core.score.max", "100");
        api.LMSSetValue("cmi.core.score.raw", String(score));
        api.LMSSetValue("cmi.core.lesson_status", done >= TOTAL_LESSONS ? "completed" : (done > 0 ? "incomplete" : "not attempted"));
      }
      api.LMSSetValue("cmi.core.exit", "suspend");
      api.LMSCommit("");
    } catch (e) {}
  }

  window.__scorm12 = {
    init: initScorm,
    finish: finishScorm,
    getSuspendData: getSuspendData,
    setSuspendData: setSuspendData,
  };

  window.storage = {
    get: async function (key) {
      var scormValue = getSuspendData();
      if (scormValue) {
        try { window.localStorage.setItem(key, scormValue); } catch (e) {}
        return { value: scormValue };
      }
      try {
        var local = window.localStorage.getItem(key);
        return local === null ? null : { value: local };
      } catch (e) {
        return null;
      }
    },
    set: async function (key, value) {
      try { window.localStorage.setItem(key, value); } catch (e) {}
      setSuspendData(value);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScorm);
  } else {
    initScorm();
  }
  window.addEventListener("beforeunload", finishScorm);
  window.addEventListener("pagehide", finishScorm);
})();
