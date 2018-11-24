
// sources:
//
//  Paul Schlyter, How to compute planetary positions
//    http://www.stjarnhimlen.se/comp/ppcomp.html
//
//  Jean Meeus, Astronomical Algorithms (1st edition)
//    Willmann-Bell, 1991


  // trigonometric functions in degrees

var radiansPerDegree = Math.PI / 180;
var degreesPerRadian = 180 / Math.PI;

function cosd(x) {
  return Math.cos(x * radiansPerDegree);
}

function sind(x) {
  return Math.sin(x * radiansPerDegree);
}

function acosd(x) {
  return Math.acos(x) * degreesPerRadian;
}

function asind(x) {
  return Math.asin(x) * degreesPerRadian;
}

function atan2d(x, y) {
  return Math.atan2(y, x) * degreesPerRadian;
}

function rev(x) {
  x = x % 360;
  return x >= 0 ? x : x + 360;
}

function rev180(x) {
  x = rev(x);
  return x <= 180 ? x : x - 360;
}

// point conversion

function rectToPolar(r) {
  return {
    lon: rev(atan2d(r.x, r.y)),
    lat: atan2d(Math.sqrt(r.x * r.x + r.y * r.y), r.z)
  };
}

// epoch time functions

var epoch = Date.UTC(1999, 11, 31);
var millsecondsPerDay = 86400000;

function unixToEpochTime(unixTime) {
  return (unixTime - epoch) / millsecondsPerDay;
}

function epochToUnixTime(time) {
  return time * millsecondsPerDay + epoch;
}

// astronomical functions

function eclipticToEquatorial(time, r)  {
  var o = obliquityOfEcliptic(time);
  var coso = cosd(o);
  var sino = sind(o);
  return {
    x: r.x,
    y: r.y * coso - r.z * sino,
    z: r.y * sino + r.z * coso
  };
}

function obliquityOfEcliptic(time) {
  return 23.4393 - (3.563e-7 * time);
}

function siderealTime(time, lon) {
  var st = 280.4606 + 360.98564736629 * (time - 1.5);
  return rev(st + lon);
}

function sunArgOfPerihelion(time) {
  return rev(282.9404 + 4.70935e-5 * time);
}

function sunEccentricity(time) {
  return 0.016709 - 1.151e-9 * time;
}

function sunEclipticPosition(time) {

  // orbital elements

  var w = sunArgOfPerihelion(time);
  var e = sunEccentricity(time);
  var M = sunMeanAnomaly(time);

  // eccentric anomaly

  var ea = M + e * degreesPerRadian * sind(M) * (1 + e * cosd(M));

  // true anomaly and distance

  var xv = cosd(ea) - e;
  var yv = Math.sqrt(1 - e * e) * sind(ea);
  var v = atan2d(xv, yv);
  var r = Math.sqrt(xv * xv + yv * yv);

  // position in space

  return {
    x: r * cosd(v + w),
    y: r * sind(v + w),
    z: 0
  };
}

function sunEquatorialPosition(time) {
  return eclipticToEquatorial(time, sunEclipticPosition(time));
}

function sunMeanAnomaly(time) {
  return rev(356.0470 + 0.9856002585 * time);
}

function findTransitTime(time, observer, atNoon) {
  var offset = atNoon || atNoon === undefined ? 0 : 180;
  var delta = 0;

  do {
    time = time + delta / 360;
    var sun = rectToPolar(sunEquatorialPosition(time));
    delta = rev180(sun.lon - siderealTime(time, observer.lon + offset));
  } while (Math.abs(delta) > 0.0001);

  return time;
}

function findAltitudeTime(time, noon, observer, rising, altitude) {
  var sun = rectToPolar(sunEquatorialPosition(time));
  var cosh0 = (sind(altitude) - sind(observer.lat) * sind(sun.lat)) / (cosd(observer.lat) * cosd(sun.lat));

  if (cosh0 > 1) {
    return noon;
  }

  var direction = rising ? -1 : 1;
  var midnight = findTransitTime(noon + direction * 0.5, observer, false);

  if (cosh0 < -1) {
    return midnight;
  }

  time = noon + direction * acosd(cosh0) / 360;
  var delta = 0;
  var i = -1;

  do {
    time += direction * delta / 360;
    sun = rectToPolar(sunEquatorialPosition(time));
    var h = rev(siderealTime(time, observer.lon) - sun.lon);
    var newAltitude = asind(sind(observer.lat) * sind(sun.lat) + cosd(observer.lat) * cosd(sun.lat) * cosd(h));
    delta = newAltitude - altitude;
    i += 1;
  } while (Math.abs(delta) > 0.0001 && i < 2000);

  if (rising) {
    return time < midnight ? null : time <= noon ? time : null;
  }

  return time < noon ? null : time <= midnight ? time : null;
}

// public API

function findNoon(unixTime, observer) {
  var noon = findTransitTime(unixToEpochTime(unixTime), observer);
  return epochToUnixTime(noon);
}

function findTimes(unixTime, observer, includeTwilight) {
  var transit = findTransitTime(unixToEpochTime(unixTime), observer);

  var startMidnight = epochToUnixTime(findTransitTime(transit - 0.5, observer, false));
  var startDawn = epochToUnixTime(findAltitudeTime(transit - 0.25, transit, observer, true, -6));
  var startRise = epochToUnixTime(findAltitudeTime(transit - 0.25, transit, observer, true, -0.833));
  var endRise = epochToUnixTime(findAltitudeTime(transit - 0.25, transit, observer, true, -0.294));
  var noon = epochToUnixTime(transit);
  var startSet = epochToUnixTime(findAltitudeTime(transit + 0.25, transit, observer, false, -0.294));
  var endSet = epochToUnixTime(findAltitudeTime(transit + 0.25, transit, observer, false, -0.833));
  var endDusk = epochToUnixTime(findAltitudeTime(transit + 0.25, transit, observer, false, -6));
  var endMidnight = epochToUnixTime(findTransitTime(transit + 0.5, observer, false));

  var times = {
    startMidnight: startMidnight,
    startDawn: startDawn,
    startRise: startRise,
    endRise: endRise,
    noon: noon,
    startSet: startSet,
    endSet: endSet,
    endDusk: endDusk,
    endMidnight: endMidnight,
    dayLength: endMidnight - startMidnight,
    noDawn: startDawn === startMidnight || startDawn === noon,
    noRise: startRise === startMidnight || startRise === noon,
    noSet: endSet === endMidnight || endSet === noon,
    noDusk: endDusk === endMidnight || endDusk === noon,
    ratio: function (v) {
      if (typeof v === 'string') {
        v = this[v];
      }
      return Math.round(v - this.startMidnight) / Math.round(this.dayLength);
    }
  };

  if (includeTwilight) {
    times.startAstroTwilight = epochToUnixTime(findAltitudeTime(transit - 0.25, transit, observer, true, -18));
    times.startNautTwilight = epochToUnixTime(findAltitudeTime(transit - 0.25, transit, observer, true, -12));
    times.endNautTwilight = epochToUnixTime(findAltitudeTime(transit + 0.25, transit, observer, false, -12));
    times.endAstroTwilight = epochToUnixTime(findAltitudeTime(transit + 0.25, transit, observer, false, -18));
  }

  return times;
}

export var sol = { findNoon, findTimes };
