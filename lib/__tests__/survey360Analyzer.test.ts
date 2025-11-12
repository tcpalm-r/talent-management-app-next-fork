/**
 * Tests for survey360Analyzer.ts - 360 Survey Analysis
 */

import { mock360Survey, mock360Responses, mock360Reviewers, createMock360Survey } from '../../test-utils/mockData';

// Mock Anthropic SDK
const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  }));
});

import {
  analyzeSurvey360Responses,
  getDefault360Questions,
} from '../survey360Analyzer';

// Import Anthropic after mocking to get the mock instance
import Anthropic from '@anthropic-ai/sdk';

describe('survey360Analyzer.ts - Survey Analysis', () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mock instance
    const AnthropicInstance = new Anthropic({ apiKey: 'test' });
    mockCreate = AnthropicInstance.messages.create as jest.Mock;
  });

  describe('analyzeSurvey360Responses', () => {
    const mockSurvey = {
      ...mock360Survey,
      employee_name: 'John Doe',
      survey_title: 'Q1 2024 360 Review',
    };

    const mockQuestions = [
      { id: 'q1', question: 'What are their strengths?', type: 'text' as const, required: true },
      { id: 'q2', question: 'What could they improve?', type: 'text' as const, required: true },
    ];

    const mockResponses = [
      {
        id: 'r1',
        survey_id: mockSurvey.id,
        participant_id: 'p1',
        responses: {
          q1: 'Great communication skills',
          q2: 'Time management needs work',
        },
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockParticipants = [
      {
        id: 'p1',
        survey_id: mockSurvey.id,
        participant_name: 'Peer One',
        participant_email: 'peer1@test.com',
        relationship: 'peer' as const,
        status: 'completed' as const,
        access_token: 'token1',
        invited_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ];

    const mockAnalysisFromClaude = {
      themes: [
        {
          theme: 'Strong Communication',
          sentiment: 'very_positive' as const,
          supporting_evidence: ['Excellent at conveying ideas', 'Clear and concise'],
          relationships_mentioned: ['peer' as const],
        },
      ],
      overall_strengths: ['Communication', 'Collaboration'],
      development_areas: ['Time management', 'Prioritization'],
      recommendations: ['Take time management course', 'Use project tracking tools'],
      sentiment_by_relationship: {
        overall: 0.75,
        peer: 0.8,
      },
      key_insights: ['Strong collaborator', 'Needs structure'],
      consensus_areas: ['Communication is excellent'],
      outlier_opinions: ['Some feedback on delegation'],
    };

    // Expected response includes survey_id, generated_by, and generated_at
    const expectedResponse = {
      survey_id: mockSurvey.id,
      ...mockAnalysisFromClaude,
      generated_by: 'claude-sonnet-4-20250514',
      generated_at: expect.any(String),
    };

    it('should successfully analyze survey responses', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: JSON.stringify(mockAnalysisFromClaude),
        }],
      });

      const result = await analyzeSurvey360Responses({
        survey: mockSurvey as any,
        responses: mockResponses as any,
        participants: mockParticipants as any,
        questions: mockQuestions as any,
      });

      expect(result).toMatchObject(expectedResponse);
      expect(result.survey_id).toBe(mockSurvey.id);
      expect(result.generated_by).toBe('claude-sonnet-4-20250514');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          temperature: 0.3,
        })
      );
    });

    it('should handle softer tone parameter', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: JSON.stringify(mockAnalysisFromClaude),
        }],
      });

      const result = await analyzeSurvey360Responses({
        survey: mockSurvey as any,
        responses: mockResponses as any,
        participants: mockParticipants as any,
        questions: mockQuestions as any,
        tone: 'softer',
      });

      expect(result).toBeDefined();
      expect(result.survey_id).toBe(mockSurvey.id);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle standard tone parameter', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: JSON.stringify(mockAnalysisFromClaude),
        }],
      });

      const result = await analyzeSurvey360Responses({
        survey: mockSurvey as any,
        responses: mockResponses as any,
        participants: mockParticipants as any,
        questions: mockQuestions as any,
        tone: 'standard',
      });

      expect(result).toBeDefined();
      expect(result.survey_id).toBe(mockSurvey.id);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle markdown code blocks in response', async () => {
      const responseWithMarkdown = `\`\`\`json\n${JSON.stringify(mockAnalysisFromClaude)}\n\`\`\``;

      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: responseWithMarkdown,
        }],
      });

      const result = await analyzeSurvey360Responses({
        survey: mockSurvey as any,
        responses: mockResponses as any,
        participants: mockParticipants as any,
        questions: mockQuestions as any,
      });

      expect(result).toMatchObject(expectedResponse);
    });

    it('should return fallback analysis on invalid JSON response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: 'This is not valid JSON',
        }],
      });

      // The function catches errors and returns fallback analysis
      const result = await analyzeSurvey360Responses({
        survey: mockSurvey as any,
        responses: mockResponses as any,
        participants: mockParticipants as any,
        questions: mockQuestions as any,
      });

      expect(result).toBeDefined();
      expect(result.survey_id).toBe(mockSurvey.id);
      expect(result.development_areas).toContain('Detailed analysis requires AI processing');
    });

    it('should return fallback when response type is not text', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'image',
        }],
      });

      const result = await analyzeSurvey360Responses({
        survey: mockSurvey as any,
        responses: mockResponses as any,
        participants: mockParticipants as any,
        questions: mockQuestions as any,
      });

      expect(result).toBeDefined();
      expect(result.development_areas).toContain('Detailed analysis requires AI processing');
    });

    it('should return fallback on API errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeSurvey360Responses({
        survey: mockSurvey as any,
        responses: mockResponses as any,
        participants: mockParticipants as any,
        questions: mockQuestions as any,
      });

      expect(result).toBeDefined();
      expect(result.survey_id).toBe(mockSurvey.id);
    });

    it('should analyze survey with employee info', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: JSON.stringify(mockAnalysisFromClaude),
        }],
      });

      const result = await analyzeSurvey360Responses({
        survey: mockSurvey as any,
        responses: mockResponses as any,
        participants: mockParticipants as any,
        questions: mockQuestions as any,
      });

      expect(result).toBeDefined();
      expect(result.themes).toHaveLength(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.any(String),
            }),
          ]),
        })
      );
    });

    it('should handle multiple responses', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: JSON.stringify(mockAnalysisFromClaude),
        }],
      });

      const multipleResponses = [mockResponses[0], { ...mockResponses[0], id: 'r2' }];

      const result = await analyzeSurvey360Responses({
        survey: mockSurvey as any,
        responses: multipleResponses as any,
        participants: mockParticipants as any,
        questions: mockQuestions as any,
      });

      expect(result).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDefault360Questions', () => {
    it('should return an array of default questions', () => {
      const questions = getDefault360Questions();

      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });

    it('should return questions with required properties', () => {
      const questions = getDefault360Questions();

      questions.forEach(q => {
        expect(q).toHaveProperty('id');
        expect(q).toHaveProperty('question');
        expect(q).toHaveProperty('type');
        expect(q).toHaveProperty('required');
      });
    });

    it('should return consistent results', () => {
      const questions1 = getDefault360Questions();
      const questions2 = getDefault360Questions();

      expect(questions1).toEqual(questions2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle survey with no responses', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: JSON.stringify({
            themes: [],
            overall_strengths: [],
            development_areas: [],
            recommendations: [],
            sentiment_by_relationship: { overall: 0.5 },
            key_insights: ['No responses to analyze'],
            consensus_areas: [],
            outlier_opinions: [],
          }),
        }],
      });

      const mockSurvey = createMock360Survey();

      const result = await analyzeSurvey360Responses({
        survey: mockSurvey as any,
        responses: [],
        participants: [],
        questions: [],
      });

      expect(result).toBeDefined();
      expect(result.survey_id).toBe(mockSurvey.id);
    });

    it('should handle very large number of responses', async () => {
      const largeResponseSet = Array.from({ length: 100 }, (_, i) => ({
        id: `r${i}`,
        survey_id: 'survey-1',
        participant_id: `p${i}`,
        responses: { q1: `Response ${i}` },
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: JSON.stringify({
            themes: [{ theme: 'Test', sentiment: 'positive', supporting_evidence: [], relationships_mentioned: [] }],
            overall_strengths: ['Strength'],
            development_areas: ['Area'],
            recommendations: ['Rec'],
            sentiment_by_relationship: { overall: 0.8 },
            key_insights: ['Insight'],
            consensus_areas: ['Consensus'],
            outlier_opinions: [],
          }),
        }],
      });

      const result = await analyzeSurvey360Responses({
        survey: createMock360Survey() as any,
        responses: largeResponseSet as any,
        participants: [],
        questions: [],
      });

      expect(result).toBeDefined();
      expect(result.themes).toHaveLength(1);
    });
  });
});
