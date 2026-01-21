import { ITPBehavior, ITPVirtue } from '@/types';

/**
 * ITP (Ideal Team Player) Behaviors
 * Based on the Ideal Team Player Guide (Rev. Jan 2025)
 *
 * Three virtues: Humble, Hungry, People Smart
 * Each virtue has 4 core behaviors
 * Each behavior has 3 levels: Not Living, Living, Role Modeling
 */

export const ITP_BEHAVIORS: ITPBehavior[] = [
  // ============================================
  // HUMBLE (4 behaviors)
  // ============================================
  {
    virtue: 'humble',
    behaviorKey: 'recognition',
    behaviorName: 'Recognition',
    descriptionNotLiving: 'Mostly concerned with personal accomplishments rather than team accomplishments',
    descriptionLiving: 'Proactively recognizes team accomplishments vs individual accomplishments',
    descriptionRoleModeling: 'Encourages others to recognize team accomplishments and always refers to "we" when we succeed and "I" when we fail',
  },
  {
    virtue: 'humble',
    behaviorKey: 'collaboration',
    behaviorName: 'Collaboration',
    descriptionNotLiving: 'Resists collaboration out of arrogance, fear, or insecurity. Often thinks, "I knew that wouldn\'t work" or says, "Well I could have told you that"',
    descriptionLiving: 'Collaborates, asks others for input, and is comfortable being challenged',
    descriptionRoleModeling: 'Creates an environment where everyone feels comfortable to contribute and share their ideas',
  },
  {
    virtue: 'humble',
    behaviorKey: 'handling_mistakes',
    behaviorName: 'Handling Mistakes',
    descriptionNotLiving: 'Does not easily admit mistakes, quick to make excuses, and is generally defensive when receiving feedback',
    descriptionLiving: 'Easily admits mistakes and learns from each of them',
    descriptionRoleModeling: 'Proactively owns mistakes and demonstrates to others how admitting and "owning" mistakes can build trust - not erode it',
  },
  {
    virtue: 'humble',
    behaviorKey: 'communication',
    behaviorName: 'Communication',
    descriptionNotLiving: 'Uses absolute terms like: "Always", "Never", "Certainly", or "Undoubtedly"',
    descriptionLiving: 'Uses words like: "Perhaps", "I think", and "My gut says that"',
    descriptionRoleModeling: 'Is very comfortable saying: "I don\'t know" or "I could use your input"',
  },

  // ============================================
  // HUNGRY (4 behaviors)
  // ============================================
  {
    virtue: 'hungry',
    behaviorKey: 'initiative',
    behaviorName: 'Initiative',
    descriptionNotLiving: 'Does the bare minimum to get by',
    descriptionLiving: 'Quick to jump in to the next initiative or opportunity with enthusiasm and passion',
    descriptionRoleModeling: 'My passion for my work and the Team could be described as "contagious"',
  },
  {
    virtue: 'hungry',
    behaviorKey: 'passion',
    behaviorName: 'Passion',
    descriptionNotLiving: 'Is indifferent about our products, customers, and our team. Avoids interactions with customers and team members',
    descriptionLiving: 'Is passionate about what we do, our customer\'s businesses, and team member\'s lives',
    descriptionRoleModeling: 'Engages with our customers and employees and displays passion for our products, our customers, and teammates',
  },
  {
    virtue: 'hungry',
    behaviorKey: 'drive',
    behaviorName: 'Drive',
    descriptionNotLiving: 'Has a "That\'s not my job" attitude',
    descriptionLiving: 'Willing to take on tedious or challenging tasks whenever necessary',
    descriptionRoleModeling: 'Looks for opportunities to do both high level and low level tasks - coaches others to do the same',
  },
  {
    virtue: 'hungry',
    behaviorKey: 'connects_to_company_goals',
    behaviorName: 'Connects To Company Goals',
    descriptionNotLiving: 'Struggles to tie individual responsibilities to company goals - eager for opportunity but may struggle understanding the bigger picture',
    descriptionLiving: 'Easily connects the work of self and others to the company\'s goals',
    descriptionRoleModeling: 'Helps others find ways to contribute to the team and actively looks for next projects/areas to tackle',
  },

  // ============================================
  // PEOPLE SMART (4 behaviors)
  // ============================================
  {
    virtue: 'people_smart',
    behaviorKey: 'adaptability',
    behaviorName: 'Adaptability',
    descriptionNotLiving: 'Often offends others; unable to "read the room"',
    descriptionLiving: 'Can quickly assess the room and alter delivery on the spot to appeal to the audience',
    descriptionRoleModeling: 'Helps others learn to adapt to different personality styles and situations',
  },
  {
    virtue: 'people_smart',
    behaviorKey: 'focus',
    behaviorName: 'Focus',
    descriptionNotLiving: 'Too focused on office politics and gossip',
    descriptionLiving: 'Focuses on the important things and ignores office politics and gossip',
    descriptionRoleModeling: 'Calls it out when people are focusing on office politics or gossip and draws people\'s focus back to the Team\'s initiatives',
  },
  {
    virtue: 'people_smart',
    behaviorKey: 'conflict_resolution',
    behaviorName: 'Conflict Resolution',
    descriptionNotLiving: 'Hesitates to address conflict and/or avoids uncomfortable situations',
    descriptionLiving: 'Participates in constructive conflict to drive for resolution',
    descriptionRoleModeling: 'Drives constructive conflict and productive debate to help produce the best outcome',
  },
  {
    virtue: 'people_smart',
    behaviorKey: 'skill_identification',
    behaviorName: 'Skill Identification',
    descriptionNotLiving: 'Fails to recognize and appreciate others skills and experiences',
    descriptionLiving: 'Values the skills and experience of others and asks them to weigh in',
    descriptionRoleModeling: 'Seeks to learn more about others skills/experiences and helps them find ways to contribute to the Team and the discussion',
  },
];

/**
 * Get behaviors grouped by virtue
 */
export function getBehaviorsByVirtue(): Record<ITPVirtue, ITPBehavior[]> {
  return {
    humble: ITP_BEHAVIORS.filter(b => b.virtue === 'humble'),
    hungry: ITP_BEHAVIORS.filter(b => b.virtue === 'hungry'),
    people_smart: ITP_BEHAVIORS.filter(b => b.virtue === 'people_smart'),
  };
}

/**
 * Get a behavior by its key
 */
export function getBehaviorByKey(key: string): ITPBehavior | undefined {
  return ITP_BEHAVIORS.find(b => b.behaviorKey === key);
}

/**
 * Get all behavior keys
 */
export function getAllBehaviorKeys(): string[] {
  return ITP_BEHAVIORS.map(b => b.behaviorKey);
}

/**
 * Virtue display names and colors
 */
export const VIRTUE_CONFIG: Record<ITPVirtue, { displayName: string; color: string; bgColor: string; borderColor: string }> = {
  humble: {
    displayName: 'Humble',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  hungry: {
    displayName: 'Hungry',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  people_smart: {
    displayName: 'People Smart',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
};

/**
 * Rating labels for the 5-point scale
 */
export const RATING_LABELS: Record<number, string> = {
  1: 'Not Living',
  2: '',
  3: 'Living',
  4: '',
  5: 'Role Modeling',
};
