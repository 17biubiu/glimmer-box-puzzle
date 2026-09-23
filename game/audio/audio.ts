// Web Audio 全程序化音频 —— 零外部音频文件
// 轻柔氛围 BGM（振荡器和弦垫循环）+ 移动/推箱/胜利/撤销音效
// 自动播放策略安全：首次用户手势时才创建/恢复 AudioContext

type Chord = number[]

// 温和的和弦进行（Cmaj7 → Am7 → Fmaj7 → G6），频率 Hz
const CHORDS: Chord[] = [
  [261.63, 329.63, 392.0, 493.88],
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 329.63],
  [196.0, 246.94, 293.66, 329.63],
]
const CHORD_SECONDS = 4.2

export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bgmBus: GainNode | null = null
  private bgmTimer: ReturnType<typeof setTimeout> | null = null
  private chordIdx = 0
  private bgmOn = false
  muted = false

  /** 必须在用户手势中调用（首次点击/按键/触摸） */
  ensure(): void {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 1
      this.master.connect(this.ctx.destination)
      this.bgmBus = this.ctx.createGain()
      this.bgmBus.gain.value = 0.16
      // 低通让和声垫更柔
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1400
      this.bgmBus.connect(lp)
      lp.connect(this.master)
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    if (this.bgmOn && !this.bgmTimer) this.scheduleNextChord()
  }

  startBGM(): void {
    this.bgmOn = true
    if (this.ctx && !this.bgmTimer) this.scheduleNextChord()
  }

  stopBGM(): void {
    this.bgmOn = false
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer)
      this.bgmTimer = null
    }
  }

  private scheduleNextChord(): void {
    if (!this.bgmOn || !this.ctx || !this.bgmBus) return
    this.playChord(CHORDS[this.chordIdx % CHORDS.length]!)
    this.chordIdx += 1
    this.bgmTimer = setTimeout(() => {
      this.bgmTimer = null
      this.scheduleNextChord()
    }, CHORD_SECONDS * 1000)
  }

  /** 缓慢淡入淡出的和声垫 */
  private playChord(freqs: number[]): void {
    const ctx = this.ctx!
    const t0 = ctx.currentTime + 0.05
    for (const f of freqs) {
      for (const detune of [-4, 3]) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = f
        osc.detune.value = detune
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t0)
        g.gain.linearRampToValueAtTime(0.05, t0 + CHORD_SECONDS * 0.35)
        g.gain.setValueAtTime(0.05, t0 + CHORD_SECONDS * 0.7)
        g.gain.linearRampToValueAtTime(0, t0 + CHORD_SECONDS * 1.05)
        osc.connect(g)
        g.connect(this.bgmBus!)
        osc.start(t0)
        osc.stop(t0 + CHORD_SECONDS * 1.1)
      }
    }
    // 低音
    const bass = ctx.createOscillator()
    bass.type = 'triangle'
    bass.frequency.value = freqs[0]! / 2
    const bg = ctx.createGain()
    bg.gain.setValueAtTime(0, t0)
    bg.gain.linearRampToValueAtTime(0.06, t0 + 0.6)
    bg.gain.linearRampToValueAtTime(0, t0 + CHORD_SECONDS * 1.05)
    bass.connect(bg)
    bg.connect(this.bgmBus!)
    bass.start(t0)
    bass.stop(t0 + CHORD_SECONDS * 1.1)
  }

  private blip(freqA: number, freqB: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.ctx || !this.master) return
    const t0 = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freqA, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), t0 + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  sfxMove(): void {
    this.blip(520, 700, 0.09, 'square', 0.06)
  }

  sfxPush(): void {
    this.blip(200, 120, 0.16, 'triangle', 0.16)
    this.blip(320, 260, 0.1, 'square', 0.05)
  }

  sfxBump(): void {
    this.blip(140, 90, 0.08, 'sawtooth', 0.05)
  }

  sfxUndo(): void {
    this.blip(700, 420, 0.12, 'square', 0.06)
  }

  sfxWin(): void {
    if (!this.ctx || !this.master) return
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      const t0 = this.ctx!.currentTime + i * 0.13
      const osc = this.ctx!.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = f
      const g = this.ctx!.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5)
      osc.connect(g)
      g.connect(this.master!)
      osc.start(t0)
      osc.stop(t0 + 0.55)
    })
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05)
    }
  }
}

export const audio = new AudioManager()
