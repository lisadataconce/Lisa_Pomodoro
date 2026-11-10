/**
 * Pure Pomodoro business logic for macOS desktop & widget application.
 * Fully decoupled and unit-tested via node:test.
 */

export type FocusInterval = 30 | 45; // Minutes

export type SessionPhase = 'idle' | 'focusing' | 'paused' | 'break' | 'break_complete';

export interface PomodoroState {
  selectedInterval: FocusInterval; // 30 or 45
  currentCycle: number; // 1, 2, or 3
  cyclesCompletedTotal: number; // total cycles finished this session
  totalFocusSecondsCompleted: number; // cumulative focus time
  timeRemainingSeconds: number; // current countdown seconds
  phase: SessionPhase;
  breakType: 'short' | 'long' | null;
  breakTotalSeconds: number;
}

export const INTERVAL_SECONDS: Record<FocusInterval, number> = {
  30: 30 * 60,
  45: 45 * 60,
};

export const SHORT_BREAK_SECONDS = 5 * 60; // 5 minutes
export const LONG_BREAK_SECONDS = 20 * 60; // 20 minutes

/**
 * Format seconds into MM:SS format with leading zeros.
 */
export function formatTime(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Format total accumulated focus seconds into "Xh YYm" format.
 * Examples:
 * - 0s -> "0h 00m"
 * - 1800s (30m) -> "0h 30m"
 * - 3600s (60m) -> "1h 00m"
 * - 5400s (90m) -> "1h 30m"
 * - 8100s (135m) -> "2h 15m"
 */
export function formatCumulativeTime(totalSeconds: number): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const totalMins = Math.floor(safeSec / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const mm = mins.toString().padStart(2, '0');
  return `${hours}h ${mm}m`;
}

/**
 * Determine break duration based on the cycle just completed (1, 2, or 3).
 * Cycle 1 -> 5 min short break
 * Cycle 2 -> 5 min short break
 * Cycle 3 -> 20 min long break
 */
export function getBreakDuration(cycleCompleted: number): { type: 'short' | 'long'; durationSeconds: number } {
  const isLongBreak = cycleCompleted % 3 === 0;
  return {
    type: isLongBreak ? 'long' : 'short',
    durationSeconds: isLongBreak ? LONG_BREAK_SECONDS : SHORT_BREAK_SECONDS,
  };
}

/**
 * Creates initial clean state.
 */
export function createInitialState(interval: FocusInterval = 30): PomodoroState {
  return {
    selectedInterval: interval,
    currentCycle: 1,
    cyclesCompletedTotal: 0,
    totalFocusSecondsCompleted: 0,
    timeRemainingSeconds: INTERVAL_SECONDS[interval],
    phase: 'idle',
    breakType: null,
    breakTotalSeconds: 0,
  };
}

/**
 * Switch focus interval between 30 and 45 minutes.
 * Only allowed when in 'idle' phase.
 */
export function setInterval(state: PomodoroState, interval: FocusInterval): PomodoroState {
  if (state.phase !== 'idle' && state.phase !== 'paused') {
    return state;
  }
  return {
    ...state,
    selectedInterval: interval,
    timeRemainingSeconds: INTERVAL_SECONDS[interval],
  };
}

/**
 * Start focus session.
 */
export function startFocusSession(state: PomodoroState): PomodoroState {
  return {
    ...state,
    phase: 'focusing',
  };
}

/**
 * Pause active focus countdown.
 */
export function pauseFocusSession(state: PomodoroState): PomodoroState {
  if (state.phase !== 'focusing') return state;
  return {
    ...state,
    phase: 'paused',
  };
}

/**
 * Resume paused focus countdown.
 */
export function resumeFocusSession(state: PomodoroState): PomodoroState {
  if (state.phase !== 'paused') return state;
  return {
    ...state,
    phase: 'focusing',
  };
}

/**
 * Tick function called every second.
 * Returns updated state and flags for transitions (e.g. shouldPlayPing).
 */
export function tickSession(
  state: PomodoroState,
  deltaSeconds: number = 1
): { state: PomodoroState; transitionEvent: 'none' | 'focus_completed' | 'break_completed' } {
  if (state.phase !== 'focusing' && state.phase !== 'break') {
    return { state, transitionEvent: 'none' };
  }

  const newTime = state.timeRemainingSeconds - deltaSeconds;

  if (state.phase === 'focusing') {
    if (newTime <= 0) {
      // Focus cycle has completed!
      const breakInfo = getBreakDuration(state.currentCycle);
      const focusAddedSeconds = INTERVAL_SECONDS[state.selectedInterval];

      return {
        state: {
          ...state,
          phase: 'break',
          totalFocusSecondsCompleted: state.totalFocusSecondsCompleted + focusAddedSeconds,
          cyclesCompletedTotal: state.cyclesCompletedTotal + 1,
          breakType: breakInfo.type,
          breakTotalSeconds: breakInfo.durationSeconds,
          timeRemainingSeconds: breakInfo.durationSeconds,
        },
        transitionEvent: 'focus_completed',
      };
    } else {
      return {
        state: {
          ...state,
          timeRemainingSeconds: newTime,
        },
        transitionEvent: 'none',
      };
    }
  }

  if (state.phase === 'break') {
    if (newTime <= 0) {
      // Break has finished! Release computer and advance cycle number.
      const nextCycleNumber = state.currentCycle >= 3 ? 1 : state.currentCycle + 1;
      const nextIntervalSeconds = INTERVAL_SECONDS[state.selectedInterval];

      return {
        state: {
          ...state,
          phase: 'break_complete',
          currentCycle: nextCycleNumber,
          timeRemainingSeconds: nextIntervalSeconds,
          breakType: null,
          breakTotalSeconds: 0,
        },
        transitionEvent: 'break_completed',
      };
    } else {
      return {
        state: {
          ...state,
          timeRemainingSeconds: newTime,
        },
        transitionEvent: 'none',
      };
    }
  }

  return { state, transitionEvent: 'none' };
}

/**
 * Emergency skip break button action.
 * Releases the lockdown immediately and advances to ready-to-focus state.
 */
export function skipBreak(state: PomodoroState): PomodoroState {
  if (state.phase !== 'break') return state;
  const nextCycleNumber = state.currentCycle >= 3 ? 1 : state.currentCycle + 1;
  const nextIntervalSeconds = INTERVAL_SECONDS[state.selectedInterval];

  return {
    ...state,
    phase: 'break_complete',
    currentCycle: nextCycleNumber,
    timeRemainingSeconds: nextIntervalSeconds,
    breakType: null,
    breakTotalSeconds: 0,
  };
}

/**
 * User clicks "Start Next Focus" after break finishes or is skipped.
 * Manual next-cycle initiation specification:
 * Waits for user explicit action to resume focusing.
 */
export function startNextCycle(state: PomodoroState): PomodoroState {
  const focusSeconds = INTERVAL_SECONDS[state.selectedInterval];

  return {
    ...state,
    phase: 'focusing',
    timeRemainingSeconds: focusSeconds,
    breakType: null,
    breakTotalSeconds: 0,
  };
}

/**
 * Dedicated manual reset button immediately clears active timers,
 * cycle counts, and accumulated session hours.
 */
export function resetSession(state: PomodoroState): PomodoroState {
  return createInitialState(state.selectedInterval);
}
