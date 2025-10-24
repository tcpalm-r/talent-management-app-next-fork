import { useState } from 'react';
import { X, Save, Send, FileText, User, Users, Target, MessageSquare, Award, ChevronRight, ChevronLeft, AlertCircle, Sparkles, Mic } from 'lucide-react';
import type { Employee } from '../types';
import AIDraftReviewModal from './AIDraftReviewModal';
import ReviewSectionAIAssistant from './ReviewSectionAIAssistant';
import type { ReviewSectionKey } from '../lib/anthropicService';
import { EmployeeNameLink } from './unified';

export interface PerformanceReview {
  id: string;
  employee_id: string;
  employee_name: string;
  review_type: 'self' | 'manager';
  reviewer_name: string;
  review_year: number;

  // Question responses
  accomplishments_okrs: string;
  growth_development: string;
  support_feedback: string;
  ideal_team_player_link: string;

  // Ideal Team Player scores (1-10 scale for each behavior)
  humble_scores: {
    recognition: number;
    collaboration: number;
    handling_mistakes: number;
    communication: number;
  };
  hungry_scores: {
    initiative: number;
    passion: number;
    drive: number;
    connects_to_company_goals: number;
  };
  smart_scores: {
    adaptability: number;
    focus: number;
    conflict_resolution: number;
    skill_identification: number;
  };

  // Overall averages (calculated)
  humble_score: number;
  hungry_score: number;
  smart_score: number;

  ideal_team_player_areas: string[]; // Two areas to work on

  // Manager-only fields
  manager_performance_summary?: 'excellence' | 'exceeds' | 'meets' | 'occasionally_meets' | 'not_performing';
  manager_additional_comments?: string;

  // Self-only field
  self_additional_comments?: string;

  status: 'draft' | 'submitted' | 'completed';
  created_at: string;
  updated_at: string;
  submitted_at?: string;
}

interface PerformanceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  reviewType: 'self' | 'manager';
  currentUserName: string;
  onSave: (review: PerformanceReview) => void;
  existingReview?: PerformanceReview;
}

const IDEAL_TEAM_PLAYER_ATTRIBUTES = [
  {
    id: 'humble',
    name: 'Humble',
    description: 'Lacks excessive ego, quick to point out contributions of others, slow to seek attention',
    color: 'blue',
    behaviors: [
      { name: 'Recognition', notLiving: 'Mostly concerned with personal accomplishments rather than team accomplishments', living: 'Proactively recognizes team accomplishments vs individual accomplishments', roleModeling: 'Encourages others to recognize team accomplishments and always refers to "we" when we succeed and "I" when we fail' },
      { name: 'Collaboration', notLiving: 'Resists collaboration out of arrogance, fear, or insecurity. Often thinks, "I knew that wouldn\'t work" or says, "Well I could have told you that"', living: 'Collaborates, asks others for input, and is comfortable being challenged', roleModeling: 'Creates an environment where everyone feels comfortable to contribute and share their ideas' },
      { name: 'Handling Mistakes', notLiving: 'Does not easily admit mistakes, quick to make excuses, and is generally defensive when receiving feedback', living: 'Easily admits mistakes and learns from each of them', roleModeling: 'Proactively owns mistakes and demonstrates to others how admitting and "owning" mistakes can build trust - not erode it' },
      { name: 'Communication', notLiving: 'Uses absolute terms like: "Always", "Never", "Certainly", or "Undoubtedly"', living: 'Uses words like: "Perhaps", "I think", and "My gut says that"', roleModeling: 'Is very comfortable saying: "I don\'t know" or "I could use your input"' }
    ]
  },
  {
    id: 'hungry',
    name: 'Hungry',
    description: 'Always looking for more to do, thinks about next step and next opportunity',
    color: 'green',
    behaviors: [
      { name: 'Initiative', notLiving: 'Does the bare minimum to get by', living: 'Quick to jump in to the next initiative or opportunity with enthusiasm and passion', roleModeling: 'My passion for my work and the Team could be described as "contagious"' },
      { name: 'Passion', notLiving: 'Is indifferent about our products, customers, and our team. Avoids interactions with customers and team members', living: 'Is passionate about what we do, our customer\'s businesses, and team member\'s lives', roleModeling: 'Engages with our customers and employees and displays passion for our products, our customers, and teammates' },
      { name: 'Drive', notLiving: 'Has a "That\'s not my job" attitude', living: 'Willing to take on tedious or challenging tasks whenever necessary', roleModeling: 'Looks for opportunities to do both high and low level tasks - coaches others to do the same' },
      { name: 'Connects To Company Goals', notLiving: 'Struggles to tie individual responsibilities to company goals - eager for opportunity but may struggle understanding the bigger picture', living: 'Easily connects the work of self and others to the company\'s goals', roleModeling: 'Helps others find ways to contribute to the team and actively looks for next projects/areas to tackle' }
    ]
  },
  {
    id: 'smart',
    name: 'People Smart',
    description: 'Has common sense about people, understands group dynamics',
    color: 'purple',
    behaviors: [
      { name: 'Adaptability', notLiving: 'Often offends others; unable to "read the room"', living: 'Can quickly assess the room and alter delivery on the spot to appeal to the audience', roleModeling: 'Helps others learn to adapt to different personality styles and situations' },
      { name: 'Focus', notLiving: 'Too focused on office politics and gossip', living: 'Focuses on the important things and ignores office politics and gossip', roleModeling: 'Calls it out when people are focusing on office politics or gossip and draws people\'s focus back to the Team\'s initiatives' },
      { name: 'Conflict Resolution', notLiving: 'Hesitates to address conflict and/or avoids uncomfortable situations', living: 'Participates in constructive conflict to drive for resolution', roleModeling: 'Drives constructive conflict and productive debate to help produce the best outcome' },
      { name: 'Skill Identification', notLiving: 'Fails to recognize and appreciate others skills and experiences', living: 'Values the skills and experience of others and asks them to weigh in', roleModeling: 'Seeks to learn more about others skills/experiences and helps them find ways to contribute to the Team and the discussion' }
    ]
  }
];

