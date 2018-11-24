import { sol } from './sol.js';

var timeFormat = ['h:mm A', '-:-- --'];
//var timeFormat = ['HH:mm', '--:--'];

var obs, now, noons, times, dial;

navigator.geolocation.getCurrentPosition(function (pos) {
  obs = { lat: pos.coords.latitude, lon: pos.coords.longitude };
  now = new Date();
  noons = findNoons(now, obs);
  times = sol.findTimes(noons[0], obs);

  dial = setDial();
  setArcs(dial, times);
  setSun(dial, times, now);
  showTimes(times);
  showDay(times, now);
});

setInterval(function () {
  navigator.geolocation.getCurrentPosition(function (pos) {
    obs = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    var n = new Date();

    if (n.getMinutes() !== now.getMinutes()) {
      var t = n.valueOf();

      if (t - noons[0] > noons[1] - t) {
        noons = [noons[1], sol.findNoon(noons[1] + 86400000, obs)];
      }

      if (times.noon !== noons[0] || n.getTimezoneOffset() !== now.getTimezoneOffset()) {
        times = sol.findTimes(noons[0], obs);
        setArcs(dial, times);
        showTimes(times);
      }

      setSun(dial, times, n);
      showDay(times, n);
    }

    now = n;
  });
}, 1000);

function findNoons(date, observer) {
  var current = date.valueOf();
  var noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).valueOf();
  noon = sol.findNoon(noon, observer);
  var difference = current - noon;

  if (difference < 0) {
    var previousNoon = sol.findNoon(noon - 86400000, observer);

    if (previousNoon - current > difference) {
      return [previousNoon, noon];
    }
    else {
      return [noon, sol.findNoon(noon + 86400000, observer)];
    }
  }
  else {
    var nextNoon = sol.findNoon(noon + 86400000, observer);

    if (nextNoon - current > difference) {
      return [noon, nextNoon];
    }
    else {
      return [nextNoon, sol.findNoon(nextNoon + 86400000, observer)];
    }
  }
}

function ratioToX(dial, radius, ratio) {
  return dial.cx - Math.sin(2 * Math.PI * ratio) * radius;
}

function ratioToY(dial, radius, ratio) {
  return dial.cy + Math.cos(2 * Math.PI * ratio) * radius;
}

function setDial() {
  var svg = document.querySelector('svg');
  var svgStyle = getComputedStyle(svg);
  var w = parseInt(svgStyle.getPropertyValue('width'), 10);
  var h = parseInt(svgStyle.getPropertyValue('height'), 10);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  var cx = w * 0.5;
  var cy = h * 0.5;
  var or = w * 0.4;
  var ir = or * 2 / 3;

  var face = document.querySelector('#face');
  var facePath = `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} z M ${cx} ${cy} m 0 ${-or} a ${-or} ${-or} 0 1 0 0.001 0 z m 0 ${or - ir} z a ${ir} ${ir} 0 1 1 -0.001 0 z`;
  face.setAttribute('d', facePath);

  return {
    cx: cx,
    cy: cy,
    r: or
  };
}

function setArcs(dial, times) {
  var civilArc = document.querySelector('#civil-arc');
  setArcPath(dial, civilArc, times.ratio('startDawn'), times.ratio('endDusk'));

  var dayArc = document.querySelector('#day-arc');
  setArcPath(dial, dayArc, times.ratio('startRise'), times.ratio('endSet'));
}

function setArcPath(dial, arc, fromRatio, toRatio) {
  var ar = dial.r * 1.1;

  if (fromRatio === 0 && toRatio === 1) {
    arc.setAttribute('d', `M ${dial.cx} ${dial.cy} m 0 ${-ar} a ${-ar} ${-ar} 0 1 0 0.001 0 z`);
  }
  else if (fromRatio === toRatio) {
    arc.setAttribute('d', '');
  }
  else {
    var x0 = ratioToX(dial, ar, fromRatio);
    var y0 = ratioToY(dial, ar, fromRatio);
    var x1 = ratioToX(dial, ar, toRatio);
    var y1 = ratioToY(dial, ar, toRatio);
    var la = toRatio - fromRatio >= 0.5 ? 1 : 0;

    var d = `M ${x0} ${y0} A ${ar} ${ar} 0 ${la} 1 ${x1} ${y1} L ${dial.cx} ${dial.cy} z`;
    arc.setAttribute('d', d);
  }
}

