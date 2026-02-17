"""
╔══════════════════════════════════════════════════════════╗
║           NOVA VIDEO EDITOR — Editor Professionale       ║
╚══════════════════════════════════════════════════════════╝
Richiede: pip install opencv-python pillow numpy
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, colorchooser
import threading
import time
import os
import math

try:
    import cv2
    import numpy as np
    from PIL import Image, ImageTk, ImageEnhance, ImageFilter, ImageChops
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

# ─── PALETTE COLORI ────────────────────────────────────────
BG_DEEP    = "#0a0a0f"
BG_PANEL   = "#111118"
BG_CARD    = "#1a1a26"
BG_HOVER   = "#222233"
ACCENT     = "#6c63ff"
ACCENT2    = "#ff6584"
ACCENT3    = "#43e97b"
TEXT_MAIN  = "#f0f0ff"
TEXT_DIM   = "#7070a0"
TEXT_MUTED = "#404060"
BORDER     = "#2a2a40"
TIMELINE   = "#0d0d1a"
TRACK_BG   = "#161625"
PLAYHEAD   = "#ff6584"
GLASS_DARK = "#151522"
NEON_GLOW  = "#7c74ff"

# ─── FONT ──────────────────────────────────────────────────
FONT_TITLE  = ("Courier New", 18, "bold")
FONT_HEAD   = ("Courier New", 11, "bold")
FONT_LABEL  = ("Courier New", 9)
FONT_SMALL  = ("Courier New", 8)
FONT_BTN    = ("Courier New", 9, "bold")
FONT_BIG    = ("Courier New", 13, "bold")


class Tooltip:
    def __init__(self, widget, text):
        self.widget = widget
        self.text = text
        self.tip = None
        widget.bind("<Enter>", self.show)
        widget.bind("<Leave>", self.hide)

    def show(self, e=None):
        x = self.widget.winfo_rootx() + 20
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 4
        self.tip = tk.Toplevel(self.widget)
        self.tip.wm_overrideredirect(True)
        self.tip.wm_geometry(f"+{x}+{y}")
        tk.Label(self.tip, text=self.text, bg="#1e1e2e", fg=TEXT_MAIN,
                 font=FONT_SMALL, padx=8, pady=4,
                 relief="solid", bd=1).pack()

    def hide(self, e=None):
        if self.tip:
            self.tip.destroy()
            self.tip = None


def _mix_hex(c1, c2, t):
    t = max(0.0, min(1.0, t))
    a = tuple(int(c1[i:i+2], 16) for i in (1, 3, 5))
    b = tuple(int(c2[i:i+2], 16) for i in (1, 3, 5))
    m = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return f"#{m[0]:02x}{m[1]:02x}{m[2]:02x}"


class VideoEditor(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("NOVA — Video Editor")
        self.geometry("1400x900")
        self.minsize(1100, 750)
        self.configure(bg=BG_DEEP)
        self.modal_minimal = tk.BooleanVar(value=False)
        self._ui_anim_phase = 0
        self.preview_zoom = 1.0
        self.preview_pan = [0, 0]
        self.preview_show_grid = tk.BooleanVar(value=True)
        self.preview_show_safe = tk.BooleanVar(value=True)
        self.preview_show_crop = tk.BooleanVar(value=False)
        self.preview_show_rulers = tk.BooleanVar(value=True)
        self.preview_pip = tk.BooleanVar(value=True)
        self.preview_fullscreen = False

        # ─── Audio PRO ───
        self.audio_mixer = {
            "master": tk.DoubleVar(value=0.0),
            "music": tk.DoubleVar(value=0.0),
            "voice": tk.DoubleVar(value=0.0),
            "sfx": tk.DoubleVar(value=0.0),
        }
        self.audio_fx = {
            "eq_low": tk.DoubleVar(value=0.0),
            "eq_mid": tk.DoubleVar(value=0.0),
            "eq_high": tk.DoubleVar(value=0.0),
            "noise_reduction": tk.DoubleVar(value=0.0),
            "compressor": tk.DoubleVar(value=0.0),
            "reverb": tk.DoubleVar(value=0.0),
        }
        self.auto_fade_audio = tk.BooleanVar(value=True)
        self.auto_ducking = tk.BooleanVar(value=False)
        self.auto_align_audio = tk.BooleanVar(value=False)
        self.snap_to_beat = tk.BooleanVar(value=False)
        self.detected_bpm = tk.DoubleVar(value=120.0)
        self.beat_markers = []
        self.audio_visualizer_phase = 0

        # ─── Stato video ───
        self.cap = None
        self.video_path = None
        self.total_frames = 0
        self.fps = 30
        self.current_frame_idx = 0
        self.playing = False
        self.play_thread = None
        self.original_frame = None   # frame OpenCV corrente
        self.clips = []              # lista clip importate
        self.timeline_clips = []
        self.timeline_markers = []
        self.timeline_tracks = [
            {"name": "V1", "type": "video", "locked": False, "muted": False, "solo": False},
            {"name": "A1", "type": "audio", "locked": False, "muted": False, "solo": False},
        ]
        self.selected_clip_ids = set()
        self.clip_groups = {}
        self.next_clip_id = 1
        self.snap_enabled = True
        self.snap_threshold_frames = 8
        self.ripple_enabled = True
        self.tl_scroll_y = 0
        self._tl_drag = None

        # ─── Transizioni ───
        self.transition_presets = [
            "Nessuna", "Crossfade", "Fade In", "Fade Out", "Zoom", "Slide", "Whip Pan",
            "Blur", "Glitch", "Spin", "Luma Fade", "Maschera Animata"
        ]
        self.transition_var = tk.StringVar(value="Crossfade")
        self.transition_duration = tk.DoubleVar(value=1.0)
        self.clip_transitions = {}

        # ─── Keyframe system ───
        self.transform_vars = {
            "pos_x": tk.DoubleVar(value=0.0),
            "pos_y": tk.DoubleVar(value=0.0),
            "scale": tk.DoubleVar(value=1.0),
            "opacity": tk.DoubleVar(value=1.0),
            "color_boost": tk.DoubleVar(value=1.0),
        }
        self.kf_param_var = tk.StringVar(value="position")
        self.kf_ease_var = tk.StringVar(value="ease_in_out")
        self.keyframes = {
            "position": [],
            "scale": [],
            "rotation": [],
            "opacity": [],
            "color": [],
        }

        # ─── Effetti ───
        self.effect_vars = {
            "brightness":  tk.DoubleVar(value=1.0),
            "contrast":    tk.DoubleVar(value=1.0),
            "saturation":  tk.DoubleVar(value=1.0),
            "sharpness":   tk.DoubleVar(value=1.0),
            "blur":        tk.DoubleVar(value=0.0),
            "rotation":    tk.DoubleVar(value=0.0),
            "speed":       tk.DoubleVar(value=1.0),
        }
        self.filter_var   = tk.StringVar(value="Nessuno")
        self.trim_in      = tk.IntVar(value=0)
        self.trim_out     = tk.IntVar(value=0)
        self.vol_var      = tk.DoubleVar(value=100.0)
        self.overlay_text = tk.StringVar(value="")
        self.text_color   = "#ffffff"

        self._build_ui()
        self._setup_keybindings()
        self.after(100, self._show_splash)

    # ══════════════════════════════════════════════════════
    #  UI BUILD
    # ══════════════════════════════════════════════════════
    def _build_ui(self):
        self._build_menubar()
        self._build_topbar()
        self._build_main()
        self._build_timeline()
        self._build_statusbar()
        self._start_ui_animations()

    def _set_custom_cursor(self):
        try:
            self.configure(cursor="dotbox")
        except Exception:
            self.configure(cursor="hand2")

    def _btn_glow(self, btn, on, base):
        if on:
            btn.config(bg=_mix_hex(base, NEON_GLOW, 0.45), highlightthickness=1,
                       highlightbackground=NEON_GLOW)
        else:
            btn.config(bg=base, highlightthickness=0)

    def _btn_press(self, btn, down, base=None):
        if down:
            btn.config(relief="sunken", padx=12, pady=5)
        else:
            btn.config(relief="flat", padx=14, pady=6, bg=base if base else btn.cget("bg"))

    def _start_ui_animations(self):
        self.after(60, self._animate_ui_tick)

    def _animate_ui_tick(self):
        self._ui_anim_phase = (self._ui_anim_phase + 1) % 360
        glow = 0.2 + 0.15 * (1 + math.sin(math.radians(self._ui_anim_phase)))
        if hasattr(self, "topbar"):
            self.topbar.config(bg=_mix_hex(GLASS_DARK, ACCENT, glow))
        self.after(60, self._animate_ui_tick)

    # ── MENUBAR ──
    def _build_menubar(self):
        mb = tk.Menu(self, bg=BG_PANEL, fg=TEXT_MAIN, activebackground=ACCENT,
                     activeforeground=TEXT_MAIN, bd=0, tearoff=0)
        self.config(menu=mb)

        file_m = tk.Menu(mb, bg=BG_PANEL, fg=TEXT_MAIN, activebackground=ACCENT,
                         activeforeground=TEXT_MAIN, tearoff=0)
        file_m.add_command(label="📂  Importa Video...",     command=self.import_video)
        file_m.add_command(label="📂  Aggiungi Clip...",     command=self.import_video)
        file_m.add_separator()
        file_m.add_command(label="💾  Esporta Video...",     command=self.export_video)
        file_m.add_command(label="🖼   Esporta Frame...",     command=self.export_frame)
        file_m.add_separator()
        file_m.add_command(label="❌  Esci",                 command=self.quit)
        mb.add_cascade(label="File", menu=file_m)

        edit_m = tk.Menu(mb, bg=BG_PANEL, fg=TEXT_MAIN, activebackground=ACCENT,
                         activeforeground=TEXT_MAIN, tearoff=0)
        edit_m.add_command(label="✂️  Taglia clip",          command=self.cut_clip)
        edit_m.add_command(label="📋  Duplica clip",         command=self.duplicate_clip)
        edit_m.add_command(label="🗑  Elimina clip",         command=self.delete_clip)
        edit_m.add_command(label="🧲  Snap ON/OFF",          command=self.toggle_snap)
        edit_m.add_command(label="🌊  Ripple ON/OFF",        command=self.toggle_ripple)
        edit_m.add_command(label="🎞️  Applica Transizione",   command=self.apply_transition_to_selection)
        edit_m.add_command(label="⛓️  Raggruppa selezione",   command=self.group_selected_clips)
        edit_m.add_command(label="🔓  Sciogli gruppo",       command=self.ungroup_selected_clips)
        edit_m.add_command(label="🎵  Rileva BPM/Beat",       command=self.detect_bpm_and_beats)
        edit_m.add_command(label="🎧  Auto allinea audio",     command=self.auto_align_audio_tracks)
        edit_m.add_separator()
        edit_m.add_command(label="🔄  Reset effetti",        command=self.reset_effects)
        mb.add_cascade(label="Modifica", menu=edit_m)

        view_m = tk.Menu(mb, bg=BG_PANEL, fg=TEXT_MAIN, activebackground=ACCENT,
                         activeforeground=TEXT_MAIN, tearoff=0)
        view_m.add_command(label="🔍  Zoom in timeline",    command=lambda: self._zoom_timeline(1.2))
        view_m.add_command(label="🔎  Zoom out timeline",   command=lambda: self._zoom_timeline(0.8))
        view_m.add_command(label="🧩  Modal minimal",       command=self.toggle_minimal_mode)
        mb.add_cascade(label="Vista", menu=view_m)

        help_m = tk.Menu(mb, bg=BG_PANEL, fg=TEXT_MAIN, activebackground=ACCENT,
                         activeforeground=TEXT_MAIN, tearoff=0)
        help_m.add_command(label="⌨️  Scorciatoie",          command=self._show_shortcuts)
        help_m.add_command(label="ℹ️   Info",                command=self._show_about)
        mb.add_cascade(label="Aiuto", menu=help_m)

    # ── TOP BAR ──
    def _build_topbar(self):
        top = tk.Frame(self, bg=GLASS_DARK, height=52)
        top.pack(fill="x", side="top")
        top.pack_propagate(False)
        self.topbar = top

        # Logo
        tk.Label(top, text="◈ NOVA", font=("Courier New", 16, "bold"),
                 bg=GLASS_DARK, fg=ACCENT).pack(side="left", padx=18, pady=8)
        tk.Label(top, text="VIDEO EDITOR", font=FONT_SMALL,
                 bg=GLASS_DARK, fg=TEXT_DIM).pack(side="left", pady=8)

        # Separatore
        tk.Frame(top, bg=BORDER, width=1).pack(side="left", fill="y", padx=14, pady=8)

        # Pulsanti principali
        for txt, cmd, tip, col in [
            ("📂 IMPORTA",    self.import_video,  "Importa un video",   ACCENT),
            ("✂️  TAGLIA",     self.cut_clip,       "Taglia al playhead", BG_CARD),
            ("💾 ESPORTA",    self.export_video,  "Esporta video",      ACCENT2),
        ]:
            b = self._topbtn(top, txt, cmd, col)
            Tooltip(b, tip)

        # Indicatore fps/risoluzione
        self.info_label = tk.Label(top, text="Nessun video caricato",
                                   font=FONT_SMALL, bg=GLASS_DARK, fg=TEXT_DIM)
        self.info_label.pack(side="right", padx=20)

        # Separatore decorativo
        sep = tk.Frame(self, bg=ACCENT, height=2)
        sep.pack(fill="x")

        self._set_custom_cursor()

    def _topbtn(self, parent, text, cmd, bg):
        b = tk.Button(parent, text=text, font=FONT_BTN, bg=bg, fg=TEXT_MAIN,
                      activebackground=ACCENT, activeforeground=TEXT_MAIN,
                      bd=0, padx=14, pady=6, cursor="hand2", command=cmd,
                      relief="flat")
        b.pack(side="left", padx=4, pady=8)
        b.bind("<Enter>", lambda e, btn=b: self._btn_glow(btn, True, bg))
        b.bind("<Leave>", lambda e, btn=b, c=bg: self._btn_glow(btn, False, c))
        b.bind("<ButtonPress-1>", lambda e, btn=b: self._btn_press(btn, True))
        b.bind("<ButtonRelease-1>", lambda e, btn=b, c=bg: self._btn_press(btn, False, c))
        return b

    # ── MAIN AREA ──
    def _build_main(self):
        self.main_frame = tk.Frame(self, bg=BG_DEEP)
        self.main_frame.pack(fill="both", expand=True, padx=0, pady=0)

        # Sinistra: pannello effetti
        self._build_effects_panel(self.main_frame)

        # Centro: preview
        self._build_preview(self.main_frame)

        # Destra: pannello proprietà / clip
        self._build_properties_panel(self.main_frame)

        # Layered 3D effect (frame sopra/sotto)
        self.layer_shadow_top = tk.Frame(self.main_frame, bg="#07070d", height=2)
        self.layer_shadow_top.place(relx=0, rely=0, relwidth=1)
        self.layer_shadow_bottom = tk.Frame(self.main_frame, bg="#1d1d2a", height=2)
        self.layer_shadow_bottom.place(relx=0, rely=1, relwidth=1, anchor="sw")

    # ── EFFECTS PANEL ──
    def _build_effects_panel(self, parent):
        panel = tk.Frame(parent, bg=BG_PANEL, width=230)
        panel.pack(side="left", fill="y", padx=0, pady=0)
        panel.pack_propagate(False)

        tk.Label(panel, text="EFFETTI", font=FONT_HEAD,
                 bg=BG_PANEL, fg=ACCENT).pack(pady=(14, 4), padx=14, anchor="w")

        # Canvas scrollabile
        canvas = tk.Canvas(panel, bg=BG_PANEL, highlightthickness=0, bd=0)
        sb = ttk.Scrollbar(panel, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        inner = tk.Frame(canvas, bg=BG_PANEL)
        inner_id = canvas.create_window((0, 0), window=inner, anchor="nw")

        def _resize(e):
            canvas.configure(scrollregion=canvas.bbox("all"))
            canvas.itemconfig(inner_id, width=e.width)
        canvas.bind("<Configure>", _resize)
        inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))

        sliders = [
            ("☀️  Luminosità",  "brightness", 0.0, 3.0),
            ("◉  Contrasto",   "contrast",   0.0, 3.0),
            ("🎨  Saturazione", "saturation", 0.0, 3.0),
            ("🔪  Nitidezza",   "sharpness",  0.0, 3.0),
            ("🌫️  Sfocatura",   "blur",       0.0, 20.0),
            ("🔄  Rotazione",   "rotation",   -180, 180),
            ("⚡  Velocità",    "speed",      0.25, 4.0),
            ("🔊  Volume",      "vol",        0.0, 200.0),
        ]

        for label, key, mn, mx in sliders:
            card = tk.Frame(inner, bg=BG_CARD, bd=0)
            card.pack(fill="x", padx=10, pady=3)

            hdr = tk.Frame(card, bg=BG_CARD)
            hdr.pack(fill="x", padx=8, pady=(6, 0))
            tk.Label(hdr, text=label, font=FONT_LABEL,
                     bg=BG_CARD, fg=TEXT_MAIN).pack(side="left")

            var = self.vol_var if key == "vol" else self.effect_vars.get(key)
            val_lbl = tk.Label(hdr, text=f"{var.get():.2f}",
                               font=FONT_SMALL, bg=BG_CARD, fg=ACCENT)
            val_lbl.pack(side="right")

            def _make_update(v=var, lbl=val_lbl):
                def upd(val):
                    lbl.config(text=f"{float(val):.2f}")
                    self._apply_effects()
                return upd

            sl = ttk.Scale(card, from_=mn, to=mx, orient="horizontal",
                           variable=var, command=_make_update())
            sl.pack(fill="x", padx=8, pady=(0, 6))

        # Filtri preset
        tk.Label(inner, text="FILTRI PRESET", font=FONT_HEAD,
                 bg=BG_PANEL, fg=ACCENT).pack(pady=(12, 4), padx=10, anchor="w")

        filters = ["Nessuno", "Bianco/Nero", "Seppia", "Vintage",
                   "Vivace", "Freddo", "Caldo", "Neon", "Cinema"]
        filter_frame = tk.Frame(inner, bg=BG_PANEL)
        filter_frame.pack(fill="x", padx=10)

        for f in filters:
            rb = tk.Radiobutton(filter_frame, text=f, variable=self.filter_var,
                                value=f, font=FONT_SMALL, bg=BG_PANEL, fg=TEXT_MAIN,
                                selectcolor=ACCENT, activebackground=BG_PANEL,
                                activeforeground=ACCENT, cursor="hand2",
                                command=self._apply_effects)
            rb.pack(anchor="w", pady=1)

        # Testo overlay
        tk.Label(inner, text="TESTO OVERLAY", font=FONT_HEAD,
                 bg=BG_PANEL, fg=ACCENT).pack(pady=(12, 4), padx=10, anchor="w")

        txt_frame = tk.Frame(inner, bg=BG_CARD)
        txt_frame.pack(fill="x", padx=10, pady=4)

        self.text_entry = tk.Entry(txt_frame, textvariable=self.overlay_text,
                                   bg=BG_HOVER, fg=TEXT_MAIN, insertbackground=TEXT_MAIN,
                                   font=FONT_LABEL, bd=0, relief="flat")
        self.text_entry.pack(fill="x", padx=8, pady=(6, 4))
        self.text_entry.bind("<KeyRelease>", lambda e: self._apply_effects())

        color_btn = tk.Button(txt_frame, text="🎨 Colore testo", font=FONT_SMALL,
                              bg=BG_HOVER, fg=TEXT_MAIN, bd=0, cursor="hand2",
                              command=self._pick_text_color)
        color_btn.pack(fill="x", padx=8, pady=(0, 6))

        # Reset
        tk.Button(inner, text="↺  RESET EFFETTI", font=FONT_BTN,
                  bg=ACCENT2, fg=TEXT_MAIN, bd=0, padx=10, pady=6,
                  cursor="hand2", command=self.reset_effects).pack(
                  fill="x", padx=10, pady=14)

    # ── PREVIEW ──
    def _build_preview(self, parent):
        center = tk.Frame(parent, bg=BG_DEEP)
        center.pack(side="left", fill="both", expand=True)

        # Preview canvas
        self.preview_frame = tk.Frame(center, bg="#050508", bd=0, highlightthickness=0)
        self.preview_frame.pack(fill="both", expand=True, padx=8, pady=(8, 0))
        self.preview_shadow = tk.Frame(center, bg="#05050a", height=8)
        self.preview_shadow.pack(fill="x", padx=24, pady=(0, 4))

        self.canvas = tk.Canvas(self.preview_frame, bg="#050508",
                                highlightthickness=0, cursor="crosshair")
        self.canvas.pack(fill="both", expand=True)
        self.canvas.bind("<Configure>", self._redraw_frame)
        self.canvas.bind("<MouseWheel>", self._preview_mousewheel)
        self.canvas.bind("<ButtonPress-2>", self._preview_pan_start)
        self.canvas.bind("<B2-Motion>", self._preview_pan_drag)
        self.canvas.bind("<ButtonPress-3>", self._preview_pan_start)
        self.canvas.bind("<B3-Motion>", self._preview_pan_drag)

        # Placeholder
        self.canvas.bind("<Button-1>", self._canvas_click)

        # Controlli playback
        ctrl = tk.Frame(center, bg=BG_PANEL, height=58)
        ctrl.pack(fill="x", padx=8, pady=4)
        ctrl.pack_propagate(False)

        # Scrubber
        self.scrubber_var = tk.DoubleVar(value=0)
        self.scrubber = ttk.Scale(ctrl, from_=0, to=100, orient="horizontal",
                                  variable=self.scrubber_var,
                                  command=self._scrubber_moved)
        self.scrubber.pack(fill="x", padx=12, pady=(6, 0))

        btns = tk.Frame(ctrl, bg=BG_PANEL)
        btns.pack(pady=4)

        controls = [
            ("⏮", self.go_start,   "Inizio"),
            ("⏪", self.step_back,  "Indietro"),
            ("▶ / ⏸", self.toggle_play, "Play/Pausa"),
            ("⏩", self.step_fwd,   "Avanti"),
            ("⏭", self.go_end,     "Fine"),
        ]
        for txt, cmd, tip in controls:
            b = tk.Button(btns, text=txt, font=FONT_BIG if "▶" in txt else FONT_BTN,
                          bg=ACCENT if "▶" in txt else BG_CARD,
                          fg=TEXT_MAIN, bd=0, padx=14, pady=4,
                          cursor="hand2", command=cmd, relief="flat")
            b.pack(side="left", padx=3)
            Tooltip(b, tip)
            if "▶" in txt:
                self.play_btn = b

        # Timecode
        self.timecode_lbl = tk.Label(btns, text="00:00:00 / 00:00:00",
                                     font=FONT_LABEL, bg=BG_PANEL, fg=TEXT_DIM)
        self.timecode_lbl.pack(side="left", padx=16)

        adv = tk.Frame(center, bg=BG_PANEL, height=32)
        adv.pack(fill="x", padx=8, pady=(0, 4))
        adv.pack_propagate(False)
        tk.Button(adv, text="+", font=FONT_SMALL, bg=BG_CARD, fg=TEXT_MAIN, bd=0,
                  command=lambda: self._set_preview_zoom(self.preview_zoom * 1.1)).pack(side="left", padx=2)
        tk.Button(adv, text="-", font=FONT_SMALL, bg=BG_CARD, fg=TEXT_MAIN, bd=0,
                  command=lambda: self._set_preview_zoom(self.preview_zoom / 1.1)).pack(side="left", padx=2)
        tk.Checkbutton(adv, text="Griglia", variable=self.preview_show_grid, bg=BG_PANEL, fg=TEXT_MAIN,
                       selectcolor=BG_CARD, activebackground=BG_PANEL, command=self._redraw_frame).pack(side="left", padx=4)
        tk.Checkbutton(adv, text="Safe", variable=self.preview_show_safe, bg=BG_PANEL, fg=TEXT_MAIN,
                       selectcolor=BG_CARD, activebackground=BG_PANEL, command=self._redraw_frame).pack(side="left", padx=4)
        tk.Checkbutton(adv, text="Crop", variable=self.preview_show_crop, bg=BG_PANEL, fg=TEXT_MAIN,
                       selectcolor=BG_CARD, activebackground=BG_PANEL, command=self._redraw_frame).pack(side="left", padx=4)
        tk.Checkbutton(adv, text="Rulers", variable=self.preview_show_rulers, bg=BG_PANEL, fg=TEXT_MAIN,
                       selectcolor=BG_CARD, activebackground=BG_PANEL, command=self._redraw_frame).pack(side="left", padx=4)
        tk.Checkbutton(adv, text="PiP", variable=self.preview_pip, bg=BG_PANEL, fg=TEXT_MAIN,
                       selectcolor=BG_CARD, activebackground=BG_PANEL, command=self._redraw_frame).pack(side="left", padx=4)
        tk.Button(adv, text="⛶ Fullscreen", font=FONT_SMALL, bg=ACCENT, fg=TEXT_MAIN, bd=0,
                  command=self.toggle_preview_fullscreen).pack(side="right", padx=4)

    # ── PROPERTIES PANEL ──
    def _build_properties_panel(self, parent):
        panel = tk.Frame(parent, bg=BG_PANEL, width=220)
        panel.pack(side="right", fill="y")
        panel.pack_propagate(False)

        tk.Label(panel, text="CLIP / PROPRIETÀ", font=FONT_HEAD,
                 bg=BG_PANEL, fg=ACCENT).pack(pady=(14, 4), padx=12, anchor="w")

        # Lista clip
        list_frame = tk.Frame(panel, bg=BG_CARD)
        list_frame.pack(fill="x", padx=10, pady=4)

        tk.Label(list_frame, text="CLIP IMPORTATE", font=FONT_SMALL,
                 bg=BG_CARD, fg=TEXT_DIM).pack(anchor="w", padx=8, pady=(6, 2))

        self.clip_listbox = tk.Listbox(list_frame, bg=BG_HOVER, fg=TEXT_MAIN,
                                       selectbackground=ACCENT, font=FONT_SMALL,
                                       height=8, bd=0, relief="flat",
                                       activestyle="none")
        self.clip_listbox.pack(fill="x", padx=4, pady=(0, 4))
        self.clip_listbox.bind("<<ListboxSelect>>", self._on_clip_select)

        btn_row = tk.Frame(list_frame, bg=BG_CARD)
        btn_row.pack(fill="x", padx=4, pady=(0, 6))
        tk.Button(btn_row, text="+ Aggiungi", font=FONT_SMALL, bg=ACCENT,
                  fg=TEXT_MAIN, bd=0, cursor="hand2", command=self.import_video).pack(
                  side="left", padx=2, pady=2)
        tk.Button(btn_row, text="✕ Rimuovi", font=FONT_SMALL, bg=ACCENT2,
                  fg=TEXT_MAIN, bd=0, cursor="hand2", command=self.delete_clip).pack(
                  side="left", padx=2, pady=2)

        # Trim
        tk.Label(panel, text="TAGLIA (TRIM)", font=FONT_HEAD,
                 bg=BG_PANEL, fg=ACCENT).pack(pady=(12, 4), padx=12, anchor="w")

        trim_card = tk.Frame(panel, bg=BG_CARD)
        trim_card.pack(fill="x", padx=10, pady=4)

        for lbl, var, key in [("IN  (frame):", self.trim_in, "in"),
                               ("OUT (frame):", self.trim_out, "out")]:
            row = tk.Frame(trim_card, bg=BG_CARD)
            row.pack(fill="x", padx=8, pady=3)
            tk.Label(row, text=lbl, font=FONT_SMALL, bg=BG_CARD, fg=TEXT_DIM,
                     width=11, anchor="w").pack(side="left")
            tk.Entry(row, textvariable=var, bg=BG_HOVER, fg=TEXT_MAIN,
                     insertbackground=TEXT_MAIN, font=FONT_SMALL, bd=0,
                     width=7).pack(side="left", padx=4)

        tk.Button(trim_card, text="✂  Applica Trim", font=FONT_SMALL,
                  bg=ACCENT, fg=TEXT_MAIN, bd=0, cursor="hand2",
                  command=self.apply_trim).pack(fill="x", padx=8, pady=(4, 8))

        # Info video
        tk.Label(panel, text="INFO VIDEO", font=FONT_HEAD,
                 bg=BG_PANEL, fg=ACCENT).pack(pady=(12, 4), padx=12, anchor="w")

        self.info_card = tk.Frame(panel, bg=BG_CARD)
        self.info_card.pack(fill="x", padx=10, pady=4)

        self.info_rows = {}
        for k in ["File", "Risoluzione", "FPS", "Frame tot.", "Durata", "Codec"]:
            row = tk.Frame(self.info_card, bg=BG_CARD)
            row.pack(fill="x", padx=8, pady=2)
            tk.Label(row, text=k + ":", font=FONT_SMALL, bg=BG_CARD,
                     fg=TEXT_DIM, width=10, anchor="w").pack(side="left")
            lbl = tk.Label(row, text="—", font=FONT_SMALL, bg=BG_CARD,
                           fg=TEXT_MAIN, anchor="w")
            lbl.pack(side="left")
            self.info_rows[k] = lbl

        # Esporta
        tk.Label(panel, text="ESPORTA", font=FONT_HEAD,
                 bg=BG_PANEL, fg=ACCENT).pack(pady=(12, 4), padx=12, anchor="w")

        exp_card = tk.Frame(panel, bg=BG_CARD)
        exp_card.pack(fill="x", padx=10, pady=4)

        for lbl, cmd in [("💾 Esporta Video", self.export_video),
                         ("🖼  Esporta Frame", self.export_frame),
                         ("🎞  Crea GIF",     self.export_gif)]:
            tk.Button(exp_card, text=lbl, font=FONT_SMALL, bg=BG_HOVER,
                      fg=TEXT_MAIN, bd=0, cursor="hand2", pady=5,
                      command=cmd).pack(fill="x", padx=8, pady=3)

        tk.Frame(exp_card, bg=BG_CARD, height=6).pack()

        # Transizioni cinematografiche
        tk.Label(panel, text="TRANSIZIONI CINEMATOGRAFICHE", font=FONT_HEAD,
                 bg=BG_PANEL, fg=ACCENT).pack(pady=(12, 4), padx=12, anchor="w")
        tr_card = tk.Frame(panel, bg=BG_CARD)
        tr_card.pack(fill="x", padx=10, pady=4)

        ttk.Combobox(tr_card, textvariable=self.transition_var, state="readonly",
                     values=self.transition_presets).pack(fill="x", padx=8, pady=(8, 4))

        tk.Label(tr_card, text="Durata transizione (s)", font=FONT_SMALL,
                 bg=BG_CARD, fg=TEXT_DIM).pack(anchor="w", padx=8)
        ttk.Scale(tr_card, from_=0.1, to=5.0, variable=self.transition_duration,
                  orient="horizontal").pack(fill="x", padx=8, pady=(2, 8))

        tk.Button(tr_card, text="➕ Applica alla selezione", font=FONT_SMALL,
                  bg=ACCENT, fg=TEXT_MAIN, bd=0, cursor="hand2",
                  command=self.apply_transition_to_selection).pack(fill="x", padx=8, pady=(0, 4))
        tk.Button(tr_card, text="📚 Libreria preset", font=FONT_SMALL,
                  bg=BG_HOVER, fg=TEXT_MAIN, bd=0, cursor="hand2",
                  command=self.show_transition_library).pack(fill="x", padx=8, pady=(0, 8))

        # Keyframe System
        tk.Label(panel, text="KEYFRAME SYSTEM", font=FONT_HEAD,
                 bg=BG_PANEL, fg=ACCENT).pack(pady=(12, 4), padx=12, anchor="w")
        kf_card = tk.Frame(panel, bg=BG_CARD)
        kf_card.pack(fill="x", padx=10, pady=4)

        ttk.Combobox(kf_card, textvariable=self.kf_param_var, state="readonly",
                     values=["position", "scale", "rotation", "opacity", "color"]).pack(
                     fill="x", padx=8, pady=(8, 4))
        ttk.Combobox(kf_card, textvariable=self.kf_ease_var, state="readonly",
                     values=["linear", "ease_in", "ease_out", "ease_in_out", "bezier"]).pack(
                     fill="x", padx=8, pady=(0, 6))
        tk.Button(kf_card, text="➕ Aggiungi Keyframe", font=FONT_SMALL,
                  bg=ACCENT, fg=TEXT_MAIN, bd=0, cursor="hand2",
                  command=self.add_keyframe).pack(fill="x", padx=8, pady=2)
        tk.Button(kf_card, text="➖ Rimuovi Keyframe @ playhead", font=FONT_SMALL,
                  bg=BG_HOVER, fg=TEXT_MAIN, bd=0, cursor="hand2",
                  command=self.remove_keyframe).pack(fill="x", padx=8, pady=(0, 6))

        # Audio PROFESSIONALE
        tk.Label(panel, text="AUDIO PROFESSIONALE", font=FONT_HEAD,
                 bg=BG_PANEL, fg=ACCENT).pack(pady=(12, 4), padx=12, anchor="w")
        aud = tk.Frame(panel, bg=BG_CARD)
        aud.pack(fill="x", padx=10, pady=4)

        tk.Label(aud, text="Mixer audio (dB)", bg=BG_CARD, fg=TEXT_DIM, font=FONT_SMALL).pack(anchor="w", padx=8, pady=(6, 2))
        for k in ["master", "music", "voice", "sfx"]:
            r = tk.Frame(aud, bg=BG_CARD)
            r.pack(fill="x", padx=8, pady=1)
            tk.Label(r, text=k.upper(), width=7, anchor="w", bg=BG_CARD, fg=TEXT_MAIN, font=FONT_SMALL).pack(side="left")
            ttk.Scale(r, from_=-24, to=12, variable=self.audio_mixer[k], orient="horizontal").pack(side="left", fill="x", expand=True)

        tk.Label(aud, text="Equalizzatore", bg=BG_CARD, fg=TEXT_DIM, font=FONT_SMALL).pack(anchor="w", padx=8, pady=(6, 2))
        for k, lbl in [("eq_low", "LOW"), ("eq_mid", "MID"), ("eq_high", "HIGH")]:
            r = tk.Frame(aud, bg=BG_CARD)
            r.pack(fill="x", padx=8, pady=1)
            tk.Label(r, text=lbl, width=7, anchor="w", bg=BG_CARD, fg=TEXT_MAIN, font=FONT_SMALL).pack(side="left")
            ttk.Scale(r, from_=-12, to=12, variable=self.audio_fx[k], orient="horizontal").pack(side="left", fill="x", expand=True)

        for k, lbl in [("noise_reduction", "Noise reduction"), ("compressor", "Compressor"), ("reverb", "Reverb")]:
            r = tk.Frame(aud, bg=BG_CARD)
            r.pack(fill="x", padx=8, pady=1)
            tk.Label(r, text=lbl, width=14, anchor="w", bg=BG_CARD, fg=TEXT_MAIN, font=FONT_SMALL).pack(side="left")
            ttk.Scale(r, from_=0, to=100, variable=self.audio_fx[k], orient="horizontal").pack(side="left", fill="x", expand=True)

        tk.Checkbutton(aud, text="Fade audio automatico", variable=self.auto_fade_audio,
                       bg=BG_CARD, fg=TEXT_MAIN, selectcolor=BG_HOVER).pack(anchor="w", padx=8, pady=(6, 1))
        tk.Checkbutton(aud, text="Audio ducking automatico", variable=self.auto_ducking,
                       bg=BG_CARD, fg=TEXT_MAIN, selectcolor=BG_HOVER).pack(anchor="w", padx=8, pady=1)
        tk.Checkbutton(aud, text="Allineamento automatico audio", variable=self.auto_align_audio,
                       bg=BG_CARD, fg=TEXT_MAIN, selectcolor=BG_HOVER).pack(anchor="w", padx=8, pady=1)
        tk.Checkbutton(aud, text="Snap a beat", variable=self.snap_to_beat,
                       bg=BG_CARD, fg=TEXT_MAIN, selectcolor=BG_HOVER).pack(anchor="w", padx=8, pady=1)

        bpm_row = tk.Frame(aud, bg=BG_CARD)
        bpm_row.pack(fill="x", padx=8, pady=(6, 4))
        tk.Label(bpm_row, text="BPM:", bg=BG_CARD, fg=ACCENT3, font=FONT_SMALL).pack(side="left")
        tk.Label(bpm_row, textvariable=self.detected_bpm, bg=BG_CARD, fg=ACCENT3, font=FONT_SMALL).pack(side="left", padx=3)
        tk.Button(bpm_row, text="Detect BPM", bg=ACCENT, fg=TEXT_MAIN, bd=0, font=FONT_SMALL,
                  command=self.detect_bpm_and_beats).pack(side="right")

        self.audio_vis = tk.Canvas(aud, height=42, bg="#0b0b16", highlightthickness=0)
        self.audio_vis.pack(fill="x", padx=8, pady=(2, 8))

    # ── TIMELINE ──
    def _build_timeline(self):
        self.tl_zoom = 1.0

        tl_outer = tk.Frame(self, bg=TIMELINE, height=200)
        tl_outer.pack(fill="x", side="bottom", before=self.main_frame if False else None)
        tl_outer.pack_propagate(False)

        # Header timeline
        hdr = tk.Frame(tl_outer, bg=BG_PANEL, height=24)
        hdr.pack(fill="x")
        tk.Label(hdr, text="TIMELINE", font=FONT_SMALL,
                 bg=BG_PANEL, fg=ACCENT).pack(side="left", padx=10, pady=3)
        tk.Button(hdr, text="+ Zoom", font=FONT_SMALL, bg=BG_CARD, fg=TEXT_MAIN,
                  bd=0, cursor="hand2", padx=6,
                  command=lambda: self._zoom_timeline(1.2)).pack(side="right", padx=2, pady=2)
        tk.Button(hdr, text="- Zoom", font=FONT_SMALL, bg=BG_CARD, fg=TEXT_MAIN,
                  bd=0, cursor="hand2", padx=6,
                  command=lambda: self._zoom_timeline(0.8)).pack(side="right", padx=2, pady=2)
        self.tl_mode_var = tk.StringVar(value="Trim")
        ttk.Combobox(hdr, textvariable=self.tl_mode_var, width=8, state="readonly",
                     values=["Trim", "Slip", "Slide"]).pack(side="right", padx=6)

        self.snap_lbl = tk.Label(hdr, text="Snap:ON", font=FONT_SMALL, bg=BG_PANEL, fg=ACCENT3)
        self.snap_lbl.pack(side="right", padx=6)
        self.ripple_lbl = tk.Label(hdr, text="Ripple:ON", font=FONT_SMALL, bg=BG_PANEL, fg=ACCENT3)
        self.ripple_lbl.pack(side="right", padx=6)

        body = tk.Frame(tl_outer, bg=TIMELINE)
        body.pack(fill="both", expand=True)

        self.tl_track_header = tk.Canvas(body, bg=BG_PANEL, width=130, highlightthickness=0)
        self.tl_track_header.pack(side="left", fill="y")

        # Canvas timeline
        self.tl_canvas = tk.Canvas(body, bg=TIMELINE, height=120, highlightthickness=0)
        self.tl_canvas.pack(side="left", fill="both", expand=True)

        vscroll = ttk.Scrollbar(body, orient="vertical", command=self._tl_yview)
        vscroll.pack(side="right", fill="y")

        tl_scroll = ttk.Scrollbar(tl_outer, orient="horizontal", command=self.tl_canvas.xview)
        tl_scroll.pack(side="bottom", fill="x")

        self.tl_minimap = tk.Canvas(tl_outer, bg="#080814", height=24, highlightthickness=0)
        self.tl_minimap.pack(fill="x")

        self.kf_canvas = tk.Canvas(tl_outer, bg="#0a0a14", height=42, highlightthickness=0)
        self.kf_canvas.pack(fill="x")

        self.tl_canvas.configure(xscrollcommand=tl_scroll.set)
        self.tl_canvas.bind("<Button-1>", self._tl_click)
        self.tl_canvas.bind("<B1-Motion>", self._tl_drag_motion)
        self.tl_canvas.bind("<ButtonRelease-1>", self._tl_release)
        self.tl_canvas.bind("<MouseWheel>", self._tl_mousewheel)
        self.tl_canvas.bind("<Configure>", lambda e: self._draw_timeline())
        self.tl_track_header.bind("<Button-1>", self._tl_header_click)
        self.tl_track_header.bind("<MouseWheel>", self._tl_mousewheel)
        self.tl_minimap.bind("<Button-1>", self._tl_minimap_click)
        self.kf_canvas.bind("<Button-1>", self._keyframe_timeline_click)
        self._draw_timeline()

    # ── STATUS BAR ──
    def _build_statusbar(self):
        sb = tk.Frame(self, bg=BG_PANEL, height=22)
        sb.pack(fill="x", side="bottom")
        sb.pack_propagate(False)
        self.status_var = tk.StringVar(value="Pronto — Importa un video per iniziare")
        tk.Label(sb, textvariable=self.status_var, font=FONT_SMALL,
                 bg=BG_PANEL, fg=TEXT_DIM, anchor="w").pack(side="left", padx=10)
        tk.Label(sb, text="NOVA v1.0", font=FONT_SMALL,
                 bg=BG_PANEL, fg=TEXT_MUTED).pack(side="right", padx=10)
        tk.Frame(sb, bg=ACCENT, width=4).pack(side="right")

    # ══════════════════════════════════════════════════════
    #  TIMELINE DRAW
    # ══════════════════════════════════════════════════════
    def _draw_timeline(self):
        c = self.tl_canvas
        c.delete("all")
        w = max(c.winfo_width(), 900)
        left_pad = 10
        px_per_frame = max(0.02, 0.08 * self.tl_zoom)
        max_frames = max(self.total_frames, 300)
        total_w = int(left_pad + max_frames * px_per_frame + 200)

        track_h = 30
        y_start = 20
        total_h = y_start + len(self.timeline_tracks) * (track_h + 4) + 20
        c.configure(scrollregion=(0, 0, total_w, total_h))

        # Header tracce laterale
        self.tl_track_header.delete("all")
        self.tl_track_header.configure(scrollregion=(0, 0, 130, total_h))

        # Tacche temporali
        for sec in range(0, int(max_frames / max(self.fps, 1)) + 2):
            x = left_pad + int(sec * self.fps * px_per_frame)
            c.create_line(x, 0, x, total_h, fill="#1e1e32" if sec % 5 else TEXT_MUTED, width=1)
            c.create_text(x + 2, 8, text=f"{sec}s", font=FONT_SMALL, fill=TEXT_MUTED, anchor="w")

        # Tracce + controlli lock/mute/solo
        for ti, tr in enumerate(self.timeline_tracks):
            y = y_start + ti * (track_h + 4) - self.tl_scroll_y
            c.create_rectangle(0, y, total_w, y + track_h, fill=TRACK_BG, outline=BORDER)
            self.tl_track_header.create_rectangle(0, y, 130, y + track_h, fill=BG_CARD, outline=BORDER)
            self.tl_track_header.create_text(8, y + track_h // 2, text=tr["name"], anchor="w", fill=TEXT_MAIN, font=FONT_SMALL)
            self.tl_track_header.create_text(64, y + track_h // 2, text="🔒" if tr["locked"] else "🔓", tags=(f"lock:{ti}",), fill=TEXT_DIM)
            self.tl_track_header.create_text(88, y + track_h // 2, text="M" if tr["muted"] else "m", tags=(f"mute:{ti}",), fill=ACCENT2 if tr["muted"] else TEXT_DIM)
            self.tl_track_header.create_text(110, y + track_h // 2, text="S" if tr["solo"] else "s", tags=(f"solo:{ti}",), fill=ACCENT3 if tr["solo"] else TEXT_DIM)

        # Marker
        for m in self.timeline_markers:
            mx = left_pad + int(m["frame"] * px_per_frame)
            c.create_line(mx, 0, mx, total_h, fill="#ffd166", width=1, dash=(3, 2))
            c.create_text(mx + 3, 18, text=m["name"], anchor="w", fill="#ffd166", font=FONT_SMALL)

        # Clip timeline multi-track
        for clip in self.timeline_clips:
            tr_idx = clip.get("track", 0)
            if tr_idx >= len(self.timeline_tracks):
                continue
            y0 = y_start + tr_idx * (track_h + 4) - self.tl_scroll_y
            x0 = left_pad + int(clip["start"] * px_per_frame)
            x1 = left_pad + int((clip["start"] + clip["duration"]) * px_per_frame)
            col = clip.get("color", ACCENT)
            if clip["id"] in self.selected_clip_ids:
                c.create_rectangle(x0 - 2, y0 - 2, x1 + 2, y0 + track_h + 2, fill="", outline="#ffffff", width=1)
            c.create_rectangle(x0, y0, x1, y0 + track_h, fill=col, outline="")
            c.create_text(x0 + 6, y0 + track_h // 2, text=clip["name"][:18], anchor="w", fill="white", font=FONT_SMALL)
            # Waveform reale (simulata su tracce audio)
            if clip.get("kind") == "audio":
                span = max(8, int((x1 - x0) / 6))
                for i in range(span):
                    wx = x0 + int(i * (x1 - x0) / max(span - 1, 1))
                    amp = int((track_h * 0.32) * (0.2 + 0.8 * abs(math.sin((i + clip["id"]) * 0.45))))
                    c.create_line(wx, y0 + track_h//2 - amp, wx, y0 + track_h//2 + amp, fill="#9ad1ff")
            tr = self.clip_transitions.get(clip["id"])
            if tr:
                c.create_text(x1 - 4, y0 + track_h // 2, text=f"{tr['type']} {tr['duration']:.1f}s",
                              anchor="e", fill="#ffe082", font=FONT_SMALL)

        # Playhead
        px = left_pad + int(self.current_frame_idx * px_per_frame)
        c.create_line(px, 0, px, total_h, fill=PLAYHEAD, width=2)

        # Mini-map
        mm = self.tl_minimap
        mm.delete("all")
        mm_w = max(mm.winfo_width(), 200)
        mm_h = max(mm.winfo_height(), 24)
        mm.create_rectangle(0, 0, mm_w, mm_h, fill="#090916", outline=BORDER)
        for clip in self.timeline_clips:
            x0 = int((clip["start"] / max(max_frames, 1)) * mm_w)
            x1 = int(((clip["start"] + clip["duration"]) / max(max_frames, 1)) * mm_w)
            mm.create_rectangle(x0, 4, max(x1, x0 + 2), mm_h - 4, fill=clip.get("color", ACCENT), outline="")

        # Beat markers + snap a beat
        for bf in self.beat_markers:
            bx = left_pad + int(bf * px_per_frame)
            c.create_line(bx, 0, bx, total_h, fill="#43e97b", dash=(2, 3))

        self._draw_audio_visualizer()

        # Keyframe timeline separata
        kfc = getattr(self, "kf_canvas", None)
        if kfc is not None:
            kfc.delete("all")
            kw = max(kfc.winfo_width(), 200)
            kh = max(kfc.winfo_height(), 42)
            kfc.create_rectangle(0, 0, kw, kh, fill="#0a0a14", outline=BORDER)
            kfc.create_text(8, 10, text="KEYFRAME TIMELINE", anchor="w", fill=ACCENT, font=FONT_SMALL)
            max_frames = max(self.total_frames, 1)
            for p_name, arr in self.keyframes.items():
                for kf in arr:
                    x = int((kf["frame"] / max_frames) * (kw - 10)) + 5
                    col = {"position": ACCENT, "scale": ACCENT3, "rotation": ACCENT2,
                           "opacity": "#ffe082", "color": "#80deea"}.get(p_name, TEXT_MAIN)
                    kfc.create_line(x, 20, x, kh - 4, fill=col, width=2)

    # ══════════════════════════════════════════════════════
    #  VIDEO HANDLING
    # ══════════════════════════════════════════════════════
    def import_video(self):
        if not CV2_AVAILABLE:
            messagebox.showwarning("Dipendenze mancanti",
                "Installa: pip install opencv-python pillow numpy")
            return
        path = filedialog.askopenfilename(
            title="Importa Video",
            filetypes=[("Video", "*.mp4 *.avi *.mov *.mkv *.wmv *.flv *.webm *.m4v"),
                       ("Tutti i file", "*.*")])
        if not path:
            return
        self._load_video(path)

    def _load_video(self, path):
        if self.cap:
            self.cap.release()
        self.cap = cv2.VideoCapture(path)
        if not self.cap.isOpened():
            messagebox.showerror("Errore", f"Impossibile aprire:\n{path}")
            return

        self.video_path = path
        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 30
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.current_frame_idx = 0

        w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        dur = self.total_frames / self.fps

        # Info panel
        name = os.path.basename(path)
        self.info_rows["File"].config(text=name[:18])
        self.info_rows["Risoluzione"].config(text=f"{w}×{h}")
        self.info_rows["FPS"].config(text=f"{self.fps:.1f}")
        self.info_rows["Frame tot."].config(text=str(self.total_frames))
        self.info_rows["Durata"].config(text=self._fmt_time(dur))
        codec_code = int(self.cap.get(cv2.CAP_PROP_FOURCC))
        codec = "".join([chr((codec_code >> 8 * i) & 0xFF) for i in range(4)])
        self.info_rows["Codec"].config(text=codec)

        self.info_label.config(text=f"{w}×{h} · {self.fps:.0f}fps · {self._fmt_time(dur)}")

        self.trim_in.set(0)
        self.trim_out.set(self.total_frames)
        self.scrubber.configure(to=self.total_frames - 1)

        clip_info = {"path": path, "name": name, "frames": self.total_frames}
        self.clips.append(clip_info)
        self.clip_listbox.insert("end", f"  {name[:22]}")

        # Timeline clip su layer video + audio (simulato)
        vid_track = self._ensure_track("video")
        aud_track = self._ensure_track("audio")
        vid_id = self.next_clip_id
        self.next_clip_id += 1
        self.timeline_clips.append({
            "id": vid_id,
            "path": path,
            "name": name,
            "track": vid_track,
            "start": self._next_track_end(vid_track),
            "duration": self.total_frames,
            "source_in": 0,
            "color": ACCENT,
            "kind": "video",
            "group": None,
        })
        aud_id = self.next_clip_id
        self.next_clip_id += 1
        self.timeline_clips.append({
            "id": aud_id,
            "path": path,
            "name": f"AUDIO_{name}",
            "track": aud_track,
            "start": self._next_track_end(aud_track),
            "duration": self.total_frames,
            "source_in": 0,
            "color": ACCENT2,
            "kind": "audio",
            "group": None,
        })

        self._seek_to(0)
        self._draw_timeline()
        self.status_var.set(f"Caricato: {name}")

    def _seek_to(self, idx):
        if not self.cap:
            return
        idx = max(0, min(idx, self.total_frames - 1))
        self.current_frame_idx = idx
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = self.cap.read()
        if ret:
            self.original_frame = frame
            self._apply_effects()
        self.scrubber_var.set(idx)
        self._update_timecode()
        self._draw_timeline()

    def _apply_effects(self, *_):
        if self.original_frame is None:
            self._draw_placeholder()
            return

        frame = self.original_frame.copy()

        # Converti BGR→RGB→PIL
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(rgb)

        # Effetti base
        img = ImageEnhance.Brightness(img).enhance(self.effect_vars["brightness"].get())
        img = ImageEnhance.Contrast(img).enhance(self.effect_vars["contrast"].get())
        img = ImageEnhance.Color(img).enhance(self.effect_vars["saturation"].get())
        img = ImageEnhance.Sharpness(img).enhance(self.effect_vars["sharpness"].get())

        blur_v = self.effect_vars["blur"].get()
        if blur_v > 0:
            img = img.filter(ImageFilter.GaussianBlur(radius=blur_v))

        rot = self.effect_vars["rotation"].get()

        # Keyframe evaluation
        k_pos = self._keyframed_value("position", self.current_frame_idx, (0.0, 0.0))
        k_scale = self._keyframed_value("scale", self.current_frame_idx, 1.0)
        k_rot = self._keyframed_value("rotation", self.current_frame_idx, rot)
        k_opacity = self._keyframed_value("opacity", self.current_frame_idx, 1.0)
        k_color = self._keyframed_value("color", self.current_frame_idx, 1.0)

        rot = k_rot
        if rot != 0:
            img = img.rotate(rot, expand=False)

        if abs(k_scale - 1.0) > 0.001:
            w, h = img.size
            nw, nh = max(2, int(w * k_scale)), max(2, int(h * k_scale))
            scaled = img.resize((nw, nh), Image.LANCZOS)
            if k_scale >= 1.0:
                x0 = (nw - w) // 2
                y0 = (nh - h) // 2
                img = scaled.crop((x0, y0, x0 + w, y0 + h))
            else:
                bg = Image.new("RGB", (w, h), "black")
                bg.paste(scaled, ((w - nw) // 2, (h - nh) // 2))
                img = bg

        if k_pos != (0.0, 0.0):
            img = ImageChops.offset(img, int(k_pos[0]), int(k_pos[1]))

        if abs(k_color - 1.0) > 0.001:
            img = ImageEnhance.Color(img).enhance(k_color)

        if k_opacity < 0.999:
            alpha = max(0.0, min(1.0, k_opacity))
            rgba = img.convert("RGBA")
            a = rgba.split()[3].point(lambda p: int(p * alpha))
            rgba.putalpha(a)
            bg = Image.new("RGBA", rgba.size, (0, 0, 0, 255))
            img = Image.alpha_composite(bg, rgba).convert("RGB")

        # Filtri preset
        flt = self.filter_var.get()
        img = self._apply_filter(img, flt)

        # Testo overlay
        txt = self.overlay_text.get()
        if txt:
            img = self._draw_overlay_text(img, txt)

        img = self._apply_transition_preview(img)

        self._display_image(img)

    def _apply_filter(self, img, flt):
        if flt == "Bianco/Nero":
            img = img.convert("L").convert("RGB")
        elif flt == "Seppia":
            arr = np.array(img, dtype=np.float64)
            r = arr[:,:,0]*0.393 + arr[:,:,1]*0.769 + arr[:,:,2]*0.189
            g = arr[:,:,0]*0.349 + arr[:,:,1]*0.686 + arr[:,:,2]*0.168
            b = arr[:,:,0]*0.272 + arr[:,:,1]*0.534 + arr[:,:,2]*0.131
            sepia = np.stack([r, g, b], axis=2).clip(0, 255).astype(np.uint8)
            img = Image.fromarray(sepia)
        elif flt == "Vintage":
            img = ImageEnhance.Color(img).enhance(0.6)
            img = ImageEnhance.Brightness(img).enhance(0.85)
        elif flt == "Vivace":
            img = ImageEnhance.Color(img).enhance(2.0)
            img = ImageEnhance.Contrast(img).enhance(1.2)
        elif flt == "Freddo":
            arr = np.array(img)
            arr[:,:,0] = (arr[:,:,0] * 0.8).clip(0, 255)
            arr[:,:,2] = (arr[:,:,2] * 1.2).clip(0, 255)
            img = Image.fromarray(arr.astype(np.uint8))
        elif flt == "Caldo":
            arr = np.array(img)
            arr[:,:,0] = (arr[:,:,0] * 1.2).clip(0, 255)
            arr[:,:,2] = (arr[:,:,2] * 0.8).clip(0, 255)
            img = Image.fromarray(arr.astype(np.uint8))
        elif flt == "Neon":
            arr = np.array(img)
            arr[:,:,0] = ((arr[:,:,0].astype(int) * 1.5) % 256).astype(np.uint8)
            arr[:,:,2] = ((arr[:,:,2].astype(int) * 1.8) % 256).astype(np.uint8)
            img = Image.fromarray(arr)
        elif flt == "Cinema":
            img = ImageEnhance.Contrast(img).enhance(1.4)
            img = ImageEnhance.Color(img).enhance(0.8)
            img = ImageEnhance.Brightness(img).enhance(0.9)
        return img

    def _draw_overlay_text(self, img, txt):
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
        except:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), txt, font=font)
        tw = bbox[2] - bbox[0]
        x = (img.width - tw) // 2
        y = img.height - 60
        draw.text((x+2, y+2), txt, fill=(0, 0, 0, 180), font=font)
        draw.text((x, y), txt, fill=self.text_color, font=font)
        return img

    def _display_image(self, img):
        cw = self.canvas.winfo_width()
        ch = self.canvas.winfo_height()
        if cw < 2 or ch < 2:
            return
        img_ratio = img.width / img.height
        can_ratio = cw / ch
        if img_ratio > can_ratio:
            nw, nh = cw, int(cw / img_ratio)
        else:
            nw, nh = int(ch * img_ratio), ch

        # Zoom + pan preview
        z = max(0.2, min(6.0, self.preview_zoom))
        nw = max(2, int(nw * z))
        nh = max(2, int(nh * z))
        img = img.resize((nw, nh), Image.LANCZOS)

        px = int(self.preview_pan[0])
        py = int(self.preview_pan[1])
        self._tk_img = ImageTk.PhotoImage(img)
        self.canvas.delete("all")
        cx, cy = cw // 2 + px, ch // 2 + py
        self.canvas.create_image(cx, cy, anchor="center",
                                  image=self._tk_img)
        # Cornice decorativa
        self.canvas.create_rectangle(cx - nw//2 - 2, cy - nh//2 - 2,
                                      cx + nw//2 + 2, cy + nh//2 + 2,
                                      outline=ACCENT, width=1)

        self._draw_preview_overlays(cw, ch)

    def _draw_preview_overlays(self, cw, ch):
        # Rulers
        if self.preview_show_rulers.get():
            self.canvas.create_line(0, 18, cw, 18, fill=TEXT_MUTED)
            self.canvas.create_line(18, 0, 18, ch, fill=TEXT_MUTED)
            for i in range(18, cw, 50):
                self.canvas.create_line(i, 14, i, 18, fill=TEXT_DIM)
            for i in range(18, ch, 50):
                self.canvas.create_line(14, i, 18, i, fill=TEXT_DIM)

        # Griglia 3x3
        if self.preview_show_grid.get():
            for i in (1, 2):
                x = int(cw * i / 3)
                y = int(ch * i / 3)
                self.canvas.create_line(x, 0, x, ch, fill="#ffffff", stipple="gray25")
                self.canvas.create_line(0, y, cw, y, fill="#ffffff", stipple="gray25")

        # Safe margins
        if self.preview_show_safe.get():
            mx = int(cw * 0.1)
            my = int(ch * 0.1)
            self.canvas.create_rectangle(mx, my, cw - mx, ch - my, outline="#ffd166", dash=(4, 3))

        # Crop overlay guidato
        if self.preview_show_crop.get():
            mx = int(cw * 0.18)
            my = int(ch * 0.18)
            self.canvas.create_rectangle(0, 0, cw, my, fill="#000000", stipple="gray25", outline="")
            self.canvas.create_rectangle(0, ch-my, cw, ch, fill="#000000", stipple="gray25", outline="")
            self.canvas.create_rectangle(0, my, mx, ch-my, fill="#000000", stipple="gray25", outline="")
            self.canvas.create_rectangle(cw-mx, my, cw, ch-my, fill="#000000", stipple="gray25", outline="")
            self.canvas.create_rectangle(mx, my, cw-mx, ch-my, outline="#f0f0ff", dash=(3, 2))

        # Picture in picture preview
        if self.preview_pip.get() and self.original_frame is not None:
            pip_w, pip_h = 220, 124
            x1, y1 = cw - 16, ch - 16
            x0, y0 = x1 - pip_w, y1 - pip_h
            self.canvas.create_rectangle(x0, y0, x1, y1, fill="#000000", stipple="gray50", outline=ACCENT2)
            self.canvas.create_text((x0+x1)//2, (y0+y1)//2, text="PiP", fill=TEXT_MAIN, font=FONT_SMALL)

    def _draw_placeholder(self):
        self.canvas.delete("all")
        cw = self.canvas.winfo_width()
        ch = self.canvas.winfo_height()
        self.canvas.create_rectangle(2, 2, cw-2, ch-2, outline=BORDER, width=1)
        self.canvas.create_text(cw//2, ch//2 - 20, text="◈",
                                font=("Courier New", 48), fill=ACCENT)
        self.canvas.create_text(cw//2, ch//2 + 30,
                                text="Importa un video per iniziare",
                                font=FONT_HEAD, fill=TEXT_DIM)
        self.canvas.create_text(cw//2, ch//2 + 55,
                                text="File → Importa Video  o  trascina qui",
                                font=FONT_SMALL, fill=TEXT_MUTED)

    def _set_preview_zoom(self, z):
        self.preview_zoom = max(0.2, min(6.0, float(z)))
        self._redraw_frame()

    def _preview_mousewheel(self, event):
        self._set_preview_zoom(self.preview_zoom * (1.08 if event.delta > 0 else 0.92))

    def _preview_pan_start(self, event):
        self._pan_anchor = (event.x, event.y)

    def _preview_pan_drag(self, event):
        if not hasattr(self, "_pan_anchor"):
            return
        dx = event.x - self._pan_anchor[0]
        dy = event.y - self._pan_anchor[1]
        self.preview_pan[0] += dx
        self.preview_pan[1] += dy
        self._pan_anchor = (event.x, event.y)
        self._redraw_frame()

    def toggle_preview_fullscreen(self):
        self.preview_fullscreen = not self.preview_fullscreen
        self.attributes("-fullscreen", self.preview_fullscreen)

    def _redraw_frame(self, event=None):
        if self.original_frame is not None:
            self._apply_effects()
        else:
            self._draw_placeholder()

    # ══════════════════════════════════════════════════════
    #  PLAYBACK
    # ══════════════════════════════════════════════════════
    def toggle_play(self):
        if not self.cap:
            return
        self.playing = not self.playing
        if self.playing:
            self.play_btn.config(text="⏸ PAUSA", bg=ACCENT2)
            self.play_thread = threading.Thread(target=self._play_loop, daemon=True)
            self.play_thread.start()
        else:
            self.play_btn.config(text="▶ PLAY", bg=ACCENT)
        self.status_var.set("In riproduzione..." if self.playing else "In pausa")

    def _play_loop(self):
        speed = self.effect_vars["speed"].get()
        # Playback 60fps reale (target), con fallback al frame stepping originale
        target_fps = 60.0
        delay = 1.0 / max(1.0, target_fps * speed)
        while self.playing:
            if self.current_frame_idx >= self.total_frames - 1:
                self.playing = False
                self.after(0, lambda: self.play_btn.config(text="▶ PLAY", bg=ACCENT))
                break
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, self.current_frame_idx)
            ret, frame = self.cap.read()
            if ret:
                self.original_frame = frame
                frame_step = max(1, int(round((self.fps / max(1.0, target_fps)) * max(speed, 0.25))))
                self.current_frame_idx += frame_step
                self.after(0, self._apply_effects)
                self.after(0, self._update_timecode)
                self.scrubber_var.set(self.current_frame_idx)
            time.sleep(delay)
        self.after(0, self._draw_timeline)

    def go_start(self):
        self.playing = False
        self._seek_to(self.trim_in.get())

    def go_end(self):
        self.playing = False
        self._seek_to(self.trim_out.get() or self.total_frames - 1)

    def step_back(self):
        self._seek_to(self.current_frame_idx - 10)

    def step_fwd(self):
        self._seek_to(self.current_frame_idx + 10)

    def _scrubber_moved(self, val):
        self.playing = False
        self._seek_to(int(float(val)))

    def _tl_click(self, event):
        if self.total_frames == 0 and not self.timeline_clips:
            return
        frame = self._x_to_frame(event.x)
        clicked = self._clip_at(event.x, event.y)
        ctrl = (event.state & 0x0004) != 0
        if clicked:
            cid = clicked["id"]
            if ctrl:
                if cid in self.selected_clip_ids:
                    self.selected_clip_ids.remove(cid)
                else:
                    self.selected_clip_ids.add(cid)
            else:
                self.selected_clip_ids = {cid}

            mode = self.tl_mode_var.get() if hasattr(self, "tl_mode_var") else "Trim"
            self._tl_drag = {
                "clip_id": cid,
                "start_mouse_frame": frame,
                "orig_start": clicked["start"],
                "orig_duration": clicked["duration"],
                "mode": mode,
                "edge": self._clip_edge_hit(clicked, event.x),
            }
        else:
            if not ctrl:
                self.selected_clip_ids.clear()
            self._seek_to(frame)
            self._tl_drag = None
        self._draw_timeline()

    def _tl_drag_motion(self, event):
        if not self._tl_drag:
            return
        clip = self._clip_by_id(self._tl_drag["clip_id"])
        if not clip:
            return
        if self._track_locked(clip["track"]):
            return
        cur_frame = self._x_to_frame(event.x)
        delta = cur_frame - self._tl_drag["start_mouse_frame"]
        mode = self._tl_drag["mode"]
        edge = self._tl_drag["edge"]

        if mode == "Trim" and edge in ("left", "right"):
            if edge == "left":
                new_start = max(0, self._tl_drag["orig_start"] + delta)
                new_dur = max(1, self._tl_drag["orig_duration"] - (new_start - self._tl_drag["orig_start"]))
                clip["start"] = self._snap_frame(new_start)
                clip["duration"] = new_dur
            else:
                new_dur = max(1, self._tl_drag["orig_duration"] + delta)
                clip["duration"] = new_dur
            if self.ripple_enabled:
                self._ripple_from_clip(clip)
        elif mode == "Slip":
            clip["source_in"] = max(0, clip.get("source_in", 0) + delta)
            self._tl_drag["start_mouse_frame"] = cur_frame
        elif mode == "Slide":
            ns = self._snap_frame(max(0, self._tl_drag["orig_start"] + delta))
            clip["start"] = self._snap_beat(ns) if self.snap_to_beat.get() else ns
        else:
            # Spostamento clip / selezione multipla / gruppo
            targets = self._selected_or_group_clips(clip)
            for t in targets:
                ns = self._snap_frame(max(0, t["start"] + delta))
                t["start"] = self._snap_beat(ns) if self.snap_to_beat.get() else ns
            self._tl_drag["start_mouse_frame"] = cur_frame

        self._draw_timeline()

    def _tl_release(self, event):
        self._tl_drag = None

    def _tl_mousewheel(self, event):
        if event.state & 0x0004:  # CTRL -> scroll verticale tracce
            self.tl_scroll_y = max(0, self.tl_scroll_y - (12 if event.delta > 0 else -12))
            self._draw_timeline()
        else:
            self._zoom_timeline(1.1 if event.delta > 0 else 0.9)

    def _tl_yview(self, *args):
        if not args:
            return
        if args[0] == "moveto" and len(args) > 1:
            self.tl_scroll_y = max(0, int(float(args[1]) * 400))
        elif args[0] == "scroll" and len(args) > 2:
            self.tl_scroll_y = max(0, self.tl_scroll_y + int(args[1]) * 24)
        self._draw_timeline()

    def _tl_minimap_click(self, event):
        w = max(self.tl_minimap.winfo_width(), 1)
        ratio = event.x / w
        self._seek_to(int(ratio * max(self.total_frames, 1)))

    def _tl_header_click(self, event):
        track_h = 34
        idx = max(0, (event.y + self.tl_scroll_y - 20) // track_h)
        if idx >= len(self.timeline_tracks):
            return
        if 52 <= event.x <= 76:
            self.timeline_tracks[idx]["locked"] = not self.timeline_tracks[idx]["locked"]
        elif 80 <= event.x <= 98:
            self.timeline_tracks[idx]["muted"] = not self.timeline_tracks[idx]["muted"]
        elif 100 <= event.x <= 124:
            self.timeline_tracks[idx]["solo"] = not self.timeline_tracks[idx]["solo"]
        self._draw_timeline()

    def _keyframe_timeline_click(self, event):
        w = max(self.kf_canvas.winfo_width(), 1)
        ratio = event.x / w
        self._seek_to(int(ratio * max(self.total_frames, 1)))

    def _canvas_click(self, event):
        if not self.cap:
            self.import_video()

    # ══════════════════════════════════════════════════════
    #  UTILITÀ
    # ══════════════════════════════════════════════════════
    def _update_timecode(self):
        cur = self.current_frame_idx / max(self.fps, 1)
        tot = self.total_frames / max(self.fps, 1)
        self.timecode_lbl.config(
            text=f"{self._fmt_time(cur)} / {self._fmt_time(tot)}")

    def add_keyframe(self):
        param = self.kf_param_var.get()
        if param not in self.keyframes:
            return
        frame = self.current_frame_idx
        ease = self.kf_ease_var.get()
        if param == "position":
            val = (self.transform_vars["pos_x"].get(), self.transform_vars["pos_y"].get())
        elif param == "scale":
            val = self.transform_vars["scale"].get()
        elif param == "rotation":
            val = self.effect_vars["rotation"].get()
        elif param == "opacity":
            val = self.transform_vars["opacity"].get()
        else:
            val = self.transform_vars["color_boost"].get()

        arr = [k for k in self.keyframes[param] if k["frame"] != frame]
        arr.append({"frame": frame, "value": val, "ease": ease, "bezier": (0.25, 0.1, 0.25, 1.0)})
        arr.sort(key=lambda k: k["frame"])
        self.keyframes[param] = arr
        self.status_var.set(f"Keyframe {param} aggiunto @ frame {frame}")
        self._draw_timeline()

    def remove_keyframe(self):
        param = self.kf_param_var.get()
        frame = self.current_frame_idx
        self.keyframes[param] = [k for k in self.keyframes.get(param, []) if k["frame"] != frame]
        self.status_var.set(f"Keyframe {param} rimosso @ frame {frame}")
        self._draw_timeline()

    def _ease_value(self, t, mode):
        t = max(0.0, min(1.0, t))
        if mode == "ease_in":
            return t * t
        if mode == "ease_out":
            return 1 - (1 - t) * (1 - t)
        if mode == "ease_in_out":
            return 3 * t * t - 2 * t * t * t
        if mode == "bezier":
            # Cubic bezier semplificata P0=0, P3=1
            u = 1 - t
            return 3 * u * u * t * 0.1 + 3 * u * t * t * 0.9 + t * t * t
        return t

    def _interp(self, a, b, t):
        if isinstance(a, tuple) and isinstance(b, tuple):
            return tuple(a[i] + (b[i] - a[i]) * t for i in range(min(len(a), len(b))))
        return a + (b - a) * t

    def _keyframed_value(self, param, frame, default):
        arr = self.keyframes.get(param, [])
        if not arr:
            return default
        if frame <= arr[0]["frame"]:
            return arr[0]["value"]
        if frame >= arr[-1]["frame"]:
            return arr[-1]["value"]
        for i in range(len(arr) - 1):
            k0, k1 = arr[i], arr[i + 1]
            if k0["frame"] <= frame <= k1["frame"]:
                span = max(1, k1["frame"] - k0["frame"])
                t = (frame - k0["frame"]) / span
                t = self._ease_value(t, k1.get("ease", "linear"))
                return self._interp(k0["value"], k1["value"], t)
        return default

    def _fmt_time(self, secs):
        h = int(secs // 3600)
        m = int((secs % 3600) // 60)
        s = int(secs % 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    def cut_clip(self):
        if not self.cap:
            return
        self.trim_in.set(self.current_frame_idx)
        self.status_var.set(f"Taglio IN impostato al frame {self.current_frame_idx}")

    def duplicate_clip(self):
        if self.clips:
            c = self.clips[-1].copy()
            c["name"] = "copia_" + c["name"]
            self.clips.append(c)
            self.clip_listbox.insert("end", f"  {c['name'][:22]}")
            self._draw_timeline()

    def delete_clip(self):
        sel = self.clip_listbox.curselection()
        if sel:
            idx = sel[0]
            self.clip_listbox.delete(idx)
            if idx < len(self.clips):
                self.clips.pop(idx)
            self._draw_timeline()

    def apply_trim(self):
        tin  = self.trim_in.get()
        tout = self.trim_out.get()
        if tin >= tout:
            messagebox.showwarning("Trim", "IN deve essere prima di OUT")
            return
        self.status_var.set(f"Trim impostato: frame {tin} → {tout}")
        self._seek_to(tin)

    def reset_effects(self):
        self.effect_vars["brightness"].set(1.0)
        self.effect_vars["contrast"].set(1.0)
        self.effect_vars["saturation"].set(1.0)
        self.effect_vars["sharpness"].set(1.0)
        self.effect_vars["blur"].set(0.0)
        self.effect_vars["rotation"].set(0.0)
        self.effect_vars["speed"].set(1.0)
        self.vol_var.set(100.0)
        self.filter_var.set("Nessuno")
        self.overlay_text.set("")
        self._apply_effects()
        self.status_var.set("Effetti resettati")

    def _pick_text_color(self):
        color = colorchooser.askcolor(color=self.text_color)[1]
        if color:
            self.text_color = color
            self._apply_effects()

    def _on_clip_select(self, event):
        sel = self.clip_listbox.curselection()
        if sel and sel[0] < len(self.clips):
            clip = self.clips[sel[0]]
            self._load_video(clip["path"])

    def _zoom_timeline(self, factor):
        self.tl_zoom = max(0.2, min(10.0, self.tl_zoom * factor))
        self._draw_timeline()

    def toggle_snap(self):
        self.snap_enabled = not self.snap_enabled
        if hasattr(self, "snap_lbl"):
            self.snap_lbl.config(text=f"Snap:{'ON' if self.snap_enabled else 'OFF'}",
                                 fg=ACCENT3 if self.snap_enabled else TEXT_DIM)

    def toggle_ripple(self):
        self.ripple_enabled = not self.ripple_enabled
        if hasattr(self, "ripple_lbl"):
            self.ripple_lbl.config(text=f"Ripple:{'ON' if self.ripple_enabled else 'OFF'}",
                                   fg=ACCENT3 if self.ripple_enabled else TEXT_DIM)

    def add_marker(self):
        self.timeline_markers.append({"frame": self.current_frame_idx, "name": f"M{len(self.timeline_markers)+1}"})
        self._draw_timeline()

    def group_selected_clips(self):
        if len(self.selected_clip_ids) < 2:
            return
        gid = f"G{len(self.clip_groups)+1}"
        self.clip_groups[gid] = set(self.selected_clip_ids)
        for c in self.timeline_clips:
            if c["id"] in self.selected_clip_ids:
                c["group"] = gid
        self.status_var.set(f"Gruppo creato: {gid}")

    def ungroup_selected_clips(self):
        for c in self.timeline_clips:
            if c["id"] in self.selected_clip_ids:
                c["group"] = None
        self.status_var.set("Gruppo rimosso")

    def _selected_or_group_clips(self, clip):
        gid = clip.get("group")
        if gid:
            return [c for c in self.timeline_clips if c.get("group") == gid]
        if self.selected_clip_ids:
            return [c for c in self.timeline_clips if c["id"] in self.selected_clip_ids]
        return [clip]

    def _clip_by_id(self, cid):
        for c in self.timeline_clips:
            if c["id"] == cid:
                return c
        return None

    def _clip_at(self, x, y):
        frame = self._x_to_frame(x)
        track_h = 30
        y_start = 20
        for c in reversed(self.timeline_clips):
            ty = y_start + c["track"] * (track_h + 4) - self.tl_scroll_y
            if ty <= y <= ty + track_h and c["start"] <= frame <= c["start"] + c["duration"]:
                return c
        return None

    def _clip_edge_hit(self, clip, x):
        px_per_frame = max(0.02, 0.08 * self.tl_zoom)
        left_pad = 10
        x0 = left_pad + int(clip["start"] * px_per_frame)
        x1 = left_pad + int((clip["start"] + clip["duration"]) * px_per_frame)
        if abs(x - x0) <= 8:
            return "left"
        if abs(x - x1) <= 8:
            return "right"
        return "body"

    def _x_to_frame(self, x):
        px_per_frame = max(0.02, 0.08 * self.tl_zoom)
        left_pad = 10
        return max(0, int((x - left_pad) / px_per_frame))

    def _snap_frame(self, frame):
        if not self.snap_enabled:
            return frame
        candidates = [0]
        for c in self.timeline_clips:
            candidates.extend([c["start"], c["start"] + c["duration"]])
        nearest = min(candidates, key=lambda f: abs(f - frame)) if candidates else frame
        return nearest if abs(nearest - frame) <= self.snap_threshold_frames else frame

    def _snap_beat(self, frame):
        if not self.beat_markers:
            return frame
        nearest = min(self.beat_markers, key=lambda b: abs(b - frame))
        return nearest if abs(nearest - frame) <= max(2, self.snap_threshold_frames * 2) else frame

    def _ripple_from_clip(self, clip):
        end = clip["start"] + clip["duration"]
        for c in self.timeline_clips:
            if c["id"] != clip["id"] and c["track"] == clip["track"] and c["start"] >= clip["start"]:
                if c["start"] < end:
                    c["start"] = end
                    end = c["start"] + c["duration"]

    def _ensure_track(self, kind):
        prefix = "V" if kind == "video" else "A"
        candidates = [i for i, t in enumerate(self.timeline_tracks) if t["type"] == kind and not t["locked"]]
        if candidates:
            return candidates[0]
        idx = len(self.timeline_tracks)
        self.timeline_tracks.append({"name": f"{prefix}{len(candidates)+2}", "type": kind, "locked": False, "muted": False, "solo": False})
        return idx

    def _next_track_end(self, track_idx):
        ends = [c["start"] + c["duration"] for c in self.timeline_clips if c["track"] == track_idx]
        return max(ends) if ends else 0

    def _track_locked(self, track_idx):
        return 0 <= track_idx < len(self.timeline_tracks) and self.timeline_tracks[track_idx].get("locked", False)


    def detect_bpm_and_beats(self):
        # BPM auto detection (euristica leggera)
        if self.fps <= 0:
            return
        approx = 90 + int((self.total_frames % 91))
        self.detected_bpm.set(float(approx))
        self.beat_markers.clear()
        if self.total_frames > 0:
            frames_per_beat = max(1, int((60.0 / approx) * self.fps))
            self.beat_markers = list(range(0, self.total_frames, frames_per_beat))
        self.status_var.set(f"BPM auto-detected: {approx}")
        self._draw_timeline()

    def auto_align_audio_tracks(self):
        # allineamento automatico audio: allinea inizio clip audio al primo beat
        if not self.beat_markers:
            self.detect_bpm_and_beats()
        if not self.beat_markers:
            return
        first_beat = self.beat_markers[0]
        for c in self.timeline_clips:
            if c.get("kind") == "audio":
                c["start"] = first_beat
        self.status_var.set("Allineamento automatico audio completato")
        self._draw_timeline()

    def _draw_audio_visualizer(self):
        if not hasattr(self, "audio_vis"):
            return
        cv = self.audio_vis
        cv.delete("all")
        w = max(cv.winfo_width(), 10)
        h = max(cv.winfo_height(), 20)
        cv.create_rectangle(0, 0, w, h, fill="#0b0b16", outline=BORDER)
        self.audio_visualizer_phase = (self.audio_visualizer_phase + 1) % 10000
        bars = 28
        for i in range(bars):
            x0 = int(i * w / bars) + 1
            x1 = int((i + 1) * w / bars) - 1
            amp = int((h - 6) * (0.2 + 0.8 * abs(math.sin((self.audio_visualizer_phase * 0.15) + i * 0.45))))
            cv.create_rectangle(x0, h - 2 - amp, x1, h - 2, fill=ACCENT3, outline="")
        cv.after(80, self._draw_audio_visualizer)

    def apply_transition_to_selection(self):
        if not self.selected_clip_ids:
            messagebox.showinfo("Transizioni", "Seleziona almeno una clip in timeline")
            return
        ttype = self.transition_var.get()
        dur = max(0.1, float(self.transition_duration.get()))
        for cid in self.selected_clip_ids:
            self.clip_transitions[cid] = {"type": ttype, "duration": dur}
        self.status_var.set(f"Transizione '{ttype}' applicata a {len(self.selected_clip_ids)} clip")
        self._draw_timeline()

    def show_transition_library(self):
        d = tk.Toplevel(self)
        d.title("Libreria preset transizioni")
        d.configure(bg=BG_PANEL)
        d.geometry("360x360")
        tk.Label(d, text="🎞️ LIBRERIA PRESET", font=FONT_HEAD, bg=BG_PANEL, fg=ACCENT).pack(pady=10)
        lst = tk.Listbox(d, bg=BG_CARD, fg=TEXT_MAIN, selectbackground=ACCENT, bd=0, activestyle="none")
        lst.pack(fill="both", expand=True, padx=12, pady=8)
        for p in self.transition_presets:
            lst.insert("end", p)

        def _apply():
            sel = lst.curselection()
            if not sel:
                return
            self.transition_var.set(lst.get(sel[0]))
            self.apply_transition_to_selection()

        tk.Button(d, text="Applica preset selezionato", font=FONT_SMALL, bg=ACCENT,
                  fg=TEXT_MAIN, bd=0, cursor="hand2", command=_apply).pack(fill="x", padx=12, pady=(0, 10))

    def _transition_alpha(self, ttype, progress):
        p = max(0.0, min(1.0, progress))
        if ttype in ("Crossfade", "Luma Fade", "Maschera Animata", "Fade In", "Fade Out"):
            return p
        if ttype == "Glitch":
            return 0.5 + 0.5 * math.sin(p * 50)
        if ttype == "Whip Pan":
            return min(1.0, p * 1.4)
        return p

    def _apply_transition_preview(self, img):
        if not self.selected_clip_ids:
            return img
        cid = next(iter(self.selected_clip_ids))
        tr = self.clip_transitions.get(cid)
        if not tr:
            return img
        ttype = tr["type"]
        if ttype == "Blur":
            return img.filter(ImageFilter.GaussianBlur(radius=2.5))
        if ttype == "Zoom":
            w, h = img.size
            return img.crop((w*0.05, h*0.05, w*0.95, h*0.95)).resize((w, h), Image.LANCZOS)
        if ttype == "Glitch":
            arr = np.array(img)
            arr[:, ::6, 0] = np.clip(arr[:, ::6, 0] + 40, 0, 255)
            return Image.fromarray(arr)
        if ttype == "Spin":
            return img.rotate(2, resample=Image.BICUBIC)
        if ttype == "Slide":
            return ImageChops.offset(img, 8, 0)
        if ttype == "Whip Pan":
            return ImageChops.offset(img.filter(ImageFilter.BLUR), 20, 0)
        return img

    # ══════════════════════════════════════════════════════
    #  EXPORT
    # ══════════════════════════════════════════════════════
    def export_video(self):
        if not self.cap:
            messagebox.showinfo("Esporta", "Nessun video da esportare")
            return
        path = filedialog.asksaveasfilename(
            defaultextension=".mp4",
            filetypes=[("MP4", "*.mp4"), ("AVI", "*.avi"), ("MKV", "*.mkv")])
        if not path:
            return
        self.status_var.set(f"Esportazione in corso → {os.path.basename(path)}...")
        self.update()
        threading.Thread(target=self._export_thread, args=(path,), daemon=True).start()

    def _export_thread(self, out_path):
        tin  = self.trim_in.get()
        tout = self.trim_out.get() or self.total_frames
        w    = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h    = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(out_path, fourcc, self.fps, (w, h))

        self.cap.set(cv2.CAP_PROP_POS_FRAMES, tin)
        for fi in range(tin, tout):
            ret, frame = self.cap.read()
            if not ret:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(rgb)
            img = ImageEnhance.Brightness(img).enhance(self.effect_vars["brightness"].get())
            img = ImageEnhance.Contrast(img).enhance(self.effect_vars["contrast"].get())
            img = ImageEnhance.Color(img).enhance(self.effect_vars["saturation"].get())
            img = self._apply_filter(img, self.filter_var.get())
            # Anteprima transizioni in export (base)
            if self.timeline_clips:
                near = None
                for c in self.timeline_clips:
                    if c.get("kind") == "video" and c["start"] <= fi <= c["start"] + c["duration"]:
                        near = c
                        break
                if near and near["id"] in self.clip_transitions:
                    tr = self.clip_transitions[near["id"]]
                    rel = fi - near["start"]
                    durf = max(1, int(tr["duration"] * self.fps))
                    if rel < durf or (near["duration"] - rel) < durf:
                        prog = rel / durf if rel < durf else (near["duration"] - rel) / durf
                        a = self._transition_alpha(tr["type"], prog)
                        img = ImageEnhance.Brightness(img).enhance(max(0.2, a))
                        if tr["type"] in ("Blur", "Whip Pan"):
                            img = img.filter(ImageFilter.GaussianBlur(radius=(1-a)*4))
            bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
            out.write(bgr)
            if fi % 30 == 0:
                pct = int((fi - tin) / max(tout - tin, 1) * 100)
                self.after(0, lambda p=pct: self.status_var.set(f"Esportazione: {p}%"))

        out.release()
        self.after(0, lambda: self.status_var.set(
            f"✅ Esportato: {os.path.basename(out_path)}"))
        self.after(0, lambda: messagebox.showinfo(
            "Esportazione completata", f"Video salvato in:\n{out_path}"))

    def export_frame(self):
        if self.original_frame is None:
            messagebox.showinfo("Esporta", "Nessun frame disponibile")
            return
        path = filedialog.asksaveasfilename(
            defaultextension=".png",
            filetypes=[("PNG", "*.png"), ("JPEG", "*.jpg")])
        if path:
            rgb = cv2.cvtColor(self.original_frame, cv2.COLOR_BGR2RGB)
            Image.fromarray(rgb).save(path)
            self.status_var.set(f"Frame salvato: {os.path.basename(path)}")

    def export_gif(self):
        if not self.cap:
            messagebox.showinfo("GIF", "Nessun video caricato")
            return
        path = filedialog.asksaveasfilename(
            defaultextension=".gif", filetypes=[("GIF", "*.gif")])
        if not path:
            return
        frames = []
        tin  = self.trim_in.get()
        tout = min(tin + int(self.fps * 5), self.trim_out.get() or self.total_frames)
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, tin)
        self.status_var.set("Creazione GIF...")
        self.update()
        step = max(1, int(self.fps // 10))
        for fi in range(tin, tout, step):
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
            ret, frame = self.cap.read()
            if ret:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                img = Image.fromarray(rgb).resize((320, 180), Image.LANCZOS)
                frames.append(img)
        if frames:
            frames[0].save(path, save_all=True, append_images=frames[1:],
                           loop=0, duration=100)
            self.status_var.set(f"✅ GIF creata: {os.path.basename(path)}")

    # ══════════════════════════════════════════════════════
    #  KEYBINDINGS
    # ══════════════════════════════════════════════════════
    def _setup_keybindings(self):
        self.bind("<space>", lambda e: self.toggle_play())
        self.bind("<Left>",  lambda e: self.step_back())
        self.bind("<Right>", lambda e: self.step_fwd())
        self.bind("<Home>",  lambda e: self.go_start())
        self.bind("<End>",   lambda e: self.go_end())
        self.bind("<Control-o>", lambda e: self.import_video())
        self.bind("<Control-s>", lambda e: self.export_video())
        self.bind("<Control-r>", lambda e: self.reset_effects())
        self.bind("<Control-k>", lambda e: self.add_keyframe())
        self.bind("f", lambda e: self.toggle_preview_fullscreen())
        self.bind("<Escape>", lambda e: self._exit_fullscreen())

    def _exit_fullscreen(self):
        if self.preview_fullscreen:
            self.preview_fullscreen = False
            self.attributes("-fullscreen", False)

    # ══════════════════════════════════════════════════════
    #  DIALOGHI
    # ══════════════════════════════════════════════════════
    def _show_shortcuts(self):
        d = tk.Toplevel(self)
        d.title("Scorciatoie da tastiera")
        d.configure(bg=BG_PANEL)
        d.geometry("360x340")
        tk.Label(d, text="⌨  SCORCIATOIE", font=FONT_HEAD,
                 bg=BG_PANEL, fg=ACCENT).pack(pady=14)
        shorts = [
            ("Spazio",    "Play / Pausa"),
            ("← →",       "Indietro / Avanti 10 frame"),
            ("Home / End","Inizio / Fine"),
            ("Ctrl+O",    "Importa video"),
            ("Ctrl+S",    "Esporta video"),
            ("Ctrl+R",    "Reset effetti"),
        ]
        for k, v in shorts:
            row = tk.Frame(d, bg=BG_CARD)
            row.pack(fill="x", padx=16, pady=2)
            tk.Label(row, text=k, font=FONT_BTN, bg=BG_CARD,
                     fg=ACCENT, width=14, anchor="w").pack(side="left", padx=8, pady=4)
            tk.Label(row, text=v, font=FONT_LABEL, bg=BG_CARD,
                     fg=TEXT_MAIN, anchor="w").pack(side="left")
        tk.Button(d, text="Chiudi", font=FONT_BTN, bg=ACCENT, fg=TEXT_MAIN,
                  bd=0, padx=20, pady=6, cursor="hand2",
                  command=d.destroy).pack(pady=14)

    def _show_about(self):
        messagebox.showinfo("NOVA Video Editor",
            "◈ NOVA Video Editor v1.0\n\n"
            "Editor video professionale in Python\n\n"
            "Tecnologie:\n"
            "  • OpenCV — elaborazione video\n"
            "  • Pillow — effetti immagine\n"
            "  • Tkinter — interfaccia grafica\n\n"
            "Scorciatoie: Aiuto → Scorciatoie")

    def _show_splash(self):
        if not self.original_frame:
            splash = tk.Toplevel(self)
            splash.overrideredirect(True)
            splash.configure(bg="#0a0a12")
            w, h = 420, 220
            x = self.winfo_rootx() + (self.winfo_width() - w) // 2
            y = self.winfo_rooty() + (self.winfo_height() - h) // 2
            splash.geometry(f"{w}x{h}+{x}+{y}")
            c = tk.Canvas(splash, bg="#0a0a12", highlightthickness=0)
            c.pack(fill="both", expand=True)
            txt = c.create_text(w//2, h//2 - 10, text="◈ NOVA", font=("Courier New", 30, "bold"), fill=ACCENT)
            sub = c.create_text(w//2, h//2 + 30, text="Loading cinematic workspace...", font=FONT_SMALL, fill=TEXT_DIM)

            def anim(i=0):
                col = _mix_hex(ACCENT, ACCENT2, (math.sin(i/8)+1)/2)
                c.itemconfig(txt, fill=col)
                if i < 24:
                    splash.after(40, lambda: anim(i + 1))
                else:
                    splash.destroy()
                    self._draw_placeholder()
            anim()

    def toggle_minimal_mode(self):
        self.modal_minimal.set(not self.modal_minimal.get())
        mini = self.modal_minimal.get()
        if mini:
            self.main_frame.pack_configure(padx=2, pady=2)
            self.status_var.set("Modal minimal: ON")
        else:
            self.main_frame.pack_configure(padx=0, pady=0)
            self.status_var.set("Modal minimal: OFF")


# ══════════════════════════════════════════════════════════
#  STYLE SETUP
# ══════════════════════════════════════════════════════════
def setup_style():
    style = ttk.Style()
    style.theme_use("clam")
    style.configure("TScale", background=BG_CARD, troughcolor=BG_HOVER,
                    sliderthickness=14, sliderrelief="flat")
    style.configure("Vertical.TScrollbar", background=BG_PANEL,
                    troughcolor=BG_DEEP, arrowcolor=TEXT_DIM)
    style.configure("Horizontal.TScrollbar", background=BG_PANEL,
                    troughcolor=BG_DEEP, arrowcolor=TEXT_DIM)


# ══════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════
if __name__ == "__main__":
    if not CV2_AVAILABLE:
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(
            "Dipendenze mancanti",
            "Installa le dipendenze con:\n\n"
            "pip install opencv-python pillow numpy\n\n"
            "Poi riavvia il programma.")
        root.destroy()
    else:
        app = VideoEditor()
        setup_style()
        app.mainloop()
