import { Component } from '@angular/core';
import { WeddingShellComponent } from './wedding-shell/wedding-shell.component';

@Component({
  selector: 'app-root',
  imports: [WeddingShellComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
}
