import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { Participant, SchedulerEvent } from '../../models/scheduler.models';
import {
  calculateDaysInclusive,
  encodeEventIdToShortSlug,
  encodeShareToken,
  getDefaultDateRange,
} from '../../utils/scheduler.utils';
import { HelpModalComponent } from '../../components/help-modal/help-modal.component';

@Component({
  selector: 'app-create-event',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HelpModalComponent],
  template: `
    <div class="min-h-screen flex flex-col justify-between bg-slate-50">
      <!-- Top Bar (Clean Elevated Surface) -->
      <header class="border-b border-slate-200/80 bg-white text-slate-900 shadow-2xs">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <img
              src="/icon.png"
              alt="Zynci"
              class="h-8 w-8 rounded-lg object-contain shrink-0"
            />
            <div>
              <span class="font-extrabold text-slate-900 tracking-tight text-base">Zynci</span>
              <span class="hidden sm:inline-block ml-2 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                Group Availability Scheduler
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            @if (totalMyPollsCount() > 0) {
              <a
                href="#my-polls"
                class="rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition-colors"
              >
                My Polls ({{ totalMyPollsCount() }})
              </a>
            }
            <button
              type="button"
              (click)="showHelpModal.set(true)"
              class="rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              title="Help & About"
            >
              ?
            </button>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-10">
        <!-- Section 1: Create Poll Card -->
        <div class="max-w-lg mx-auto">
          <div class="text-center mb-6">
            <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Find the day everyone is free
            </h1>
            <p class="mt-2 text-sm text-slate-600">
              Create a password-protected poll link, share it with your group, and watch the consensus heatmap light up.
            </p>
          </div>

          <div class="rounded-3xl bg-white border border-slate-200/80 shadow-md p-6 sm:p-8">
            <form (ngSubmit)="onSubmit()" class="space-y-5">
              <!-- Anti-Bot Honeypot (Hidden from humans, filled by automated form bots) -->
              <div class="hidden" aria-hidden="true">
                <label for="websiteUrl">Website</label>
                <input
                  id="websiteUrl"
                  type="text"
                  name="websiteUrl"
                  tabindex="-1"
                  autocomplete="off"
                  [(ngModel)]="honeypotWebsite"
                />
              </div>

              <!-- Event Title -->
              <div>
                <label for="title" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Poll Title
                </label>
                <input
                  id="title"
                  type="text"
                  name="title"
                  [(ngModel)]="title"
                  required
                  placeholder="e.g., Summer Lisbon Trip or D&D Session Zero"
                  class="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <!-- Date Range (Up to 90 Days) -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="startDate" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Start Date
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    name="startDate"
                    [(ngModel)]="startDate"
                    required
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label for="endDate" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    End Date <span class="text-slate-400 font-normal">(Max 90d)</span>
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    name="endDate"
                    [(ngModel)]="endDate"
                    [min]="startDate"
                    required
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              <div class="flex items-center justify-between text-xs px-1">
                <span class="text-slate-500">
                  Selected window:
                  <strong
                    [class]="
                      dayCount() > 0 && dayCount() <= 90
                        ? 'text-blue-700'
                        : 'text-rose-600'
                    "
                  >
                    {{ dayCount() > 0 ? dayCount() + ' days' : 'Invalid date range' }}
                  </strong>
                </span>
                <span class="text-slate-400">Up to 90 days allowed</span>
              </div>

              <!-- Shared Password -->
              <div>
                <label for="sharedPassword" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Shared Group Password
                </label>
                <div class="relative">
                  <input
                    id="sharedPassword"
                    [type]="showPassword() ? 'text' : 'password'"
                    name="sharedPassword"
                    [(ngModel)]="sharedPassword"
                    required
                    placeholder="Enter a password for your participants"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-4 pr-16 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="button"
                    (click)="showPassword.set(!showPassword())"
                    class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {{ showPassword() ? 'Hide' : 'Show' }}
                  </button>
                </div>
              </div>

              @if (errorMessage()) {
                <div class="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-700">
                  {{ errorMessage() }}
                </div>
              }

              <button
                type="submit"
                [disabled]="loading()"
                class="w-full min-h-[48px] rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 px-6 shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 text-base"
              >
                @if (loading()) {
                  <span>Creating Poll...</span>
                } @else {
                  <span>Create Poll & Get Share Link</span>
                }
              </button>
            </form>
          </div>
        </div>

        <!-- ================================================================ -->
        <!-- Section 2: MY POLLS (Created & Joined)                           -->
        <!-- ================================================================ -->
        <section id="my-polls" class="pt-4 border-t border-slate-200/80 space-y-8">
          @if (feedbackToast()) {
            <div class="rounded-full bg-blue-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-sm">
              <span>{{ feedbackToast() }}</span>
              <button type="button" (click)="feedbackToast.set('')" class="text-blue-100 hover:text-white cursor-pointer">✕</button>
            </div>
          }

          <!-- Polls I Created -->
          <div>
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-lg font-extrabold text-slate-900">Polls I Created</h2>
                <p class="text-xs text-slate-500">
                  Manage your polls: add or remove days, change the shared password, or remove participants.
                </p>
              </div>
              <span class="rounded-full bg-blue-100 text-blue-800 px-3 py-0.5 text-xs font-bold">
                {{ myPolls().length }} {{ myPolls().length === 1 ? 'Poll' : 'Polls' }}
              </span>
            </div>

            @if (myPolls().length === 0) {
              <div class="rounded-2xl bg-white border border-slate-200/80 p-6 text-center text-xs text-slate-400 shadow-2xs">
                You haven’t created any polls yet. Create one above and it will appear here.
              </div>
            } @else {
              <div class="space-y-3">
                @for (poll of myPolls(); track poll.id) {
                  <div class="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-sm transition-all">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div class="flex flex-wrap items-center gap-2">
                          <h3 class="text-sm sm:text-base font-extrabold text-slate-900">
                            {{ poll.title }}
                          </h3>
                          <span class="rounded-full bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-0.5 text-[11px] font-bold">
                            Creator
                          </span>
                          @if (getJoinedNameForPoll(poll.id); as joinedName) {
                            <span class="rounded-full bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-0.5 text-[11px] font-semibold">
                              Joined as {{ joinedName }}
                            </span>
                          }
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5">
                          {{ poll.start_date }} to {{ poll.end_date }} ·
                          <strong>{{ calcDays(poll.start_date, poll.end_date) }} days</strong> ·
                          <strong>{{ getParticipantsForPoll(poll.id).length }} people</strong>
                        </p>
                      </div>

                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          (click)="toggleManagePoll(poll)"
                          [class]="
                            editingPollId() === poll.id
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          "
                          class="rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                        >
                          {{ editingPollId() === poll.id ? 'Close Edit' : 'Edit Poll' }}
                        </button>

                        <a
                          [routerLink]="['/p', getShortSlug(poll.id)]"
                          [queryParams]="getShareQueryParam(poll)"
                          class="rounded-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 text-xs font-bold transition-colors"
                        >
                          Open →
                        </a>
                      </div>
                    </div>

                    <!-- Inline Poll Editor (Add/Remove Days, Edit Password, & Remove People Below) -->
                    @if (editingPollId() === poll.id) {
                      <div class="mt-4 pt-4 border-t border-slate-100 space-y-4">
                        <form (ngSubmit)="savePollEdits(poll.id)" class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                          <!-- Title -->
                          <div class="sm:col-span-2">
                            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              Poll Title
                            </label>
                            <input
                              type="text"
                              name="editTitle"
                              [(ngModel)]="editTitle"
                              required
                              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                            />
                          </div>

                          <!-- Start Date (Add/Remove days at start) -->
                          <div>
                            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              Start Date
                            </label>
                            <input
                              type="date"
                              name="editStartDate"
                              [(ngModel)]="editStartDate"
                              required
                              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                            />
                          </div>

                          <!-- End Date (Add/Remove days at end) -->
                          <div>
                            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              End Date ({{ calcDays(editStartDate, editEndDate) }}d)
                            </label>
                            <input
                              type="date"
                              name="editEndDate"
                              [(ngModel)]="editEndDate"
                              [min]="editStartDate"
                              required
                              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                            />
                          </div>

                          <!-- New Shared Password (Optional) -->
                          <div class="sm:col-span-2">
                            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              New Shared Password <span class="text-slate-400 font-normal">(Leave blank to keep current)</span>
                            </label>
                            <input
                              type="text"
                              name="editPassword"
                              [(ngModel)]="editPassword"
                              placeholder="Type new password to change it..."
                              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                            />
                          </div>

                          <div class="sm:col-span-2 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              (click)="deleteEntirePoll(poll)"
                              class="min-h-[38px] rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold px-3.5 py-2 text-xs cursor-pointer"
                            >
                              Delete Poll
                            </button>
                            <button
                              type="submit"
                              class="min-h-[38px] rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 text-xs shadow-xs cursor-pointer"
                            >
                              Save Poll Changes
                            </button>
                          </div>
                        </form>

                        @if (editError()) {
                          <p class="text-xs font-semibold text-rose-600">{{ editError() }}</p>
                        }

                        <!-- Participants List (Below Poll Edit Fields, Same Color Scheme) -->
                        <div class="pt-3 border-t border-slate-100">
                          <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Participants in this poll (tap ✕ to remove):
                          </span>
                          @if (getParticipantsForPoll(poll.id).length === 0) {
                            <span class="text-xs text-slate-400 italic">No participants yet.</span>
                          } @else {
                            <div class="flex flex-wrap items-center gap-1.5">
                              @for (p of getParticipantsForPoll(poll.id); track p.id) {
                                <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                                  <span>{{ p.name }}</span>
                                  <button
                                    type="button"
                                    (click)="removeParticipantFromPoll(poll.id, p)"
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
                    }
                  </div>
                }
              </div>
            }
          </div>

          <!-- Polls I Joined (Participant) -->
          <div class="pt-4 border-t border-slate-200/60">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-lg font-extrabold text-slate-900">Polls I Joined</h2>
                <p class="text-xs text-slate-500">
                  Polls where you added or claimed your availability as a participant.
                </p>
              </div>
              <span class="rounded-full bg-slate-200 text-slate-800 px-3 py-0.5 text-xs font-bold">
                {{ joinedOnlyPolls().length }} {{ joinedOnlyPolls().length === 1 ? 'Poll' : 'Polls' }}
              </span>
            </div>

            @if (joinedOnlyPolls().length === 0) {
              <div class="rounded-2xl bg-white border border-slate-200/80 p-6 text-center text-xs text-slate-400 shadow-2xs">
                When you join someone else’s poll and add your availability, it will appear here for quick access.
              </div>
            } @else {
              <div class="space-y-3">
                @for (item of joinedOnlyPolls(); track item.event.id) {
                  <div class="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-sm transition-all">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div class="flex flex-wrap items-center gap-2">
                          <h3 class="text-sm sm:text-base font-extrabold text-slate-900">
                            {{ item.event.title }}
                          </h3>
                          <span class="rounded-full bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-0.5 text-[11px] font-bold">
                            Participant · {{ item.participantName }}
                          </span>
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5">
                          {{ item.event.start_date }} to {{ item.event.end_date }} ·
                          <strong>{{ calcDays(item.event.start_date, item.event.end_date) }} days</strong> ·
                          <strong>{{ getParticipantsForPoll(item.event.id).length }} people</strong>
                        </p>
                      </div>

                      <div class="flex items-center gap-2">
                        <a
                          [routerLink]="['/p', getShortSlug(item.event.id)]"
                          [queryParams]="getShareQueryParam(item.event)"
                          class="rounded-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 text-xs font-bold transition-colors"
                        >
                          Open →
                        </a>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </section>
      </main>

      <!-- Footer -->
      <footer class="py-4 text-center text-xs text-slate-400 border-t border-slate-200/80 bg-white">
        <div class="max-w-4xl mx-auto px-4 flex items-center justify-center">
          <span>Zynci — Minimalist Group Scheduler</span>
        </div>
      </footer>

      @if (showHelpModal()) {
        <app-help-modal (closeModal)="showHelpModal.set(false)" />
      }
    </div>
  `,
})
export class CreateEventComponent implements OnInit {
  readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  // Create form state
  private readonly defaultRange = getDefaultDateRange();
  title = '';
  startDate = this.defaultRange.startDate;
  endDate = this.defaultRange.endDate;
  sharedPassword = '';
  honeypotWebsite = '';
  showPassword = signal<boolean>(false);
  showHelpModal = signal<boolean>(false);
  loading = signal<boolean>(false);
  errorMessage = signal<string>('');

