// sources:
//
//  Paul Schlyter, How to compute planetary positions
//    http://www.stjarnhimlen.se/comp/ppcomp.html
//
//  Jean Meeus, Astronomical Algorithms (1st edition)
//    Willmann-Bell, 1991

// trigonometric functions in degrees

const radiansPerDegree = Math.PI / 180;
const degreesPerRadian = 180 / Math.PI;

const cosd = x => Math.cos(x * radiansPerDegree);
const sind = x => Math.sin(x * radiansPerDegree);
const acosd = x => Math.acos(x) * degreesPerRadian;
const asind = x => Math.asin(x) * degreesPerRadian;
const atan2d = (x, y) => Math.atan2(y, x) * degreesPerRadian;

const rev = x => {
  x = x % 360;
  return x >= 0 ? x : x + 360;
};

const rev180 = x => {
  x = rev(x);
  return x <= 180 ? x : x - 360;
};

// point conversion

const rectToPolar = r => ({
  lon: rev(atan2d(r.x, r.y)),
  lat: atan2d(Math.sqrt(r.x * r.x + r.y * r.y), r.z)
});

// epoch time functions

const epoch = Date.UTC(1999, 11, 31);
const millsecondsPerDay = 86400000;

const unixToEpochTime = unixTime => (unixTime - epoch) / millsecondsPerDay;
const epochToUnixTime = time => time * millsecondsPerDay + epoch;

// astronomical functions

const obliquityOfEcliptic = time => 23.4393 - (3.563e-7 * time);
const sunArgOfPerihelion = time => rev(282.9404 + 4.70935e-5 * time);
const sunEccentricity = time => 0.016709 - 1.151e-9 * time;
const sunMeanAnomaly = time =>  rev(356.0470 + 0.9856002585 * time);
const siderealTime = (time, lon) => rev(280.4606 + 360.98564736629 * (time - 1.5) + lon);

const eclipticToEquatorial = (time, r) => {
  const o = obliquityOfEcliptic(time);
  const coso = cosd(o);
  const sino = sind(o);
  return {
    x: r.x,
    y: r.y * coso - r.z * sino,
    z: r.y * sino + r.z * coso
  };
};

const sunEclipticPosition = time => {
  const w = sunArgOfPerihelion(time);
  const e = sunEccentricity(time);
  const M = sunMeanAnomaly(time);
  const ea = M + e * degreesPerRadian * sind(M) * (1 + e * cosd(M));
  const xv = cosd(ea) - e;
  const yv = Math.sqrt(1 - e * e) * sind(ea);
  const v = atan2d(xv, yv);
  const r = Math.sqrt(xv * xv + yv * yv);

  return {
    x: r * cosd(v + w),
    y: r * sind(v + w),
    z: 0
  };
};

const sunEquatorialPosition = time => eclipticToEquatorial(time, sunEclipticPosition(time));

// time finding functions

const findTransitTime = (time, observer, atNoon) => {
  const offset = atNoon || atNoon === undefined ? 0 : 180;
  let delta = 0;

  do {
    time = time + delta / 360;
    const sun = rectToPolar(sunEquatorialPosition(time));
    delta = rev180(sun.lon - siderealTime(time, observer.lon + offset));
  } while (Math.abs(delta) > 0.0001);

  return time;
};

const findAltitudeTime = (time, noon, observer, rising, altitude) => {
  let sun = rectToPolar(sunEquatorialPosition(time));
  const cosh0 = (sind(altitude) - sind(observer.lat) * sind(sun.lat)) / (cosd(observer.lat) * cosd(sun.lat));

  if (cosh0 > 1) {
    return noon;
  }

  const direction = rising ? -1 : 1;
  const midnight = findTransitTime(noon + direction * 0.5, observer, false);

  if (cosh0 < -1) {
    return midnight;
  }

  time = noon + direction * acosd(cosh0) / 360;
  let delta = 0;
  let i = -1;

  do {
    time += direction * delta / 360;
    sun = rectToPolar(sunEquatorialPosition(time));
    const h = rev(siderealTime(time, observer.lon) - sun.lon);
    const newAltitude = asind(sind(observer.lat) * sind(sun.lat) + cosd(observer.lat) * cosd(sun.lat) * cosd(h));
    delta = newAltitude - altitude;
    i += 1;
  } while (Math.abs(delta) > 0.0001 && i < 2000);

  if (rising) {
    return time < midnight ? null : time <= noon ? time : null;
  }

  return time < noon ? null : time <= midnight ? time : null;
};

// public API

const findNoon = (unixTime, observer) => {
  const noon = findTransitTime(unixToEpochTime(unixTime), observer);
  return epochToUnixTime(noon);
};

const findTimes = (unixTime, observer) => {
  const transit = findTransitTime(unixToEpochTime(unixTime), observer);

  const startMidnight = epochToUnixTime(findTransitTime(transit - 0.5, observer, false));
  const startDawn = epochToUnixTime(findAltitudeTime(transit - 0.25, transit, observer, true, -6));
  const startRise = epochToUnixTime(findAltitudeTime(transit - 0.25, transit, observer, true, -0.833));
  const endRise = epochToUnixTime(findAltitudeTime(transit - 0.25, transit, observer, true, -0.294));
  const noon = epochToUnixTime(transit);
  const startSet = epochToUnixTime(findAltitudeTime(transit + 0.25, transit, observer, false, -0.294));
  const endSet = epochToUnixTime(findAltitudeTime(transit + 0.25, transit, observer, false, -0.833));
  const endDusk = epochToUnixTime(findAltitudeTime(transit + 0.25, transit, observer, false, -6));
  const endMidnight = epochToUnixTime(findTransitTime(transit + 0.5, observer, false));

  return {
    startMidnight,
    startDawn,
    startRise,
    endRise,
    noon,
    startSet,
    endSet,
    endDusk,
    endMidnight,
    dayLength: endMidnight - startMidnight,
    noDawn: startDawn === startMidnight || startDawn === noon,
    noRise: startRise === startMidnight || startRise === noon,
    noSet: endSet === endMidnight || endSet === noon,
    noDusk: endDusk === endMidnight || endDusk === noon,
    ratio(v) {
      if (typeof v === 'string') {
        v = this[v];
      }
      return Math.round(v - this.startMidnight) / Math.round(this.dayLength);
    }
  };
};

export const sol = { findNoon, findTimes };
