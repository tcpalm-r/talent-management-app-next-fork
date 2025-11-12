/**
 * Tests for /api/360-default-questions route
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { promises as fs } from 'fs';
import path from 'path';

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

describe('/api/360-default-questions', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/360-default-questions', () => {
    it('should return saved settings from file', async () => {
      const savedSettings = {
        defaultQuestionIds: ['q1', 'q2', 'q3'],
        customQuestions: { custom1: 'Custom question 1' },
        updatedAt: '2024-01-15T10:00:00Z',
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(savedSettings));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        defaultQuestionIds: ['q1', 'q2', 'q3'],
        customQuestions: { custom1: 'Custom question 1' },
      });
    });

    it('should return default questions when file does not exist', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: file not found'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.defaultQuestionIds).toEqual([
        'impact-biggest-impact',
        'growth-stop',
        'growth-start',
      ]);
      expect(data.customQuestions).toEqual({});
    });

    it('should return defaults when file contains invalid JSON', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('invalid json{');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.defaultQuestionIds).toEqual([
        'impact-biggest-impact',
        'growth-stop',
        'growth-start',
      ]);
    });

    it('should return defaults when file has wrong number of questions', async () => {
      const invalidSettings = {
        defaultQuestionIds: ['q1', 'q2'], // Only 2 questions
        customQuestions: {},
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidSettings));

      const response = await GET();
      const data = await response.json();

      expect(data.defaultQuestionIds).toEqual([
        'impact-biggest-impact',
        'growth-stop',
        'growth-start',
      ]);
    });

    it('should return defaults when defaultQuestionIds is not an array', async () => {
      const invalidSettings = {
        defaultQuestionIds: 'not-an-array',
        customQuestions: {},
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidSettings));

      const response = await GET();
      const data = await response.json();

      expect(data.defaultQuestionIds).toEqual([
        'impact-biggest-impact',
        'growth-stop',
        'growth-start',
      ]);
    });

    it('should create data directory if it does not exist', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      await GET();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(process.cwd(), 'data'),
        { recursive: true }
      );
    });

    it('should handle mkdir errors gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.defaultQuestionIds).toBeDefined();
    });

    it('should include empty customQuestions when not in file', async () => {
      const settingsWithoutCustom = {
        defaultQuestionIds: ['q1', 'q2', 'q3'],
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(settingsWithoutCustom));

      const response = await GET();
      const data = await response.json();

      expect(data.customQuestions).toEqual({});
    });
  });

  describe('POST /api/360-default-questions', () => {
    const createMockRequest = (body: any): any => {
      // Minimal mock that satisfies NextRequest interface
      return {
        url: 'http://localhost:3004/api/360-default-questions',
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        cookies: {
          get: jest.fn(),
          getAll: jest.fn(),
          set: jest.fn(),
          delete: jest.fn(),
        },
        json: jest.fn().mockResolvedValue(body),
      };
    };

    it('should save valid question IDs', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const requestBody = {
        defaultQuestionIds: ['q1', 'q2', 'q3'],
        customQuestions: { custom1: 'Question 1' },
      };

      const request = createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.defaultQuestionIds).toEqual(['q1', 'q2', 'q3']);
      expect(data.customQuestions).toEqual({ custom1: 'Question 1' });
    });

    it('should write to correct file path', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const requestBody = {
        defaultQuestionIds: ['q1', 'q2', 'q3'],
        customQuestions: {},
      };

      const request = createMockRequest(requestBody);
      await POST(request);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'data', '360-default-questions.json'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should include timestamp in saved data', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const requestBody = {
        defaultQuestionIds: ['q1', 'q2', 'q3'],
        customQuestions: {},
      };

      const request = createMockRequest(requestBody);
      await POST(request);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData).toHaveProperty('updatedAt');
      expect(writtenData.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should return 400 when not exactly 3 questions', async () => {
      const requestBody = {
        defaultQuestionIds: ['q1', 'q2'], // Only 2
        customQuestions: {},
      };

      const request = createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Must provide exactly 3 question IDs');
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should return 400 when defaultQuestionIds is not an array', async () => {
      const requestBody = {
        defaultQuestionIds: 'not-an-array',
        customQuestions: {},
      };

      const request = createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Must provide exactly 3 question IDs');
    });

    it('should return 400 with too many questions', async () => {
      const requestBody = {
        defaultQuestionIds: ['q1', 'q2', 'q3', 'q4'],
        customQuestions: {},
      };

      const request = createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Must provide exactly 3 question IDs');
    });

    it('should handle missing customQuestions gracefully', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const requestBody = {
        defaultQuestionIds: ['q1', 'q2', 'q3'],
      };

      const request = createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // When customQuestions is missing, the response may have undefined or empty object
      expect(data.customQuestions === undefined || Object.keys(data.customQuestions || {}).length === 0).toBe(true);
    });

    it('should return 500 when file write fails', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      const requestBody = {
        defaultQuestionIds: ['q1', 'q2', 'q3'],
        customQuestions: {},
      };

      const request = createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should format JSON with proper indentation', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const requestBody = {
        defaultQuestionIds: ['q1', 'q2', 'q3'],
        customQuestions: { custom1: 'Test' },
      };

      const request = createMockRequest(requestBody);
      await POST(request);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenJson = writeCall[1] as string;

      // Check that JSON is formatted (has newlines and indentation)
      expect(writtenJson).toContain('\n');
      expect(writtenJson).toContain('  ');
    });

    it('should create data directory before writing', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const requestBody = {
        defaultQuestionIds: ['q1', 'q2', 'q3'],
        customQuestions: {},
      };

      const request = createMockRequest(requestBody);
      await POST(request);

      // Both mkdir and writeFile should be called
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle empty customQuestions object', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const requestBody = {
        defaultQuestionIds: ['q1', 'q2', 'q3'],
        customQuestions: {},
      };

      const request = createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.customQuestions).toEqual({});
    });

    it('should handle multiple custom questions', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const requestBody = {
        defaultQuestionIds: ['q1', 'q2', 'q3'],
        customQuestions: {
          custom1: 'Question 1',
          custom2: 'Question 2',
          custom3: 'Question 3',
        },
      };

      const request = createMockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Object.keys(data.customQuestions)).toHaveLength(3);
    });
  });
});
