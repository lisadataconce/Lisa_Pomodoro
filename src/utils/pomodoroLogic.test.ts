import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTime,
  formatCumulativeTime,
  getBreakDuration,
  createInitialState,
  setInterval,
  startFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  tickSession,
  skipBreak,
  startNextCycle,
  resetSession,
} from './pomodoroLogic';

test('formatTime properly formats seconds to MM:SS', () => {
  assert.equal(formatTime(1800), '30:00');
  assert.equal(formatTime(2700), '45:00');
  assert.equal(formatTime(1799), '29:59');
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(9), '00:09');
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(-5), '00:00');
});

test('formatCumulativeTime explicitly formats hours and minutes milestones', () => {
  // 0 hours
  assert.equal(formatCumulativeTime(0), '0h 00m');
  // 30 minutes
  assert.equal(formatCumulativeTime(30 * 60), '0h 30m');
  // 1 full hour (two 30-min blocks)
  assert.equal(formatCumulativeTime(60 * 60), '1h 00m');
  // 1.5 hours (two 45-min blocks or three 30-min blocks)
  assert.equal(formatCumulativeTime(90 * 60), '1h 30m');
  // 2 hours 15 mins (three 45-min blocks)
  assert.equal(formatCumulativeTime(135 * 60), '2h 15m');
});

test('getBreakDuration assigns 5m for cycles 1 & 2, and 20m for cycle 3', () => {
  assert.deepEqual(getBreakDuration(1), { type: 'short', durationSeconds: 300 });
  assert.deepEqual(getBreakDuration(2), { type: 'short', durationSeconds: 300 });
  assert.deepEqual(getBreakDuration(3), { type: 'long', durationSeconds: 1200 });
  // Cycle 4 (second set cycle 1) is short break
  assert.deepEqual(getBreakDuration(4), { type: 'short', durationSeconds: 300 });
  // Cycle 6 (second set cycle 3) is long break
  assert.deepEqual(getBreakDuration(6), { type: 'long', durationSeconds: 1200 });
});

test('interval switching is permitted when idle', () => {
  let state = createInitialState(30);
  assert.equal(state.selectedInterval, 30);
  assert.equal(state.timeRemainingSeconds, 1800);

  state = setInterval(state, 45);
  assert.equal(state.selectedInterval, 45);
  assert.equal(state.timeRemainingSeconds, 2700);

  state = setInterval(state, 30);
  assert.equal(state.selectedInterval, 30);
  assert.equal(state.timeRemainingSeconds, 1800);
});

test('start, pause, and resume transitions', () => {
  let state = createInitialState(30);
  state = startFocusSession(state);
  assert.equal(state.phase, 'focusing');

  state = pauseFocusSession(state);
  assert.equal(state.phase, 'paused');

  state = resumeFocusSession(state);
  assert.equal(state.phase, 'focusing');
});

test('focus countdown tick and transition into Short Break upon Cycle 1 completion', () => {
  let state = createInitialState(30);
  state = startFocusSession(state);
  state.timeRemainingSeconds = 2;

  // Tick 1 second
  let tickResult = tickSession(state, 1);
  assert.equal(tickResult.transitionEvent, 'none');
  assert.equal(tickResult.state.timeRemainingSeconds, 1);

  // Tick to 0
  tickResult = tickSession(tickResult.state, 1);
  assert.equal(tickResult.transitionEvent, 'focus_completed');
  assert.equal(tickResult.state.phase, 'break');
  assert.equal(tickResult.state.breakType, 'short');
  assert.equal(tickResult.state.breakTotalSeconds, 300);
  assert.equal(tickResult.state.timeRemainingSeconds, 300);
  assert.equal(tickResult.state.cyclesCompletedTotal, 1);
  assert.equal(tickResult.state.totalFocusSecondsCompleted, 1800);
  assert.equal(formatCumulativeTime(tickResult.state.totalFocusSecondsCompleted), '0h 30m');
});

test('completing cycle 3 triggers 20m long break', () => {
  let state = createInitialState(30);
  state.currentCycle = 3;
  state.cyclesCompletedTotal = 2;
  state.totalFocusSecondsCompleted = 3600; // 1h 00m
  state = startFocusSession(state);
  state.timeRemainingSeconds = 1;

  const tickResult = tickSession(state, 1);
  assert.equal(tickResult.transitionEvent, 'focus_completed');
  assert.equal(tickResult.state.phase, 'break');
  assert.equal(tickResult.state.breakType, 'long');
  assert.equal(tickResult.state.breakTotalSeconds, 1200);
  assert.equal(tickResult.state.totalFocusSecondsCompleted, 5400); // 1h 30m
  assert.equal(formatCumulativeTime(tickResult.state.totalFocusSecondsCompleted), '1h 30m');
});

test('break countdown completion triggers manual next cycle ready state', () => {
  let state = createInitialState(30);
  state.phase = 'break';
  state.currentCycle = 1;
  state.timeRemainingSeconds = 1;

  const tickResult = tickSession(state, 1);
  assert.equal(tickResult.transitionEvent, 'break_completed');
  assert.equal(tickResult.state.phase, 'break_complete');
  assert.equal(tickResult.state.currentCycle, 2);
  assert.equal(tickResult.state.timeRemainingSeconds, 1800);

  // Next cycle manual initiation
  const nextState = startNextCycle(tickResult.state);
  assert.equal(nextState.phase, 'focusing');
  assert.equal(nextState.currentCycle, 2);
  assert.equal(nextState.timeRemainingSeconds, 1800);
});

test('skip break allows emergency exit from break mode', () => {
  let state = createInitialState(45);
  state.phase = 'break';
  state.currentCycle = 1;
  state.timeRemainingSeconds = 250;

  const skipped = skipBreak(state);
  assert.equal(skipped.phase, 'break_complete');
  assert.equal(skipped.currentCycle, 2);
  assert.equal(skipped.timeRemainingSeconds, 2700);
});

test('cycle count wraps around cleanly from 3 back to 1 upon break completion', () => {
  let state = createInitialState(30);
  state.currentCycle = 3;
  state.phase = 'break';
  state.timeRemainingSeconds = 1;

  const tickResult = tickSession(state, 1);
  assert.equal(tickResult.transitionEvent, 'break_completed');
  assert.equal(tickResult.state.phase, 'break_complete');
  assert.equal(tickResult.state.currentCycle, 1);

  const nextState = startNextCycle(tickResult.state);
  assert.equal(nextState.currentCycle, 1);
  assert.equal(nextState.phase, 'focusing');
});

test('resetSession completely wipes active timers, cycles and accumulated hours', () => {
  let state = createInitialState(45);
  state.currentCycle = 2;
  state.cyclesCompletedTotal = 4;
  state.totalFocusSecondsCompleted = 10800;
  state.phase = 'focusing';

  const reset = resetSession(state);
  assert.equal(reset.currentCycle, 1);
  assert.equal(reset.cyclesCompletedTotal, 0);
  assert.equal(reset.totalFocusSecondsCompleted, 0);
  assert.equal(reset.phase, 'idle');
  assert.equal(reset.selectedInterval, 45);
  assert.equal(reset.timeRemainingSeconds, 2700);
  assert.equal(formatCumulativeTime(reset.totalFocusSecondsCompleted), '0h 00m');
});
