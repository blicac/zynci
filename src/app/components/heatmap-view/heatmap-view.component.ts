import { Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
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
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">Group Availability</span>
              <!-- Participants Chip (Hover for tooltip, Click to open draggable filter modal) -->
              <div class="relative group inline-flex items-center">
                <button
                  type="button"
                  (click)="toggleParticipantsModal()"
                  [title]="participantNamesSummary()"
                  [class]="
                    showParticipantsTooltip() || selectedParticipantId
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 border-slate-200/60'
                  "
                  class="rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors cursor-pointer select-none flex items-center gap-1"
                >
                  <span>{{ participants.length }} {{ participants.length === 1 ? 'person' : 'people' }}</span>
                </button>

                <!-- Hover-only quick preview when the modal is NOT open -->
                @if (!showParticipantsTooltip()) {
                  <div
                    class="opacity-0 invisible -translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 absolute left-0 top-full mt-2 z-30 min-w-[170px] max-w-[260px] rounded-xl bg-slate-900 text-white p-2.5 shadow-lg transition-all duration-150 pointer-events-none"
                  >
                    <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Participants · Click chip to filter
                    </div>
                    @if (participants.length === 0) {
                      <div class="text-xs text-slate-300 italic">No participants yet</div>
                    } @else {
                      <div class="flex flex-wrap gap-1">
                        @for (p of participants; track p.id) {
                          <span class="inline-block rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-100">
                            {{ p.name }}
                          </span>
                        }
                      </div>
                    }
                  </div>
                }

                <!-- Draggable Interactive Participants Mini-Modal (Opened on Click) -->
                @if (showParticipantsTooltip()) {
                  <div
                    [style.transform]="'translate3d(' + modalOffset().x + 'px, ' + modalOffset().y + 'px, 0)'"
                    class="absolute left-0 top-full mt-2 z-50 w-64 sm:w-72 rounded-2xl bg-slate-900 text-white shadow-xl border border-slate-700/80 select-none overflow-hidden"
                  >
                    <!-- Draggable Header Bar + Small X Close Button -->
                    <div
                      (pointerdown)="startModalDrag($event)"
                      class="flex items-center justify-between px-3 py-2 bg-slate-800/90 border-b border-slate-700/80 cursor-move touch-none"
                      title="Drag to move out of the way"
                    >
                      <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                        <span class="text-slate-500 text-xs leading-none">⋮⋮</span>
                        <span>Participants ({{ participants.length }})</span>
                      </div>
                      <button
                        type="button"
                        (pointerdown)="$event.stopPropagation()"
                        (click)="closeParticipantsModal()"
                        class="rounded-full h-5 w-5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 text-xs font-bold cursor-pointer transition-colors"
                        title="Close"
                      >
                        ✕
                      </button>
                    </div>

                    <!-- Clickable Participant List (Click a person to view only their availability) -->
                    <div class="p-3 space-y-2">
                      @if (participants.length === 0) {
                        <div class="text-xs text-slate-300 italic">No participants yet</div>
                      } @else {
                        <p class="text-[10px] font-medium text-slate-400">
                          Tap a person to show only their availability:
                        </p>
                        <div class="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                          <button
                            type="button"
                            (click)="onSelectPerson(null)"
                            [class]="
                              !selectedParticipantId
                                ? 'bg-blue-600 border-blue-500 text-white shadow-2xs'
                                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                            "
                            class="rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            All ({{ participants.length }})
                          </button>

                          @for (p of participants; track p.id) {
                            <button
                              type="button"
                              (click)="onSelectPerson(p.id)"
                              [class]="
                                selectedParticipantId === p.id
                                  ? 'bg-blue-600 border-blue-500 text-white shadow-2xs'
                                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
                              "
                              class="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              {{ p.name }}
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>

              <!-- Active Single-Person Filter Badge (Quick Reset) -->
              @if (selectedParticipantName(); as filteredName) {
                <button
                  type="button"
                  (click)="onSelectPerson(null)"
                  class="rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Click to show all participants again"
                >
                  <span>Showing: {{ filteredName }}</span>
                  <span class="text-blue-500 font-extrabold">✕</span>
                </button>
              }
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
              } @else if (!showNamePrompt()) {
                <button
                  type="button"
                  (click)="onAddMyAvailabilityClick()"
                  class="min-h-[44px] rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-5 py-2.5 text-xs sm:text-sm shadow-sm shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center"
                >
                  + Add my availability
                </button>
              }
            </div>
          </div>

          <!-- Inline Name Prompt ("That's me" existing participant picker OR new unique name) -->
          @if (showNamePrompt()) {
            <div class="mt-3.5 pt-3.5 border-t border-slate-100 space-y-3">
              @if (!isRenaming() && participants.length > 0) {
                <div class="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
                  <span class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Already in this poll? Tap your name ("That's me"):
                  </span>
                  <div class="flex flex-wrap gap-1.5">
                    @for (p of participants; track p.id) {
                      <button
                        type="button"
                        (click)="promptClaimExistingParticipant(p)"
                        class="rounded-full bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-3 py-1.5 text-xs font-bold text-slate-800 hover:text-blue-700 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>{{ p.name }}</span>
                        <span class="text-[10px] font-bold text-blue-600">That's me →</span>
                      </button>
                    }
                  </div>
                </div>
              }

              <form (ngSubmit)="submitParticipantName()">
                @if (!isRenaming() && participants.length > 0) {
                  <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Or join as a new participant:
                  </label>
                }
                <div class="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    name="participantName"
                    [(ngModel)]="enteredName"
                    [placeholder]="
                      isRenaming()
                        ? 'Update your name...'
                        : participants.length > 0
                        ? 'Type a new unique name...'
                        : 'Enter your name (used across your polls)...'
                    "
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
                      (click)="showNamePrompt.set(false); isRenaming.set(false); pendingClaimParticipant.set(null); localNameError.set(''); nameError = ''"
                      class="min-h-[44px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-4 py-2 text-xs sm:text-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                @if (localNameError() || nameError) {
                  <p class="mt-1.5 text-[11px] font-semibold text-rose-600">
                    {{ localNameError() || nameError }}
                  </p>
                }
              </form>
            </div>
          }

          <!-- Small Confirmation Modal when clicking "That's me" -->
          @if (pendingClaimParticipant(); as targetParticipant) {
            <div
              class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
              (click)="cancelClaimExistingParticipant()"
            >
              <div
                class="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-5 space-y-4"
                (click)="$event.stopPropagation()"
              >
                <div>
                  <h4 class="text-sm sm:text-base font-extrabold text-slate-900">
                    Confirm you are "{{ targetParticipant.name }}"?
                  </h4>
                  <p class="mt-1 text-xs text-slate-600 leading-relaxed">
                    This will load <strong>{{ targetParticipant.name }}</strong>'s availability on this device so you can view and update it.
                  </p>
                </div>

                <div class="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    (click)="cancelClaimExistingParticipant()"
                    class="min-h-[38px] rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold px-4 py-2 text-xs shadow-2xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    (click)="confirmClaimExistingParticipant()"
                    class="min-h-[38px] rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-4 py-2 text-xs shadow-2xs transition-colors cursor-pointer"
                  >
                    Yes, that's me →
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Minimalist Transposed Matrix -->
          <div class="mt-4 rounded-xl border border-slate-200/80 overflow-hidden">
            <div class="overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch]">
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
                      <!-- Sticky M / A / E Row Header with Rich Hover Tooltip -->
                      <td
                        class="group relative sticky left-0 z-20 bg-slate-50 hover:bg-slate-100 border-r border-slate-200/80 px-2 py-1.5 text-center font-bold text-[11px] uppercase tracking-wider text-slate-600 cursor-help select-none"
                        [title]="slot.fullLabel + ' (' + slot.timeHint + ')'"
                      >
                        <span>{{ slot.shortLabel }}</span>
                        <div
                          class="pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 absolute left-full top-1/2 -translate-y-1/2 ml-2 z-40 whitespace-nowrap rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white tracking-normal normal-case leading-none shadow-md"
                        >
                          {{ slot.fullLabel }} · {{ slot.timeHint }}
                        </div>
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
  @Input() selectedParticipantId: string | null = null;

  @Output() startAddingAvailability = new EventEmitter<string>();
  @Output() claimExistingParticipant = new EventEmitter<string>();
  @Output() editMyAvailability = new EventEmitter<void>();
  @Output() renameUser = new EventEmitter<string>();
  @Output() selectParticipantFilter = new EventEmitter<string | null>();

  readonly timeSlots = TIME_SLOTS;

  showNamePrompt = signal<boolean>(false);
  isRenaming = signal<boolean>(false);
  localNameError = signal<string>('');
  pendingClaimParticipant = signal<Participant | null>(null);
  showParticipantsTooltip = signal<boolean>(false);
  modalOffset = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  private isDraggingModal = false;
  private dragStartPointer = { x: 0, y: 0 };
  private dragStartOffset = { x: 0, y: 0 };
  enteredName = '';
  selectedSlotKey = signal<{ dateStr: string; slot: TimeSlot } | null>(null);

  toggleParticipantsModal(): void {
    this.showParticipantsTooltip.update((open) => {
      if (!open) {
        this.modalOffset.set({ x: 0, y: 0 });
      }
      return !open;
    });
  }

  closeParticipantsModal(): void {
    this.showParticipantsTooltip.set(false);
    this.isDraggingModal = false;
  }

  onSelectPerson(participantId: string | null): void {
    if (participantId && this.selectedParticipantId === participantId) {
      this.selectParticipantFilter.emit(null);
    } else {
      this.selectParticipantFilter.emit(participantId);
    }
  }

  selectedParticipantName(): string | null {
    if (!this.selectedParticipantId) return null;
    const found = this.participants.find((p) => p.id === this.selectedParticipantId);
    return found ? found.name : null;
  }

  startModalDrag(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    this.isDraggingModal = true;
    this.dragStartPointer = { x: event.clientX, y: event.clientY };
    this.dragStartOffset = { ...this.modalOffset() };
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    if (!this.isDraggingModal) return;
    const dx = event.clientX - this.dragStartPointer.x;
    const dy = event.clientY - this.dragStartPointer.y;
    this.modalOffset.set({
      x: this.dragStartOffset.x + dx,
      y: this.dragStartOffset.y + dy,
    });
  }

  @HostListener('window:pointerup')
  @HostListener('window:pointercancel')
  onWindowPointerUp(): void {
    this.isDraggingModal = false;
  }

  participantNamesSummary(): string {
    if (!this.participants || this.participants.length === 0) {
      return 'No participants yet';
    }
    return `Participants: ${this.participants.map((p) => p.name).join(', ')}`;
  }

  activeSlot(): SlotConsensus | null {
    const sel = this.selectedSlotKey();
    if (!sel) return null;
    if (!this.days.some((d) => d.dateStr === sel.dateStr)) {
      return null;
    }
    return this.getConsensus(sel.dateStr, sel.slot);
  }

  onAddMyAvailabilityClick(): void {
    // If there are already participants in the poll, always show the prompt so the user
    // can either pick their existing name ("That's me") or type a new unique name.
    if (this.participants.length > 0 || !this.currentUserName) {
      this.openNamePrompt();
      return;
    }
    this.startAddingAvailability.emit(this.currentUserName);
  }

  openNamePrompt(): void {
    this.isRenaming.set(false);
    this.localNameError.set('');
    const prefill = this.currentUserName ?? '';
    const isDuplicate = this.participants.some(
      (p) => p.name.toLowerCase() === prefill.trim().toLowerCase()
    );
    this.enteredName = isDuplicate ? '' : prefill;
    this.showNamePrompt.set(true);
  }

  openRenamePrompt(): void {
    this.isRenaming.set(true);
    this.localNameError.set('');
    this.enteredName = this.currentUserName ?? this.ownedParticipantName ?? '';
    this.showNamePrompt.set(true);
  }

  promptClaimExistingParticipant(participant: Participant): void {
    this.localNameError.set('');
    this.pendingClaimParticipant.set(participant);
  }

  cancelClaimExistingParticipant(): void {
    this.pendingClaimParticipant.set(null);
  }

  confirmClaimExistingParticipant(): void {
    const target = this.pendingClaimParticipant();
    if (!target) return;
    this.pendingClaimParticipant.set(null);
    this.localNameError.set('');
    this.showNamePrompt.set(false);
    this.claimExistingParticipant.emit(target.id);
  }

  submitParticipantName(): void {
    const clean = this.enteredName.trim();
    if (!clean) return;
    this.localNameError.set('');

    if (!this.isRenaming()) {
      const duplicate = this.participants.find(
        (p) => p.name.toLowerCase() === clean.toLowerCase()
      );
      if (duplicate) {
        this.localNameError.set(
          `"${duplicate.name}" is already in this poll. If that is you, tap "${duplicate.name} · That's me" above; otherwise enter a different name.`
        );
        return;
      }
    }

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
