import { useState, type FormEvent, useRef, useEffect } from 'react';
import { Sparkles, X, ChevronDown, ChevronUp, Lightbulb, AlertTriangle, Info, TrendingUp, Minimize2, MessageSquare, Zap, RotateCcw } from 'lucide-react';
import { useUnifiedAICoach } from '../context/UnifiedAICoachContext';
import { useQuickAction } from '../context/QuickActionContext';
import { useToast } from './unified';

export default function UnifiedAICoach() {
  const {
    suggestions,
    dismissSuggestion,
    onboardingTips,
    markTipComplete,
    askQuestion,
    isAsking,
    conversationHistory,
    clearConversation,
    isMinimized,
    setIsMinimized,
    navigateToView,
  } = useUnifiedAICoach();
  const { executeAction } = useQuickAction();
  const { notify } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'tips' | 'qa'>('suggestions');
  const [question, setQuestion] = useState('');
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const focusTipTarget = (targetId: string, attempts = 8) => {
    if (!targetId) return;
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ai-companion-focus');
      setTimeout(() => element.classList.remove('ai-companion-focus'), 2000);
      return;
    }
    if (attempts <= 0) return;
    setTimeout(() => focusTipTarget(targetId, attempts - 1), 200);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (activeTab === 'qa' && conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationHistory, activeTab]);

  // If minimized, show just a floating button
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl hover:from-indigo-700 hover:to-purple-700 transition-all hover:scale-105"
        aria-label="Open AI Coach"
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-semibold">
          {suggestions.length > 0 ? `${suggestions.length} AI Tips` : 'AI Coach'}
        </span>
      </button>
    );
  }

  const incompleteTips = onboardingTips.filter(tip => !tip.completed);
  const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high');
  const otherSuggestions = suggestions.filter(s => s.priority !== 'high');

  return (
    <div className="fixed bottom-6 right-6 w-96 z-50 ai-coach-enter">
      {/* Coach Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-xl shadow-2xl">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 hover:bg-white/10 transition-colors rounded-lg px-2 py-1 flex-1"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold">AI Coach</div>
              <div className="text-xs text-white/80">
                {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
                {incompleteTips.length > 0 && ` • ${incompleteTips.length} tips`}
              </div>
            </div>
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 flex-shrink-0" />
            ) : (
              <ChevronUp className="w-5 h-5 flex-shrink-0" />
            )}
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            className="ml-2 p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        {isExpanded && (
          <div className="px-4 pb-3 flex gap-2">
            <TabButton
              active={activeTab === 'suggestions'}
              onClick={() => setActiveTab('suggestions')}
              icon={Zap}
              label="Suggestions"
              count={suggestions.length}
            />
            <TabButton
              active={activeTab === 'tips'}
              onClick={() => setActiveTab('tips')}
              icon={Lightbulb}
              label="Tips"
              count={incompleteTips.length}
            />
            <TabButton
              active={activeTab === 'qa'}
              onClick={() => setActiveTab('qa')}
              icon={MessageSquare}
              label="Chat"
            />
          </div>
        )}
      </div>

      {/* Coach Body */}
      {isExpanded && (
        <div className="bg-white rounded-b-xl shadow-2xl border-t border-indigo-200 max-h-[600px] overflow-hidden flex flex-col">
          {/* Suggestions Tab */}
          {activeTab === 'suggestions' && (
            <div className="p-4 space-y-3 overflow-y-auto">
              {suggestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm">No suggestions right now.</p>
                  <p className="text-xs mt-1">Keep working—I'll notify you when there's something to focus on.</p>
                </div>
              ) : (
                <>
                  {/* High Priority */}
                  {highPrioritySuggestions.length > 0 && (
                    <>
                      <div className="text-xs font-semibold text-red-600 uppercase tracking-wide flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        High Priority
                      </div>
                      {highPrioritySuggestions.map(suggestion => (
                        <SuggestionCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          onDismiss={dismissSuggestion}
                          onAction={executeAction}
                        />
                      ))}
                    </>
                  )}

                  {/* Other Suggestions */}
                  {otherSuggestions.length > 0 && (
                    <>
                      {highPrioritySuggestions.length > 0 && (
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2 border-t border-gray-200">
                          More Suggestions
                        </div>
                      )}
                      {otherSuggestions.map(suggestion => (
                        <SuggestionCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          onDismiss={dismissSuggestion}
                          onAction={executeAction}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tips Tab */}
          {activeTab === 'tips' && (
            <div className="p-4 space-y-3 overflow-y-auto">
              {incompleteTips.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm">You've completed all tips!</p>
                  <p className="text-xs mt-1">Great job exploring Sonance.</p>
                </div>
              ) : (
                <>
                  <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                    Quick Tour
                  </div>
                  <p className="text-xs text-gray-600">Pick a highlight to explore</p>
                  {incompleteTips.map(tip => (
                    <div
                      key={tip.id}
                      className="rounded-lg border border-amber-200 bg-amber-50 p-3 hover:bg-amber-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-amber-900">{tip.title}</p>
                          <p className="text-xs text-amber-800 mt-1">{tip.description}</p>
                        </div>
                        <button
                          onClick={() => markTipComplete(tip.id)}
                          className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                        >
                          Dismiss
                        </button>
                      </div>
                      {tip.targetId && (
                        <button
                          onClick={() => {
                            // Navigate to the correct view first if needed
                            if (tip.navigateTo && navigateToView) {
                              navigateToView(tip.navigateTo);
                              setTimeout(() => {
                                if (tip.targetId) {
                                  focusTipTarget(tip.targetId);
                                }
                              }, 250);
                            } else if (tip.targetId) {
                              focusTipTarget(tip.targetId);
                            }
                          }}
                          className="mt-2 text-xs text-amber-700 hover:text-amber-900 font-medium"
                        >
                          Show me →
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Q&A Tab - Conversational */}
          {activeTab === 'qa' && (
            <div className="flex flex-col h-[540px]">
              {/* Conversation header with clear button */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                    Chat with AI Coach
                  </span>
                </div>
                {conversationHistory.length > 0 && (
                  <button
                    onClick={clearConversation}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                    title="Clear conversation"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>

              {/* Conversation messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {conversationHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm font-medium">Start a conversation</p>
                    <p className="text-xs mt-1">Ask me anything about talent management</p>
                    <div className="mt-4 space-y-2 text-left max-w-xs mx-auto">
                      <p className="text-xs text-gray-600">Try asking:</p>
                      <button
                        onClick={() => setQuestion('How do I assess potential?')}
                        className="block w-full text-left px-3 py-2 text-xs bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        "How do I assess potential?"
                      </button>
                      <button
                        onClick={() => setQuestion('Where should I start?')}
                        className="block w-full text-left px-3 py-2 text-xs bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        "Where should I start?"
                      </button>
                      <button
                        onClick={() => setQuestion('How do development plans work?')}
                        className="block w-full text-left px-3 py-2 text-xs bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        "How do development plans work?"
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {conversationHistory.map((message, idx) => (
                      <div
                        key={idx}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 ${
                            message.role === 'user'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-900 border border-gray-200'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-line leading-relaxed">
                            {message.content}
                          </p>
                          <p
                            className={`text-[10px] mt-1 ${
                              message.role === 'user' ? 'text-indigo-200' : 'text-gray-500'
                            }`}
                          >
                            {new Date(message.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isAsking && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span className="text-xs text-gray-500">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={conversationEndRef} />
                  </>
                )}
              </div>

              {/* Input form */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <form
                  onSubmit={async (e: FormEvent) => {
                    e.preventDefault();
                    if (!question.trim() || isAsking) return;

                    try {
                      await askQuestion(question.trim());
                      setQuestion('');
                    } catch (error) {
                      console.error('Failed to ask question:', error);
                      notify({
                        title: 'Error',
                        description: 'Failed to send message. Please try again.',
                        variant: 'error',
                      });
                    }
                  }}
                  className="space-y-2"
                >
                  <textarea
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => {
                      // Submit on Enter (without Shift)
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (question.trim() && !isAsking) {
                          e.currentTarget.form?.requestSubmit();
                        }
                      }
                    }}
                    rows={2}
                    placeholder={conversationHistory.length > 0 ? 'Follow up...' : 'Ask me anything...'}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                    disabled={isAsking}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">
                      Press Enter to send • Shift+Enter for new line
                    </span>
                    <button
                      type="submit"
                      disabled={isAsking || !question.trim()}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {isAsking ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Tab button component
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
}

function TabButton({ active, onClick, icon: Icon, label, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? 'bg-white text-indigo-700 shadow-sm'
          : 'bg-white/20 text-white hover:bg-white/30'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
          active ? 'bg-indigo-100 text-indigo-700' : 'bg-white/20 text-white'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// Suggestion card component
interface SuggestionCardProps {
  suggestion: ReturnType<typeof useUnifiedAICoach>['suggestions'][0];
  onDismiss: (id: string) => void;
  onAction: (payload: any) => void;
}

function SuggestionCard({ suggestion, onDismiss, onAction }: SuggestionCardProps) {
  const iconMap = {
    action: TrendingUp,
    insight: Lightbulb,
    warning: AlertTriangle,
    tip: Info,
  };

  const colorMap = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-amber-200 bg-amber-50',
    low: 'border-blue-200 bg-blue-50',
  };

  const iconColorMap = {
    action: 'text-blue-600',
    insight: 'text-purple-600',
    warning: 'text-red-600',
    tip: 'text-green-600',
  };

  const Icon = iconMap[suggestion.type];

  return (
    <div className={`rounded-lg border p-3 ${colorMap[suggestion.priority]} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconColorMap[suggestion.type]}`} />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-gray-900 mb-1">
              {suggestion.title}
            </h4>
            <p className="text-xs text-gray-700 leading-relaxed">
              {suggestion.description}
            </p>
          </div>
        </div>
        {suggestion.dismissable && (
          <button
            onClick={() => onDismiss(suggestion.id)}
            className="p-1 hover:bg-white/50 rounded transition-colors flex-shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Actions */}
      {suggestion.actions && suggestion.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {suggestion.actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => {
                onAction({
                  type: action.actionType as any,
                  ...action.payload,
                  context: action.payload,
                });
              }}
              className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 transition-colors shadow-sm hover:shadow"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Learn more link */}
      {suggestion.learnMore && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <a
            href={suggestion.learnMore}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Learn more →
          </a>
        </div>
      )}
    </div>
  );
}
