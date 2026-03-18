export interface TourStep {
  id: string;
  targetSelector: string;
  titleKey: string;
  descriptionKey: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'wait_for_input' | 'wait_for_response' | 'wait_for_save' | 'navigate' | 'none';
  navigateTo?: string;
  highlightPadding?: number;
}

export const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    targetSelector: '[data-tour="welcome-message"]',
    titleKey: 'tour.welcomeTitle',
    descriptionKey: 'tour.welcomeDesc',
    position: 'bottom',
    action: 'none',
    highlightPadding: 8,
  },
  {
    id: 'chat-input',
    targetSelector: '[data-tour="chat-input"]',
    titleKey: 'tour.inputTitle',
    descriptionKey: 'tour.inputDesc',
    position: 'top',
    action: 'wait_for_input',
    highlightPadding: 8,
  },
  {
    id: 'ai-response',
    targetSelector: '[data-tour="ai-response"]',
    titleKey: 'tour.waitingTitle',
    descriptionKey: 'tour.waitingDesc',
    position: 'bottom',
    action: 'wait_for_response',
    highlightPadding: 8,
  },
  {
    id: 'parsed-result',
    targetSelector: '[data-tour="parsed-result"]',
    titleKey: 'tour.resultTitle',
    descriptionKey: 'tour.resultDesc',
    position: 'top',
    action: 'wait_for_save',
    highlightPadding: 8,
  },
  {
    id: 'log-page',
    targetSelector: '[data-tour="log-entries"]',
    titleKey: 'tour.logTitle',
    descriptionKey: 'tour.logDesc',
    position: 'top',
    action: 'navigate',
    navigateTo: '/log',
    highlightPadding: 12,
  },
  {
    id: 'dashboard-page',
    targetSelector: '[data-tour="diet-card"]',
    titleKey: 'tour.dashboardTitle',
    descriptionKey: 'tour.dashboardDesc',
    position: 'top',
    action: 'navigate',
    navigateTo: '/dashboard',
    highlightPadding: 12,
  },
  {
    id: 'complete',
    targetSelector: '',
    titleKey: 'tour.completeTitle',
    descriptionKey: 'tour.completeDesc',
    position: 'center',
    action: 'none',
    highlightPadding: 0,
  },
];