const IMPROVEMENT_AREAS = [
  'Communication Skills',
  'Technical Expertise',
  'Leadership',
  'Collaboration',
  'Time Management',
  'Strategic Thinking',
  'Problem Solving',
  'Adaptability',
  'Accountability',
  'Initiative',
  'Emotional Intelligence',
  'Decision Making'
];

export default function PerformanceReviewModal({
  isOpen,
  onClose,
  employee,
  reviewType,
  currentUserName,
  onSave,
  existingReview
}: PerformanceReviewModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showAIDraftModal, setShowAIDraftModal] = useState(false);
  const [activeSectionAssistant, setActiveSectionAssistant] = useState<ReviewSectionKey | null>(null);

  // Form state
  const [accomplishmentsOKRs, setAccomplishmentsOKRs] = useState(existingReview?.accomplishments_okrs || '');
  const [growthDevelopment, setGrowthDevelopment] = useState(existingReview?.growth_development || '');
  const [supportFeedback, setSupportFeedback] = useState(existingReview?.support_feedback || '');
  const [teamPlayerLink] = useState(existingReview?.ideal_team_player_link || '[LINK TO BE PROVIDED]');

  // Ideal Team Player scores (1-10 scale for each behavior)
  const [humbleScores, setHumbleScores] = useState({
    recognition: existingReview?.humble_scores?.recognition || 5,
    collaboration: existingReview?.humble_scores?.collaboration || 5,
    handling_mistakes: existingReview?.humble_scores?.handling_mistakes || 5,
    communication: existingReview?.humble_scores?.communication || 5,
  });
  const [hungryScores, setHungryScores] = useState({
    initiative: existingReview?.hungry_scores?.initiative || 5,
    passion: existingReview?.hungry_scores?.passion || 5,
    drive: existingReview?.hungry_scores?.drive || 5,
    connects_to_company_goals: existingReview?.hungry_scores?.connects_to_company_goals || 5,
  });
  const [smartScores, setSmartScores] = useState({
    adaptability: existingReview?.smart_scores?.adaptability || 5,
    focus: existingReview?.smart_scores?.focus || 5,
    conflict_resolution: existingReview?.smart_scores?.conflict_resolution || 5,
    skill_identification: existingReview?.smart_scores?.skill_identification || 5,
  });
  const [improvementAreas, setImprovementAreas] = useState<string[]>(existingReview?.ideal_team_player_areas || []);

  // Calculate overall averages
  const humbleScore = Math.round((humbleScores.recognition + humbleScores.collaboration + humbleScores.handling_mistakes + humbleScores.communication) / 4);
  const hungryScore = Math.round((hungryScores.initiative + hungryScores.passion + hungryScores.drive + hungryScores.connects_to_company_goals) / 4);
  const smartScore = Math.round((smartScores.adaptability + smartScores.focus + smartScores.conflict_resolution + smartScores.skill_identification) / 4);

  // Manager-only fields
  const [performanceSummary, setPerformanceSummary] = useState<PerformanceReview['manager_performance_summary']>(
    existingReview?.manager_performance_summary || 'meets'
  );
  const [managerComments, setManagerComments] = useState(existingReview?.manager_additional_comments || '');

  // Self-only field
  const [selfComments, setSelfComments] = useState(existingReview?.self_additional_comments || '');

  const [status, setStatus] = useState<'draft' | 'submitted'>(existingReview?.status === 'submitted' ? 'submitted' : 'draft');

  if (!isOpen) return null;

  const isSelfReview = reviewType === 'self';
  const totalSteps = 5;

  const handleSaveDraft = () => {
    const review: PerformanceReview = {
      id: existingReview?.id || `review-${Date.now()}`,
      employee_id: employee.id,
      employee_name: employee.name,
      review_type: reviewType,
      reviewer_name: currentUserName,
      review_year: new Date().getFullYear(),
      accomplishments_okrs: accomplishmentsOKRs,
      growth_development: growthDevelopment,
      support_feedback: supportFeedback,
      ideal_team_player_link: teamPlayerLink,
      humble_scores: humbleScores,
      hungry_scores: hungryScores,
      smart_scores: smartScores,
      humble_score: humbleScore,
      hungry_score: hungryScore,
      smart_score: smartScore,
      ideal_team_player_areas: improvementAreas,
      manager_performance_summary: reviewType === 'manager' ? performanceSummary : undefined,
      manager_additional_comments: reviewType === 'manager' ? managerComments : undefined,
      self_additional_comments: reviewType === 'self' ? selfComments : undefined,
      status: 'draft',
      created_at: existingReview?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSave(review);
  };

  const handleSubmit = async () => {
    setIsSaving(true);

    const review: PerformanceReview = {
      id: existingReview?.id || `review-${Date.now()}`,
      employee_id: employee.id,
      employee_name: employee.name,
      review_type: reviewType,
      reviewer_name: currentUserName,
      review_year: new Date().getFullYear(),
      accomplishments_okrs: accomplishmentsOKRs,
      growth_development: growthDevelopment,
      support_feedback: supportFeedback,
      ideal_team_player_link: teamPlayerLink,
      humble_scores: humbleScores,
      hungry_scores: hungryScores,
      smart_scores: smartScores,
      humble_score: humbleScore,
      hungry_score: hungryScore,
      smart_score: smartScore,
      ideal_team_player_areas: improvementAreas,
      manager_performance_summary: reviewType === 'manager' ? performanceSummary : undefined,
      manager_additional_comments: reviewType === 'manager' ? managerComments : undefined,
      self_additional_comments: reviewType === 'self' ? selfComments : undefined,
      status: 'submitted',
      created_at: existingReview?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    };

    await onSave(review);
    setIsSaving(false);
    setStatus('submitted');

    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const toggleImprovementArea = (area: string) => {
    if (improvementAreas.includes(area)) {
      setImprovementAreas(improvementAreas.filter(a => a !== area));
    } else if (improvementAreas.length < 2) {
      setImprovementAreas([...improvementAreas, area]);
    }
  };

  const canProceed = () => {
    // Step 1: Ideal Team Player - requires 2 improvement areas selected
    if (currentStep === 1) return improvementAreas.length === 2;
    // Step 2: Accomplishments - requires 50+ characters
    if (currentStep === 2) return accomplishmentsOKRs.trim().length > 50;
    // Step 3: Growth & Development - requires 50+ characters
    if (currentStep === 3) return growthDevelopment.trim().length > 50;
    // Step 4: Support & Feedback - requires 50+ characters
    if (currentStep === 4) return supportFeedback.trim().length > 50;
    return true;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="surface-card space-y-6">
              <div className="flex items-start space-x-3 mb-6">
                <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Ideal Team Player Assessment
                  </h3>
                  <p className="text-sm text-gray-700 mb-4">
                    {isSelfReview ? (
                      <>
                        Rate each core behavior on a scale of 1-10, where <strong>1 = Not Living</strong> the behavior
                        and <strong>10 = Role Modeling</strong> the behavior for others.
                      </>
                    ) : (
                      <>
                        Rate each core behavior on a scale of 1-10, where <strong>1 = Not Living</strong> the behavior
                        and <strong>10 = Role Modeling</strong> the behavior for others.
                      </>
                    )}
                  </p>
                  <div className="bg-blue-100 rounded-lg p-3 text-xs text-blue-900">
                    <strong>Reference Guide:</strong> {teamPlayerLink}
                  </div>
                </div>
              </div>

              {/* Detailed sliders for each attribute and behavior */}
              <div className="space-y-8">
                {IDEAL_TEAM_PLAYER_ATTRIBUTES.map((attr) => {
                  const scores = attr.id === 'humble' ? humbleScores : attr.id === 'hungry' ? hungryScores : smartScores;
                  const setScores = attr.id === 'humble' ? setHumbleScores : attr.id === 'hungry' ? setHungryScores : setSmartScores;
                  const overallScore = attr.id === 'humble' ? humbleScore : attr.id === 'hungry' ? hungryScore : smartScore;
                  const colorClass = attr.color === 'blue' ? 'blue' : attr.color === 'green' ? 'green' : 'purple';
                  const bgColor = attr.color === 'blue' ? '#3B82F6' : attr.color === 'green' ? '#10B981' : '#A855F7';

                  return (
                    <div key={attr.id} className={`bg-gradient-to-br from-${colorClass}-50 to-${colorClass}-100 rounded-xl p-6 border-3 border-${colorClass}-300 shadow-lg`}>
                      {/* Attribute Header with Average Score */}
                      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-${colorClass}-300">
                        <div className="flex-1">
                          <h4 className={`text-xl font-bold text-${colorClass}-900 mb-2`}>
                            {attr.name}
                          </h4>
                          <p className={`text-sm text-${colorClass}-800`}>{attr.description}</p>
                        </div>
                        <div className={`ml-4 w-20 h-20 rounded-2xl bg-gradient-to-br from-${colorClass}-500 to-${colorClass}-700 flex items-center justify-center shadow-xl border-4 border-white`}>
                          <div className="text-center">
                            <div className="text-white text-3xl font-bold">{overallScore}</div>
                            <div className="text-white text-xs font-medium">AVG</div>
                          </div>
                        </div>
                      </div>

                      {/* Individual Behavior Sliders */}
                      <div className="space-y-5">
                        {attr.behaviors.map((behavior, behaviorIndex) => {
                          const behaviorKey = behavior.name.toLowerCase().replace(/ /g, '_').replace(/[()]/g, '');
                          const currentScore = (scores as any)[behaviorKey] || 5;

                          const updateScore = (newValue: number) => {
                            setScores({
                              ...scores,
                              [behaviorKey]: newValue
                            });
                          };

                          // Calculate visual intensity based on slider position (1-10 scale)
                          // Score 1-3: Red zone, 4-7: Yellow zone, 8-10: Green zone
                          const getCardStyle = (cardType: 'red' | 'yellow' | 'green') => {
                            let intensity = 0;
                            let isActive = false;

                            if (cardType === 'red') {
                              // Red is most intense at scores 1-3
                              if (currentScore <= 3) {
                                intensity = 1 - ((currentScore - 1) / 2) * 0.5; // 1.0 to 0.5
                                isActive = true;
                              } else if (currentScore <= 5) {
                                intensity = 0.5 - ((currentScore - 3) / 2) * 0.3; // 0.5 to 0.2
                              } else {
                                intensity = 0.2;
                              }
                            } else if (cardType === 'yellow') {
                              // Yellow is most intense at scores 4-7
                              if (currentScore <= 3) {
                                intensity = 0.2 + ((currentScore - 1) / 2) * 0.3; // 0.2 to 0.5
                              } else if (currentScore <= 7) {
                                const center = 5.5;
                                const distanceFromCenter = Math.abs(currentScore - center);
                                intensity = 1 - (distanceFromCenter / 2) * 0.2; // Peak at 5.5
                                isActive = true;
                              } else {
                                intensity = 0.5 - ((currentScore - 7) / 3) * 0.3; // 0.5 to 0.2
                              }
                            } else if (cardType === 'green') {
                              // Green is most intense at scores 8-10
                              if (currentScore <= 7) {
                                intensity = 0.2 + ((currentScore - 1) / 6) * 0.3; // 0.2 to 0.5
                              } else {
                                intensity = 0.5 + ((currentScore - 7) / 3) * 0.5; // 0.5 to 1.0
                                isActive = true;
                              }
                            }

                            return { intensity, isActive };
                          };

                          const redStyle = getCardStyle('red');
                          const yellowStyle = getCardStyle('yellow');
                          const greenStyle = getCardStyle('green');

                          return (
                            <div key={behaviorIndex} className="bg-white rounded-lg p-5 border-2 border-gray-200 shadow-md">
                              {/* Behavior Name and Current Score */}
                              <div className="flex items-center justify-between mb-4">
                                <h5 className={`text-base font-bold text-${colorClass}-800`}>
                                  {behavior.name}
                                </h5>
                                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br from-${colorClass}-500 to-${colorClass}-700 flex items-center justify-center shadow-lg border-3 border-white`}>
                                  <span className="text-white text-2xl font-bold">{currentScore}</span>
                                </div>
                              </div>

                              {/* Horizontal Layout: Not Living -> Living -> Role Modeling */}
                              <div className="grid grid-cols-3 gap-3 mb-4">
                                {/* Left: Not Living (Score 1) */}
                                <div
                                  className="rounded-lg p-3 transition-all duration-300 ease-in-out"
                                  style={{
                                    backgroundColor: redStyle.isActive
                                      ? `rgba(254, 226, 226, ${0.3 + redStyle.intensity * 0.7})`
                                      : `rgba(254, 226, 226, ${0.2 + redStyle.intensity * 0.3})`,
                                    borderWidth: redStyle.isActive ? '3px' : '1px',
                                    borderColor: redStyle.isActive
                                      ? `rgba(239, 68, 68, ${0.4 + redStyle.intensity * 0.6})`
                                      : 'rgba(254, 202, 202, 0.5)',
                                    transform: redStyle.isActive ? 'scale(1.08)' : 'scale(1)',
                                    boxShadow: redStyle.isActive
                                      ? `0 4px 20px rgba(239, 68, 68, ${0.2 + redStyle.intensity * 0.3})`
                                      : 'none'
                                  }}
                                >
                                  <div className="flex items-center justify-center mb-2">
                                    <span
                                      className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all duration-300"
                                      style={{
                                        backgroundColor: `rgba(254, 202, 202, ${0.5 + redStyle.intensity * 0.5})`,
                                        color: `rgba(185, 28, 28, ${0.6 + redStyle.intensity * 0.4})`,
                                        fontSize: redStyle.isActive ? '0.95rem' : '0.875rem'
                                      }}
                                    >
                                      1
                                    </span>
                                  </div>
                                  <p
                                    className="text-xs leading-tight text-center transition-all duration-300"
                                    style={{
                                      color: `rgba(185, 28, 28, ${0.6 + redStyle.intensity * 0.4})`,
                                      fontWeight: redStyle.isActive ? 600 : 400
                                    }}
                                  >
                                    {behavior.notLiving}
                                  </p>
                                </div>

                                {/* Middle: Living (Score 5) */}
                                <div
                                  className="rounded-lg p-3 transition-all duration-300 ease-in-out"
                                  style={{
                                    backgroundColor: yellowStyle.isActive
                                      ? `rgba(254, 249, 195, ${0.3 + yellowStyle.intensity * 0.7})`
                                      : `rgba(254, 249, 195, ${0.2 + yellowStyle.intensity * 0.3})`,
                                    borderWidth: yellowStyle.isActive ? '3px' : '1px',
                                    borderColor: yellowStyle.isActive
                                      ? `rgba(234, 179, 8, ${0.4 + yellowStyle.intensity * 0.6})`
                                      : 'rgba(253, 224, 71, 0.5)',
                                    transform: yellowStyle.isActive ? 'scale(1.08)' : 'scale(1)',
                                    boxShadow: yellowStyle.isActive
                                      ? `0 4px 20px rgba(234, 179, 8, ${0.2 + yellowStyle.intensity * 0.3})`
                                      : 'none'
                                  }}
                                >
                                  <div className="flex items-center justify-center mb-2">
                                    <span
                                      className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all duration-300"
                                      style={{
                                        backgroundColor: `rgba(253, 224, 71, ${0.5 + yellowStyle.intensity * 0.5})`,
                                        color: `rgba(161, 98, 7, ${0.6 + yellowStyle.intensity * 0.4})`,
                                        fontSize: yellowStyle.isActive ? '0.95rem' : '0.875rem'
                                      }}
                                    >
                                      5
                                    </span>
                                  </div>
                                  <p
                                    className="text-xs leading-tight text-center transition-all duration-300"
                                    style={{
                                      color: `rgba(161, 98, 7, ${0.6 + yellowStyle.intensity * 0.4})`,
                                      fontWeight: yellowStyle.isActive ? 600 : 400
                                    }}
                                  >
                                    {behavior.living}
                                  </p>
                                </div>

                                {/* Right: Role Modeling (Score 10) */}
                                <div
                                  className="rounded-lg p-3 transition-all duration-300 ease-in-out"
                                  style={{
                                    backgroundColor: greenStyle.isActive
                                      ? `rgba(220, 252, 231, ${0.3 + greenStyle.intensity * 0.7})`
                                      : `rgba(220, 252, 231, ${0.2 + greenStyle.intensity * 0.3})`,
                                    borderWidth: greenStyle.isActive ? '3px' : '1px',
                                    borderColor: greenStyle.isActive
                                      ? `rgba(22, 163, 74, ${0.4 + greenStyle.intensity * 0.6})`
                                      : 'rgba(134, 239, 172, 0.5)',
                                    transform: greenStyle.isActive ? 'scale(1.08)' : 'scale(1)',
                                    boxShadow: greenStyle.isActive
                                      ? `0 4px 20px rgba(22, 163, 74, ${0.2 + greenStyle.intensity * 0.3})`
                                      : 'none'
                                  }}
                                >
                                  <div className="flex items-center justify-center mb-2">
                                    <span
                                      className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all duration-300"
                                      style={{
                                        backgroundColor: `rgba(134, 239, 172, ${0.5 + greenStyle.intensity * 0.5})`,
                                        color: `rgba(21, 128, 61, ${0.6 + greenStyle.intensity * 0.4})`,
                                        fontSize: greenStyle.isActive ? '0.95rem' : '0.875rem'
                                      }}
                                    >
                                      10
                                    </span>
                                  </div>
                                  <p
                                    className="text-xs leading-tight text-center transition-all duration-300"
                                    style={{
                                      color: `rgba(21, 128, 61, ${0.6 + greenStyle.intensity * 0.4})`,
                                      fontWeight: greenStyle.isActive ? 600 : 400
                                    }}
                                  >
                                    {behavior.roleModeling}
                                  </p>
                                </div>
                              </div>

                              {/* Slider */}
                              <div className="space-y-2">
                                <div className="relative">
                                  {/* Dynamic number indicator above slider thumb */}
                                  <div
                                    className="absolute -top-10 transform -translate-x-1/2 transition-all duration-150 ease-out"
                                    style={{
                                      left: `${((currentScore - 1) / 9) * 100}%`
                                    }}
                                  >
                                    <div className="relative">
                                      <div
                                        className="px-3 py-1.5 rounded-lg shadow-lg font-bold text-white text-sm"
                                        style={{ backgroundColor: bgColor }}
                                      >
                                        {currentScore}
                                      </div>
                                      {/* Arrow pointing down */}
                                      <div
                                        className="absolute left-1/2 transform -translate-x-1/2 -bottom-1 w-0 h-0"
                                        style={{
                                          borderLeft: '6px solid transparent',
                                          borderRight: '6px solid transparent',
                                          borderTop: `6px solid ${bgColor}`
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={currentScore}
                                    onChange={(e) => updateScore(Number(e.target.value))}
                                    className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                                    style={{
                                      background: `linear-gradient(to right,
                                        ${bgColor} 0%,
                                        ${bgColor} ${((currentScore - 1) / 9) * 100}%,
                                        #E5E7EB ${((currentScore - 1) / 9) * 100}%,
                                        #E5E7EB 100%)`
                                    }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs font-semibold">
                                  <span className="text-red-600">1 - Not Living</span>
                                  <span className="text-yellow-600">5 - Living</span>
                                  <span className="text-green-600">10 - Role Modeling</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Select two areas to improve */}
              <div className="mt-6 bg-yellow-50 rounded-lg p-5 border-2 border-yellow-200">
                <h4 className="text-sm font-bold text-gray-900 mb-3">
                  Select 2 areas to work on improving {isSelfReview ? '(your focus for next year)' : '(development focus)'}:
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {IMPROVEMENT_AREAS.map((area) => (
                    <button
                      key={area}
                      onClick={() => toggleImprovementArea(area)}
                      disabled={!improvementAreas.includes(area) && improvementAreas.length >= 2}
                      className={`px-4 py-3 rounded-lg text-sm font-medium transition-all border-2 ${
                        improvementAreas.includes(area)
                          ? 'bg-indigo-500 text-white border-indigo-600 shadow-lg'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
                      } ${!improvementAreas.includes(area) && improvementAreas.length >= 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {area}
                      {improvementAreas.includes(area) && (
                        <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-white text-indigo-600 rounded-full text-xs font-bold">
                          {improvementAreas.indexOf(area) + 1}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {improvementAreas.length < 2 && (
                  <p className="mt-3 text-xs text-orange-600 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Please select {2 - improvementAreas.length} more area{2 - improvementAreas.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="surface-card space-y-4">
              <div className="mb-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      Accomplishments, Impact & OKRs
                    </h3>
                    <p className="text-sm text-gray-700 mb-4">
                      {isSelfReview ? (
                        <>
                          What were your top contributions this year, including your delivery on OKRs? How did these
                          accomplishments support team success, and what is your reflection on the OKR process (what
                          worked well, challenges faced, and suggestions for improvement)?
                        </>
                      ) : (
                        <>
                          What were this team member's top contributions this year, including their delivery on OKRs?
                          How did these accomplishments support team success, and what is your assessment of their
                          engagement with the OKR process?
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSectionAssistant('accomplishments')}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:border-blue-400 hover:bg-blue-50"
                >
                  <Mic className="w-4 h-4" />
                  Voice-to-AI helper
                </button>
              </div>

              <textarea
                value={accomplishmentsOKRs}
                onChange={(e) => setAccomplishmentsOKRs(e.target.value)}
                placeholder={isSelfReview ? "Describe your key accomplishments, OKR delivery, and reflections..." : "Describe the team member's key accomplishments, OKR delivery, and engagement..."}
                rows={12}
                className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="text-xs text-gray-500">
                  {accomplishmentsOKRs.length} characters (minimum 50)
                </span>
                {accomplishmentsOKRs.length < 50 && (
                  <span className="text-xs text-orange-600 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Please provide more detail
                  </span>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="surface-card space-y-4">
              <div className="mb-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      Growth & Development
                    </h3>
                    <p className="text-sm text-gray-700 mb-4">
                      {isSelfReview ? (
                        <>
                          Share key lessons learned this year and areas you want to improve. How will you apply these
                          insights moving forward to enhance your contributions?
                        </>
                      ) : (
                        <>
                          Describe the ways you've seen this team member grow this year and areas where they could
                          improve. How would continued development in these areas enhance their impact?
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSectionAssistant('growth')}
                  className="inline-flex items-center gap-2 rounded-full border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-700 shadow-sm hover:border-green-400 hover:bg-green-50"
                >
                  <Mic className="w-4 h-4" />
                  Voice-to-AI helper
                </button>
              </div>

              <textarea
                value={growthDevelopment}
                onChange={(e) => setGrowthDevelopment(e.target.value)}
                placeholder={isSelfReview ? "Share your key learnings and development areas..." : "Describe growth observed and development opportunities..."}
                rows={12}
                className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="text-xs text-gray-500">
                  {growthDevelopment.length} characters (minimum 50)
                </span>
                {growthDevelopment.length < 50 && (
                  <span className="text-xs text-orange-600 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Please provide more detail
                  </span>
                )}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="surface-card space-y-4">
              <div className="mb-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      Support & Feedback
                    </h3>
                    <p className="text-sm text-gray-700 mb-4">
                      {isSelfReview ? (
                        <>
                          What support do you need to accomplish your goals and OKRs in 2026 (e.g., training, mentorship,
                          process clarity)? Please share any challenges that prevented goal and OKR achievement, or
                          suggestions for improving the employee experience.
                        </>
                      ) : (
                        <>
                          What specific support will you provide to help this team member achieve their goals and OKRs
                          and contribute more effectively in 2026? Consider training, mentorship, process clarity, or
                          other resources.
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSectionAssistant('support')}
                  className="inline-flex items-center gap-2 rounded-full border border-purple-300 bg-white px-4 py-2 text-sm font-semibold text-purple-700 shadow-sm hover:border-purple-400 hover:bg-purple-50"
                >
                  <Mic className="w-4 h-4" />
                  Voice-to-AI helper
                </button>
              </div>

              <textarea
                value={supportFeedback}
                onChange={(e) => setSupportFeedback(e.target.value)}
                placeholder={isSelfReview ? "Describe support needed and suggestions..." : "Describe support you'll provide..."}
                rows={12}
                className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="text-xs text-gray-500">
                  {supportFeedback.length} characters (minimum 50)
                </span>
                {supportFeedback.length < 50 && (
                  <span className="text-xs text-orange-600 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Please provide more detail
                  </span>
                )}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            {/* Manager-only: Performance Summary */}
            {!isSelfReview && (
              <div className="surface-card space-y-4">
                <div className="flex items-start space-x-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      Performance Summary
                    </h3>
                    <p className="text-sm text-gray-700 mb-4">
                      How would you evaluate this person's overall performance?
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { value: 'excellence', label: 'Performance sets a new standard of excellence' },
                    { value: 'exceeds', label: 'Performance frequently exceeds expectations' },
                    { value: 'meets', label: 'Performance meets expectations of the position' },
                    { value: 'occasionally_meets', label: 'Performance occasionally meets expectations' },
                    { value: 'not_performing', label: 'Consistently not performing to the expectations of the position' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPerformanceSummary(option.value as any)}
                      className={`w-full px-4 py-3 rounded-lg text-left text-sm font-medium transition-all border-2 ${
                        performanceSummary === option.value
                          ? 'bg-orange-500 text-white border-orange-600 shadow-lg'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-orange-300 hover:bg-orange-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Comments */}
            <div className="surface-card space-y-4">
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-10 h-10 bg-gray-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Additional Comments
                  </h3>
                  <p className="text-sm text-gray-700 mb-4">
                    {isSelfReview
                      ? 'Is there anything else you wish to share?'
                      : 'Is there anything else you would like to share with this team member about their performance?'
                    }
                  </p>
                </div>
              </div>

              <textarea
                value={isSelfReview ? selfComments : managerComments}
                onChange={(e) => isSelfReview ? setSelfComments(e.target.value) : setManagerComments(e.target.value)}
                placeholder="Add any additional comments or context..."
                rows={8}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 bg-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-1">
                General Performance Review 2025
              </h2>
              <p className="text-sm text-gray-500">
                {isSelfReview ? 'Self-Reflection' : 'Manager Review'} for{' '}
                <EmployeeNameLink
                  employee={employee}
                  className="font-semibold text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
                  onClick={(event) => event.stopPropagation()}
                />
              </p>
              <div className="mt-3 flex items-center space-x-2">
                <div className="flex items-center">
                  {isSelfReview ? <User className="w-4 h-4 mr-1 text-gray-500" /> : <Users className="w-4 h-4 mr-1 text-gray-500" />}
                  <span className="text-sm font-medium text-gray-600">
                    {isSelfReview ? 'Self-Assessment' : `Manager: ${currentUserName}`}
                  </span>
                </div>
                {status === 'submitted' && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    ✓ SUBMITTED
                  </span>
                )}
                {!isSelfReview && status !== 'submitted' && (
                  <button
                    onClick={() => setShowAIDraftModal(true)}
                    className="flex items-center space-x-1 px-3 py-1 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-semibold hover:bg-indigo-50 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Draft</span>
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-sm text-gray-600">
              {Math.round((currentStep / totalSteps) * 100)}% Complete
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-xs">
            <button
              onClick={() => setCurrentStep(1)}
              className={`transition-colors hover:text-indigo-500 ${
                currentStep === 1 ? 'text-indigo-600 font-semibold' : 'text-gray-500'
              }`}
            >
              Team Player
            </button>
            <button
              onClick={() => setCurrentStep(2)}
              className={`transition-colors hover:text-indigo-500 ${
                currentStep === 2 ? 'text-indigo-600 font-semibold' : 'text-gray-500'
              }`}
            >
              Accomplishments
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className={`transition-colors hover:text-indigo-500 ${
                currentStep === 3 ? 'text-indigo-600 font-semibold' : 'text-gray-500'
              }`}
            >
              Growth
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className={`transition-colors hover:text-indigo-500 ${
                currentStep === 4 ? 'text-indigo-600 font-semibold' : 'text-gray-500'
              }`}
            >
              Support
            </button>
            <button
              onClick={() => setCurrentStep(5)}
              className={`transition-colors hover:text-indigo-500 ${
                currentStep === 5 ? 'text-indigo-600 font-semibold' : 'text-gray-500'
              }`}
            >
              Summary
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDraft}
              className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Save className="w-4 h-4 inline mr-2" />
              Save Draft
            </button>
          </div>

          <div className="flex space-x-2">
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 bg-white text-indigo-600 border-2 border-indigo-300 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 inline mr-1" />
                Previous
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed()}
                className="btn-primary flex items-center gap-1 px-5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4 inline ml-1" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Save className="w-5 h-5 inline mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 inline mr-2" />
                    Submit Review
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {activeSectionAssistant && (
        <ReviewSectionAIAssistant
          isOpen={true}
          onClose={() => setActiveSectionAssistant(null)}
          section={activeSectionAssistant}
          sectionLabel={
            activeSectionAssistant === 'accomplishments'
              ? 'Accomplishments, Impact & OKRs'
              : activeSectionAssistant === 'growth'
                ? 'Growth & Development'
                : 'Support & Feedback'
          }
          employee={employee}
          reviewerName={currentUserName}
          reviewType={reviewType}
          existingText={
            activeSectionAssistant === 'accomplishments'
              ? accomplishmentsOKRs
              : activeSectionAssistant === 'growth'
                ? growthDevelopment
                : supportFeedback
          }
          onApplyDraft={(value) => {
            if (activeSectionAssistant === 'accomplishments') {
              setAccomplishmentsOKRs(value);
            } else if (activeSectionAssistant === 'growth') {
              setGrowthDevelopment(value);
            } else {
              setSupportFeedback(value);
            }
          }}
        />
      )}

      {/* AI Draft Review Modal */}
      {showAIDraftModal && (
        <AIDraftReviewModal
          isOpen={showAIDraftModal}
          onClose={() => setShowAIDraftModal(false)}
          employee={employee}
          managerName={currentUserName}
          onReviewDrafted={(draftedReview) => {
            // Populate the form fields with AI-generated content
            setAccomplishmentsOKRs(draftedReview);
            setShowAIDraftModal(false);
          }}
        />
      )}
    </div>
  );
}
