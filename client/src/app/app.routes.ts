import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { authGuard, organizerGuard, permissionGuard } from './auth/auth.guards';
import { BudgetComponent } from './features/budget/budget.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { GuestsComponent } from './features/guests/guests.component';
import { HousingComponent } from './features/housing/housing.component';
import { SeatingComponent } from './features/seating/seating.component';
import { TodosComponent } from './features/todos/todos.component';
import { VendorsComponent } from './features/vendors/vendors.component';
import { WeddingShellComponent } from './wedding-shell/wedding-shell.component';
import { AccessDeniedComponent } from './auth/access-denied.component';
import { InvitationComponent } from './auth/invitation.component';
import { PublicHomeComponent } from './features/public-site/public-home.component';
import { RsvpComponent } from './features/public-site/rsvp.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: PublicHomeComponent },
  { path: 'i/:token', component: RsvpComponent },
  { path: 'connexion', component: AuthComponent, data: { mode: 'login' } },
  { path: 'invitation', component: InvitationComponent },
  { path: 'activer', redirectTo: 'connexion' },
  {
    path: '',
    component: WeddingShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'aucun-acces', component: AccessDeniedComponent },
      { path: 'dashboard', component: DashboardComponent, canActivate: [permissionGuard], data: { section: 'dashboard' } },
      { path: 'invites', component: GuestsComponent, canActivate: [permissionGuard], data: { section: 'guests' } },
      { path: 'prestataires', component: VendorsComponent, canActivate: [permissionGuard], data: { section: 'vendors' } },
      { path: 'hebergement', component: HousingComponent, canActivate: [permissionGuard], data: { section: 'housing' } },
      { path: 'plan-de-table', component: SeatingComponent, canActivate: [permissionGuard], data: { section: 'seating' } },
      { path: 'budget', component: BudgetComponent, canActivate: [permissionGuard], data: { section: 'budget' } },
      { path: 'a-faire', component: TodosComponent, canActivate: [permissionGuard], data: { section: 'todos' } },
      {
        path: 'dernieres-semaines',
        canActivate: [permissionGuard],
        data: { section: 'final_weeks' },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'gantt' },
          {
            path: 'gantt',
            loadComponent: () => import('./features/final-weeks/final-weeks.component').then(module => module.FinalWeeksComponent),
            data: { finalWeeksPage: 'gantt' },
          },
          {
            path: 'taches',
            loadComponent: () => import('./features/final-weeks/final-weeks.component').then(module => module.FinalWeeksComponent),
            data: { finalWeeksPage: 'tasks' },
          },
          {
            path: 'presences',
            loadComponent: () => import('./features/final-weeks/final-weeks.component').then(module => module.FinalWeeksComponent),
            data: { finalWeeksPage: 'presence' },
          },
          {
            path: 'repas',
            loadComponent: () => import('./features/final-weeks/final-weeks.component').then(module => module.FinalWeeksComponent),
            data: { finalWeeksPage: 'meals' },
          },
        ],
      },
      {
        path: 'administration',
        loadComponent: () => import('./features/admin/admin.component').then(module => module.AdminComponent),
        canActivate: [organizerGuard],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