  // My Created & Joined Polls state
  myPolls = signal<SchedulerEvent[]>([]);
  myJoinedPolls = signal<{ event: SchedulerEvent; participantName: string; isCreator: boolean }[]>([]);
  pollParticipantsMap = signal<Record<string, Participant[]>>({});
  editingPollId = signal<string | null>(null);
  editTitle = '';
  editStartDate = '';
  editEndDate = '';
  editPassword = '';
  editError = signal<string>('');
  feedbackToast = signal<string>('');

  async ngOnInit(): Promise<void> {
    await this.loadMyPolls();
  }

  async loadMyPolls(): Promise<void> {
    const [polls, joined] = await Promise.all([
      this.supabaseService.getMyCreatedEvents(),
      this.supabaseService.getMyJoinedEvents(),
    ]);
    this.myPolls.set(polls);
    this.myJoinedPolls.set(joined);

    const allEventIds = new Set<string>([
      ...polls.map((p) => p.id),
      ...joined.map((j) => j.event.id),
    ]);

    const pMap: Record<string, Participant[]> = {};
    for (const pollId of allEventIds) {
      const data = await this.supabaseService.getEventParticipantsAndAvailabilities(pollId);
      pMap[pollId] = data.participants;
    }
    this.pollParticipantsMap.set(pMap);
  }

