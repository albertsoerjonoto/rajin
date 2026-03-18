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
    targetSelector: '',
    titleKey: 'tour.welcomeTitle',
    descriptionKey: 'tour.welcomeDesc',
    position: 'center',
    action: 'none',
    highlightPadding: 0,
  },
  {
    id: 'chat-input',
    targetSelector: '[data-tour="chat-input"]',
    titleKey: 'tour.inputTitle',
    descriptionKey: 'tour.inputDesc',
    position: 'top',
    action: 'wait_for_input',
    highlightPadding: 4,
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
    targetSelector: '',
    titleKey: 'tour.logTitle',
    descriptionKey: 'tour.logDesc',
    position: 'center',
    action: 'navigate',
    navigateTo: '/log',
    highlightPadding: 0,
  },
  {
    id: 'dashboard-page',
    targetSelector: '',
    titleKey: 'tour.dashboardTitle',
    descriptionKey: 'tour.dashboardDesc',
    position: 'center',
    action: 'navigate',
    navigateTo: '/dashboard',
    highlightPadding: 0,
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
