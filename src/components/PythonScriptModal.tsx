import React, { useState } from 'react';
import { X, Copy, Check, Download, Terminal, Apple, ShieldCheck } from 'lucide-react';

interface PythonScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PYTHON_CODE = `#!/usr/bin/env python3
"""
Komorebi Pomodoro — Standalone Desktop Pomodoro for macOS
=========================================================
A custom, lightweight, standalone desktop Pomodoro application written entirely in Python
for local personal use on macOS without any third-party external dependencies.

Features:
- Floating widget anchored to the bottom-right corner, always on top.
- 30-minute / 45-minute focus intervals.
- Cumulative focus time and cycle milestone tracking (Cycle X/3 • Xh YYm).
- Automatic full-screen lockdown break screens (5 min short / 20 min long).
- Emergency skip break button & automatic computer release upon expiration.
- Manual next-cycle initiation (waits for user to click "Start Next Focus").
- Native macOS Ping chime (/System/Library/Sounds/Ping.aiff via afplay).
- Zero pip dependencies (Standard library: tkinter, subprocess, threading, time).

Run on macOS:
    python3 pomodoro_macos.py
"""

import sys
import os
import subprocess
import threading
import time
import tkinter as tk

# Visual Palette Specifications
BG_FOCUS = "#1E2022"       # Deep dark graphite grey
MINT_ACCENT = "#8EE4AF"    # Fresh mint green
TEXT_MUTED = "#D5DBDB"     # Soft muted grey
BTN_DARK = "#2E383F"       # Subtle charcoal tones
SECONDARY_ACCENT = "#A39BB0"

BG_BREAK = "#0D1117"       # Petrol / pitch dark black
BREAK_TEXT = "#E2D4F0"     # Soft, pale pastel lavender
BREAK_SUBTEXT = "#A39BB0"  # Soft rosy undertones
BREAK_BTN_BG = "#21262D"   # Deep charcoal slate

REASSURING_PROMPTS = [
    "Step away from the screen. Stretch your spine and roll your shoulders.",
    "Drink a tall glass of cool water and let your eyes rest on the horizon.",
    "Inhale deeply for 4 seconds, hold for 4, and exhale slowly for 6.",
    "Walk around your room, shake out your wrists, and unclench your jaw.",
    "Give your mind gentle space. Rest is an essential part of focused mastery."
]


def play_macos_ping():
    """Play macOS native Ping chime asynchronously without blocking UI."""
    def _play():
        ping_path = "/System/Library/Sounds/Ping.aiff"
        if os.path.exists(ping_path):
            try:
                subprocess.run(["afplay", ping_path], check=False)
            except Exception:
                pass
    threading.Thread(target=_play, daemon=True).start()


def format_time(seconds: int) -> str:
    mins = max(0, seconds) // 60
    secs = max(0, seconds) % 60
    return f"{mins:02d}:{secs:02d}"


def format_cumulative(seconds: int) -> str:
    total_mins = max(0, seconds) // 60
    hours = total_mins // 60
    mins = total_mins % 60
    return f"{hours}h {mins:02d}m"


class PomodoroApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Komorebi Pomodoro")
        
        # State
        self.selected_interval = 30  # 30 or 45 mins
        self.current_cycle = 1       # 1, 2, or 3
        self.cumulative_focus_seconds = 0
        self.time_remaining = self.selected_interval * 60
        self.phase = "idle"  # idle, focusing, paused, break, break_complete
        self.timer_job = None
        self.prompt_index = 0
        self.break_type = "short"
        self.break_window = None

        self._setup_floating_widget()
        self._update_display()

    def _setup_floating_widget(self):
        self.root.configure(bg=BG_FOCUS)
        self.root.overrideredirect(True)           # Frameless floating widget
        self.root.wm_attributes("-topmost", True)  # Always on top

        # Anchor to bottom-right corner of screen with 24px margin
        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        widget_w = 260
        widget_h = 175
        pos_x = screen_w - widget_w - 24
        pos_y = screen_h - widget_h - 48
        self.root.geometry(f"{widget_w}x{widget_h}+{pos_x}+{pos_y}")

        self.root.bind("<ButtonPress-1>", self._start_drag)
        self.root.bind("<B1-Motion>", self._on_drag)

        self.card = tk.Frame(self.root, bg=BG_FOCUS, padx=14, pady=12, highlightthickness=1, highlightbackground="#2E383F")
        self.card.pack(fill="both", expand=True)

        header_row = tk.Frame(self.card, bg=BG_FOCUS)
        header_row.pack(fill="x")

        lbl_title = tk.Label(header_row, text="FOCUS", font=("SF Pro Display", 9, "bold"), fg=SECONDARY_ACCENT, bg=BG_FOCUS)
        lbl_title.pack(side="left")

        self.btn_toggle_30 = tk.Button(
            header_row, text="30m", font=("SF Pro Text", 9, "bold"),
            bg=MINT_ACCENT, fg="#121212", relief="flat", padx=6, pady=1,
            command=lambda: self._select_interval(30), cursor="hand2"
        )
        self.btn_toggle_30.pack(side="right", padx=(2, 0))

        self.btn_toggle_45 = tk.Button(
            header_row, text="45m", font=("SF Pro Text", 9, "normal"),
            bg=BTN_DARK, fg=TEXT_MUTED, relief="flat", padx=6, pady=1,
            command=lambda: self._select_interval(45), cursor="hand2"
        )
        self.btn_toggle_45.pack(side="right", padx=(2, 2))

        self.lbl_timer = tk.Label(
            self.card, text="30:00", font=("Courier", 34, "bold"),
            fg=MINT_ACCENT, bg=BG_FOCUS
        )
        self.lbl_timer.pack(pady=(4, 2))

        self.lbl_stats = tk.Label(
            self.card, text="Cycle 1/3 • 0h 00m", font=("SF Pro Text", 10),
            fg=TEXT_MUTED, bg=BG_FOCUS
        )
        self.lbl_stats.pack(pady=(0, 8))

        btn_row = tk.Frame(self.card, bg=BG_FOCUS)
        btn_row.pack(fill="x")

        self.btn_start_pause = tk.Button(
            btn_row, text="Start", font=("SF Pro Display", 10, "bold"),
            bg=MINT_ACCENT, fg="#121212", relief="flat", pady=4,
            command=self._toggle_start_pause, cursor="hand2"
        )
        self.btn_start_pause.pack(side="left", fill="x", expand=True, padx=(0, 4))

        self.btn_reset = tk.Button(
            btn_row, text="Reset", font=("SF Pro Display", 10),
            bg=BTN_DARK, fg=TEXT_MUTED, relief="flat", pady=4,
            command=self._reset_session, cursor="hand2"
        )
        self.btn_reset.pack(side="right", padx=(4, 0))

    def _start_drag(self, event):
        self._drag_x = event.x
        self._drag_y = event.y

    def _on_drag(self, event):
        deltax = event.x - self._drag_x
        deltay = event.y - self._drag_y
        x = self.root.winfo_x() + deltax
        y = self.root.winfo_y() + deltay
        self.root.geometry(f"+{x}+{y}")

    def _select_interval(self, interval: int):
        if self.phase in ("focusing", "break"):
            return
        self.selected_interval = interval
        self.time_remaining = interval * 60
        self._update_interval_buttons()
        self._update_display()

    def _update_interval_buttons(self):
        if self.selected_interval == 30:
            self.btn_toggle_30.configure(bg=MINT_ACCENT, fg="#121212", font=("SF Pro Text", 9, "bold"))
            self.btn_toggle_45.configure(bg=BTN_DARK, fg=TEXT_MUTED, font=("SF Pro Text", 9, "normal"))
        else:
            self.btn_toggle_30.configure(bg=BTN_DARK, fg=TEXT_MUTED, font=("SF Pro Text", 9, "normal"))
            self.btn_toggle_45.configure(bg=MINT_ACCENT, fg="#121212", font=("SF Pro Text", 9, "bold"))

    def _update_display(self):
        self.lbl_timer.configure(text=format_time(self.time_remaining))
        cumul_str = format_cumulative(self.cumulative_focus_seconds)
        self.lbl_stats.configure(text=f"Cycle {self.current_cycle}/3 • {cumul_str}")

        if self.phase == "focusing":
            self.btn_start_pause.configure(text="Pause", bg="#E2D4F0", fg="#121212")
        elif self.phase == "paused":
            self.btn_start_pause.configure(text="Resume", bg=MINT_ACCENT, fg="#121212")
        else:
            self.btn_start_pause.configure(text="Start", bg=MINT_ACCENT, fg="#121212")

    def _toggle_start_pause(self):
        if self.phase == "idle":
            self.phase = "focusing"
            play_macos_ping()
            self._schedule_tick()
        elif self.phase == "focusing":
            self.phase = "paused"
            if self.timer_job:
                self.root.after_cancel(self.timer_job)
                self.timer_job = None
        elif self.phase == "paused":
            self.phase = "focusing"
            self._schedule_tick()
        self._update_display()

    def _schedule_tick(self):
        if self.timer_job:
            self.root.after_cancel(self.timer_job)
        self.timer_job = self.root.after(1000, self._on_tick)

    def _on_tick(self):
        if self.phase == "focusing":
            self.time_remaining -= 1
            if self.time_remaining <= 0:
                self._complete_focus_session()
            else:
                self._update_display()
                self._schedule_tick()
        elif self.phase == "break":
            self.time_remaining -= 1
            if self.time_remaining <= 0:
                self._complete_break()
            else:
                self._update_break_display()
                self._schedule_tick()

    def _complete_focus_session(self):
        added_sec = self.selected_interval * 60
        self.cumulative_focus_seconds += added_sec
        play_macos_ping()

        if self.current_cycle % 3 == 0:
            self.break_type = "long"
            self.time_remaining = 20 * 60
        else:
            self.break_type = "short"
            self.time_remaining = 5 * 60

        self.phase = "break"
        self._launch_break_lockdown()

    def _launch_break_lockdown(self):
        self.root.withdraw()
        if self.break_window is not None:
            try:
                self.break_window.destroy()
            except Exception:
                pass

        self.break_window = tk.Toplevel(self.root)
        self.break_window.title("Rest & Recalibrate")
        self.break_window.configure(bg=BG_BREAK)
        self.break_window.attributes("-fullscreen", True)
        self.break_window.wm_attributes("-topmost", True)

        center_frame = tk.Frame(self.break_window, bg=BG_BREAK)
        center_frame.place(relx=0.5, rely=0.5, anchor="center")

        break_title = "LONG REST" if self.break_type == "long" else "SHORT REST"
        lbl_badge = tk.Label(
            center_frame, text=f"CYCLE {self.current_cycle}/3 COMPLETED • {break_title}",
            font=("SF Pro Text", 13, "bold"), fg=BREAK_SUBTEXT, bg=BG_BREAK
        )
        lbl_badge.pack(pady=(0, 16))

        self.lbl_break_timer = tk.Label(
            center_frame, text=format_time(self.time_remaining),
            font=("Courier", 88, "bold"), fg=BREAK_TEXT, bg=BG_BREAK
        )
        self.lbl_break_timer.pack(pady=(0, 24))

        prompt_text = REASSURING_PROMPTS[self.prompt_index % len(REASSURING_PROMPTS)]
        self.prompt_index += 1

        lbl_prompt = tk.Label(
            center_frame, text=prompt_text, font=("SF Pro Display", 16),
            fg=BREAK_TEXT, bg=BG_BREAK, wraplength=700, justify="center"
        )
        lbl_prompt.pack(pady=(0, 36))

        self.break_btn_frame = tk.Frame(center_frame, bg=BG_BREAK)
        self.break_btn_frame.pack()

        self.btn_skip = tk.Button(
            self.break_btn_frame, text="Skip Break", font=("SF Pro Text", 12),
            bg=BREAK_BTN_BG, fg=BREAK_SUBTEXT, relief="flat", padx=18, pady=8,
            command=self._skip_break, cursor="hand2"
        )
        self.btn_skip.pack()

        self._schedule_tick()

    def _update_break_display(self):
        if hasattr(self, "lbl_break_timer") and self.lbl_break_timer:
            self.lbl_break_timer.configure(text=format_time(self.time_remaining))

    def _skip_break(self):
        self._release_break_lockdown()

    def _complete_break(self):
        play_macos_ping()
        self._release_break_lockdown()

    def _release_break_lockdown(self):
        if self.timer_job:
            self.root.after_cancel(self.timer_job)
            self.timer_job = None

        if self.break_window:
            self.break_window.destroy()
            self.break_window = None

        self.root.deiconify()

        if self.current_cycle >= 3:
            self.current_cycle = 1
        else:
            self.current_cycle += 1

        self.phase = "break_complete"
        self.time_remaining = self.selected_interval * 60
        self.btn_start_pause.configure(text="Start Next Focus", bg=MINT_ACCENT, fg="#121212")
        self._update_display()

    def _reset_session(self):
        if self.timer_job:
            self.root.after_cancel(self.timer_job)
            self.timer_job = None

        if self.break_window:
            self.break_window.destroy()
            self.break_window = None

        self.root.deiconify()
        self.phase = "idle"
        self.current_cycle = 1
        self.cumulative_focus_seconds = 0
        self.time_remaining = self.selected_interval * 60
        self._update_display()

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    app = PomodoroApp()
    app.run()
`;

