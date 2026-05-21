import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastComponent } from './shared/components/toast/toast.component';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  exact?: boolean;
  badge?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  sidebarCollapsed = signal(false);

  readonly navItems: NavItem[] = [
    { icon: 'home',               label: 'Overview',       route: '/',        exact: true },
    { icon: 'dataset',            label: 'Data Sources',   route: '/datasets' },
    { icon: 'psychology',         label: 'Query Studio',   route: '/chat' },
    { icon: 'insights',           label: 'Insights Hub',   route: '/builder' },
  ];

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }
}