  joinedOnlyPolls(): { event: SchedulerEvent; participantName: string; isCreator: boolean }[] {
    return this.myJoinedPolls().filter((item) => !item.isCreator);
  }

  getJoinedNameForPoll(pollId: string): string | null {
    const match = this.myJoinedPolls().find((item) => item.event.id === pollId);
    return match ? match.participantName : null;
  }

  totalMyPollsCount(): number {
    return this.myPolls().length + this.joinedOnlyPolls().length;
  }

  dayCount(): number {
    if (!this.startDate || !this.endDate) return 0;
    return calculateDaysInclusive(this.startDate, this.endDate);
  }

  calcDays(start: string, end: string): number {
    if (!start || !end) return 0;
    return calculateDaysInclusive(start, end);
  }

  getParticipantsForPoll(pollId: string): Participant[] {
    return this.pollParticipantsMap()[pollId] || [];
  }

  getShortSlug(eventId: string): string {
    return encodeEventIdToShortSlug(eventId);
  }

  getShareQueryParam(poll: SchedulerEvent): Record<string, string> | undefined {
    if (this.supabaseService.isUsingSupabase) return undefined;
    const token = encodeShareToken(poll);
    return token ? { s: token } : undefined;
  }

  toggleManagePoll(poll: SchedulerEvent): void {
    if (this.editingPollId() === poll.id) {
      this.editingPollId.set(null);
      this.editError.set('');
      return;
    }
    this.editingPollId.set(poll.id);
    this.editTitle = poll.title;
    this.editStartDate = poll.start_date;
    this.editEndDate = poll.end_date;
    this.editPassword = '';
    this.editError.set('');
  }

