import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  GlobalAvailabilityRules,
  TIME_SLOTS,
  TimeSlot,
} from '../../models/scheduler.models';

interface IndividualDayColumn {
  dow: number;
  label: string;
  isWeekend: boolean;
}

@Component({
  selector: 'app-global-rules-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-0 sm:p-4 animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white shadow-xl border border-slate-200/80 overflow-hidden"
      >
        <!-- Minimal Header -->
        <div class="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 class="text-sm font-extrabold text-slate-900">
              Usual Availability · {{ participantName }}
            </h2>
            <p class="text-[11px] text-slate-400">
              Tap slots to flip <span class="text-blue-600 font-bold">Free</span> or <span class="text-slate-500 font-semibold">Busy</span>
            </p>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              (click)="toggleExpandDays()"
              class="rounded-full bg-slate-100 hover:bg-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600 transition-colors cursor-pointer"
            >
              {{ condenseWeekdays() ? 'All 7 Days' : 'Condense Mon–Fri' }}
            </button>
            <button
              type="button"
              (click)="skipRules.emit()"
              class="rounded-full p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Minimalist Slot Grid -->
        <div class="p-4">
          @if (condenseWeekdays()) {
            <!-- CONDENSED VIEW: [Mon–Fri] | [Sat] | [Sun] -->
            <div class="grid grid-cols-4 gap-2 items-center text-center">
              <div></div>
              <button
                type="button"
                (click)="toggleColumnGroup([1, 2, 3, 4, 5])"
                class="rounded-md bg-slate-100 hover:bg-slate-200/80 py-1.5 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 cursor-pointer transition-colors"
                title="Tap to flip all Weekdays"
              >
                Mon–Fri
              </button>
              <button
                type="button"
                (click)="toggleColumnGroup([6])"
                class="rounded-md bg-slate-100 hover:bg-slate-200/80 py-1.5 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 cursor-pointer transition-colors"
                title="Tap to flip Saturday"
              >
                Sat
              </button>
              <button
                type="button"
                (click)="toggleColumnGroup([0])"
                class="rounded-md bg-slate-100 hover:bg-slate-200/80 py-1.5 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 cursor-pointer transition-colors"
                title="Tap to flip Sunday"
              >
                Sun
              </button>

              @for (slot of timeSlots; track slot.key) {
                <!-- Row Header (M / A / E) -->
                <button
                  type="button"
                  (click)="toggleSlotAcrossAllDays(slot.key)"
                  [title]="slot.fullLabel + ' (' + slot.timeHint + ') · Click to toggle all days'"
                  class="flex items-center gap-1.5 text-left py-1 px-1 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  <span class="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider">
                    {{ slot.shortLabel }}
                  </span>
                  <div class="flex flex-col leading-tight">
                    <span class="text-xs font-bold text-slate-700">{{ slot.fullLabel }}</span>
                    <span class="text-[10px] font-medium text-slate-400">{{ slot.timeHint }}</span>
                  </div>
                </button>

                <!-- Mon-Fri Cell -->
                <button
                  type="button"
                  (click)="toggleGroupSlot([1, 2, 3, 4, 5], slot.key)"
                  [class]="
                    isGroupSlotAvailable([1, 2, 3, 4, 5], slot.key)
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  "
                  class="h-10 rounded-md border font-extrabold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  {{ isGroupSlotAvailable([1, 2, 3, 4, 5], slot.key) ? 'Free' : 'Busy' }}
                </button>

                <!-- Sat Cell -->
                <button
                  type="button"
                  (click)="toggleGroupSlot([6], slot.key)"
                  [class]="
                    isGroupSlotAvailable([6], slot.key)
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  "
                  class="h-10 rounded-md border font-extrabold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  {{ isGroupSlotAvailable([6], slot.key) ? 'Free' : 'Busy' }}
                </button>

                <!-- Sun Cell -->
                <button
                  type="button"
                  (click)="toggleGroupSlot([0], slot.key)"
                  [class]="
                    isGroupSlotAvailable([0], slot.key)
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  "
                  class="h-10 rounded-md border font-extrabold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  {{ isGroupSlotAvailable([0], slot.key) ? 'Free' : 'Busy' }}
                </button>
              }
            </div>
          } @else {
            <!-- EXPANDED 7-DAY VIEW: Mon Tue Wed Thu Fri | Sat Sun -->
            <div class="grid grid-cols-8 gap-1 items-center text-center">
              <div></div>
              @for (col of allDays; track col.dow) {
                <button
                  type="button"
                  (click)="toggleColumnGroup([col.dow])"
                  class="rounded-sm bg-slate-100 text-slate-700 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-200"
                >
                  {{ col.label }}
                </button>
              }

              @for (slot of timeSlots; track slot.key) {
                <button
                  type="button"
                  (click)="toggleSlotAcrossAllDays(slot.key)"
                  class="flex items-center justify-center h-9 rounded-sm bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                  [title]="slot.fullLabel + ' (' + slot.timeHint + ') · Click to toggle all days'"
                >
                  {{ slot.shortLabel }}
                </button>

                @for (col of allDays; track col.dow) {
                  <button
                    type="button"
                    (click)="toggleGroupSlot([col.dow], slot.key)"
                    [class]="
                      isGroupSlotAvailable([col.dow], slot.key)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    "
                    class="h-9 rounded-sm border font-extrabold text-xs transition-all active:scale-95 cursor-pointer"
                  >
                    {{ slot.shortLabel }}
                  </button>
                }
              }
            </div>
          }

          <!-- Quick All / None + Apply CTA (44px Tactile Rounded-Full Button) -->
          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                (click)="setAll(true)"
                class="rounded-full bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 cursor-pointer"
              >
                All Free
              </button>
              <button
                type="button"
                (click)="setAll(false)"
                class="rounded-full bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-500 cursor-pointer"
              >
                All busy
              </button>
            </div>

            <button
              type="button"
              (click)="onApply()"
              class="min-h-[44px] rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-5 py-2.5 text-xs sm:text-sm shadow-sm shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center"
            >
              Apply to Calendar
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class GlobalRulesModalComponent {
  @Input() participantName = 'Friend';
  @Output() applyRules = new EventEmitter<GlobalAvailabilityRules>();
  @Output() skipRules = new EventEmitter<void>();

  readonly timeSlots = TIME_SLOTS;
  readonly allDays: IndividualDayColumn[] = [
    { dow: 1, label: 'Mo', isWeekend: false },
    { dow: 2, label: 'Tu', isWeekend: false },
    { dow: 3, label: 'We', isWeekend: false },
    { dow: 4, label: 'Th', isWeekend: false },
    { dow: 5, label: 'Fr', isWeekend: false },
    { dow: 6, label: 'Sa', isWeekend: true },
    { dow: 0, label: 'Su', isWeekend: true },
  ];

  condenseWeekdays = signal<boolean>(true);

  byDay = signal<Record<number, Record<TimeSlot, boolean>>>({
    1: { morning: false, afternoon: false, evening: true },
    2: { morning: false, afternoon: false, evening: true },
    3: { morning: false, afternoon: false, evening: true },
    4: { morning: false, afternoon: false, evening: true },
    5: { morning: false, afternoon: false, evening: true },
    6: { morning: true, afternoon: true, evening: true },
    0: { morning: true, afternoon: true, evening: true },
  });

  toggleExpandDays(): void {
    this.condenseWeekdays.update((v) => !v);
  }

  isGroupSlotAvailable(dows: number[], slot: TimeSlot): boolean {
    const state = this.byDay();
    return dows.every((d) => state[d]?.[slot]);
  }

  toggleGroupSlot(dows: number[], slot: TimeSlot): void {
    const nextVal = !this.isGroupSlotAvailable(dows, slot);
    this.byDay.update((prev) => {
      const copy: Record<number, Record<TimeSlot, boolean>> = {};
      for (const k of [0, 1, 2, 3, 4, 5, 6]) {
        copy[k] = { ...prev[k] };
      }
      for (const d of dows) {
        copy[d][slot] = nextVal;
      }
      return copy;
    });
  }

  toggleColumnGroup(dows: number[]): void {
    const allFree = TIME_SLOTS.every((s) => this.isGroupSlotAvailable(dows, s.key));
    const nextVal = !allFree;
    this.byDay.update((prev) => {
      const copy: Record<number, Record<TimeSlot, boolean>> = {};
      for (const k of [0, 1, 2, 3, 4, 5, 6]) {
        copy[k] = { ...prev[k] };
      }
      for (const d of dows) {
        copy[d] = { morning: nextVal, afternoon: nextVal, evening: nextVal };
      }
      return copy;
    });
  }

  toggleSlotAcrossAllDays(slot: TimeSlot): void {
    this.toggleGroupSlot([0, 1, 2, 3, 4, 5, 6], slot);
  }

  setAll(val: boolean): void {
    const next: Record<number, Record<TimeSlot, boolean>> = {};
    for (const d of [0, 1, 2, 3, 4, 5, 6]) {
      next[d] = { morning: val, afternoon: val, evening: val };
    }
    this.byDay.set(next);
  }

  onApply(): void {
    this.applyRules.emit({
      byDayOfWeek: this.byDay(),
    });
  }
}
