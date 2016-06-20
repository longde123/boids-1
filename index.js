import {run} from '@cycle/xstream-run';
import {makeDOMDriver, div} from '@cycle/dom';
import xs from 'xstream';
import _ from 'lodash';
import uuid from 'node-uuid';

import timeDriver from './src/time-driver';
import mousePositionDriver from './src/mouse-position-driver';

// given we have a whole bunch of flock
// every frame
//  apply these rules:
//    X each boid moves away from any boids in the flock that are too close
//    X each boid moves towards the centre of the flock
//    X each boid moves towards the mouse
//
//
//  bonus:
//    - deploy
//    - start mouse in center
//    - sliders
//    - colors
//      - more colourful closer to mouse
//      - random hue
//
//    - min/max speed
//    - glow
//    - add/remove boid button
const FRAME_RATE = 1000 / 60;

const AVOIDANCE_DISTANCE = 50;
const BOID_COUNT = 100;
const FRICTION = 0.98;
const FLOCK_CENTRE_WEIGHT = 0.2;
const MOUSE_POSITION_WEIGHT = 0.5;
const AVOIDANCE_WEIGHT = -1.1;

function Boid () {
  return {
    position: {x: 200, y: 200},
    key: uuid.v4(),
    velocity: {x: 0, y: 0}
  };
}

function makeflock (count) {
  return _.range(count).map(Boid);
}

function renderBoid (boid) {
  const angle = Math.atan2(boid.velocity.y, boid.velocity.x);

  const speed = Math.abs(boid.velocity.x) + Math.abs(boid.velocity.y)

  const scale = speed / 30;

  const style = {
    position: 'absolute',
    transform: `translate(${boid.position.x}px, ${boid.position.y}px) rotate(${angle}rad) scale(${scale})`
  };

  return (
    div('.boid', {key: boid.key, style})
  );
}

function view (state) {
  return (
    div('.flock', state.flock.map(renderBoid))
  );
}

function sign (number) {
  if (number < 0) {
    return -1;
  } else if (number > 0) {
    return 1;
  }

  return 0;
}

function moveTowards(boid, delta, position, speed) {
  const distance = {
    x: position.x - boid.position.x,
    y: position.y - boid.position.y
  };

  const absoluteDistance = {
    x: Math.abs(distance.x),
    y: Math.abs(distance.y)
  };

  const normalizedDistance = normalizeVector(absoluteDistance);

  boid.velocity.x += normalizedDistance.x * sign(distance.x) * speed * delta;
  boid.velocity.y += normalizedDistance.y * sign(distance.y) * speed * delta;
}

function normalizeVector (vector) {
  const vectorLength = Math.abs(vector.x + vector.y);

  if (vectorLength === 0) {
    return {x: 0, y: 0};
  }

  return {
    x: vector.x / vectorLength,
    y: vector.y / vectorLength
  };
}

function calculateFlockCentre (flock) {
  return {
    x: _.mean(_.map(flock, 'position.x')),
    y: _.mean(_.map(flock, 'position.y'))
  };
}

function moveAwayFromCloseBoids (boid, flock, delta) {
  flock.forEach(otherBoid => {
    if (boid === otherBoid) { return; }

    const distanceVector = {
      x: Math.abs(boid.position.x - otherBoid.position.x),
      y: Math.abs(boid.position.y - otherBoid.position.y)
    };

    const distance = Math.sqrt(
      Math.pow(distanceVector.x, 2) +
      Math.pow(distanceVector.y, 2)
    );

    if (distance < AVOIDANCE_DISTANCE) {
      moveTowards(boid, delta, otherBoid.position, AVOIDANCE_WEIGHT);
    }
  });
}

function updateBoid (boid, delta, mousePosition, flockCentre, flock) {
  moveTowards(boid, delta, mousePosition, MOUSE_POSITION_WEIGHT);
  moveTowards(boid, delta, flockCentre, FLOCK_CENTRE_WEIGHT);
  moveAwayFromCloseBoids(boid, flock, delta);

  boid.position.x += boid.velocity.x * delta;
  boid.position.y += boid.velocity.y * delta;

  boid.velocity.x *= FRICTION / delta;
  boid.velocity.y *= FRICTION / delta;

  return boid;
}

function update (state, delta, mousePosition) {
  const flockCentre = calculateFlockCentre(state.flock);

  state.flock.forEach(boid => updateBoid(
    boid,
    delta,
    mousePosition,
    flockCentre,
    state.flock
  ));

  return state;
}

function main ({DOM, Time, Mouse}) {
  const initialState = {
    flock: makeflock(BOID_COUNT)
  };

  const tick$ = Time.map(time => time.delta / FRAME_RATE);

  const update$ = Mouse.positions()
    .map(mousePosition => tick$.map(delta => state => update(state, delta, mousePosition)))
    .flatten();

  const state$ = update$.fold((state, reducer) => reducer(state), initialState);

  return {
    DOM: state$.map(view)
  };
}

const drivers = {
  DOM: makeDOMDriver('.app'),
  Time: timeDriver,
  Mouse: mousePositionDriver
};

run(main, drivers);