  async savePollEdits(pollId: string): Promise<void> {
    this.editError.set('');
    const days = this.calcDays(this.editStartDate, this.editEndDate);
    if (days <= 0) {
      this.editError.set('End date must be on or after start date.');
      return;
    }
    if (days > 90) {
      this.editError.set('Date range cannot exceed 90 days.');
      return;
    }

    try {
      await this.supabaseService.updateEventSettings(pollId, {
        title: this.editTitle,
        start_date: this.editStartDate,
        end_date: this.editEndDate,
        new_raw_password: this.editPassword,
      });
      await this.loadMyPolls();
      this.editingPollId.set(null);
      this.feedbackToast.set('Poll settings updated!');
      setTimeout(() => this.feedbackToast.set(''), 3000);
    } catch (err: unknown) {
      this.editError.set(err instanceof Error ? err.message : 'Failed to update poll.');
    }
  }

  async removeParticipantFromPoll(pollId: string, participant: Participant): Promise<void> {
    await this.supabaseService.deleteParticipant(pollId, participant.id);
    await this.loadMyPolls();
    this.feedbackToast.set(`Removed ${participant.name}.`);
    setTimeout(() => this.feedbackToast.set(''), 3000);
  }

  async deleteEntirePoll(poll: SchedulerEvent): Promise<void> {
    await this.supabaseService.deleteEvent(poll.id);
    if (this.editingPollId() === poll.id) {
      this.editingPollId.set(null);
    }
    await this.loadMyPolls();
    this.feedbackToast.set(`Deleted poll "${poll.title}".`);
    setTimeout(() => this.feedbackToast.set(''), 3000);
  }

  async onSubmit(): Promise<void> {
    this.errorMessage.set('');

    // Reject automated bots that fill hidden honeypot fields
    if (this.honeypotWebsite.trim().length > 0) {
      return;
    }

    // Simple 15-second cooldown per browser to prevent rapid poll spam
    const lastCreatedAt = Number(localStorage.getItem('zynci_last_poll_created_ts') || '0');
    if (Date.now() - lastCreatedAt < 15000) {
      this.errorMessage.set('Please wait a few seconds before creating another poll.');
      return;
    }

    if (!this.title.trim()) {
      this.errorMessage.set('Please enter a poll title.');
      return;
    }

    const totalDays = this.dayCount();
    if (totalDays <= 0) {
      this.errorMessage.set('End date must be on or after the start date.');
      return;
    }
    if (totalDays > 90) {
      this.errorMessage.set('Date range cannot exceed 90 days. Please shorten the window.');
      return;
    }

    if (!this.sharedPassword.trim()) {
      this.errorMessage.set('Please set a shared password for your poll.');
      return;
    }

    try {
      this.loading.set(true);
      const created = await this.supabaseService.createEvent({
        title: this.title,
        start_date: this.startDate,
        end_date: this.endDate,
        raw_password: this.sharedPassword,
      });
      localStorage.setItem('zynci_last_poll_created_ts', String(Date.now()));

      const shortSlug = encodeEventIdToShortSlug(created.id);
      const shareToken = this.supabaseService.isUsingSupabase
        ? ''
        : encodeShareToken(created);
      await this.router.navigate(['/p', shortSlug], {
        queryParams: shareToken ? { s: shareToken } : undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create poll.';
      this.errorMessage.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
