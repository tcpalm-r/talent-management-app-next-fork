export interface QuestionLibraryItem {
  id: string;
  text: string;
}

export interface QuestionLibraryCategory {
  id: string;
  title: string;
  description?: string;
  questions: QuestionLibraryItem[];
}

export const QUESTION_LIBRARY: QuestionLibraryCategory[] = [
  {
    id: 'impact',
    title: 'Impact',
    questions: [
      {
        id: 'impact-biggest-impact',
        text: 'What is the biggest impact this person has had on you, the team, or the organization?',
      },
      {
        id: 'impact-missed',
        text: "If this person left tomorrow, what would be most missed? What would improve?",
      },
      {
        id: 'impact-specific-difference',
        text: 'Describe a specific situation where this person made a significant difference.',
      },
    ],
  },
  {
    id: 'growth',
    title: 'Growth (Start/Stop/Continue)',
    questions: [
      {
        id: 'growth-stop',
        text: 'What should this person STOP doing to be more effective?',
      },
      {
        id: 'growth-start',
        text: 'What should this person START doing to advance their career?',
      },
      {
        id: 'growth-continue',
        text: "What should this person CONTINUE doing because it's working well?",
      },
    ],
  },
  {
    id: 'leadership',
    title: 'Leadership',
    questions: [
      {
        id: 'leadership-work-for',
        text: 'Would you want to work for this person as a manager? Why or why not?',
      },
      {
        id: 'leadership-more-effective',
        text: 'What would make this person a more effective leader?',
      },
      {
        id: 'leadership-conversations',
        text: 'How does this person handle difficult conversations or conflicts?',
      },
    ],
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    questions: [
      {
        id: 'collaboration-day-to-day',
        text: 'What is it like to work with this person on a day-to-day basis?',
      },
      {
        id: 'collaboration-better-teammate',
        text: 'How could this person be a better team player?',
      },
      {
        id: 'collaboration-feedback-response',
        text: 'Describe how this person responds to feedback and criticism.',
      },
    ],
  },
  {
    id: 'performance',
    title: 'Performance',
    questions: [
      {
        id: 'performance-future',
        text: "Where do you see this person in 2-3 years if they continue on their current path?",
      },
      {
        id: 'performance-holding-back',
        text: "What's holding this person back from reaching the next level?",
      },
      {
        id: 'performance-rate-responsibilities',
        text: 'Rate their performance on their most important responsibilities (be specific).',
      },
    ],
  },
  {
    id: 'value',
    title: 'Value',
    questions: [
      {
        id: 'value-scale',
        text: 'On a scale of 1-10, how valuable is this person to the team? Why that number?',
      },
      {
        id: 'value-unique-skills',
        text: "What unique skills or perspective does this person bring that others don't?",
      },
      {
        id: 'value-dream-team',
        text: 'If you were building your dream team, would you choose this person? Why?',
      },
    ],
  },
  {
    id: 'trust',
    title: 'Trust',
    questions: [
      {
        id: 'trust-deliver',
        text: 'Do you trust this person to deliver on their commitments? Explain.',
      },
      {
        id: 'trust-advice',
        text: 'Would you go to this person for help or advice? Why or why not?',
      },
      {
        id: 'trust-pressure',
        text: 'How does this person handle pressure, setbacks, or failure?',
      },
    ],
  },
  {
    id: 'general',
    title: 'General',
    questions: [
      {
        id: 'general-strengths',
        text: "What are this person's greatest strengths?",
      },
      {
        id: 'general-development-areas',
        text: 'What areas could this person focus on for development?',
      },
      {
        id: 'general-change-one-thing',
        text: 'If you could change one thing about how this person works, what would it be?',
      },
    ],
  },
];

export const DEFAULT_QUESTION_IDS = [
  'impact-biggest-impact',
  'growth-stop',
  'growth-start',
];

export function getQuestionById(questionId: string): QuestionLibraryItem | undefined {
  for (const category of QUESTION_LIBRARY) {
    const match = category.questions.find((q) => q.id === questionId);
    if (match) {
      return match;
    }
  }
  return undefined;
}

export function getDefaultLibraryQuestions(): QuestionLibraryItem[] {
  return DEFAULT_QUESTION_IDS
    .map((id) => getQuestionById(id))
    .filter((q): q is QuestionLibraryItem => Boolean(q));
}

export function getQuestionsByCategory(): Record<string, QuestionLibraryItem[]> {
  const categorized: Record<string, QuestionLibraryItem[]> = {};
  
  QUESTION_LIBRARY.forEach(category => {
    categorized[category.title] = category.questions;
  });
  
  return categorized;
}
