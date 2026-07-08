import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { GuestsComponent } from './features/guests/guests.component';
import { VendorsComponent } from './features/vendors/vendors.component';
import { HousingComponent } from './features/housing/housing.component';
import { SeatingComponent } from './features/seating/seating.component';
import { BudgetComponent } from './features/budget/budget.component';
import { TodosComponent } from './features/todos/todos.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'invites', component: GuestsComponent },
  { path: 'prestataires', component: VendorsComponent },
  { path: 'hebergement', component: HousingComponent },
  { path: 'plan-de-table', component: SeatingComponent },
  { path: 'budget', component: BudgetComponent },
  { path: 'a-faire', component: TodosComponent },
  { path: '**', redirectTo: 'dashboard' },
];
