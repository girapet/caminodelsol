import sol from './sol.js';

let now;
let noons;
let times;
let dial;
let mode = '';

const format = (() => {
  const dtf = new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric' });
  const noTime = dtf.format(new Date(2000, 0, 1, 1, 1)).replace(/[^:\s]/g, '-');

  return {
    time(x) {
      return x ? dtf.format(new Date(x)) : noTime;
    },

    duration(x) {
      const s = x * 0.001;
      let h = Math.floor(s / 3600);
      let m = Math.round((s - h * 3600) / 60);

      if (m === 60) {
        m = 0;
        h += 1;
      }

      const mm = `0${m}`.slice(-2);
      return `${h}:${mm}`;
    }
  };
})();

const getObserver = () => new Promise((resolve) => {
  navigator.geolocation.getCurrentPosition((pos) => {
    resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
  });
});

const intialNoons = (observer) => {
  const current = now.valueOf();
  let noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).valueOf();
  noon = sol.findNoon(noon, observer);
  const difference = current - noon;

  if (difference < 0) {
    const previousNoon = sol.findNoon(noon - 86400000, observer);

    if (previousNoon - current > difference) {
      return [previousNoon, noon];
    }

    return [noon, sol.findNoon(noon + 86400000, observer)];
  }

  const nextNoon = sol.findNoon(noon + 86400000, observer);

  if (nextNoon - current > difference) {
    return [noon, nextNoon];
  }

  return [nextNoon, sol.findNoon(nextNoon + 86400000, observer)];
};

const ratioToX = (radius, ratio) => dial.cx - Math.sin(2 * Math.PI * ratio) * radius;
const ratioToY = (radius, ratio) => dial.cy + Math.cos(2 * Math.PI * ratio) * radius;

const setDial = () => {
  const svg = document.querySelector('svg');
  const svgStyle = getComputedStyle(svg);
  const w = parseInt(svgStyle.getPropertyValue('width'), 10);
  const h = parseInt(svgStyle.getPropertyValue('height'), 10);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  const cx = w * 0.5;
  const cy = h * 0.5;
  const or = Math.min(w, h) * 0.4;
  const ir = or * 2 / 3;

  const face = document.querySelector('#face');
  const facePath = `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} z M ${cx} ${cy} m 0 ${-or} a ${-or} ${-or} 0 1 0 0.001 0 z m 0 ${or - ir} z a ${ir} ${ir} 0 1 1 -0.001 0 z`;
  face.setAttribute('d', facePath);

  return { cx, cy, r: or };
};

const setArcPath = (arc, fromRatio, toRatio) => {
  const ar = dial.r * 1.1;

  if (fromRatio === 0 && toRatio === 1) {
    arc.setAttribute('d', `M ${dial.cx} ${dial.cy} m 0 ${-ar} a ${-ar} ${-ar} 0 1 0 0.001 0 z`);
  }
  else if (fromRatio === toRatio) {
    arc.setAttribute('d', '');
  }
  else {
    const x0 = ratioToX(ar, fromRatio);
    const y0 = ratioToY(ar, fromRatio);
    const x1 = ratioToX(ar, toRatio);
    const y1 = ratioToY(ar, toRatio);
    const la = toRatio - fromRatio >= 0.5 ? 1 : 0;

    const d = `M ${x0} ${y0} A ${ar} ${ar} 0 ${la} 1 ${x1} ${y1} L ${dial.cx} ${dial.cy} z`;
    arc.setAttribute('d', d);
  }
};

const setArcs = () => {
  const civilArc = document.querySelector('#civil-arc');
  setArcPath(civilArc, times.ratio('startDawn'), times.ratio('endDusk'));

  const dayArc = document.querySelector('#day-arc');
  setArcPath(dayArc, times.ratio('startRise'), times.ratio('endSet'));
};

const setSun = () => {
  const sun = document.querySelector('#sun');
  const sunDilate = document.querySelector('#sun-dilate');
  const sunBlur = document.querySelector('#sun-blur');

  const t = now.valueOf();
  sun.setAttribute('r', dial.r * 0.07);

  const sr = dial.r * 5 / 6;
  const ratio = times.ratio(t);
  sun.setAttribute('cx', ratioToX(sr, ratio));
  sun.setAttribute('cy', ratioToY(sr, ratio));

  let r;

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
};

const setHtml = (id, value) => {
  document.querySelector(`#${id}`).innerHTML = value;
};

const showLabelValues = (label, value1, value2 = '') => {
  setHtml('data-label', label);
  setHtml('data-value1', value1);
  setHtml('data-value2', value2);
};

const showRemaining = () => {
  const t = now.valueOf();
  const isPessimistic = mode === 'Day<br/>Remaining';
  const startTime = isPessimistic ? times.startRise : times.startDawn;
  const endTime = isPessimistic ? times.endSet : times.endDusk;

  let label = mode;
  let d;
  let p;

  if (startTime <= t && t <= endTime) {
    d = endTime - t;
    p = Math.round(d * 100 / (endTime - startTime));
  }
  else {
    label = isPessimistic ? 'Night + Twilight<br/>Remaining' : 'Night<br/>Remaining';
    const d0 = startTime - times.startMidnight;
    d = t < startTime ? startTime - t : d0 + endTime - t;
    p = Math.round(d * 100 / (d0 + times.endMidnight - endTime));
  }

  showLabelValues(label, format.duration(d), `${p}%`);
};

