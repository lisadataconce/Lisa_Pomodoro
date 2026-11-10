#!/usr/bin/env python3
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
from tkinter import font as tkfont

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

        # Break window placeholder
        self.break_window = None

        # Build Floating Widget
        self._setup_floating_widget()
        self._update_display()

    def _setup_floating_widget(self):
        self.root.configure(bg=BG_FOCUS)
        self.root.overrideredirect(True)  # Frameless floating widget
        self.root.wm_attributes("-topmost", True)  # Always on top

        # Anchor to bottom-right corner of primary screen
        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        widget_w = 260
        widget_h = 175
        pos_x = screen_w - widget_w - 24
        pos_y = screen_h - widget_h - 48
        self.root.geometry(f"{widget_w}x{widget_h}+{pos_x}+{pos_y}")

        # Dragging capability
        self.root.bind("<ButtonPress-1>", self._start_drag)
        self.root.bind("<B1-Motion>", self._on_drag)

        # Container Frame
        self.card = tk.Frame(self.root, bg=BG_FOCUS, padx=14, pady=12, highlightthickness=1, highlightbackground="#2E383F")
        self.card.pack(fill="both", expand=True)

        # Header Row: Title & Interval Selectors
        header_row = tk.Frame(self.card, bg=BG_FOCUS)
        header_row.pack(fill="x")

        lbl_title = tk.Label(header_row, text="FOCUS", font=("SF Pro Display", 9, "bold"), fg=SECONDARY_ACCENT, bg=BG_FOCUS)
        lbl_title.pack(side="left")

        # Interval Toggle (30m / 45m)
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

        # Main Countdown Timer
        self.lbl_timer = tk.Label(
            self.card, text="30:00", font=("Courier", 34, "bold"),
            fg=MINT_ACCENT, bg=BG_FOCUS
        )
        self.lbl_timer.pack(pady=(4, 2))

        # Cycle & Cumulative Time Label
        self.lbl_stats = tk.Label(
            self.card, text="Cycle 1/3 • 0h 00m", font=("SF Pro Text", 10),
            fg=TEXT_MUTED, bg=BG_FOCUS
        )
        self.lbl_stats.pack(pady=(0, 8))

        # Action Buttons Row
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
        # Focus block completed! Add cumulative milestone
        added_sec = self.selected_interval * 60
        self.cumulative_focus_seconds += added_sec
        
        # Audio cue announcing break screen
        play_macos_ping()

        # Determine break type (Short 5m for Cycle 1 & 2; Long 20m for Cycle 3)
        if self.current_cycle % 3 == 0:
            self.break_type = "long"
            self.time_remaining = 20 * 60
        else:
            self.break_type = "short"
            self.time_remaining = 5 * 60

        self.phase = "break"
        self._launch_break_lockdown()

    def _launch_break_lockdown(self):
        # Hide the floating widget
        self.root.withdraw()

        # Create or reuse full-screen lockdown window
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

        # Center Container
        center_frame = tk.Frame(self.break_window, bg=BG_BREAK)
        center_frame.place(relx=0.5, rely=0.5, anchor="center")

        break_title = "LONG REST" if self.break_type == "long" else "SHORT REST"
        lbl_badge = tk.Label(
            center_frame, text=f"CYCLE {self.current_cycle}/3 COMPLETED • {break_title}",
            font=("SF Pro Text", 13, "bold"), fg=BREAK_SUBTEXT, bg=BG_BREAK
        )
        lbl_badge.pack(pady=(0, 16))

        # Centered countdown in lavender
        self.lbl_break_timer = tk.Label(
            center_frame, text=format_time(self.time_remaining),
            font=("Courier", 88, "bold"), fg=BREAK_TEXT, bg=BG_BREAK
        )
        self.lbl_break_timer.pack(pady=(0, 24))

        # Reassuring Prompt
        prompt_text = REASSURING_PROMPTS[self.prompt_index % len(REASSURING_PROMPTS)]
        self.prompt_index += 1

        lbl_prompt = tk.Label(
            center_frame, text=prompt_text, font=("SF Pro Display", 16),
            fg=BREAK_TEXT, bg=BG_BREAK, wraplength=700, justify="center"
        )
        lbl_prompt.pack(pady=(0, 36))

        # Action Buttons: Skip Break button
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
        # Audio cue: break finished alerting user rest has elapsed
        play_macos_ping()
        self._release_break_lockdown()

    def _release_break_lockdown(self):
        if self.timer_job:
            self.root.after_cancel(self.timer_job)
            self.timer_job = None

        if self.break_window:
            self.break_window.destroy()
            self.break_window = None

        # Re-show floating widget
        self.root.deiconify()

        # Advance to next cycle (e.g. 1->2, 2->3, 3->1)
        if self.current_cycle >= 3:
            self.current_cycle = 1
        else:
            self.current_cycle += 1

        self.phase = "break_complete"
        self.time_remaining = self.selected_interval * 60

        # Ready for user to explicitly click "Start Next Focus"
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
