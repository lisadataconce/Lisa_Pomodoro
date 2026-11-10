import React from 'react';
import { Play, Pause, RotateCcw, Volume2, Sparkles, Move } from 'lucide-react';
import { FocusInterval, PomodoroState, formatTime, formatCumulativeTime } from '../utils/pomodoroLogic';

interface FloatingWidgetProps {
  state: PomodoroState;
  onSelectInterval: (interval: FocusInterval) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onPlayChimeTest: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isDraggable?: boolean;
}

export const FloatingWidget: React.FC<FloatingWidgetProps> = ({
  state,
  onSelectInterval,
  onStart,
  onPause,
  onResume,
  onReset,
  onPlayChimeTest,
  soundEnabled,
  onToggleSound,
}) => {
  const isRunning = state.phase === 'focusing';
  const isPaused = state.phase === 'paused';
  const isIdle = state.phase === 'idle';
  const isBreakComplete = state.phase === 'break_complete';

  // Format primary action button
  const getPrimaryActionLabel = () => {
    if (isBreakComplete) return 'Start Next Focus';
    if (isRunning) return 'Pause';
    if (isPaused) return 'Resume';
    return 'Start';
  };

  const handlePrimaryClick = () => {
    if (isRunning) {
      onPause();
    } else if (isPaused) {
      onResume();
    } else {
      onStart();
    }
  };

  const cumulativeText = formatCumulativeTime(state.totalFocusSecondsCompleted);
  const formattedCountdown = formatTime(state.timeRemainingSeconds);

  // Compute progress percentage
  const totalDuration = state.selectedInterval * 60;
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - state.timeRemainingSeconds) / totalDuration) * 100));

  return (
    <aside
      aria-label="Komorebi Pomodoro Floating Widget"
      className="w-[280px] sm:w-[300px] select-none rounded-xl p-4 shadow-2xl transition-all duration-200 border border-[#2E383F]/80 backdrop-blur-md"
      style={{
        backgroundColor: '#1E2022',
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* macOS Window Titlebar simulation */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#2E383F]/60">
        <div className="flex items-center gap-2">
          {/* macOS window stoplights */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]/90 block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]/90 block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]/90 block" />
          </div>
          <span className="text-[11px] font-semibold tracking-wider text-[#A39BB0] uppercase ml-1.5">
            FOCUS WIDGET
          </span>
        </div>

        {/* Top-Right Sound & Chime Test Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute macOS Ping chime' : 'Enable macOS Ping chime'}
            title={soundEnabled ? 'Sound Enabled (macOS Ping)' : 'Sound Muted'}
            className="p-1 rounded text-[#A39BB0] hover:text-[#8EE4AF] hover:bg-[#2E383F]/60 transition-colors"
          >
            <Volume2 className={`w-3.5 h-3.5 ${soundEnabled ? 'text-[#8EE4AF]' : 'text-[#A39BB0]/50'}`} />
          </button>
          <button
            type="button"
            onClick={onPlayChimeTest}
            aria-label="Test macOS Ping sound"
            title="Preview native Ping chime"
            className="px-1.5 py-0.5 text-[10px] rounded text-[#A39BB0] hover:text-[#8EE4AF] hover:bg-[#2E383F]/60 transition-colors"
          >
            Chime
          </button>
        </div>
      </div>

      {/* Interval Selector Toggle (30m or 45m) */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs text-[#D5DBDB]/80 font-medium">Session Length</span>
        <div
          role="group"
          aria-label="Focus Interval Selector"
          className="flex items-center p-0.5 bg-[#2E383F]/50 rounded-lg border border-[#2E383F]"
        >
          <button
            type="button"
            onClick={() => onSelectInterval(30)}
            disabled={isRunning || isPaused}
            aria-pressed={state.selectedInterval === 30}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              state.selectedInterval === 30
                ? 'bg-[#8EE4AF] text-[#1E2022] shadow-sm'
                : 'text-[#D5DBDB] hover:text-white disabled:opacity-50 disabled:hover:text-[#D5DBDB]'
            }`}
          >
            30m
          </button>
          <button
            type="button"
            onClick={() => onSelectInterval(45)}
            disabled={isRunning || isPaused}
            aria-pressed={state.selectedInterval === 45}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              state.selectedInterval === 45
                ? 'bg-[#8EE4AF] text-[#1E2022] shadow-sm'
                : 'text-[#D5DBDB] hover:text-white disabled:opacity-50 disabled:hover:text-[#D5DBDB]'
            }`}
          >
            45m
          </button>
        </div>
      </div>

      {/* Countdown Display: Large, highly readable mint green typography */}
      <div className="text-center py-2 relative">
        <div
          className="font-mono-numbers text-[46px] leading-tight font-bold tracking-tight text-[#8EE4AF]"
          style={{ textShadow: '0 0 20px rgba(142, 228, 175, 0.2)' }}
        >
          {formattedCountdown}
        </div>

        {/* Minimalist Progress Track */}
        <div className="w-full bg-[#2E383F]/60 h-1 rounded-full mt-2 overflow-hidden">
          <div
            className="bg-[#8EE4AF] h-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Cycle Tracking & Cumulative Time */}
      <div className="flex items-center justify-between text-xs py-2 px-1 text-[#D5DBDB] border-b border-[#2E383F]/40 mb-3">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="text-[#8EE4AF] font-bold">Cycle {state.currentCycle}/3</span>
          <span className="text-[#A39BB0]">•</span>
          <span className="text-[#D5DBDB] font-mono-numbers">{cumulativeText}</span>
        </div>
        <div className="text-[11px] text-[#A39BB0]">
          {state.currentCycle === 3 ? 'Long rest next' : '5m rest next'}
        </div>
      </div>

      {/* Session Controls: Start/Pause & Dedicated Reset Session */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePrimaryClick}
          aria-label={getPrimaryActionLabel()}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold text-xs tracking-wide transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer shadow-md"
          style={{
            backgroundColor: isRunning ? '#E2D4F0' : '#8EE4AF',
            color: '#1E2022',
          }}
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : isPaused ? (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume</span>
            </>
          ) : isBreakComplete ? (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Start Next Focus</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Focus</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onReset}
          aria-label="Reset Session"
          title="Clear active timers, cycle count, and accumulated hours"
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium text-[#D5DBDB] bg-[#2E383F] hover:bg-[#2E383F]/80 hover:text-white transition-colors whitespace-nowrap cursor-pointer border border-[#2E383F]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Status indicator footer */}
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#A39BB0]/80 px-0.5">
        <span>macOS Pinned Window</span>
        <span>Always on top</span>
      </div>
    </aside>
  );
};
