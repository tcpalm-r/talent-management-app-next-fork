/**
 * @deprecated This component is no longer used in the main navigation.
 * Subject report viewing is now handled by the "My 360 Feedback" tab in Feedback360Dashboard.
 * This file is kept for reference and potential future use.
 */
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { FileText, Download, Eye, Calendar, X } from 'lucide-react';
import type { Employee } from '../types';
import { useToast, Tooltip, TooltipProvider } from './unified';
import NavigationTabs from './unified/NavigationTabs';
import { exportReportAsPDF } from '../lib/exportReport';

interface MyReportDashboardProps {
  currentUser?: Employee;
  organizationId: string;
}

// Helper to extract text from cited items (can be string or {text, citations} object)
type CitedItem = string | { text: string; citations?: any[] };
const getStatementText = (item: CitedItem): string => {
  if (typeof item === 'string') {
    // Check if it's a JSON string that needs parsing
    if (item.startsWith('{') && item.includes('"text"')) {
      try {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object' && 'text' in parsed) {
          return parsed.text;
        }
      } catch {
        // Not valid JSON, return as-is
      }
    }
    return item;
  }
  if (item && typeof item === 'object' && 'text' in item) {
    return item.text;
  }
  return String(item);
};

interface Survey {
  id: string;
  survey_name: string | null;
  status: string | null;
  due_date: string | null;
  created_at: string | null;
  employee_id: string;
  employee?: Employee;
  completed_at?: string | null;
  finalized_at?: string | null;
}

