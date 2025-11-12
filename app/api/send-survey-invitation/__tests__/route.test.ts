/**
 * Tests for /api/send-survey-invitation route
 */

import { POST } from '../route';

// Mock Resend
const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

// Mock Supabase
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('POST /api/send-survey-invitation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up environment variables
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: 'test-api-key',
      RESEND_FROM_EMAIL: 'feedback@test.com',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3001',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    };

    // Default mock chain setup
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle, update: mockUpdate });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockRequest = (body: any): any => {
    return {
      url: 'http://localhost:3004/api/send-survey-invitation',
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: jest.fn().mockResolvedValue(body),
    };
  };

  it('should send survey invitation successfully', async () => {
    const mockSurvey = {
      id: 'survey-1',
      survey_name: 'Q1 2024 Review',
      employee_id: 'emp-1',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const mockReviewer = {
      id: 'reviewer-1',
      reviewer_name: 'John Doe',
      reviewer_email: 'john@test.com',
      relationship: 'peer',
      access_token: 'access-token-123',
    };

    const mockEmployee = {
      name: 'Jane Smith',
      email: 'jane@test.com',
    };

    // Setup Supabase mocks
    mockSingle
      .mockResolvedValueOnce({ data: mockSurvey, error: null }) // survey query
      .mockResolvedValueOnce({ data: mockReviewer, error: null }) // reviewer query
      .mockResolvedValueOnce({ data: mockEmployee, error: null }); // employee query

    mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({}) });

    // Setup Resend mock
    mockSend.mockResolvedValue({
      data: { id: 'email-123' },
      error: null,
    });

    const request = createMockRequest({
      surveyId: 'survey-1',
      reviewerId: 'reviewer-1',
      isReminder: false,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.messageId).toBe('email-123');
    expect(data.reviewerEmail).toBe('john@test.com');
    expect(mockSend).toHaveBeenCalled();
  });

  it('should return 500 when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;

    const request = createMockRequest({
      surveyId: 'survey-1',
      reviewerId: 'reviewer-1',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Email service not configured');
    expect(data.details).toContain('RESEND_API_KEY');
  });

  it('should return 500 when RESEND_API_KEY is placeholder', async () => {
    process.env.RESEND_API_KEY = 'placeholder-key';

    const request = createMockRequest({
      surveyId: 'survey-1',
      reviewerId: 'reviewer-1',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Email service not configured');
  });

  it('should return 500 when RESEND_FROM_EMAIL is not set', async () => {
    delete process.env.RESEND_FROM_EMAIL;

    const request = createMockRequest({
      surveyId: 'survey-1',
      reviewerId: 'reviewer-1',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Email service not configured');
    expect(data.details).toContain('RESEND_FROM_EMAIL');
  });

  it('should return 400 when surveyId is missing', async () => {
    const request = createMockRequest({
      reviewerId: 'reviewer-1',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing surveyId or reviewerId');
  });

  it('should return 400 when reviewerId is missing', async () => {
    const request = createMockRequest({
      surveyId: 'survey-1',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing surveyId or reviewerId');
  });

  it('should return 404 when survey not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const request = createMockRequest({
      surveyId: 'nonexistent',
      reviewerId: 'reviewer-1',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Survey not found');
  });

  it('should return 404 when reviewer not found', async () => {
    const mockSurvey = {
      id: 'survey-1',
      survey_name: 'Test Survey',
    };

    mockSingle
      .mockResolvedValueOnce({ data: mockSurvey, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const request = createMockRequest({
      surveyId: 'survey-1',
      reviewerId: 'nonexistent',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Reviewer not found');
  });

  it('should include reminder formatting when isReminder is true', async () => {
    const mockSurvey = {
      id: 'survey-1',
      survey_name: 'Test Survey',
      employee_id: 'emp-1',
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
    };

    const mockReviewer = {
      id: 'reviewer-1',
      reviewer_name: 'John Doe',
      reviewer_email: 'john@test.com',
      relationship: 'peer',
      access_token: 'token-123',
    };

    const mockEmployee = { name: 'Jane Smith', email: 'jane@test.com' };

    mockSingle
      .mockResolvedValueOnce({ data: mockSurvey, error: null })
      .mockResolvedValueOnce({ data: mockReviewer, error: null })
      .mockResolvedValueOnce({ data: mockEmployee, error: null });

    mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({}) });

    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });

    const request = createMockRequest({
      surveyId: 'survey-1',
      reviewerId: 'reviewer-1',
      isReminder: true,
    });

    await POST(request);

    const emailCall = mockSend.mock.calls[0][0];
    expect(emailCall.subject).toContain('Reminder');
    expect(emailCall.subject).toContain('2 days');
    expect(emailCall.html).toContain('⏰');
  });

  it('should calculate days remaining correctly', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);

    const mockSurvey = {
      id: 'survey-1',
      survey_name: 'Test Survey',
      employee_id: 'emp-1',
      due_date: dueDate.toISOString(),
    };

    const mockReviewer = {
      id: 'reviewer-1',
      reviewer_name: 'John Doe',
      reviewer_email: 'john@test.com',
      access_token: 'token-123',
    };

    const mockEmployee = { name: 'Jane Smith', email: 'jane@test.com' };

    mockSingle
      .mockResolvedValueOnce({ data: mockSurvey, error: null })
      .mockResolvedValueOnce({ data: mockReviewer, error: null })
      .mockResolvedValueOnce({ data: mockEmployee, error: null });

    mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({}) });
    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });

    const request = createMockRequest({
      surveyId: 'survey-1',
      reviewerId: 'reviewer-1',
      isReminder: true,
    });

    await POST(request);

    const emailCall = mockSend.mock.calls[0][0];
    expect(emailCall.subject).toMatch(/\d+ day/);
  });

  it('should update reviewer with email_sent_at on success', async () => {
    const mockSurvey = {
      id: 'survey-1',
      survey_name: 'Test',
      employee_id: 'emp-1',
    };

    const mockReviewer = {
      id: 'reviewer-1',
      reviewer_email: 'john@test.com',
      access_token: 'token-123',
    };

    const mockEmployee = { name: 'Jane', email: 'jane@test.com' };

    mockSingle
      .mockResolvedValueOnce({ data: mockSurvey, error: null })
      .mockResolvedValueOnce({ data: mockReviewer, error: null })
      .mockResolvedValueOnce({ data: mockEmployee, error: null });

    const mockUpdateEq = jest.fn().mockResolvedValue({});
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });

    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });

    const request = createMockRequest({
      surveyId: 'survey-1',
      reviewerId: 'reviewer-1',
    });

    await POST(request);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        email_sent_at: expect.any(String),
        email_error: null,
      })
    );
  });

  it('should handle Resend API errors gracefully', async () => {
    const mockSurvey = {
      id: 'survey-1',
      survey_name: 'Test',
      employee_id: 'emp-1',
    };

    const mockReviewer = {
      id: 'reviewer-1',
      reviewer_email: 'john@test.com',
      access_token: 'token-123',
    };

    const mockEmployee = { name: 'Jane', email: 'jane@test.com' };

    mockSingle
      .mockResolvedValueOnce({ data: mockSurvey, error: null })
      .mockResolvedValueOnce({ data: mockReviewer, error: null })
      .mockResolvedValueOnce({ data: mockEmployee, error: null });

    mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({}) });

    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Domain not verified' },
    });

    const request = createMockRequest({
      surveyId: 'survey-1',
      reviewerId: 'reviewer-1',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to send email');
    expect(data.details).toContain('Domain not verified');
  });

  it('should include survey URL in email with access token', async () => {
    const mockSurvey = {
      id: 'survey-1',
      survey_name: 'Test',
      employee_id: 'emp-1',
    };

    const mockReviewer = {
      id: 'reviewer-1',
      reviewer_email: 'john@test.com',
      access_token: 'unique-token-456',
    };

    const mockEmployee = { name: 'Jane', email: 'jane@test.com' };

    mockSingle
      .mockResolvedValueOnce({ data: mockSurvey, error: null })
      .mockResolvedValueOnce({ data: mockReviewer, error: null })
      .mockResolvedValueOnce({ data: mockEmployee, error: null });

    mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({}) });
    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });

    const request = createMockRequest({
      surveyId: 'survey-1',
      reviewerId: 'reviewer-1',
    });

    await POST(request);

    const emailCall = mockSend.mock.calls[0][0];
    expect(emailCall.html).toContain('/survey/complete/unique-token-456');
  });

  it('should handle surveys without due dates', async () => {
    const mockSurvey = {
      id: 'survey-1',
      survey_name: 'Test',
      employee_id: 'emp-1',
      due_date: null,
    };

    const mockReviewer = {
      id: 'reviewer-1',
      reviewer_email: 'john@test.com',
      access_token: 'token-123',
    };

    const mockEmployee = { name: 'Jane', email: 'jane@test.com' };

    mockSingle
      .mockResolvedValueOnce({ data: mockSurvey, error: null })
      .mockResolvedValueOnce({ data: mockReviewer, error: null })
      .mockResolvedValueOnce({ data: mockEmployee, error: null });

    mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({}) });
    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });

    const request = createMockRequest({
      surveyId: 'survey-1',
      reviewerId: 'reviewer-1',
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const emailCall = mockSend.mock.calls[0][0];
    expect(emailCall.html).toContain('No deadline specified');
  });

  it('should include survey ID suffix in subject to prevent threading', async () => {
    const mockSurvey = {
      id: 'survey-abcdef123456',
      survey_name: 'Test',
      employee_id: 'emp-1',
    };

    const mockReviewer = {
      id: 'reviewer-1',
      reviewer_email: 'john@test.com',
      access_token: 'token-123',
    };

    const mockEmployee = { name: 'Jane Smith', email: 'jane@test.com' };

    mockSingle
      .mockResolvedValueOnce({ data: mockSurvey, error: null })
      .mockResolvedValueOnce({ data: mockReviewer, error: null })
      .mockResolvedValueOnce({ data: mockEmployee, error: null });

    mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({}) });
    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });

    const request = createMockRequest({
      surveyId: 'survey-abcdef123456',
      reviewerId: 'reviewer-1',
    });

    await POST(request);

    const emailCall = mockSend.mock.calls[0][0];
    expect(emailCall.subject).toMatch(/\[.*\]$/); // Should end with [SUFFIX]
  });
});
