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
    { icon: 'home',              label: 'Overview',          route: '/',        exact: true },
    { icon: 'chat_bubble',       label: 'NLP Chat',          route: '/chat' },
    { icon: 'upload_file',       label: 'Upload Data',       route: '/upload' },
    { icon: 'dashboard_customize', label: 'Dashboard Builder', route: '/builder' },
    { icon: 'dataset',           label: 'Datasets',          route: '/datasets' },
  ];

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }
}
