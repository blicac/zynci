import { Routes } from '@angular/router';
import { CreateEventComponent } from './pages/create-event/create-event.component';
import { EventViewComponent } from './pages/event-view/event-view.component';

export const routes: Routes = [
  {
    path: '',
    component: CreateEventComponent,
  },
  {
    path: 'p/:id',
    component: EventViewComponent,
  },
  {
    path: 'event/:id',
    component: EventViewComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