export default function MyReportDashboard({
  currentUser,
  organizationId
}: MyReportDashboardProps) {
  const { notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [finalizedSurveys, setFinalizedSurveys] = useState<Survey[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [surveyResults, setSurveyResults] = useState<any>(null);
  const [isViewingReport, setIsViewingReport] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<string>('themes');
  const [finalNarrative, setFinalNarrative] = useState<string>('');

  useEffect(() => {
    loadFinalizedReports();
  }, [currentUser?.id, organizationId]);

  const loadFinalizedReports = async () => {
    if (!currentUser?.id) return;

    setLoading(true);
    try {
      // Fetch surveys where current user is the subject and status is 'finalized'
      const response = await fetch(`/api/surveys/list?organization_id=${organizationId}`);
      if (!response.ok) {
        throw new Error('Failed to load surveys');
      }

      const data = await response.json();

      // Filter for finalized surveys where current user is the subject
      const myFinalizedSurveys = data.surveys.filter((survey: Survey) =>
        survey.employee_id === currentUser.id &&
        survey.status === 'finalized'
      );

      setFinalizedSurveys(myFinalizedSurveys);
    } catch (error: any) {
      console.error('Error loading finalized reports:', error);
      notify({
        title: 'Error',
        description: 'Failed to load your reports. Please try again.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const viewReport = async (survey: Survey) => {
    try {
      setSelectedSurvey(survey);
      setIsViewingReport(true);

      // Fetch the report data and survey details in parallel
      const [reportResponse, surveyDetailsResponse] = await Promise.all([
        fetch(`/api/360-generate-report?survey_id=${survey.id}`),
        fetch(`/api/surveys/${survey.id}/details`)
      ]);

      if (!reportResponse.ok) {
        throw new Error('Failed to load report');
      }

      const data = await reportResponse.json();
      setSurveyResults(data.report);

      // Get final_narrative from report (consolidated in feedback_360_reports table)
      setFinalNarrative(data.report?.final_narrative || '');

      setActiveReportTab('narrative');
    } catch (error: any) {
      console.error('Error loading report:', error);
      notify({
        title: 'Error',
        description: 'Failed to load report. Please try again.',
        variant: 'error',
      });
    }
  };

  const closeReportView = () => {
    setIsViewingReport(false);
    setSelectedSurvey(null);
    setSurveyResults(null);
    setFinalNarrative('');
    setActiveReportTab('narrative');
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Loading your reports...</p>
        </div>
      </div>
    );
  }

  if (isViewingReport && surveyResults && selectedSurvey) {
    // Define tabs
    const reportTabs = [
      { id: 'narrative', label: 'Narrative' },
      { id: 'themes', label: 'Themes' },
      { id: 'strengths', label: 'Strengths' },
      { id: 'development', label: 'Development Areas' },
      ...(surveyResults.key_insights && surveyResults.key_insights.length > 0 ? [{ id: 'insights', label: 'Insights' }] : []),
      { id: 'recommendations', label: 'Recommended Actions' },
    ];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-md max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedSurvey.survey_name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Generated on {new Date(surveyResults.generated_at || Date.now()).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <button
                  onClick={async () => {
                    // Check if narrative has been generated
                    if (!finalNarrative) {
                      notify({
                        title: 'Narrative Required',
                        description: 'The narrative has not been generated for this report yet.',
                        variant: 'error',
                      });
                      setActiveReportTab('narrative');
                      return;
                    }

                    try {
                      const reportData = {
                        survey_name: selectedSurvey.survey_name || 'Untitled Survey',
                        employee_name: currentUser?.name || '',
                        generated_by: surveyResults.generated_by,
                        generated_at: surveyResults.generated_at,
                        executive_summary: surveyResults.executive_summary,
                        final_narrative: finalNarrative,
                        themes: surveyResults.themes,
                        overall_strengths: surveyResults.overall_strengths,
                        development_areas: surveyResults.development_areas,
                        recommendations: surveyResults.recommendations,
                        key_insights: surveyResults.key_insights,
                        // Subject viewing their own report - only show overall sentiment
                        sentiment_by_relationship: {
                          overall: surveyResults.sentiment_by_relationship?.overall || 0
                        },
                        // Remove consensus and outlier sections for subject view
                        consensus_areas: [],
                        outlier_opinions: []
                      };

                      const filename = await exportReportAsPDF(reportData);
                      notify({
                        title: 'Success',
                        description: `Report exported as ${filename}`,
                        variant: 'success',
                      });
                    } catch (error) {
                      console.error('Error exporting PDF:', error);
                      notify({
                        title: 'Error',
                        description: 'Failed to export PDF',
                        variant: 'error',
                      });
                    }
                  }}
                  className="text-blue-600 hover:text-blue-800 transition-colors font-medium flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </button>
                <button
                  onClick={closeReportView}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tabs Navigation */}
            <NavigationTabs
              tabs={reportTabs}
              activeTab={activeReportTab}
              onTabChange={setActiveReportTab}
              variant="underline"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[500px]">
            {/* Themes Tab */}
            {activeReportTab === 'themes' && surveyResults.themes && surveyResults.themes.length > 0 && (
              <div className="space-y-3">
                {surveyResults.themes.map((theme: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-md p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium text-gray-900 dark:text-gray-100">{theme.theme}</h5>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        theme.sentiment === 'very_positive' ? 'bg-emerald-100 text-emerald-700' :
                        theme.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                        theme.sentiment === 'mixed' ? 'bg-yellow-100 text-yellow-700' :
                        theme.sentiment === 'needs_work' ? 'bg-orange-100 text-orange-700' :
                        theme.sentiment === 'critical' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {theme.sentiment === 'very_positive' ? 'Very Positive' :
                         theme.sentiment === 'positive' ? 'Positive' :
                         theme.sentiment === 'mixed' ? 'Mixed' :
                         theme.sentiment === 'needs_work' ? 'Needs Work' :
                         theme.sentiment === 'critical' ? 'Critical' :
                         theme.sentiment}
                      </span>
                    </div>
                    {theme.supporting_evidence && theme.supporting_evidence.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {theme.supporting_evidence.map((evidence: string, qIdx: number) => (
                          <p key={qIdx} className="text-sm text-gray-600 dark:text-gray-400 pl-3 border-l-2 border-gray-300 dark:border-gray-600">
                            {evidence}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Strengths Tab */}
            {activeReportTab === 'strengths' && surveyResults.overall_strengths && surveyResults.overall_strengths.length > 0 && (
              <ul className="space-y-1">
                {surveyResults.overall_strengths.map((strength: CitedItem, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 rounded-md p-2">
                    <span className="text-green-600 dark:text-green-400 mt-1">•</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {getStatementText(strength)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Development Areas Tab */}
            {activeReportTab === 'development' && surveyResults.development_areas && surveyResults.development_areas.length > 0 && (
              <ul className="space-y-1">
                {surveyResults.development_areas.map((area: CitedItem, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 rounded-md p-2">
                    <span className="text-amber-600 dark:text-amber-400 mt-1">•</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {getStatementText(area)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Insights Tab */}
            {activeReportTab === 'insights' && surveyResults.key_insights && surveyResults.key_insights.length > 0 && (
              <div className="space-y-3">
                {surveyResults.key_insights.map((insight: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-md p-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{insight.insight || insight}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations Tab */}
            {activeReportTab === 'recommendations' && surveyResults.recommendations && surveyResults.recommendations.length > 0 && (
              <div>
                <div className="mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Recommended Actions
                  </h4>
                </div>
                <ul className="space-y-3">
                  {surveyResults.recommendations.map((rec: CitedItem, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-gray-400 dark:text-gray-500 font-medium text-sm flex-shrink-0 mt-0.5">{idx + 1}.</span>
                      <span className="text-gray-700 dark:text-gray-300">{getStatementText(rec)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Narrative Tab */}
            {activeReportTab === 'narrative' && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-6">
                {finalNarrative ? (
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{finalNarrative}</div>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No narrative available for this report.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Performance Review</h1>
          </div>
        </div>

        {/* 360° Review Report Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">My 360° Feedback</h2>
          {finalizedSurveys.length === 0 ? (
            <Tooltip
              content="When all your 360 feedback is processed and your supervisor finalizes the report it will show up here"
              side="bottom"
            >
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-help">
                <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No reports yet</p>
              </div>
            </Tooltip>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {finalizedSurveys.map((survey) => (
              <div
                key={survey.id}
                className="border border-gray-200 dark:border-gray-700 rounded-md p-5 hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {survey.survey_name || 'Untitled Survey'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3 h-3" />
                      <span>
                        Completed {survey.completed_at ? new Date(survey.completed_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                    Finalized
                  </span>
                </div>

                <button
                  onClick={() => viewReport(survey)}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  View Report
                </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
