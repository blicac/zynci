import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DayRowInfo,
  Participant,
  SlotConsensus,
  TIME_SLOTS,
  TimeSlot,
} from '../../models/scheduler.models';

@Component({
  selector: 'app-heatmap-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pb-16 bg-slate-50">
      <!-- STICKY LEADERBOARD: Minimalist elevated top bar -->
      <div class="sticky top-0 z-30 bg-white/95 backdrop-blur-md text-slate-900 border-b border-slate-200/80 shadow-2xs">
        <div class="max-w-5xl mx-auto px-3 sm:px-6 py-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-blue-600"></span>
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Top Slots
              </span>
            </div>

            @if (topSlots.length > 0 && participants.length > 0) {
              <div class="flex flex-wrap items-center gap-2">
                @for (item of topSlots; track item.dateStr + item.slot; let idx = $index) {
                  <button
                    type="button"
                    (click)="selectSlotForTooltip(item)"
                    class="inline-flex items-center gap-1.5 rounded-full bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-200 px-3.5 py-1.5 text-xs transition-all cursor-pointer shadow-2xs"
                  >
                    <span class="font-bold text-blue-600">{{ idx + 1 }}.</span>
                    <span class="font-extrabold text-slate-900">{{ item.displayDate }} {{ item.slotLabel.slice(0, 3) }}</span>
                    <span class="text-[11px] font-medium text-slate-500">({{ item.availableCount }}/{{ item.totalParticipants }})</span>
                  </button>
                }
              </div>
            } @else {
              <span class="text-xs text-slate-400">No responses yet</span>
            }
          </div>
        </div>
      </div>

      <!-- Elevated Main Calendar Card on Soft Slate Surface -->
      <div class="max-w-5xl mx-auto px-2 sm:px-6 mt-4">
        <div class="rounded-2xl bg-white border border-slate-200/80 shadow-md shadow-slate-900/5 p-3.5 sm:p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">Group Availability</span>
              <span class="rounded-full bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
                {{ participants.length }} {{ participants.length === 1 ? 'person' : 'people' }}
              </span>
            </div>

            <!-- Right Side: Clickable User Name Pill + 44px Tactile Primary CTA -->
            <div class="flex flex-wrap items-center gap-2">
              @if (currentUserName) {
                <button
                  type="button"
                  (click)="openRenamePrompt()"
                  class="min-h-[40px] rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Click to update your name across all polls"
                >
                  <span>{{ currentUserName }}</span>
                  <span class="text-[10px] text-slate-400">✎</span>
                </button>
              }

              @if (ownedParticipantName) {
                <button
                  type="button"
                  (click)="editMyAvailability.emit()"
                  class="min-h-[44px] rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-5 py-2.5 text-xs sm:text-sm shadow-sm shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center"
                >
                  Update my availability
                </button>
              } @else if (currentUserName) {
                <button
                  type="button"
                  (click)="startAddingAvailability.emit(currentUserName)"
                  class="min-h-[44px] rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-5 py-2.5 text-xs sm:text-sm shadow-sm shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center"
                >
                  + Add my availability
                </button>
              } @else if (!showNamePrompt()) {
                <button
                  type="button"
                  (click)="openNamePrompt()"
                  class="min-h-[44px] rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-5 py-2.5 text-xs sm:text-sm shadow-sm shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center"
                >
                  + Add my availability
                </button>
              }
            </div>
          </div>

          <!-- Inline Name Prompt (First-time user OR clicking their name to update it) -->
          @if (showNamePrompt()) {
            <form (ngSubmit)="submitParticipantName()" class="mt-3.5 pt-3.5 border-t border-slate-100">
              <div class="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  name="participantName"
                  [(ngModel)]="enteredName"
                  [placeholder]="isRenaming() ? 'Update your name...' : 'Enter your name (used across your polls)...'"
                  required
                  autofocus
                  class="flex-1 min-h-[44px] rounded-full border border-slate-300 bg-slate-50/70 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
                <div class="flex items-center gap-2">
                  <button
                    type="submit"
                    [disabled]="!enteredName.trim()"
                    class="min-h-[44px] rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-5 py-2 text-xs sm:text-sm cursor-pointer"
                  >
                    {{ isRenaming() ? 'Save Name' : 'Continue' }}
                  </button>
                  <button
                    type="button"
                    (click)="showNamePrompt.set(false); isRenaming.set(false); nameError = ''"
                    class="min-h-[44px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-4 py-2 text-xs sm:text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              @if (nameError) {
                <p class="mt-1.5 text-[11px] font-semibold text-rose-600">{{ nameError }}</p>
              }
            </form>
          }

          <!-- Minimalist Transposed Matrix -->
          <div class="mt-4 rounded-xl border border-slate-200/80 overflow-hidden">
            <div class="overflow-x-auto overscroll-x-contain touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch]">
              <table class="w-full border-collapse text-center">
                <thead>
                  <tr class="border-b border-slate-200/80 bg-slate-50/90">
                    <th class="sticky left-0 z-10 bg-slate-50 border-r border-slate-200/80 px-2 py-2 min-w-[38px] w-[38px]"></th>

                    @for (day of days; track day.dateStr) {
                      <th
                        [class]="day.isWeekend ? 'bg-slate-100/70' : ''"
                        class="border-r border-slate-100 px-1.5 py-2 min-w-[44px]"
                      >
                        <div class="flex flex-col items-center leading-none">
                          <span
                            [class]="day.isWeekend ? 'text-slate-600 font-bold' : 'text-slate-400 font-bold'"
                            class="text-[11px] uppercase tracking-wider"
                          >
                            {{ day.weekdayShort.slice(0, 2) }}
                          </span>
                          <span class="text-xs font-extrabold text-slate-800 mt-1">
                            {{ day.dayMonthSlash }}
                          </span>
                        </div>
                      </th>
                    }
                  </tr>
                </thead>

                <tbody class="divide-y divide-slate-100">
                  @for (slot of timeSlots; track slot.key) {
                    <tr>
                      <!-- Sticky M / A / E Row Header (Polished Metadata Label) -->
                      <td
                        class="sticky left-0 z-10 bg-slate-50 border-r border-slate-200/80 px-2 py-1.5 text-center font-bold text-[11px] uppercase tracking-wider text-slate-600"
                        [title]="slot.fullLabel"
                      >
                        {{ slot.shortLabel }}
                      </td>

                      <!-- Date Columns (Slightly Rounded Cells: rounded-sm) -->
                      @for (day of days; track day.dateStr) {
                        @let consensus = getConsensus(day.dateStr, slot.key);
                        <td
                          [class]="day.isWeekend ? 'bg-slate-50/60' : 'bg-white'"
                          class="p-0.5 border-r border-slate-100"
                        >
                          <button
                            type="button"
                            (click)="selectSlotForTooltip(consensus)"
                            [class]="getHeatmapBlockClasses(consensus)"
                            [class.ring-2]="isSelectedSlot(consensus)"
                            [class.ring-slate-900]="isSelectedSlot(consensus)"
                            class="h-8 w-full rounded-sm border text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer select-none"
                          >
                            {{ consensus.availableCount > 0 ? consensus.availableCount : '' }}
                          </button>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- Active Slot Details (Shown BELOW the table in a clean white card with blue/slate badges) -->
          @if (activeSlot(); as slotInfo) {
            <div
              class="mt-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 px-4 py-3 flex items-start sm:items-center justify-between gap-2 text-xs text-slate-800 shadow-2xs transition-all"
            >
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-extrabold text-slate-900">
                    {{ slotInfo.fullDateLabel }} · {{ slotInfo.slotLabel }}
                  </span>
                  <span
                    [class]="
                      slotInfo.availableCount > 0
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : 'bg-slate-200/80 text-slate-600 border-slate-300'
                    "
                    class="rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
                  >
                    {{ slotInfo.availableCount }} / {{ slotInfo.totalParticipants }} free
                  </span>
                </div>

                <div class="flex flex-wrap items-center gap-1.5">
                  @if (slotInfo.availableNames.length > 0) {
                    <span class="text-[11px] font-bold text-blue-700">Available:</span>
                    @for (name of slotInfo.availableNames; track name) {
                      <span class="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-semibold text-blue-900">
                        {{ name }}
                      </span>
                    }
                  } @else {
                    <span class="text-[11px] font-medium text-slate-500">All busy at this time.</span>
                  }

                  @if (slotInfo.unavailableNames.length > 0) {
                    <span class="text-[11px] font-semibold text-slate-500 ml-1">Busy:</span>
                    @for (busyName of slotInfo.unavailableNames; track busyName) {
                      <span class="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {{ busyName }}
                      </span>
                    }
                  }
                </div>
              </div>

              <button
                type="button"
                (click)="selectedSlotKey.set(null)"
                class="rounded-full text-slate-400 hover:text-slate-700 font-bold px-2 py-1 cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class HeatmapViewComponent {
  @Input({ required: true }) days: DayRowInfo[] = [];
  @Input({ required: true }) participants: Participant[] = [];
  @Input({ required: true }) consensusMap: Record<string, SlotConsensus> = {};
  @Input({ required: true }) topSlots: SlotConsensus[] = [];
  @Input() ownedParticipantName: string | null = null;
  @Input() currentUserName: string | null = null;
  @Input() nameError = '';

  @Output() startAddingAvailability = new EventEmitter<string>();
  @Output() editMyAvailability = new EventEmitter<void>();
  @Output() renameUser = new EventEmitter<string>();

  readonly timeSlots = TIME_SLOTS;

  showNamePrompt = signal<boolean>(false);
  isRenaming = signal<boolean>(false);
  enteredName = '';
  selectedSlotKey = signal<{ dateStr: string; slot: TimeSlot } | null>(null);

  activeSlot(): SlotConsensus | null {
    const sel = this.selectedSlotKey();
    if (!sel) return null;
    if (!this.days.some((d) => d.dateStr === sel.dateStr)) {
      return null;
    }
    return this.getConsensus(sel.dateStr, sel.slot);
  }

  openNamePrompt(): void {
    this.isRenaming.set(false);
    this.enteredName = this.currentUserName ?? '';
    this.showNamePrompt.set(true);
  }

  openRenamePrompt(): void {
    this.isRenaming.set(true);
    this.enteredName = this.currentUserName ?? this.ownedParticipantName ?? '';
    this.showNamePrompt.set(true);
  }

  submitParticipantName(): void {
    const clean = this.enteredName.trim();
    if (!clean) return;
    if (this.isRenaming()) {
      this.renameUser.emit(clean);
      this.showNamePrompt.set(false);
      this.isRenaming.set(false);
    } else {
      this.startAddingAvailability.emit(clean);
    }
  }

  getConsensus(dateStr: string, slot: TimeSlot): SlotConsensus {
    const key = `${dateStr}_${slot}`;
    return (
      this.consensusMap[key] ?? {
        dateStr,
        displayDate: dateStr,
        fullDateLabel: dateStr,
        slot,
        slotLabel: slot,
        availableNames: [],
        unavailableNames: [],
        availableCount: 0,
        totalParticipants: this.participants.length,
        ratio: 0,
      }
    );
  }

  /**
   * Monochromatic blue scale (blue-50 through blue-600) for available slots,
   * and highly muted cool gray (slate-100) for empty/unavailable slots.
   */
  getHeatmapBlockClasses(c: SlotConsensus): string {
    if (c.totalParticipants === 0 || c.availableCount === 0) {
      return 'bg-slate-100/90 text-slate-400 border-slate-200/60';
    }
    const r = c.ratio;
    if (r >= 0.999) {
      return 'bg-blue-600 text-white border-blue-600 shadow-2xs';
    }
    if (r >= 0.7) {
      return 'bg-blue-500 text-white border-blue-500';
    }
    if (r >= 0.4) {
      return 'bg-blue-300 text-blue-950 border-blue-300';
    }
    return 'bg-blue-100 text-blue-900 border-blue-200';
  }

  selectSlotForTooltip(slot: SlotConsensus): void {
    const current = this.selectedSlotKey();
    if (current && current.dateStr === slot.dateStr && current.slot === slot.slot) {
      this.selectedSlotKey.set(null);
    } else {
      this.selectedSlotKey.set({ dateStr: slot.dateStr, slot: slot.slot });
    }
  }

  isSelectedSlot(slot: SlotConsensus): boolean {
    const current = this.selectedSlotKey();
    return !!current && current.dateStr === slot.dateStr && current.slot === slot.slot;
  }
}