function setSun(dial, times, date) {
  var sun = document.querySelector('#sun');
  var sunDilate = document.querySelector('#sun-dilate');
  var sunBlur = document.querySelector('#sun-blur');

  var t = date.valueOf();
  sun.setAttribute('r', dial.r * 0.05);

  var sr = dial.r * 5 / 6;
  var ratio = times.ratio(t);
  sun.setAttribute('cx', ratioToX(dial, sr, ratio));
  sun.setAttribute('cy', ratioToY(dial, sr, ratio));

  var r;

  if (t < times.startDawn || times.endDusk < t) {
    sun.setAttribute('fill', 'hsl(60, 0%, 90%)');
    sunDilate.setAttribute('radius', 0);
    sunBlur.setAttribute('stdDeviation', 0);
  }
  else if (t < times.startRise) {
    r = (t - times.startDawn) / (times.startRise - times.startDawn);
    sun.setAttribute('fill', `hsl(60, ${95 * r}%, ${70 + 20 * (1 - r)}%)`);
    sunDilate.setAttribute('radius', 0);
    sunBlur.setAttribute('stdDeviation', 0);
  }
  else if (t < times.endRise) {
    r = (t - times.startRise) / (times.endRise - times.startRise);
    sun.setAttribute('fill', 'hsl(60, 95%, 70%)');
    sunDilate.setAttribute('radius', 2 * r);
    sunBlur.setAttribute('stdDeviation', 4 * r);
  }
  else if (t < times.startSet) {
    sun.setAttribute('fill', 'hsl(60, 95%, 70%)');
    sunDilate.setAttribute('radius', 2);
    sunBlur.setAttribute('stdDeviation', 4);
  }
  else if (t < times.endSet) {
    r = (times.endSet - t) / (times.endSet - times.startSet);
    sun.setAttribute('fill', 'hsl(60, 95%, 70%)');
    sunDilate.setAttribute('radius', 2 * r);
    sunBlur.setAttribute('stdDeviation', 4 * r);
  }
  else if (t < times.endDusk) {
    r = (times.endDusk - t) / (times.endDusk - times.endSet);
    sun.setAttribute('fill', `hsl(60, ${95 * r}%, ${70 + 20 * (1 - r)}%)`);
    sunDilate.setAttribute('radius', 0);
    sunBlur.setAttribute('stdDeviation', 0);
  }
}

function formatTime(time) {
  return time ? moment(time).format(timeFormat[0]) : timeFormat[1];
}

function formatDuration(duration) {
  var s = Math.round(duration * 0.001);
  var h = Math.floor(s / 3600);
  var m = Math.round((s - h * 3600) / 60);

  if (m == 60) {
    m = 0;
    h += 1;
  }

  m = ('0' + m).slice(-2);
  return `${h}:${m}`;
}

function setText(id, value) {
  document.querySelector('#' + id).innerHTML = value;
}

function showTimes(times) {
  var dawn = !times.noDawn ? times.startDawn : null;
  var rise = !times.noRise ? times.startRise : null;
  var set = !times.noSet ? times.endSet : null;
  var dusk = !times.noDusk ? times.endDusk : null;

  setText('rise-time', formatTime(rise));
  setText('noon-time', formatTime(times.noon));
  setText('set-time', formatTime(set));
  setText('dawn-time', formatTime(dawn));
  setText('midnight-time', formatTime(times.startMidnight));
  setText('dusk-time', formatTime(dusk));
}

function showDay(times, date) {
  var t = date.valueOf();
  var d, p;

  if (times.startDawn <= t && t <= times.endDusk) {
    setText('day-type', 'Day<br/>Remaining');
    d = times.endDusk - t;
    p = Math.round(d * 100 / (times.endDusk - times.startDawn));
  }
  else {
    setText('day-type', 'Night<br/>Remaining');
    var d0 = times.startDawn - times.startMidnight;
    d = t < times.startDawn ? times.startDawn - t : d0 + times.endMidnight - t;
    p = Math.round(d * 100 / (d0 + times.endMidnight - times.endDusk));
  }

  setText('day-time', formatDuration(d));
  setText('day-percent', p + '%');
}
