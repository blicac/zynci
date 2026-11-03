import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import {
  AvailabilityRecord,
  DayRowInfo,
  GlobalAvailabilityRules,
  Participant,
  SchedulerEvent,
  SelectionPaintMode,
  SlotConsensus,
  TIME_SLOTS,
  TimeSlot,
} from '../../models/scheduler.models';
import {
  calculateDaysInclusive,
  copyTextToClipboard,
  decodeShareToken,
  decodeShortSlugToEventId,
  encodeEventIdToShortSlug,
  encodeShareToken,
  formatShortMonthDay,
  generateDateRange,
  verifyPassword,
} from '../../utils/scheduler.utils';
import { GlobalRulesModalComponent } from '../../components/global-rules-modal/global-rules-modal.component';
import { EditAvailabilityComponent } from '../../components/edit-availability/edit-availability.component';
import { HeatmapViewComponent } from '../../components/heatmap-view/heatmap-view.component';
import { HelpModalComponent } from '../../components/help-modal/help-modal.component';

@Component({
  selector: 'app-event-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    GlobalRulesModalComponent,
    EditAvailabilityComponent,
    HeatmapViewComponent,
    HelpModalComponent,
  ],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col">
      <!-- Top Navigation Bar (Clean Elevated Surface, Mobile-Responsive) -->
      <header class="bg-white text-slate-900 border-b border-slate-200/80 shadow-2xs">
        <div class="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <!-- Title & Logo Row -->
          <div class="flex items-center justify-between gap-2 min-w-0">
            <div class="flex items-center gap-2.5 min-w-0">
              <a
                routerLink="/"
                class="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center hover:opacity-85 transition-opacity"
                title="Back to Create Event"
              >
                <img
                  src="/icon.png"
                  alt="Zynci"
                  class="h-8 w-8 rounded-lg object-contain"
                />
              </a>
              <div class="min-w-0">
                @if (eventData(); as ev) {
                  <h1 class="truncate text-sm sm:text-base font-extrabold text-slate-900">
                    {{ ev.title }}
                  </h1>
                  <p class="text-[11px] font-medium text-slate-500 truncate">
                    {{ ev.start_date }} to {{ ev.end_date }} · {{ days().length }} days
                  </p>
                } @else {
                  <span class="text-sm font-bold text-slate-900">Zynci Event</span>
                }
              </div>
            </div>

            <!-- Mobile-only ? Help button in top right of Row 1 -->
            <button
              type="button"
              (click)="showHelpModal.set(true)"
              class="sm:hidden shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              title="Help & About"
            >
              ?
            </button>
          </div>

          <!-- Action Buttons Row -->
          <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            @if (isAdmin() && isUnlocked()) {
              <button
                type="button"
                (click)="toggleAdminSettings()"
                [class]="
                  showAdminSettings()
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                "
                class="rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                title="Edit poll dates, title, password, or participants"
              >
                {{ showAdminSettings() ? 'Close Edit' : 'Edit Poll' }}
              </button>

              <button
                type="button"
                (click)="shareOrCopyLink()"
                [class]="
                  linkCopied()
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                "
                class="rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                <span>{{ linkCopied() ? 'Link Copied!' : 'Share Link' }}</span>
              </button>
            }

            <a
              routerLink="/"
              fragment="my-polls"
              class="rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
            >
              My Polls
            </a>

            <button
              type="button"
              (click)="showHelpModal.set(true)"
              class="hidden sm:inline-block rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              title="Help & About"
            >
              ?
            </button>
          </div>
        </div>
      </header>

      <!-- Expandable Edit Poll Panel (Unified White Scheme: Poll Fields + Participants Below) -->
      @if (showAdminSettings() && isAdmin() && eventData()) {
        <div class="bg-slate-50 text-slate-900 border-b border-slate-200/80 px-3 sm:px-6 py-4">
          <div class="max-w-5xl mx-auto rounded-2xl bg-white border border-slate-200/80 p-4 space-y-4 shadow-sm">
            <form (ngSubmit)="saveAdminPollSettings()" class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <!-- Title -->
              <div class="sm:col-span-2">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Poll Title
                </label>
                <input
                  type="text"
                  name="adminTitle"
                  [(ngModel)]="adminTitle"
                  required
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <!-- Start Date -->
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  name="adminStartDate"
                  [(ngModel)]="adminStartDate"
                  required
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <!-- End Date -->
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  name="adminEndDate"
                  [(ngModel)]="adminEndDate"
                  [min]="adminStartDate"
                  required
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <!-- New Shared Password -->
              <div class="sm:col-span-2">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  New Shared Password <span class="text-slate-400 font-normal">(Leave blank to keep current)</span>
                </label>
                <input
                  type="text"
                  name="adminNewPassword"
                  [(ngModel)]="adminNewPassword"
                  placeholder="Type new password to change it..."
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div class="sm:col-span-2 flex items-center justify-end gap-2">
                <button
                  type="submit"
                  class="min-h-[40px] rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 text-xs shadow-xs cursor-pointer"
                >
                  Save Poll Changes
                </button>
              </div>
            </form>

            <!-- Participants List (Below Poll Edit Fields, Same Color Scheme) -->
            <div class="pt-3 border-t border-slate-100">
              <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Participants in this poll (tap ✕ to remove):
              </span>
              @if (participants().length === 0) {
                <span class="text-xs text-slate-400 italic">No participants yet.</span>
              } @else {
                <div class="flex flex-wrap items-center gap-1.5">
                  @for (p of participants(); track p.id) {
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                      <span>{{ p.name }}</span>
                      <button
                        type="button"
                        (click)="onDeleteParticipant(p)"
                        class="rounded-full hover:bg-slate-200 hover:text-slate-900 text-slate-400 px-1 text-[11px] font-bold cursor-pointer"
                        [title]="'Remove ' + p.name"
                      >
                        ✕
                      </button>
                    </span>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Loading State -->
      @if (loading()) {
        <div class="flex-1 flex items-center justify-center p-8">
          <div class="text-center space-y-2">
            <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
            <p class="text-sm font-semibold text-slate-600">Loading event schedule...</p>
          </div>
        </div>
      } @else if (!eventData()) {
        <!-- Not Found State -->
        <div class="flex-1 flex items-center justify-center p-6">
          <div class="max-w-md w-full rounded-3xl bg-white border border-slate-200 p-8 text-center shadow-sm">
            <h2 class="text-lg font-extrabold text-slate-900">Event Not Found</h2>
            <p class="mt-2 text-xs text-slate-500">
              We couldn't find an event with ID <code class="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{{ eventId }}</code>.
            </p>
            <a
              routerLink="/"
              class="mt-5 inline-flex items-center justify-center min-h-[44px] rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 text-sm transition-colors"
            >
              Create a New Event
            </a>
          </div>
        </div>
      } @else if (!isUnlocked()) {
        <!-- ================================================================ -->
        <!-- PASSWORD GATE VIEW                                               -->
        <!-- ================================================================ -->
        <div class="flex-1 flex items-center justify-center p-4">
          <div class="w-full max-w-md rounded-3xl bg-white border border-slate-200/80 shadow-md p-6 sm:p-8">
            <div class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
              </svg>
              <span>Password Protected Event</span>
            </div>

            <h2 class="mt-4 text-xl font-extrabold text-slate-900">
              {{ eventData()!.title }}
            </h2>
            <p class="mt-1 text-xs text-slate-500">
              Enter the shared event password to view the group heatmap and add your availability.
            </p>

            <form (ngSubmit)="verifyPasswordGate()" class="mt-5 space-y-4">
              <div>
                <label for="gate-password" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Shared Password
                </label>
                <input
                  id="gate-password"
                  type="password"
                  name="passwordAttempt"
                  [(ngModel)]="passwordAttempt"
                  required
                  autofocus
                  placeholder="Enter shared password..."
                  class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              @if (gateError()) {
                <div class="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                  {{ gateError() }}
                </div>
              }

              <button
                type="submit"
                class="w-full min-h-[44px] rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 shadow-sm transition-all cursor-pointer text-sm"
              >
                Unlock Event Schedule
              </button>
            </form>
          </div>
        </div>
      } @else {
        <!-- ================================================================ -->
        <!-- UNLOCKED CONTENT: HEATMAP VIEW OR EDIT VIEW                      -->
        <!-- ================================================================ -->

        @if (toastMessage()) {
          <div class="max-w-5xl mx-auto w-full px-3 sm:px-6 mt-2.5">
            <div class="rounded-full bg-blue-600 text-white px-4 py-2 text-xs sm:text-sm font-bold shadow-sm flex items-center justify-between">
              <span>{{ toastMessage() }}</span>
              <button type="button" (click)="toastMessage.set('')" class="text-blue-100 hover:text-white font-extrabold ml-4 cursor-pointer">✕</button>
            </div>
          </div>
        }

        @if (viewMode() === 'heatmap') {
          <app-heatmap-view
            [days]="days()"
            [participants]="participants()"
            [consensusMap]="consensusMap()"
            [topSlots]="topThreeSlots()"
            [ownedParticipantName]="ownedParticipantName()"
            [currentUserName]="globalUserName()"
            [nameError]="participantNameError()"
            [selectedParticipantId]="filteredParticipantId()"
            (selectParticipantFilter)="filteredParticipantId.set($event)"
            (startAddingAvailability)="onStartParticipantFlow($event)"
            (claimExistingParticipant)="onClaimParticipantFlow($event)"
            (editMyAvailability)="onEditOwnedParticipant()"
            (renameUser)="onRenameUser($event)"
          />
        } @else {
          <app-edit-availability
            [days]="days()"
            [availabilityMap]="draftAvailability()"
            [participantName]="activeParticipant()?.name ?? ''"
            [saving]="savingAvailability()"
            (availabilityChange)="onSingleSlotToggle($event)"
            (dayToggleChange)="onEntireDayToggle($event)"
            (bulkAvailabilityChange)="onBulkAvailabilityChange($event)"
            (renameUser)="onRenameUser($event)"
            (openRulesModal)="showGlobalRulesModal.set(true)"
            (saveAvailability)="onSaveParticipantAvailability()"
            (cancelEdit)="viewMode.set('heatmap')"
          />
        }

        <!-- Pre-flight Global Rules Modal -->
        @if (showGlobalRulesModal()) {
          <app-global-rules-modal
            [participantName]="activeParticipant()?.name ?? 'Friend'"
            (applyRules)="applyGlobalRulesToDraft($event)"
            (skipRules)="showGlobalRulesModal.set(false)"
          />
        }
      }

      @if (showHelpModal()) {
        <app-help-modal (closeModal)="showHelpModal.set(false)" />
      }
    </div>
  `,
})
export class EventViewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly supabaseService = inject(SupabaseService);
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  eventId = '';
  loading = signal<boolean>(true);
  eventData = signal<SchedulerEvent | null>(null);
  isUnlocked = signal<boolean>(false);
  isAdmin = signal<boolean>(false);
  showHelpModal = signal<boolean>(false);

  // Password gate state
  passwordAttempt = '';
  gateError = signal<string>('');

  // Event schedule data
  days = signal<DayRowInfo[]>([]);
  participants = signal<Participant[]>([]);
  availabilities = signal<AvailabilityRecord[]>([]);

  // View mode: 'heatmap' or 'edit'
  viewMode = signal<'heatmap' | 'edit'>('heatmap');
  showGlobalRulesModal = signal<boolean>(false);
  activeParticipant = signal<Participant | null>(null);
  draftAvailability = signal<Record<string, boolean>>({});
  savingAvailability = signal<boolean>(false);
  editPaintMode: SelectionPaintMode = 'unavailable';

  // UI feedback & admin settings
  linkCopied = signal<boolean>(false);
  showAdminSettings = signal<boolean>(false);
  adminTitle = '';
  adminStartDate = '';
  adminEndDate = '';
  adminNewPassword = '';
  toastMessage = signal<string>('');
  ownedParticipantName = signal<string | null>(null);
  globalUserName = signal<string | null>(null);
  participantNameError = signal<string>('');
  filteredParticipantId = signal<string | null>(null);

  /**
   * Computes a map of `${dateStr}_${slot}` -> SlotConsensus across all participants
   * (or filtered to a single selected participant when `filteredParticipantId` is active).
   */
  consensusMap = computed<Record<string, SlotConsensus>>(() => {
    const map: Record<string, SlotConsensus> = {};
    const dayList = this.days();
    const allParticipants = this.participants();
    const selectedId = this.filteredParticipantId();
    const partList =
      selectedId && allParticipants.some((p) => p.id === selectedId)
        ? allParticipants.filter((p) => p.id === selectedId)
        : allParticipants;
    const avList = this.availabilities();

    const avSet = new Set<string>();
    for (const a of avList) {
      if (a.is_available) {
        avSet.add(`${a.participant_id}_${a.date}_${a.time_slot}`);
      }
    }

    for (const day of dayList) {
      const shortDate = formatShortMonthDay(day.dateStr);
      for (const s of TIME_SLOTS) {
        const availableNames: string[] = [];
        const unavailableNames: string[] = [];

        for (const p of partList) {
          if (avSet.has(`${p.id}_${day.dateStr}_${s.key}`)) {
            availableNames.push(p.name);
          } else {
            unavailableNames.push(p.name);
          }
        }

        const total = partList.length;
        const count = availableNames.length;
        const ratio = total > 0 ? count / total : 0;

        map[`${day.dateStr}_${s.key}`] = {
          dateStr: day.dateStr,
          displayDate: shortDate,
          fullDateLabel: day.displayLabel,
          slot: s.key,
          slotLabel: s.fullLabel,
          availableNames,
          unavailableNames,
          availableCount: count,
          totalParticipants: total,
          ratio,
        };
      }
    }

    return map;
  });

  /**
   * Computes the Top 3 best time slots ranked by highest available count (with chronological tie-breaker).
   */
  topThreeSlots = computed<SlotConsensus[]>(() => {
    const allSlots = Object.values(this.consensusMap());
    const withPeople = allSlots.filter((s) => s.availableCount > 0);
    withPeople.sort((a, b) => {
      if (b.availableCount !== a.availableCount) {
        return b.availableCount - a.availableCount;
      }
      return a.dateStr.localeCompare(b.dateStr);
    });
    return withPeople.slice(0, 3);
  });

  async ngOnInit(): Promise<void> {
    this.route.paramMap.subscribe(async (params) => {
      const rawParam = params.get('id') ?? '';
      this.eventId = decodeShortSlugToEventId(rawParam);
      await this.loadEvent();
    });

    // Live poll sync across browser windows/users every 2.5 seconds
    this.syncTimer = setInterval(() => {
      if (this.isUnlocked() && this.viewMode() === 'heatmap' && this.eventId) {
        this.refreshParticipantsAndAvailabilities();
      }
    }, 2500);
  }

  ngOnDestroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    if (this.isUnlocked() && this.viewMode() === 'heatmap' && this.eventId) {
      this.refreshParticipantsAndAvailabilities();
    }
  }

  private async loadEvent(): Promise<void> {
    this.loading.set(true);
    try {
      const shareToken = this.route.snapshot.queryParamMap.get('s');
      const sharedFallback = decodeShareToken(shareToken);

      const ev = await this.supabaseService.getEventById(this.eventId, sharedFallback);
      this.eventData.set(ev);

      if (!ev) {
        return;
      }

      this.days.set(generateDateRange(ev.start_date, ev.end_date));

      const unlocked = this.supabaseService.isEventUnlocked(ev.id, ev.password_hash);
      this.isUnlocked.set(unlocked);
      this.isAdmin.set(this.supabaseService.isEventAdmin(ev.id));

      if (unlocked) {
        await this.refreshParticipantsAndAvailabilities();
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async refreshParticipantsAndAvailabilities(): Promise<void> {
    if (!this.eventId) return;

    const latestEvent = await this.supabaseService.getEventById(this.eventId);
    if (latestEvent) {
      const currentEvent = this.eventData();
      this.eventData.set(latestEvent);
      if (
        !currentEvent ||
        currentEvent.start_date !== latestEvent.start_date ||
        currentEvent.end_date !== latestEvent.end_date
      ) {
        this.days.set(generateDateRange(latestEvent.start_date, latestEvent.end_date));
      }
      if (!this.supabaseService.isEventUnlocked(latestEvent.id, latestEvent.password_hash)) {
        this.isUnlocked.set(false);
        this.viewMode.set('heatmap');
        return;
      }
    }

    const data = await this.supabaseService.getEventParticipantsAndAvailabilities(this.eventId);
    this.participants.set(data.participants);
    this.availabilities.set(data.availabilities);

    const owned = this.supabaseService.getOwnedParticipant(this.eventId, data.participants);
    const matchingParticipant = owned
      ? data.participants.find((p) => p.id === owned.participantId)
      : undefined;

    if (matchingParticipant) {
      this.ownedParticipantName.set(matchingParticipant.name);
      this.globalUserName.set(matchingParticipant.name);
    } else {
      this.ownedParticipantName.set(null);
      this.globalUserName.set(this.supabaseService.getGlobalUserName());
    }
  }

  async verifyPasswordGate(): Promise<void> {
    this.gateError.set('');
    const ev = this.eventData();
    if (!ev) return;

    const isValid = await verifyPassword(this.passwordAttempt, ev.password_hash);
    if (!isValid) {
      this.gateError.set('Incorrect password. Please try again.');
      return;
    }

    this.supabaseService.markEventUnlocked(ev.id, ev.password_hash);
    this.isUnlocked.set(true);
    this.passwordAttempt = '';
    await this.refreshParticipantsAndAvailabilities();
  }

  async onEditOwnedParticipant(): Promise<void> {
    const owned = this.supabaseService.getOwnedParticipant(this.eventId);
    if (!owned) return;
    await this.onStartParticipantFlow(owned.name);
  }

  async onRenameUser(newName: string): Promise<void> {
    const ev = this.eventData();
    if (!ev) return;

    this.participantNameError.set('');
    try {
      const updatedName = await this.supabaseService.updateOwnName(ev.id, newName);
      this.globalUserName.set(updatedName);
      if (this.ownedParticipantName()) {
        this.ownedParticipantName.set(updatedName);
      }
      const active = this.activeParticipant();
      if (active) {
        this.activeParticipant.set({ ...active, name: updatedName });
      }
      await this.refreshParticipantsAndAvailabilities();
      this.toastMessage.set(`Updated your name to ${updatedName}.`);
      setTimeout(() => this.toastMessage.set(''), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update name.';
      this.participantNameError.set(msg);
      this.toastMessage.set(msg);
      setTimeout(() => this.toastMessage.set(''), 3500);
    }
  }

  async onDeleteParticipant(participant: Participant): Promise<void> {
    const ev = this.eventData();
    if (!ev || !this.isAdmin()) return;

    await this.supabaseService.deleteParticipant(ev.id, participant.id);
    if (this.filteredParticipantId() === participant.id) {
      this.filteredParticipantId.set(null);
    }
    await this.refreshParticipantsAndAvailabilities();
    this.toastMessage.set(`Removed ${participant.name} from the poll.`);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }

  toggleAdminSettings(): void {
    const ev = this.eventData();
    if (!ev) return;
    if (this.showAdminSettings()) {
      this.showAdminSettings.set(false);
      return;
    }
    this.adminTitle = ev.title;
    this.adminStartDate = ev.start_date;
    this.adminEndDate = ev.end_date;
    this.adminNewPassword = '';
    this.showAdminSettings.set(true);
  }

  async saveAdminPollSettings(): Promise<void> {
    const ev = this.eventData();
    if (!ev || !this.isAdmin()) return;

    const totalDays = calculateDaysInclusive(this.adminStartDate, this.adminEndDate);
    if (totalDays <= 0 || totalDays > 90) {
      this.toastMessage.set('Date range must be between 1 and 90 days.');
      setTimeout(() => this.toastMessage.set(''), 3500);
      return;
    }

    try {
      const updated = await this.supabaseService.updateEventSettings(ev.id, {
        title: this.adminTitle,
        start_date: this.adminStartDate,
        end_date: this.adminEndDate,
        new_raw_password: this.adminNewPassword,
      });

      this.eventData.set(updated);
      this.days.set(generateDateRange(updated.start_date, updated.end_date));
      await this.refreshParticipantsAndAvailabilities();
      this.showAdminSettings.set(false);
      this.toastMessage.set('Poll settings updated!');
      setTimeout(() => this.toastMessage.set(''), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update poll settings.';
      this.toastMessage.set(msg);
      setTimeout(() => this.toastMessage.set(''), 3500);
    }
  }

  async onStartParticipantFlow(name: string): Promise<void> {
    const ev = this.eventData();
    if (!ev) return;

    this.participantNameError.set('');
    let participant: Participant;
    let isExisting = false;

    try {
      const res = await this.supabaseService.registerOrResolveOwnParticipant(
        ev.id,
        name
      );
      participant = res.participant;
      isExisting = res.isExisting;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to use that name.';
      this.participantNameError.set(msg);
      return;
    }

    this.activeParticipant.set(participant);
    this.ownedParticipantName.set(participant.name);
    this.globalUserName.set(participant.name);

    const map: Record<string, boolean> = {};
    const currentAvailabilities = this.availabilities().filter(
      (a) => a.participant_id === participant.id
    );

    const defaultVal = !isExisting || currentAvailabilities.length === 0;
    for (const day of this.days()) {
      for (const s of TIME_SLOTS) {
        map[`${day.dateStr}_${s.key}`] = defaultVal;
      }
    }

    for (const record of currentAvailabilities) {
      map[`${record.date}_${record.time_slot}`] = record.is_available;
    }

    this.draftAvailability.set(map);
    this.viewMode.set('edit');

    if (!isExisting || currentAvailabilities.length === 0) {
      this.showGlobalRulesModal.set(true);
    }
  }

  async onClaimParticipantFlow(participantId: string): Promise<void> {
    const ev = this.eventData();
    if (!ev) return;

    this.participantNameError.set('');
    let participant: Participant;
    try {
      participant = await this.supabaseService.claimExistingParticipant(
        ev.id,
        participantId
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to select participant.';
      this.participantNameError.set(msg);
      return;
    }

    this.activeParticipant.set(participant);
    this.ownedParticipantName.set(participant.name);
    this.globalUserName.set(participant.name);

    const map: Record<string, boolean> = {};
    const currentAvailabilities = this.availabilities().filter(
      (a) => a.participant_id === participant.id
    );

    const defaultVal = currentAvailabilities.length === 0;
    for (const day of this.days()) {
      for (const s of TIME_SLOTS) {
        map[`${day.dateStr}_${s.key}`] = defaultVal;
      }
    }

    for (const record of currentAvailabilities) {
      map[`${record.date}_${record.time_slot}`] = record.is_available;
    }

    this.draftAvailability.set(map);
    this.viewMode.set('edit');
  }

  /**
   * Auto-fills the underlying draftAvailability array based on the Global Rules Modal day-of-week M/A/E matrix.
   */
  applyGlobalRulesToDraft(rules: GlobalAvailabilityRules): void {
    const updated: Record<string, boolean> = {};

    for (const day of this.days()) {
      const dayRule = rules.byDayOfWeek[day.dayOfWeek] ?? {
        morning: false,
        afternoon: false,
        evening: false,
      };

      updated[`${day.dateStr}_morning`] = !!dayRule.morning;
      updated[`${day.dateStr}_afternoon`] = !!dayRule.afternoon;
      updated[`${day.dateStr}_evening`] = !!dayRule.evening;
    }

    this.draftAvailability.set(updated);
    this.showGlobalRulesModal.set(false);
  }

  onSingleSlotToggle(change: { dateStr: string; slot: TimeSlot; value: boolean }): void {
    this.draftAvailability.update((prev) => ({
      ...prev,
      [`${change.dateStr}_${change.slot}`]: change.value,
    }));
  }

  onEntireDayToggle(change: { dateStr: string; value: boolean }): void {
    this.draftAvailability.update((prev) => ({
      ...prev,
      [`${change.dateStr}_morning`]: change.value,
      [`${change.dateStr}_afternoon`]: change.value,
      [`${change.dateStr}_evening`]: change.value,
    }));
  }

  onBulkAvailabilityChange(updatedMap: Record<string, boolean>): void {
    this.draftAvailability.set(updatedMap);
  }

  async onSaveParticipantAvailability(): Promise<void> {
    const ev = this.eventData();
    const participant = this.activeParticipant();
    if (!ev || !participant) return;

    try {
      this.savingAvailability.set(true);
      const draft = this.draftAvailability();
      const records: AvailabilityRecord[] = [];

      for (const day of this.days()) {
        for (const s of TIME_SLOTS) {
          records.push({
            participant_id: participant.id,
            event_id: ev.id,
            date: day.dateStr,
            time_slot: s.key,
            is_available: !!draft[`${day.dateStr}_${s.key}`],
          });
        }
      }

      await this.supabaseService.saveParticipantAvailabilities(
        ev.id,
        participant.id,
        records
      );

      await this.refreshParticipantsAndAvailabilities();
      this.viewMode.set('heatmap');
      this.toastMessage.set(`Saved availability for ${participant.name}!`);
      setTimeout(() => this.toastMessage.set(''), 4000);
    } finally {
      this.savingAvailability.set(false);
    }
  }

  /**
   * Builds a short TinyURL-style shareable link (`/p/k9Xm2pQ`).
   */
  buildShareableUrl(): string {
    const ev = this.eventData();
    const origin = window.location.origin;
    if (!ev) return window.location.href;
    const shortSlug = encodeEventIdToShortSlug(ev.id);
    if (this.supabaseService.isUsingSupabase) {
      return `${origin}/p/${shortSlug}`;
    }
    const token = encodeShareToken(ev);
    return token
      ? `${origin}/p/${shortSlug}?s=${encodeURIComponent(token)}`
      : `${origin}/p/${shortSlug}`;
  }

  async shareOrCopyLink(): Promise<void> {
    const url = this.buildShareableUrl();
    const ev = this.eventData();

    const copied = await copyTextToClipboard(url);
    if (copied) {
      this.linkCopied.set(true);
      this.toastMessage.set('Shareable event link copied to clipboard!');
      setTimeout(() => {
        this.linkCopied.set(false);
        this.toastMessage.set('');
      }, 3000);
    }

    if (typeof navigator !== 'undefined' && navigator.share && ev) {
      try {
        await navigator.share({
          title: `Zynci: ${ev.title}`,
          text: `Add your availability for "${ev.title}" on Zynci`,
          url,
        });
      } catch {
        // User dismissed native share sheet; link is already copied
      }
    }
  }
}
