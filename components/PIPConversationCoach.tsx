import { useState } from 'react';
import { MessageCircle, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Clock, Users } from 'lucide-react';
import type { PerformanceImprovementPlan, PIPCheckIn } from '../types';
import { getConversationScript, type ConversationScript } from '../lib/pipConversationScripts';

interface PIPConversationCoachProps {
  pip: PerformanceImprovementPlan;
  checkIns: PIPCheckIn[];
}

export default function PIPConversationCoach({ pip, checkIns }: PIPConversationCoachProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showFullScript, setShowFullScript] = useState(false);

  // Calculate days in PIP
  const startDate = new Date(pip.start_date);
  const today = new Date();
  const daysInPIP = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Get appropriate conversation script
  const script = getConversationScript(daysInPIP, pip.status);

  // Determine next meeting type
  const getNextMeetingType = () => {
    if (daysInPIP < 28) return 'Weekly Check-In';
    if (daysInPIP >= 28 && daysInPIP < 30) return '30-Day Milestone Review';
    if (daysInPIP >= 58 && daysInPIP < 60) return '60-Day Milestone Review';
    if (daysInPIP >= 88) return '90-Day Final Review';
    return 'Weekly Check-In';
  };

  const nextMeeting = getNextMeetingType();
  const isUpcomingMilestone = daysInPIP >= 25 && daysInPIP < 30;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Conversation Coach</h3>
            <p className="text-sm text-gray-600">
              Next: {nextMeeting}
              {isUpcomingMilestone && (
                <span className="ml-2 text-amber-600 font-medium">
                  (In {30 - daysInPIP} days)
                </span>
              )}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Meeting Info */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <Clock className="w-5 h-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">{script.title}</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><strong>Duration:</strong> {script.duration}</p>
                  <p><strong>Participants:</strong> {script.participants.join(', ')}</p>
                  {script.hrRequired && (
                    <div className="flex items-center gap-2 mt-2 text-amber-700">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">HR presence required</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pre-Meeting Checklist */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Before the Meeting
            </h4>
            <div className="space-y-1.5">
              {script.preMeetingChecklist.map((item, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-4 h-4 rounded border-2 border-gray-300 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Opening Script */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900">Opening Script</h4>
              <button
                onClick={() => setShowFullScript(!showFullScript)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showFullScript ? 'Hide Full Script' : 'Show Full Script'}
              </button>
            </div>
            {showFullScript ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                  {script.openingScript}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic">
                {script.openingScript.split('\n')[0].slice(0, 100)}...
              </p>
            )}
          </div>

          {/* Key Points */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Key Points to Cover</h4>
            <ul className="space-y-1.5">
              {script.keyPoints.map((point, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Do's and Don'ts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                <span className="text-lg">❌</span>
                Avoid Saying
              </h4>
              <ul className="space-y-1.5">
                {script.avoidSaying.map((phrase, index) => (
                  <li key={index} className="text-xs text-gray-700 pl-4 border-l-2 border-red-300">
                    {phrase}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                <span className="text-lg">✅</span>
                Do Say
              </h4>
              <ul className="space-y-1.5">
                {script.doSay.map((phrase, index) => (
                  <li key={index} className="text-xs text-gray-700 pl-4 border-l-2 border-green-300">
                    {phrase}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Common Questions */}
          {script.commonQuestions.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Common Questions & Responses</h4>
              <div className="space-y-3">
                {script.commonQuestions.map((qa, index) => (
                  <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      Q: {qa.question}
                    </p>
                    <p className="text-sm text-gray-700 italic">
                      A: {qa.suggestedAnswer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Post-Meeting Actions */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">After the Meeting</h4>
            <div className="space-y-1.5">
              {script.postMeetingActions.map((action, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-4 h-4 rounded border-2 border-gray-300 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Documentation Required */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Required Documentation
            </h4>
            <ul className="space-y-1">
              {script.documentationRequired.map((doc, index) => (
                <li key={index} className="text-sm text-amber-900 pl-4">
                  • {doc}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

