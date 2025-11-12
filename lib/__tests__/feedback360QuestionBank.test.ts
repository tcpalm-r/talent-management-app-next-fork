/**
 * Tests for feedback360QuestionBank.ts - 360 Question Library
 */

import {
  QUESTION_LIBRARY,
  QuestionLibraryCategory,
  QuestionLibraryItem,
} from '../feedback360QuestionBank';

describe('feedback360QuestionBank.ts - Question Library', () => {
  describe('QUESTION_LIBRARY structure', () => {
    it('should be an array', () => {
      expect(Array.isArray(QUESTION_LIBRARY)).toBe(true);
    });

    it('should have multiple categories', () => {
      expect(QUESTION_LIBRARY.length).toBeGreaterThan(0);
    });

    it('should have all required category properties', () => {
      QUESTION_LIBRARY.forEach(category => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('title');
        expect(category).toHaveProperty('questions');

        expect(typeof category.id).toBe('string');
        expect(typeof category.title).toBe('string');
        expect(Array.isArray(category.questions)).toBe(true);
      });
    });

    it('should have unique category IDs', () => {
      const ids = QUESTION_LIBRARY.map(cat => cat.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have non-empty titles', () => {
      QUESTION_LIBRARY.forEach(category => {
        expect(category.title.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Question structure', () => {
    it('should have questions in each category', () => {
      QUESTION_LIBRARY.forEach(category => {
        expect(category.questions.length).toBeGreaterThan(0);
      });
    });

    it('should have all required question properties', () => {
      QUESTION_LIBRARY.forEach(category => {
        category.questions.forEach(question => {
          expect(question).toHaveProperty('id');
          expect(question).toHaveProperty('text');

          expect(typeof question.id).toBe('string');
          expect(typeof question.text).toBe('string');
          expect(question.text.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have unique question IDs across all categories', () => {
      const allQuestionIds: string[] = [];

      QUESTION_LIBRARY.forEach(category => {
        category.questions.forEach(question => {
          allQuestionIds.push(question.id);
        });
      });

      const uniqueIds = new Set(allQuestionIds);
      expect(uniqueIds.size).toBe(allQuestionIds.length);
    });

    it('should have question IDs matching category prefix', () => {
      QUESTION_LIBRARY.forEach(category => {
        category.questions.forEach(question => {
          expect(question.id.startsWith(category.id + '-')).toBe(true);
        });
      });
    });

    it('should have descriptive question text', () => {
      QUESTION_LIBRARY.forEach(category => {
        category.questions.forEach(question => {
          // Questions should be at least 20 characters (meaningful)
          expect(question.text.length).toBeGreaterThan(20);
        });
      });
    });
  });

  describe('Specific categories', () => {
    it('should have Impact category', () => {
      const impact = QUESTION_LIBRARY.find(cat => cat.id === 'impact');

      expect(impact).toBeDefined();
      expect(impact?.title).toBe('Impact');
      expect(impact?.questions.length).toBeGreaterThan(0);
    });

    it('should have Growth category', () => {
      const growth = QUESTION_LIBRARY.find(cat => cat.id === 'growth');

      expect(growth).toBeDefined();
      expect(growth?.title).toContain('Growth');
    });

    it('should have Leadership category', () => {
      const leadership = QUESTION_LIBRARY.find(cat => cat.id === 'leadership');

      expect(leadership).toBeDefined();
      expect(leadership?.title).toBe('Leadership');
    });

    it('should have Collaboration category', () => {
      const collaboration = QUESTION_LIBRARY.find(cat => cat.id === 'collaboration');

      expect(collaboration).toBeDefined();
      expect(collaboration?.title).toBe('Collaboration');
    });

    it('should have Performance category', () => {
      const performance = QUESTION_LIBRARY.find(cat => cat.id === 'performance');

      expect(performance).toBeDefined();
      expect(performance?.title).toBe('Performance');
    });

    it('should have Value category', () => {
      const value = QUESTION_LIBRARY.find(cat => cat.id === 'value');

      expect(value).toBeDefined();
    });

    it('should have Trust category', () => {
      const trust = QUESTION_LIBRARY.find(cat => cat.id === 'trust');

      expect(trust).toBeDefined();
    });

    it('should have General category', () => {
      const general = QUESTION_LIBRARY.find(cat => cat.id === 'general');

      expect(general).toBeDefined();
    });
  });

  describe('Question quality', () => {
    it('should have actionable questions', () => {
      // Look for common action words in questions
      const actionWords = ['what', 'how', 'describe', 'rate', 'would', 'should'];
      let hasActionableQuestions = false;

      QUESTION_LIBRARY.forEach(category => {
        category.questions.forEach(question => {
          const lowerText = question.text.toLowerCase();
          if (actionWords.some(word => lowerText.includes(word))) {
            hasActionableQuestions = true;
          }
        });
      });

      expect(hasActionableQuestions).toBe(true);
    });

    it('should have questions ending with question marks or periods', () => {
      QUESTION_LIBRARY.forEach(category => {
        category.questions.forEach(question => {
          const lastChar = question.text[question.text.length - 1];
          expect(['?', '.'].includes(lastChar)).toBe(true);
        });
      });
    });

    it('should not have duplicate question texts', () => {
      const allTexts: string[] = [];

      QUESTION_LIBRARY.forEach(category => {
        category.questions.forEach(question => {
          allTexts.push(question.text);
        });
      });

      const uniqueTexts = new Set(allTexts);
      expect(uniqueTexts.size).toBe(allTexts.length);
    });
  });

  describe('Category descriptions', () => {
    it('should allow optional descriptions', () => {
      QUESTION_LIBRARY.forEach(category => {
        if (category.description) {
          expect(typeof category.description).toBe('string');
          expect(category.description.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Practical usage', () => {
    it('should provide enough questions for a diverse survey', () => {
      const totalQuestions = QUESTION_LIBRARY.reduce(
        (sum, cat) => sum + cat.questions.length,
        0
      );

      // Should have at least 20 questions total for variety
      expect(totalQuestions).toBeGreaterThanOrEqual(20);
    });

    it('should be easy to find questions by category', () => {
      const impactCategory = QUESTION_LIBRARY.find(cat => cat.id === 'impact');

      expect(impactCategory).toBeDefined();
      expect(impactCategory?.questions[0].text).toContain('impact');
    });

    it('should be easy to get all questions from a category', () => {
      const leadershipCategory = QUESTION_LIBRARY.find(cat => cat.id === 'leadership');
      const leadershipQuestions = leadershipCategory?.questions || [];

      expect(leadershipQuestions.length).toBeGreaterThan(0);
      leadershipQuestions.forEach(q => {
        expect(q.id).toBeDefined();
        expect(q.text).toBeDefined();
      });
    });

    it('should support filtering questions by keyword', () => {
      // Simulate filtering for "leadership" questions
      const leadershipRelated = QUESTION_LIBRARY.filter(cat =>
        cat.id.includes('leadership') || cat.title.toLowerCase().includes('leadership')
      );

      expect(leadershipRelated.length).toBeGreaterThan(0);
    });

    it('should allow combining questions from multiple categories', () => {
      const impactQuestions = QUESTION_LIBRARY.find(cat => cat.id === 'impact')?.questions || [];
      const growthQuestions = QUESTION_LIBRARY.find(cat => cat.id === 'growth')?.questions || [];

      const combined = [...impactQuestions, ...growthQuestions];

      expect(combined.length).toBeGreaterThan(impactQuestions.length);
      expect(combined.length).toBeGreaterThan(growthQuestions.length);
    });
  });

  describe('Type safety', () => {
    it('should satisfy QuestionLibraryCategory type', () => {
      const category: QuestionLibraryCategory = QUESTION_LIBRARY[0];

      expect(category.id).toBeDefined();
      expect(category.title).toBeDefined();
      expect(category.questions).toBeDefined();
    });

    it('should satisfy QuestionLibraryItem type', () => {
      const question: QuestionLibraryItem = QUESTION_LIBRARY[0].questions[0];

      expect(question.id).toBeDefined();
      expect(question.text).toBeDefined();
    });
  });

  describe('Consistency', () => {
    it('should have consistent ID formatting (lowercase-with-dashes)', () => {
      QUESTION_LIBRARY.forEach(category => {
        expect(category.id).toMatch(/^[a-z-]+$/);

        category.questions.forEach(question => {
          expect(question.id).toMatch(/^[a-z-]+$/);
        });
      });
    });

    it('should have consistent capitalization in titles', () => {
      QUESTION_LIBRARY.forEach(category => {
        // Titles should start with capital letter
        expect(category.title[0]).toBe(category.title[0].toUpperCase());
      });
    });
  });
});