const showLocalSolarTime = () => {
  const date = new Date(now.getYear(), now.getMonth(), now.getDate()).valueOf();
  let t = now.valueOf();
  t = date + 86400000 * (t - times.startMidnight) / times.dayLength;
  showLabelValues(mode, format.time(t));
};

const showData = () => {
  switch (mode) {
    case 'Midnight': showLabelValues(mode, format.time(times.startMidnight)); break;
    case 'Begin Twilight': showLabelValues(mode, format.time(times.startDawn)); break;
    case 'Sunrise': showLabelValues(mode, format.time(times.startRise)); break;
    case 'Noon': showLabelValues(mode, format.time(times.noon)); break;
    case 'Sunset': showLabelValues(mode, format.time(times.endSet)); break;
    case 'End Twilight': showLabelValues(mode, format.time(times.endDusk)); break;
    case 'Day + Twilight': showLabelValues(mode, format.duration(times.endDusk - times.startDawn)); break;
    case 'Day': showLabelValues(mode, format.duration(times.endSet - times.startRise)); break;
    case 'Night': showLabelValues(mode, format.duration((times.startDawn - times.startMidnight) + (times.endMidnight - times.endDusk))); break;
    case 'Night + Twilight': showLabelValues(mode, format.duration((times.startRise - times.startMidnight) + (times.endMidnight - times.endSet))); break;
    case 'Local<br/>Solar Time': showLocalSolarTime(); break;

    case 'Day + Twilight<br/>Remaining':
    case 'Day<br/>Remaining':
      showRemaining();
      break;

    default: showLabelValues('', ''); break;
  }
};

// events

document.querySelector('#night-rect').addEventListener('click', (e) => {
  const dx = dial.cx - e.x;
  const dy = dial.cy - e.y;

  const ratio = 0.5 + Math.atan2(-dx, dy) / (Math.PI * 2);
  const t = times.startMidnight + ratio * times.dayLength;
  let newMode = 'Midnight';

  if ((times.startMidnight + times.startDawn) * 0.5 <= t && t < (times.startDawn + times.startRise) * 0.5) {
    newMode = 'Begin Twilight';
  }
  else if ((times.startDawn + times.startRise) * 0.5 <= t && t < (times.startRise + times.noon) * 0.5) {
    newMode = 'Sunrise';
  }
  else if ((times.startRise + times.noon) * 0.5 <= t && t < (times.noon + times.endSet) * 0.5) {
    newMode = 'Noon';
  }
  else if ((times.noon + times.endSet) * 0.5 <= t && t < (times.endSet + times.endDusk) * 0.5) {
    newMode = 'Sunset';
  }
  else if ((times.endSet + times.endDusk) * 0.5 <= t && t < (times.endDusk + times.endMidnight) * 0.5) {
    newMode = 'End Twilight';
  }
  else {
    newMode = 'Midnight';
  }

  mode = newMode !== mode ? newMode : '';
  showData();
});

document.querySelector('#sun').addEventListener('click', () => {
  const lst = 'Local<br/>Solar Time';
  mode = lst !== mode ? lst : '';
  showData();
});

document.querySelector('#face').addEventListener('click', (e) => {
  const dx = dial.cx - e.x;
  const dy = dial.cy - e.y;
  const r = Math.sqrt(dx * dx + dy * dy);
  let newMode;

  if (r < dial.r) {
    newMode = e.x < dial.cx ? 'Day + Twilight<br/>Remaining' : 'Day<br/>Remaining';
  }
  else if (e.y <= dial.cy) {
    newMode = e.x < dial.cx ? 'Day + Twilight' : 'Day';
  }
  else {
    newMode = e.x < dial.cx ? 'Night' : 'Night + Twilight';
  }

  mode = newMode !== mode ? newMode : '';
  showData();
});

window.addEventListener('resize', () => {
  dial = setDial();
  setArcs();
  setSun();
});

// startup

getObserver().then((observer) => {
  now = new Date();
  noons = intialNoons(observer);
  times = sol.findTimes(noons[0], observer);

  dial = setDial();
  setArcs();
  setSun();
  showData();
});

setInterval(async () => {
  const n = new Date();
  const newMinute = n.getMinutes() !== now.getMinutes();
  now = n;

  if (newMinute) {
    const observer = await getObserver();
    const t = now.valueOf();

    if (t - noons[0] > noons[1] - t) {
      noons = [noons[1], sol.findNoon(noons[1] + 86400000, observer)];
    }

    if (times.noon !== noons[0] || n.getTimezoneOffset() !== now.getTimezoneOffset()) {
      times = sol.findTimes(noons[0], observer);
      setArcs();
    }

    setSun();
    showData();
  }
}, 1000);
