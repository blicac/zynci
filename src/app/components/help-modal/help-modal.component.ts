import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { copyTextToClipboard } from '../../utils/scheduler.utils';

@Component({
  selector: 'app-help-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-0 sm:p-4 select-none"
      role="dialog"
      aria-modal="true"
      (click)="closeModal.emit()"
    >
      <div
        class="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white shadow-xl border border-slate-200/80 overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs">
              ?
            </span>
            <h2 class="text-sm font-extrabold text-slate-900">Help & About Zynci</h2>
          </div>
          <button
            type="button"
            (click)="closeModal.emit()"
            class="rounded-full p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            title="Close"
          >
            ✕
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4 text-xs text-slate-600 leading-relaxed select-text">
          <!-- Quick How-To -->
          <div class="space-y-1.5">
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-900">
              How it works
            </h3>
            <ul class="space-y-1 text-slate-600 list-disc pl-4">
              <li>
                <strong class="text-slate-800">Add or Update Availability:</strong> Click <strong>+ Add my availability</strong>, tap or drag across cells to mark <span class="text-blue-600 font-bold">Free</span> or <span class="text-slate-500 font-bold">Busy</span>, or use the <strong>M–F</strong> / <strong>S–S</strong> columns to toggle all weekdays or weekends at once.
              </li>
              <li>
                <strong class="text-slate-800">Inspect Slots:</strong> Tap any cell in the group table to see who is available and who is busy below the table.
              </li>
              <li>
                <strong class="text-slate-800">Auto-Cleanup:</strong> Polls are automatically deleted once their last selected date has passed.
              </li>
            </ul>
          </div>

          <!-- Creator & Disclaimer -->
          <div class="pt-3 border-t border-slate-100 space-y-2">
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-900">
              About & Disclaimer
            </h3>
            <p>
              Created by <strong class="text-slate-900">Bruna Freitas</strong> for personal purposes.
            </p>
            <p class="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-slate-600">
              This app is provided as-is for personal use. I do not hold any promises or guarantees regarding bugs, uptime, or data availability.
            </p>
          </div>

          <!-- Anti-Spam Contact Section -->
          <div class="pt-3 border-t border-slate-100 space-y-2">
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-900">
              Report a Problem
            </h3>
            <p>
              If you run into any issues or bugs, feel free to reach out:
            </p>

            @if (!emailRevealed()) {
              <button
                type="button"
                (click)="revealEmail()"
                class="rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 px-4 py-2 text-xs font-bold text-slate-800 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Click to reveal contact email</span>
              </button>
            } @else {
              <div class="rounded-xl bg-blue-50/70 border border-blue-200 p-3 flex flex-wrap items-center justify-between gap-2">
                <span class="font-mono font-bold text-slate-900 text-xs">
                  {{ obfuscatedDisplay() }}
                </span>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    (click)="copyEmail()"
                    class="rounded-full bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    {{ copied() ? 'Copied!' : 'Copy Email' }}
                  </button>
                  <button
                    type="button"
                    (click)="openMailClient()"
                    class="rounded-full bg-blue-600 hover:bg-blue-500 px-3 py-1 text-[11px] font-bold text-white cursor-pointer"
                  >
                    Email Me
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class HelpModalComponent {
  @Output() closeModal = new EventEmitter<void>();

  emailRevealed = signal<boolean>(false);
  copied = signal<boolean>(false);

  // Stored as split character code arrays so bots/scrapers scanning HTML or JS bundles cannot regex-match an email address
  private readonly uCodes = [104, 101, 108, 108, 111];
  private readonly dCodes = [98, 102, 114, 101, 105, 116, 97, 115];
  private readonly tCodes = [100, 101];

  private decodePart(codes: number[]): string {
    return String.fromCharCode(...codes);
  }

  private assembleAddress(): string {
    const u = this.decodePart(this.uCodes);
    const d = this.decodePart(this.dCodes);
    const t = this.decodePart(this.tCodes);
    return [u, [d, t].join('.')].join('@');
  }

  obfuscatedDisplay(): string {
    const u = this.decodePart(this.uCodes);
    const d = this.decodePart(this.dCodes);
    const t = this.decodePart(this.tCodes);
    return `${u} [at] ${d} [dot] ${t}`;
  }

  revealEmail(): void {
    this.emailRevealed.set(true);
  }

  async copyEmail(): Promise<void> {
    const ok = await copyTextToClipboard(this.assembleAddress());
    if (ok) {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    }
  }

  openMailClient(): void {
    const addr = this.assembleAddress();
    window.location.href = `mailto:${addr}?subject=${encodeURIComponent('Zynci Feedback / Bug Report')}`;
  }
}