export const PythonScriptModal: React.FC<PythonScriptModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(PYTHON_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([PYTHON_CODE], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pomodoro_macos.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="python-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="bg-[#1E2022] border border-[#2E383F] w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2E383F] bg-[#161819]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#2E383F]/70 text-[#8EE4AF]">
              <Apple className="w-5 h-5" />
            </div>
            <div>
              <h2 id="python-modal-title" className="text-base font-bold text-white">
                macOS Standalone Python Application
              </h2>
              <p className="text-xs text-[#A39BB0]">
                Zero-dependency local desktop script (`pomodoro_macos.py`)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A39BB0] hover:text-white hover:bg-[#2E383F] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Info Bar */}
        <div className="px-6 py-3 bg-[#0D1117] border-b border-[#2E383F] flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 text-[#D5DBDB]">
            <span className="flex items-center gap-1.5 text-[#8EE4AF]">
              <ShieldCheck className="w-4 h-4" />
              <span>0 external pip dependencies</span>
            </span>
            <span className="text-[#A39BB0]">•</span>
            <span>Uses standard `tkinter` + `afplay Ping.aiff`</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E383F] hover:bg-[#2E383F]/80 text-xs font-medium text-white transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#8EE4AF]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8EE4AF] hover:bg-[#8EE4AF]/90 text-xs font-bold text-[#1E2022] transition-colors shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .py</span>
            </button>
          </div>
        </div>

        {/* macOS Quick Run Instructions */}
        <div className="px-6 py-3 bg-[#181B1D] border-b border-[#2E383F] text-xs text-[#D5DBDB]">
          <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-[#8EE4AF]" />
            <span>How to run on macOS Terminal in 5 seconds:</span>
          </div>
          <code className="block bg-[#0D1117] text-[#8EE4AF] font-mono px-3 py-1.5 rounded border border-[#2E383F] select-all">
            python3 pomodoro_macos.py
          </code>
        </div>

        {/* Code Content Viewport */}
        <div className="p-4 overflow-y-auto flex-1 bg-[#0D1117] font-mono text-xs text-[#D5DBDB] leading-relaxed">
          <pre className="whitespace-pre">{PYTHON_CODE}</pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#161819] border-t border-[#2E383F] flex items-center justify-between text-xs text-[#A39BB0]">
          <span>Anchored to bottom-right corner • Always-on-top • Fullscreen break lock</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#2E383F] hover:bg-[#2E383F]/80 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
