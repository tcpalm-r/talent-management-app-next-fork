import { useState } from 'react';
import { X, Sparkles, Loader, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { PerformanceReview } from './PerformanceReviewModal';
import { getAnthropicClient, isAnthropicConfigured } from '../lib/anthropicService';

interface TeamPlayerCoachingModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  managerReview: PerformanceReview;
  selfReview: PerformanceReview;
}

interface ScoreDifference {
  attribute: string;
  behavior: string;
  managerScore: number;
  selfScore: number;
  difference: number;
}

export default function TeamPlayerCoachingModal({
  isOpen,
  onClose,
  employeeName,
  managerReview,
  selfReview,
}: TeamPlayerCoachingModalProps) {
  const [coaching, setCoaching] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const anthropicAvailable = isAnthropicConfigured();
  const [anthropicWarning, setAnthropicWarning] = useState<string | null>(
    anthropicAvailable ? null : 'Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to enable AI coaching.'
  );

  // Calculate score differences
  const calculateDifferences = (): ScoreDifference[] => {
    const differences: ScoreDifference[] = [];

    // Humble scores
    Object.entries(managerReview.humble_scores).forEach(([behavior, managerScore]) => {
      const selfScore = (selfReview.humble_scores as any)[behavior];
      const diff = managerScore - selfScore;
      if (Math.abs(diff) >= 2) { // Only show significant differences
        differences.push({
          attribute: 'Humble',
          behavior: behavior.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          managerScore,
          selfScore,
          difference: diff
        });
      }
    });

    // Hungry scores
    Object.entries(managerReview.hungry_scores).forEach(([behavior, managerScore]) => {
      const selfScore = (selfReview.hungry_scores as any)[behavior];
      const diff = managerScore - selfScore;
      if (Math.abs(diff) >= 2) {
        differences.push({
          attribute: 'Hungry',
          behavior: behavior.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          managerScore,
          selfScore,
          difference: diff
        });
      }
    });

    // Smart scores
    Object.entries(managerReview.smart_scores).forEach(([behavior, managerScore]) => {
      const selfScore = (selfReview.smart_scores as any)[behavior];
      const diff = managerScore - selfScore;
      if (Math.abs(diff) >= 2) {
        differences.push({
          attribute: 'Smart',
          behavior: behavior.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          managerScore,
          selfScore,
          difference: diff
        });
      }
    });

    return differences.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  };

  const differences = calculateDifferences();

  const generateCoaching = async () => {
    if (!anthropicAvailable) {
      setAnthropicWarning('Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to enable AI coaching.');
      return;
    }

    setIsGenerating(true);
    setCoaching('');
    setAnthropicWarning(null);

    try {
      const anthropic = getAnthropicClient();

      const prompt = `You are an executive coach helping a manager prepare for a performance review discussion. There are score differences between the manager's assessment and the employee's self-assessment on the Ideal Team Player framework.

EMPLOYEE: ${employeeName}

SCORE DIFFERENCES (Manager Score - Self Score):
${differences.map(d => `
- **${d.attribute}: ${d.behavior}**
  - Manager rated: ${d.managerScore}/10
  - Employee self-rated: ${d.selfScore}/10
  - Difference: ${d.difference > 0 ? '+' : ''}${d.difference} (${d.difference > 0 ? 'Manager rated higher' : 'Employee rated higher'})
`).join('\n')}

MANAGER'S OVERALL SCORES:
- Humble: ${managerReview.humble_score}/10
- Hungry: ${managerReview.hungry_score}/10
- Smart: ${managerReview.smart_score}/10

EMPLOYEE'S SELF SCORES:
- Humble: ${selfReview.humble_score}/10
- Hungry: ${selfReview.hungry_score}/10
- Smart: ${selfReview.smart_score}/10

Your task is to provide coaching to the manager on how to broach these score differences in the performance review conversation. For each significant difference:

1. **Explain the likely reason** for the perceptual gap (e.g., self-awareness, different examples in mind, cultural/personality factors)
2. **Suggest conversation starters** that are non-confrontational and invite dialogue
3. **Recommend specific examples** the manager should prepare to share (even if hypothetical)
4. **Provide tips** for handling defensive reactions if they arise
5. **Suggest development actions** that both parties could agree on

Format your response in clear sections with actionable advice. Be empathetic, practical, and focused on productive conversation. Aim for 600-800 words.`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = message.content[0];
      if (content.type === 'text') {
        setCoaching(content.text);
      }
    } catch (error: any) {
      console.error('Error generating coaching:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate coaching.';
      setAnthropicWarning(message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-blue-500">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Coaching: Score Differences</h2>
              <p className="text-sm text-purple-100">Review discussion guidance for {employeeName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-purple-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        {anthropicWarning && (
          <div className="p-6 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
            {anthropicWarning}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Score Differences Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Significant Score Differences (±2 points or more)</h3>
            </div>
            {differences.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Minus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No Significant Differences</p>
                <p className="text-sm mt-1">Manager and employee ratings are closely aligned!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {differences.map((diff, idx) => (
                  <div key={idx} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            diff.attribute === 'Humble' ? 'bg-blue-100 text-blue-700' :
                            diff.attribute === 'Hungry' ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {diff.attribute}
                          </span>
                          <span className="font-medium text-gray-900">{diff.behavior}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Manager</div>
                          <div className="text-lg font-bold text-gray-900">{diff.managerScore}</div>
                        </div>
                        <div className="flex items-center justify-center w-16">
                          {diff.difference > 0 ? (
                            <TrendingUp className="w-5 h-5 text-orange-500" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-blue-500" />
                          )}
                          <span className={`ml-1 font-bold ${diff.difference > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                            {diff.difference > 0 ? '+' : ''}{diff.difference}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Self</div>
                          <div className="text-lg font-bold text-gray-900">{diff.selfScore}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generate Coaching Button */}
          {differences.length > 0 && !coaching && (
            <div className="flex justify-center">
              <button
                onClick={generateCoaching}
                disabled={isGenerating}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Generating Coaching...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Get AI Coaching on These Differences</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* AI Coaching */}
          {coaching && (
            <div className="border border-green-200 bg-green-50 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-900">AI Coaching Guidance</h3>
              </div>
              <div className="prose prose-sm max-w-none text-gray-900 whitespace-pre-wrap bg-white rounded p-4 border border-green-200">
                {coaching}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setCoaching('')}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 text-sm"
                >
                  Generate New Coaching
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            AI coaching suggestions are meant as guidance. Use your judgment and knowledge of the employee.
          </p>
        </div>
      </div>
    </div>
  );
}
