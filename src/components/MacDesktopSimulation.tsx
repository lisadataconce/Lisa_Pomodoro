import React, { useState, useEffect, useRef } from 'react';
import {
  Apple,
  Wifi,
  Volume2,
  VolumeX,
  Battery,
  Terminal,
  FastForward,
  RotateCcw,
  Sparkles,
  Maximize2,
  Folder,
  Code2,
  BookOpen,
  Monitor,
  Download,
} from 'lucide-react';
import {
  FocusInterval,
  PomodoroState,
  createInitialState,
  setInterval as setPomodoroInterval,
  startFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  tickSession,
  skipBreak,
  startNextCycle,
  resetSession,
} from '../utils/pomodoroLogic';
import { playMacPingChime } from '../utils/audioChime';
import { FloatingWidget } from './FloatingWidget';
import { FullScreenBreakOverlay } from './FullScreenBreakOverlay';
import { PythonScriptModal } from './PythonScriptModal';

export const MacDesktopSimulation: React.FC = () => {
  const [state, setState] = useState<PomodoroState>(() => createInitialState(30));
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState<'bottom_right' | 'centered'>('bottom_right');
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [isRealFullscreen, setIsRealFullscreen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update menu bar clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTimeStr(
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', weekday: 'short', month: 'short', day: 'numeric' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Main tick loop
  useEffect(() => {
    if (state.phase === 'focusing' || state.phase === 'break') {
      timerRef.current = setInterval(() => {
        setState((prevState) => {
          const { state: nextState, transitionEvent } = tickSession(prevState, 1);

          if (transitionEvent === 'focus_completed') {
            if (soundEnabled) playMacPingChime();
          } else if (transitionEvent === 'break_completed') {
            if (soundEnabled) playMacPingChime();
          }

          return nextState;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.phase, soundEnabled]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsRealFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleRealFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback if browser denies
    }
  };

  const handleSelectInterval = (interval: FocusInterval) => {
    setState((prev) => setPomodoroInterval(prev, interval));
  };

  const handleStart = () => {
    if (soundEnabled) playMacPingChime();
    setState((prev) => {
      if (prev.phase === 'break_complete') {
        return startNextCycle(prev);
      }
      return startFocusSession(prev);
    });
  };

  const handlePause = () => {
    setState((prev) => pauseFocusSession(prev));
  };

  const handleResume = () => {
    setState((prev) => resumeFocusSession(prev));
  };

  const handleReset = () => {
    setState((prev) => resetSession(prev));
  };

  const handleSkipBreak = () => {
    setState((prev) => skipBreak(prev));
  };

  const handleStartNextCycle = () => {
    if (soundEnabled) playMacPingChime();
    setState((prev) => startNextCycle(prev));
  };

  const handlePlayChimeTest = () => {
    playMacPingChime();
  };

  // Fast-Forward & Testing helpers
  const handleFastForward10s = () => {
    setState((prev) => {
      const { state: nextState, transitionEvent } = tickSession(prev, 10);
      if (transitionEvent !== 'none' && soundEnabled) {
        playMacPingChime();
      }
      return nextState;
    });
  };

  const handleJumpToCycleFinish = () => {
    if (state.phase !== 'focusing' && state.phase !== 'paused' && state.phase !== 'idle') return;
    setState((prev) => {
      const { state: nextState } = tickSession({ ...prev, phase: 'focusing', timeRemainingSeconds: 1 }, 1);
      if (soundEnabled) playMacPingChime();
      return nextState;
    });
  };

  const handleJumpToBreakFinish = () => {
    if (state.phase !== 'break') return;
    setState((prev) => {
      const { state: nextState } = tickSession({ ...prev, timeRemainingSeconds: 1 }, 1);
      if (soundEnabled) playMacPingChime();
      return nextState;
    });
  };

  const isBreakActive = state.phase === 'break';

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0A0D11] text-slate-100 flex flex-col font-sans select-none">
      {/* 1. macOS Top Menu Bar */}
      <header className="h-7 w-full bg-[#181B1F]/90 backdrop-blur-md border-b border-black/40 px-3 flex items-center justify-between text-xs text-[#D5DBDB] z-40 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex items-center gap-1.5 font-bold hover:text-white transition-colors"
            title="macOS System Menu"
          >
            <Apple className="w-3.5 h-3.5 fill-current" />
          </button>

          <span className="font-semibold text-white">Komorebi</span>

          <nav className="hidden md:flex items-center gap-3.5 text-[#D5DBDB]/80 text-[11px]">
            <span className="hover:text-white cursor-default">Focus</span>
            <span className="hover:text-white cursor-default">Session</span>
            <span className="hover:text-white cursor-default">View</span>
            <span className="hover:text-white cursor-default">Window</span>
            <button
              type="button"
              onClick={() => setIsPythonModalOpen(true)}
              className="text-[#8EE4AF] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Terminal className="w-3 h-3" />
              <span>Python Script (.py)</span>
            </button>
            <a
              href="/pomodoro_macos.py"
              download="pomodoro_macos.py"
              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#8EE4AF] hover:bg-[#8EE4AF]/90 text-[#1E2022] font-bold text-[11px] transition-colors"
              title="Download standalone pomodoro_macos.py script"
            >
              <Download className="w-3 h-3" />
              <span>Download .py</span>
            </a>
          </nav>
        </div>

        {/* Right Menu Bar Extras */}
        <div className="flex items-center gap-3 text-xs text-[#D5DBDB]/80">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label="Toggle Sound"
            className="hover:text-white transition-colors"
            title={soundEnabled ? 'Chime Enabled' : 'Chime Muted'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#8EE4AF]" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <Wifi className="w-3.5 h-3.5 hidden sm:block" />
          <Battery className="w-3.5 h-3.5 hidden sm:block" />

          <span className="font-medium text-white text-[11px] font-mono-numbers">
            {currentTimeStr || '10:00 AM'}
          </span>
        </div>
      </header>

      {/* 2. macOS Desktop Canvas Wallpaper */}
      <main className="relative flex-1 w-full overflow-hidden flex flex-col justify-between">
        {/* Ambient Dark Gradient Wallpaper */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 80% 20%, #1a222d 0%, #0d1217 45%, #07090c 100%)',
          }}
        >
          {/* Subtle geometric light orbs */}
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-[#8EE4AF]/5 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/3 left-1/4 w-80 h-80 rounded-full bg-[#E2D4F0]/5 blur-[100px] pointer-events-none" />
        </div>

        {/* Desktop Top-Left Information & Quick Links */}
        <div className="relative z-10 p-6 flex flex-col gap-4 max-w-md pointer-events-auto">
          {/* macOS Notification for Rest Complete */}
          {state.phase === 'break_complete' && (
            <div className="bg-[#1E2022] border border-[#8EE4AF]/60 rounded-xl p-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2E383F] flex items-center justify-center text-[#8EE4AF]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Rest Period Complete</h4>
                  <p className="text-[11px] text-[#A39BB0]">
                    Computer released. Ready for Cycle {state.currentCycle}/3.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartNextCycle}
                className="px-3 py-1.5 rounded-lg bg-[#8EE4AF] hover:bg-[#8EE4AF]/90 text-xs font-bold text-[#1E2022] cursor-pointer whitespace-nowrap shadow"
              >
                Start Cycle {state.currentCycle}
              </button>
            </div>
          )}
          <div className="bg-[#181B1F]/70 border border-[#2E383F]/70 backdrop-blur-md rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2E383F]/50">
              <span className="text-[11px] font-bold tracking-wider text-[#8EE4AF] uppercase">
                macOS Native Pomodoro
              </span>
              <span className="text-[10px] text-[#A39BB0]">Zero Dependencies</span>
            </div>

            <p className="text-xs text-[#D5DBDB] leading-relaxed mb-3">
              Lightweight desktop Pomodoro tailored for macOS to reduce cognitive fatigue, enforce structured study/work sets, and lock the monitor during rest periods.
            </p>

            <div className="flex items-center gap-2">
              <a
                href="/pomodoro_macos.py"
                download="pomodoro_macos.py"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8EE4AF] hover:bg-[#8EE4AF]/90 text-xs font-bold text-[#1E2022] shadow transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download `pomodoro_macos.py`</span>
              </a>
              <button
                type="button"
                onClick={() => setIsPythonModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262D] hover:bg-[#2E383F] text-xs font-semibold text-[#8EE4AF] border border-[#2E383F] transition-all cursor-pointer shadow-sm"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>View Code & Instructions</span>
              </button>
            </div>
          </div>

          {/* Interactive Testing & Simulation Strip */}
          <div className="bg-[#181B1F]/70 border border-[#2E383F]/70 backdrop-blur-md rounded-xl p-3 shadow-xl text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#A39BB0] block mb-2">
              Fast-Testing Controls
            </span>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={handleFastForward10s}
                aria-label="Skip 10 seconds"
                title="Advance timer by 10 seconds"
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#21262D] hover:bg-[#2E383F] text-slate-200 text-[11px] font-medium border border-[#2E383F]/50 transition-colors"
              >
                <FastForward className="w-3 h-3 text-[#8EE4AF]" />
                <span>+10s</span>
              </button>

              <button
                type="button"
                onClick={handleJumpToCycleFinish}
                aria-label="Finish Focus Cycle"
                title="Instantly trigger the 00:00 focus transition into full-screen lockdown break"
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#21262D] hover:bg-[#2E383F] text-slate-200 text-[11px] font-medium border border-[#2E383F]/50 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-[#8EE4AF]" />
                <span>Finish Focus</span>
              </button>

              {state.phase === 'break' && (
                <button
                  type="button"
                  onClick={handleJumpToBreakFinish}
                  aria-label="Finish Rest Break"
                  title="Instantly complete break rest period to test computer release and manual start"
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#21262D] hover:bg-[#2E383F] text-slate-200 text-[11px] font-medium border border-[#2E383F]/50 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-[#E2D4F0]" />
                  <span>Finish Break</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setWidgetPosition(widgetPosition === 'bottom_right' ? 'centered' : 'bottom_right')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#21262D] hover:bg-[#2E383F] text-[#A39BB0] hover:text-white text-[11px] border border-[#2E383F]/50 transition-colors ml-auto"
                title="Toggle between anchored bottom-right and center preview"
              >
                <Monitor className="w-3 h-3" />
                <span>{widgetPosition === 'bottom_right' ? 'Anchor: Bottom-Right' : 'Anchor: Centered'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Floating Widget anchored to bottom-right corner of desktop screen */}
        {/* (Only visible when NOT in break mode, as per specification) */}
        {!isBreakActive && (
          <div
            className={`z-20 transition-all duration-300 ${
              widgetPosition === 'bottom_right'
                ? 'absolute bottom-20 right-6 sm:bottom-24 sm:right-8'
                : 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
            }`}
          >
            <FloatingWidget
              state={state}
              onSelectInterval={handleSelectInterval}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onReset={handleReset}
              onPlayChimeTest={handlePlayChimeTest}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
            />
          </div>
        )}

        {/* 4. Full-Screen Break Lockdown Overlay (Automatically triggers at 00:00) */}
        {isBreakActive && (
          <FullScreenBreakOverlay
            state={state}
            onSkipBreak={handleSkipBreak}
            onStartNextCycle={handleStartNextCycle}
            isRealFullscreen={isRealFullscreen}
            onToggleRealFullscreen={toggleRealFullscreen}
          />
        )}

        {/* 5. macOS Dock simulation */}
        <div className="relative z-10 w-full flex justify-center pb-3 pointer-events-auto">
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#16181B]/80 backdrop-blur-xl border border-white/10 shadow-2xl">
            <div
              className="p-2.5 rounded-xl bg-gradient-to-b from-[#3A88E9] to-[#1E56B6] text-white shadow hover:scale-110 transition-transform cursor-pointer"
              title="Finder"
            >
              <Folder className="w-5 h-5" />
            </div>

            <div
              className="p-2.5 rounded-xl bg-[#1E2022] border border-[#2E383F] text-[#8EE4AF] shadow hover:scale-110 transition-transform cursor-pointer relative"
              title="Komorebi Pomodoro (Active)"
            >
              <Sparkles className="w-5 h-5" />
              {/* Active app dot */}
              <span className="w-1 h-1 rounded-full bg-white/80 absolute -bottom-1 left-1/2 -translate-x-1/2" />
            </div>

            <div
              onClick={() => setIsPythonModalOpen(true)}
              className="p-2.5 rounded-xl bg-[#1A1D20] border border-[#2E383F] text-slate-300 shadow hover:scale-110 transition-transform cursor-pointer"
              title="Python Terminal"
            >
              <Terminal className="w-5 h-5" />
            </div>

            <div
              className="p-2.5 rounded-xl bg-[#2D3748] text-slate-300 shadow hover:scale-110 transition-transform cursor-pointer"
              title="Editor"
            >
              <Code2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </main>

      {/* Standalone Python Application Inspector Modal */}
      <PythonScriptModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
      />
    </div>
  );
};
