import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2, Sparkles, Coffee, ArrowRight, ShieldAlert, Heart } from 'lucide-react';
import { PomodoroState, formatTime } from '../utils/pomodoroLogic';

interface FullScreenBreakOverlayProps {
  state: PomodoroState;
  onSkipBreak: () => void;
  onStartNextCycle: () => void;
  isRealFullscreen: boolean;
  onToggleRealFullscreen: () => void;
}

const REASSURING_PROMPTS = [
  {
    title: 'Rest Your Eyes & Posture',
    prompt: 'Look away from the screen toward a distant object. Roll your shoulders back and unclench your jaw.',
    icon: Coffee,
  },
  {
    title: 'Hydration & Movement',
    prompt: 'Stand up, stretch your spine, and drink a refreshing glass of water to replenish your focus.',
    icon: Sparkles,
  },
  {
    title: 'Mindful Breathing',
    prompt: 'Take deep diaphragmatic breaths: inhale calmly through your nose, hold, and release tension slowly.',
    icon: Heart,
  },
  {
    title: 'Cognitive Reset',
    prompt: 'Give your working memory gentle space. Unstructured mental rest directly restores deep creative capacity.',
    icon: Coffee,
  },
];

export const FullScreenBreakOverlay: React.FC<FullScreenBreakOverlayProps> = ({
  state,
  onSkipBreak,
  onStartNextCycle,
  isRealFullscreen,
  onToggleRealFullscreen,
}) => {
  const isCompleted = state.phase === 'break_complete';
  const isLongBreak = state.breakType === 'long';
  const remainingTimeStr = formatTime(state.timeRemainingSeconds);

  // Breathing guide cycle (Inhale 4s, Hold 4s, Exhale 6s = 14s cycle)
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [breathSecond, setBreathSecond] = useState(0);

  useEffect(() => {
    if (isCompleted) return;
    const interval = setInterval(() => {
      setBreathSecond((prev) => {
        const next = (prev + 1) % 14;
        if (next < 4) setBreathPhase('Inhale');
        else if (next < 8) setBreathPhase('Hold');
        else setBreathPhase('Exhale');
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isCompleted]);

  // Prompt based on completed cycle
  const promptData = REASSURING_PROMPTS[(state.cyclesCompletedTotal - 1) % REASSURING_PROMPTS.length] || REASSURING_PROMPTS[0];
  const PromptIcon = promptData.icon;

  const totalBreakSeconds = state.breakTotalSeconds || (isLongBreak ? 1200 : 300);
  const breakProgress = totalBreakSeconds > 0
    ? Math.min(100, Math.max(0, ((totalBreakSeconds - state.timeRemainingSeconds) / totalBreakSeconds) * 100))
    : 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full-Screen Rest & Lockdown"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-12 select-none overflow-hidden"
      style={{
        backgroundColor: '#0D1117', // Petrol / pitch dark black
        color: '#E2D4F0', // Soft pastel lavender
      }}
    >
      {/* Top Bar: Lockdown indicator & Display toggles */}
      <div className="w-full max-w-4xl flex items-center justify-between text-xs border-b border-[#21262D] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#21262D] text-[#A39BB0] font-mono text-[11px] border border-[#2E383F]">
            <ShieldAlert className="w-3.5 h-3.5 text-[#E2D4F0]" />
            <span>FULL-SCREEN REST LOCKDOWN</span>
          </div>
          <span className="text-[#A39BB0] hidden sm:inline">
            Cycle {state.currentCycle}/3 Completed
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleRealFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262D] hover:bg-[#2E383F] text-[#E2D4F0] text-xs font-medium transition-colors border border-[#2E383F]/60"
            title={isRealFullscreen ? 'Exit macOS Fullscreen' : 'Enter Real Fullscreen'}
          >
            {isRealFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desktop Fullscreen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Center Zone: Rest Timer, Reassuring Prompts & Breathing Guide */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-2xl text-center px-4 py-8">
        {!isCompleted ? (
          <>
            {/* Break Tag */}
            <div className="mb-4">
              <span className="text-xs uppercase tracking-[0.25em] font-semibold text-[#A39BB0]">
                {isLongBreak ? 'Deep Rest Interval • 20 Minutes' : 'Short Rest Interval • 5 Minutes'}
              </span>
            </div>

            {/* Centered Large Countdown */}
            <div
              className="font-mono-numbers text-7xl sm:text-9xl font-bold tracking-tight text-[#E2D4F0] mb-6 drop-shadow-lg"
              style={{
                textShadow: '0 0 40px rgba(226, 212, 240, 0.15)',
              }}
            >
              {remainingTimeStr}
            </div>

            {/* Rest Progress Bar */}
            <div className="w-64 sm:w-80 h-1.5 bg-[#21262D] rounded-full overflow-hidden mb-8">
              <div
                className="h-full bg-gradient-to-r from-[#A39BB0] to-[#E2D4F0] transition-all duration-300"
                style={{ width: `${breakProgress}%` }}
              />
            </div>

            {/* Breathing Guide Animation Orb */}
            <div className="flex flex-col items-center justify-center my-4">
              <div
                className="relative flex items-center justify-center w-28 h-28 rounded-full border border-[#E2D4F0]/30 transition-all duration-1000 ease-in-out"
                style={{
                  transform: breathPhase === 'Inhale' ? 'scale(1.2)' : breathPhase === 'Hold' ? 'scale(1.2)' : 'scale(0.9)',
                  backgroundColor: breathPhase === 'Hold' ? 'rgba(226, 212, 240, 0.12)' : 'rgba(226, 212, 240, 0.05)',
                  boxShadow: '0 0 30px rgba(226, 212, 240, 0.1)',
                }}
              >
                <span className="text-sm font-semibold tracking-wider text-[#E2D4F0] uppercase">
                  {breathPhase}
                </span>
              </div>
              <span className="text-xs text-[#A39BB0] mt-3">
                {breathPhase === 'Inhale' && 'Breathe in slowly through your nose (4s)'}
                {breathPhase === 'Hold' && 'Hold gently and release physical tension (4s)'}
                {breathPhase === 'Exhale' && 'Exhale completely through relaxed lips (6s)'}
              </span>
            </div>

            {/* Reassuring Prompt Card */}
            <div className="mt-8 p-5 rounded-xl bg-[#21262D]/60 border border-[#2E383F]/60 max-w-lg">
              <div className="flex items-center justify-center gap-2 mb-2 text-[#E2D4F0]">
                <PromptIcon className="w-4 h-4 text-[#8EE4AF]" />
                <h3 className="text-sm font-semibold tracking-wide">{promptData.title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-[#A39BB0]">
                {promptData.prompt}
              </p>
            </div>
          </>
        ) : (
          /* Break Complete / Computer Released Screen */
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-[#21262D] border border-[#8EE4AF]/40 flex items-center justify-center mb-6 text-[#8EE4AF]">
              <Sparkles className="w-8 h-8" />
            </div>

            <span className="text-xs uppercase tracking-[0.2em] font-semibold text-[#8EE4AF] mb-2">
              Rest Period Complete
            </span>

            <h2 className="text-3xl sm:text-4xl font-bold text-[#E2D4F0] mb-4">
              Mind Cleared & Ready
            </h2>

            <p className="text-sm text-[#A39BB0] max-w-md leading-relaxed mb-8">
              Your rest interval has concluded and the computer has been released. The application waits for you to begin the next focus block at your own pace.
            </p>

            {/* Manual Next-Cycle Initiation Button */}
            <button
              type="button"
              onClick={onStartNextCycle}
              className="flex items-center gap-2 py-3 px-8 rounded-xl font-bold text-sm tracking-wide bg-[#8EE4AF] hover:bg-[#8EE4AF]/90 text-[#1E2022] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Start Next Focus</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Bar: Emergency Skip Break button */}
      <div className="w-full max-w-4xl flex items-center justify-between text-xs pt-4 border-t border-[#21262D]">
        <span className="text-[#A39BB0] text-[11px]">
          {isCompleted ? 'Computer released from lockdown' : 'Prevent accidental overtime via unmissable break'}
        </span>

        {!isCompleted && (
          <button
            type="button"
            onClick={onSkipBreak}
            aria-label="Skip Break Button"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#21262D] hover:bg-[#2E383F] text-[#A39BB0] hover:text-[#E2D4F0] transition-colors border border-[#2E383F]"
          >
            <span>Skip Break (Emergency Bypass)</span>
          </button>
        )}
      </div>
    </div>
  );
};
