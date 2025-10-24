import type { PerformanceReview } from '../components/PerformanceReviewModal';

/**
 * Compose a rich text narrative from a structured performance review.
 * This is used when routing internal reviews into the AI ingestion flow.
 */
export function composeReviewNarrative(review: PerformanceReview): string {
  const sections: string[] = [];

  sections.push(`Reviewer: ${review.reviewer_name}`);
  sections.push(`Review Type: ${review.review_type === 'manager' ? 'Manager Assessment' : 'Self-Reflection'}`);
  sections.push(`Review Year: ${review.review_year}`);

  sections.push('\n=== Performance Story ===');
  sections.push(`Accomplishments & OKRs:\n${review.accomplishments_okrs || 'Not provided.'}`);
  sections.push(`Growth & Development:\n${review.growth_development || 'Not provided.'}`);
  sections.push(`Support & Feedback Needed:\n${review.support_feedback || 'Not provided.'}`);

  if (review.manager_performance_summary) {
    sections.push('\n=== Manager Summary ===');
    sections.push(`Overall Assessment: ${formatSentence(review.manager_performance_summary)}`);
  }

  if (review.manager_additional_comments) {
    sections.push(`Manager Comments:\n${review.manager_additional_comments}`);
  }

  if (review.self_additional_comments) {
    sections.push('\n=== Self Reflection Notes ===');
    sections.push(review.self_additional_comments);
  }

  sections.push('\n=== Ideal Team Player Snapshot ===');
  sections.push(`Humble Score: ${review.humble_score} / 10`);
  sections.push(`Hungry Score: ${review.hungry_score} / 10`);
  sections.push(`People Smart Score: ${review.smart_score} / 10`);

  sections.push('Detailed Behavior Scores:');
  sections.push(formatBehaviorScores('Humble Behaviors', review.humble_scores));
  sections.push(formatBehaviorScores('Hungry Behaviors', review.hungry_scores));
  sections.push(formatBehaviorScores('People Smart Behaviors', review.smart_scores));

  if (review.ideal_team_player_areas?.length) {
    sections.push('\n=== Focus Areas ===');
    sections.push(review.ideal_team_player_areas.map((area, idx) => `${idx + 1}. ${area}`).join('\n'));
  }

  return sections.filter(Boolean).join('\n');
}

function formatSentence(value: string): string {
  const formatted = value.replace(/_/g, ' ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatBehaviorScores<T extends Record<string, number>>(label: string, scores: T): string {
  const lines = Object.entries(scores).map(([key, value]) => {
    const friendly = key.replace(/_/g, ' ');
    return `• ${capitalizeWords(friendly)}: ${value}/10`;
  });
  return `${label}:\n${lines.join('\n')}`;
}

function capitalizeWords(text: string): string {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}
