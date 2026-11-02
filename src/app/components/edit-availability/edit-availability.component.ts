import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DayRowInfo,
  TIME_SLOTS,
  TimeSlot,
} from '../../models/scheduler.models';

@Component({
  selector: 'app-edit-availability',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pb-24 select-none bg-white">
      <!-- Minimalist Responsive Top Bar -->
      <div class="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 py-2.5 px-3 sm:px-6">
        <div class="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <!-- Top Row on Mobile: Name + Mode Hint -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500"></span>
              @if (!editingName()) {
                <button
                  type="button"
                  (click)="startEditingName()"
                  class="truncate text-xs font-bold text-slate-800 hover:text-emerald-600 underline decoration-slate-300 hover:decoration-emerald-500 transition-colors cursor-pointer flex items-center gap-1"
                  title="Click to update your name"
                >
                  <span class="truncate">{{ participantName }}</span>
                  <span class="text-[10px] text-slate-400">✎</span>
                </button>
                <span class="text-[11px] text-slate-400 truncate">
                  · {{ mobileDragPaintMode() ? 'Drag finger to paint' : 'Swipe to scroll, tap to flip' }}
                </span>
              } @else {
                <form (ngSubmit)="submitNameEdit()" class="flex items-center gap-1">
                  <input
                    type="text"
                    name="newName"
                    [(ngModel)]="draftName"
                    required
                    autofocus
                    class="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none w-36"
                  />
                  <button
                    type="submit"
                    class="rounded-md bg-emerald-600 text-white px-2 py-0.5 text-[11px] font-bold cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    (click)="editingName.set(false)"
                    class="rounded-md bg-slate-200 text-slate-600 px-1.5 py-0.5 text-[11px] font-semibold cursor-pointer"
                  >
                    ✕
                  </button>
                </form>
              }
            </div>

            <!-- Mobile Cancel Button (visible on small screens in row 1) -->
            <button
              type="button"
              (click)="cancelEdit.emit()"
              class="sm:hidden rounded-lg bg-slate-200/70 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 cursor-pointer shrink-0"
            >
              Cancel
            </button>
          </div>

          <!-- Action Controls Row -->
          <div class="flex flex-wrap items-center gap-1.5">
            <!-- Touch Drag-Select Toggle (Solves mobile scroll vs drag-paint conflict) -->
            <button
              type="button"
              (click)="toggleMobileDragPaintMode()"
              [class]="
                mobileDragPaintMode()
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              "
              class="rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
              title="Toggle between scrolling the table and dragging across cells to paint"
            >
              <span>{{ mobileDragPaintMode() ? 'Drag-Select: ON' : 'Drag-Select: OFF' }}</span>
            </button>

            <button
              type="button"
              (click)="setAllSlots(true)"
              class="rounded-lg bg-white border border-slate-200 hover:border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              All Free
            </button>
            <button
              type="button"
              (click)="setAllSlots(false)"
              class="rounded-lg bg-white border border-slate-200 hover:border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-500 cursor-pointer"
            >
              All busy
            </button>
            <button
              type="button"
              (click)="openRulesModal.emit()"
              class="rounded-lg bg-white border border-slate-200 hover:border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              Rules
            </button>
            <button
              type="button"
              (click)="cancelEdit.emit()"
              class="hidden sm:inline-block rounded-lg bg-slate-200/70 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Minimalist Transposed Table (Overall Rules Pinned on Left + Dates on Right) -->
      <div class="max-w-5xl mx-auto px-2 sm:px-6 mt-3">
        <div class="rounded-xl bg-white border border-slate-200/90 overflow-hidden">
          <div
            [class]="mobileDragPaintMode() ? 'touch-none' : 'touch-pan-x touch-pan-y'"
            class="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
            (touchmove)="onTouchMove($event)"
          >
            <table class="w-full border-collapse text-center">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50/70">
                  <!-- Sticky Slot Header -->
                  <th class="sticky left-0 z-20 bg-slate-50 border-r border-slate-200 px-2 py-1.5 min-w-[34px] w-[34px]"></th>

                  <!-- Inline Overall Rule Columns: All Weekdays (M-F) & All Weekends (S-S) -->
                  <th
                    (click)="toggleCategoryDays('weekdays')"
                    class="bg-slate-100/90 hover:bg-slate-200/70 border-r border-slate-200 px-1.5 py-1.5 min-w-[42px] cursor-pointer transition-colors"
                    title="Click to flip all Weekdays (Mon–Fri)"
                  >
                    <div class="flex flex-col items-center leading-none">
                      <span class="text-[9px] font-bold uppercase text-slate-400">Rule</span>
                      <span class="text-[11px] font-black text-slate-700 mt-0.5">M–F</span>
                    </div>
                  </th>

                  <th
                    (click)="toggleCategoryDays('weekends')"
                    class="bg-amber-50/90 hover:bg-amber-100/70 border-r-2 border-slate-300 px-1.5 py-1.5 min-w-[42px] cursor-pointer transition-colors"
                    title="Click to flip all Weekends (Sat–Sun)"
                  >
                    <div class="flex flex-col items-center leading-none">
                      <span class="text-[9px] font-bold uppercase text-amber-600/80">Rule</span>
                      <span class="text-[11px] font-black text-amber-900 mt-0.5">S–S</span>
                    </div>
                  </th>

                  <!-- Individual Date Columns (with DD/MM like 22/11) -->
                  @for (day of days; track day.dateStr) {
                    <th
                      [attr.data-drag-type]="'day'"
                      [attr.data-date]="day.dateStr"
                      (pointerdown)="onDayHeaderPointerDown(day.dateStr, $event)"
                      (pointerenter)="onDayHeaderPointerEnter(day.dateStr, $event)"
                      (touchstart)="onDayHeaderTouchStart(day.dateStr, $event)"
                      (click)="onDayHeaderClick(day.dateStr)"
                      [class]="day.isWeekend ? 'bg-amber-50/50 hover:bg-amber-100/50' : 'hover:bg-slate-100'"
                      class="border-r border-slate-100 px-1 py-1.5 min-w-[42px] cursor-pointer transition-colors select-none"
                      [title]="day.displayLabel"
                    >
                      <div class="flex flex-col items-center leading-none pointer-events-none">
                        <span
                          [class]="day.isWeekend ? 'text-amber-700 font-bold' : 'text-slate-400 font-medium'"
                          class="text-[9px] uppercase"
                        >
                          {{ day.weekdayShort.slice(0, 2) }}
                        </span>
                        <span class="text-[11px] font-extrabold text-slate-800 mt-0.5">
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
                    <!-- Sticky M / A / E Row Header -->
                    <td
                      (click)="toggleEntireSlotRow(slot.key)"
                      class="sticky left-0 z-20 bg-slate-50 hover:bg-slate-100 border-r border-slate-200 px-2 py-1 text-center cursor-pointer font-extrabold text-xs text-slate-700"
                      [title]="'Toggle all ' + slot.fullLabel"
                    >
                      {{ slot.shortLabel }}
                    </td>

                    <!-- Overall Rule Cell: All Weekdays (Mon–Fri) for this slot -->
                    <td
                      (click)="toggleCategorySlot('weekdays', slot.key)"
                      class="bg-slate-50/70 p-1 border-r border-slate-200 cursor-pointer"
                      [title]="'Toggle all Weekday ' + slot.fullLabel + 's'"
                    >
                      <div
                        [class]="
                          isCategorySlotAllFree('weekdays', slot.key)
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : isCategorySlotSomeFree('weekdays', slot.key)
                            ? 'bg-emerald-200 border-emerald-300 text-emerald-900'
                            : 'bg-orange-100 border-orange-200 text-orange-700'
                        "
                        class="h-7 w-full rounded-md border text-[10px] font-bold flex items-center justify-center transition-colors"
                      >
                        {{ isCategorySlotAllFree('weekdays', slot.key) ? 'Free' : 'Busy' }}
                      </div>
                    </td>

                    <!-- Overall Rule Cell: All Weekends (Sat–Sun) for this slot -->
                    <td
                      (click)="toggleCategorySlot('weekends', slot.key)"
                      class="bg-amber-50/40 p-1 border-r-2 border-slate-300 cursor-pointer"
                      [title]="'Toggle all Weekend ' + slot.fullLabel + 's'"
                    >
                      <div
                        [class]="
                          isCategorySlotAllFree('weekends', slot.key)
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : isCategorySlotSomeFree('weekends', slot.key)
                            ? 'bg-emerald-200 border-emerald-300 text-emerald-900'
                            : 'bg-orange-100 border-orange-200 text-orange-700'
                        "
                        class="h-7 w-full rounded-md border text-[10px] font-bold flex items-center justify-center transition-colors"
                      >
                        {{ isCategorySlotAllFree('weekends', slot.key) ? 'Free' : 'Busy' }}
                      </div>
                    </td>

                    <!-- Minimalist Date Cells (Pure Color Blocks) -->
                    @for (day of days; track day.dateStr) {
                      @let available = isSlotAvailable(day.dateStr, slot.key);
                      <td
                        [attr.data-drag-type]="'cell'"
                        [attr.data-date]="day.dateStr"
                        [attr.data-slot]="slot.key"
                        (pointerdown)="onCellPointerDown(day.dateStr, slot.key, $event)"
                        (pointerenter)="onCellPointerEnter(day.dateStr, slot.key, $event)"
                        (touchstart)="onCellTouchStart(day.dateStr, slot.key, $event)"
                        (click)="onCellClick(day.dateStr, slot.key)"
                        [class]="day.isWeekend ? 'bg-amber-50/20' : 'bg-white'"
                        class="p-0.5 border-r border-slate-100 cursor-pointer select-none"
                      >
                        <div
                          [class]="
                            available
                              ? 'bg-emerald-500 border-emerald-600'
                              : 'bg-orange-100 hover:bg-orange-200/80 border-orange-200/90'
                          "
                          class="h-7 w-full rounded-md border transition-colors pointer-events-none"
                        ></div>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Sticky Bottom Save Bar -->
      <div class="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2.5 px-4">
        <div class="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 text-xs text-slate-600">
            <span class="inline-flex items-center gap-1.5">
              <span class="h-3 w-3 rounded-xs bg-emerald-500"></span>
              <strong class="text-slate-800">{{ totalSelectedCount() }} Free</strong>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-3 w-3 rounded-xs bg-orange-100 border border-orange-300"></span>
              <span class="text-orange-800">{{ days.length * 3 - totalSelectedCount() }} Busy</span>
            </span>
          </div>

          <button
            type="button"
            [disabled]="saving"
            (click)="saveAvailability.emit()"
            class="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 px-5 shadow-sm transition-all active:scale-95 cursor-pointer text-xs sm:text-sm"
          >
            {{ saving ? 'Saving...' : 'Save Availability' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class EditAvailabilityComponent {
  @Input({ required: true }) days: DayRowInfo[] = [];
  @Input({ required: true }) availabilityMap: Record<string, boolean> = {};
  @Input() participantName = '';
  @Input() saving = false;

  @Output() availabilityChange = new EventEmitter<{ dateStr: string; slot: TimeSlot; value: boolean }>();
  @Output() dayToggleChange = new EventEmitter<{ dateStr: string; value: boolean }>();
  @Output() bulkAvailabilityChange = new EventEmitter<Record<string, boolean>>();
  @Output() renameUser = new EventEmitter<string>();
  @Output() openRulesModal = new EventEmitter<void>();
  @Output() saveAvailability = new EventEmitter<void>();
  @Output() cancelEdit = new EventEmitter<void>();

  readonly timeSlots = TIME_SLOTS;

  editingName = signal<boolean>(false);
  draftName = '';

  /**
   * On mobile touch screens, normal swiping scrolls the table smoothly (`mobileDragPaintMode = false`)
   * and tapping a cell toggles it. Toggling `Drag-Select: ON` lets mobile users drag-paint across cells.
   */
  mobileDragPaintMode = signal<boolean>(false);

  // Drag-painting state
  isDragging = signal<boolean>(false);
  private dragType: 'cell' | 'day' | null = null;
  private dragTargetAvailableValue = false;
  private visitedKeys = new Set<string>();
  private lastHandledByMousePointer = false;

  startEditingName(): void {
    this.draftName = this.participantName;
    this.editingName.set(true);
  }

  submitNameEdit(): void {
    const clean = this.draftName.trim();
    if (!clean) return;
    this.editingName.set(false);
    this.renameUser.emit(clean);
  }

  toggleMobileDragPaintMode(): void {
    this.mobileDragPaintMode.update((v) => !v);
  }

  @HostListener('window:pointerup')
  @HostListener('window:mouseup')
  @HostListener('window:touchend')
  @HostListener('window:touchcancel')
  stopDragging(): void {
    this.isDragging.set(false);
    this.dragType = null;
    this.visitedKeys.clear();
  }

  private makeKey(dateStr: string, slot: TimeSlot): string {
    return `${dateStr}_${slot}`;
  }

  isSlotAvailable(dateStr: string, slot: TimeSlot): boolean {
    return !!this.availabilityMap[this.makeKey(dateStr, slot)];
  }

  isAllDayAvailable(dateStr: string): boolean {
    return (
      this.isSlotAvailable(dateStr, 'morning') &&
      this.isSlotAvailable(dateStr, 'afternoon') &&
      this.isSlotAvailable(dateStr, 'evening')
    );
  }

  // ============================================================================
  // Inline Overall Rule Helpers (Weekdays M–F vs Weekends S–S)
  // ============================================================================

  private getDaysByCategory(category: 'weekdays' | 'weekends'): DayRowInfo[] {
    return this.days.filter((d) => (category === 'weekends' ? d.isWeekend : !d.isWeekend));
  }

  isCategorySlotAllFree(category: 'weekdays' | 'weekends', slot: TimeSlot): boolean {
    const list = this.getDaysByCategory(category);
    return list.length > 0 && list.every((d) => this.isSlotAvailable(d.dateStr, slot));
  }

  isCategorySlotSomeFree(category: 'weekdays' | 'weekends', slot: TimeSlot): boolean {
    const list = this.getDaysByCategory(category);
    return list.some((d) => this.isSlotAvailable(d.dateStr, slot));
  }

  toggleCategorySlot(category: 'weekdays' | 'weekends', slot: TimeSlot): void {
    const list = this.getDaysByCategory(category);
    const nextVal = !this.isCategorySlotAllFree(category, slot);
    const nextMap = { ...this.availabilityMap };
    for (const d of list) {
      nextMap[this.makeKey(d.dateStr, slot)] = nextVal;
    }
    this.bulkAvailabilityChange.emit(nextMap);
  }

  toggleCategoryDays(category: 'weekdays' | 'weekends'): void {
    const list = this.getDaysByCategory(category);
    const allFree = list.length > 0 && list.every((d) => this.isAllDayAvailable(d.dateStr));
    const nextVal = !allFree;
    const nextMap = { ...this.availabilityMap };
    for (const d of list) {
      for (const s of this.timeSlots) {
        nextMap[this.makeKey(d.dateStr, s.key)] = nextVal;
      }
    }
    this.bulkAvailabilityChange.emit(nextMap);
  }

  // ============================================================================
  // Desktop Mouse Drag-Paint & Mobile Tap / Optional Drag-Select Handlers
  // ============================================================================

  onCellPointerDown(dateStr: string, slot: TimeSlot, event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      if (event.button !== 0) return;
      event.preventDefault();
      this.lastHandledByMousePointer = true;
      this.isDragging.set(true);
      this.dragType = 'cell';
      this.visitedKeys.clear();
      this.dragTargetAvailableValue = !this.isSlotAvailable(dateStr, slot);
      this.applyCellDrag(dateStr, slot);
    } else {
      this.lastHandledByMousePointer = false;
    }
  }

  onCellPointerEnter(dateStr: string, slot: TimeSlot, event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    if (!this.isDragging() || this.dragType !== 'cell') return;
    this.applyCellDrag(dateStr, slot);
  }

  onCellClick(dateStr: string, slot: TimeSlot): void {
    if (this.lastHandledByMousePointer) {
      this.lastHandledByMousePointer = false;
      return;
    }
    if (this.mobileDragPaintMode()) {
      return;
    }
    // Single tap on mobile (when scrolling did not occur) toggles the cell
    this.availabilityChange.emit({
      dateStr,
      slot,
      value: !this.isSlotAvailable(dateStr, slot),
    });
  }

  onDayHeaderPointerDown(dateStr: string, event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      if (event.button !== 0) return;
      event.preventDefault();
      this.lastHandledByMousePointer = true;
      this.isDragging.set(true);
      this.dragType = 'day';
      this.visitedKeys.clear();
      this.dragTargetAvailableValue = !this.isAllDayAvailable(dateStr);
      this.applyDayDrag(dateStr);
    } else {
      this.lastHandledByMousePointer = false;
    }
  }

  onDayHeaderPointerEnter(dateStr: string, event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    if (!this.isDragging() || this.dragType !== 'day') return;
    this.applyDayDrag(dateStr);
  }

  onDayHeaderClick(dateStr: string): void {
    if (this.lastHandledByMousePointer) {
      this.lastHandledByMousePointer = false;
      return;
    }
    if (this.mobileDragPaintMode()) {
      return;
    }
    this.dayToggleChange.emit({
      dateStr,
      value: !this.isAllDayAvailable(dateStr),
    });
  }

  onCellTouchStart(dateStr: string, slot: TimeSlot, _event: TouchEvent): void {
    // Only intercept touchstart when mobile Drag-Select mode is explicitly ON;
    // otherwise let the browser scroll the table naturally.
    if (!this.mobileDragPaintMode()) return;
    this.isDragging.set(true);
    this.dragType = 'cell';
    this.visitedKeys.clear();
    this.dragTargetAvailableValue = !this.isSlotAvailable(dateStr, slot);
    this.applyCellDrag(dateStr, slot);
  }

  onDayHeaderTouchStart(dateStr: string, _event: TouchEvent): void {
    if (!this.mobileDragPaintMode()) return;
    this.isDragging.set(true);
    this.dragType = 'day';
    this.visitedKeys.clear();
    this.dragTargetAvailableValue = !this.isAllDayAvailable(dateStr);
    this.applyDayDrag(dateStr);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.mobileDragPaintMode() || !this.isDragging() || event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
    if (!targetEl) return;

    const cellEl = targetEl.closest('[data-drag-type="cell"]') as HTMLElement | null;
    if (cellEl && this.dragType === 'cell') {
      const dateStr = cellEl.getAttribute('data-date');
      const slot = cellEl.getAttribute('data-slot') as TimeSlot | null;
      if (dateStr && slot) {
        if (event.cancelable) event.preventDefault();
        this.applyCellDrag(dateStr, slot);
      }
      return;
    }

    const dayEl = targetEl.closest('[data-drag-type="day"]') as HTMLElement | null;
    if (dayEl && this.dragType === 'day') {
      const dateStr = dayEl.getAttribute('data-date');
      if (dateStr) {
        if (event.cancelable) event.preventDefault();
        this.applyDayDrag(dateStr);
      }
    }
  }

  private applyCellDrag(dateStr: string, slot: TimeSlot): void {
    const key = this.makeKey(dateStr, slot);
    if (this.visitedKeys.has(key)) return;
    this.visitedKeys.add(key);
    this.availabilityChange.emit({
      dateStr,
      slot,
      value: this.dragTargetAvailableValue,
    });
  }

  private applyDayDrag(dateStr: string): void {
    if (this.visitedKeys.has(dateStr)) return;
    this.visitedKeys.add(dateStr);
    this.dayToggleChange.emit({
      dateStr,
      value: this.dragTargetAvailableValue,
    });
  }

  toggleEntireSlotRow(slot: TimeSlot): void {
    const allFreeInRow = this.days.every((d) => this.isSlotAvailable(d.dateStr, slot));
    const target = !allFreeInRow;
    const nextMap = { ...this.availabilityMap };
    for (const d of this.days) {
      nextMap[this.makeKey(d.dateStr, slot)] = target;
    }
    this.bulkAvailabilityChange.emit(nextMap);
  }

  setAllSlots(isAvailable: boolean): void {
    const nextMap: Record<string, boolean> = {};
    for (const d of this.days) {
      for (const s of this.timeSlots) {
        nextMap[this.makeKey(d.dateStr, s.key)] = isAvailable;
      }
    }
    this.bulkAvailabilityChange.emit(nextMap);
  }

  totalSelectedCount(): number {
    let count = 0;
    for (const d of this.days) {
      for (const s of this.timeSlots) {
        if (this.availabilityMap[this.makeKey(d.dateStr, s.key)]) {
          count++;
        }
      }
    }
    return count;
  }
}
