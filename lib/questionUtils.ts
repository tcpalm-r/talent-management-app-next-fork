/**
 * Utility functions for working with 360 feedback questions
 */

/**
 * Replaces [NAME] placeholder in question text with the subject's first name
 * @param questionText - The question text containing [NAME] placeholder
 * @param subjectName - The full name of the survey subject
 * @returns Question text with [NAME] replaced by first name
 */
export function replaceNamePlaceholder(
  questionText: string,
  subjectName: string | undefined
): string {
  if (!subjectName) {
    // If no name provided, keep the placeholder
    return questionText;
  }

  // Extract first name from full name
  const firstName = subjectName.split(' ')[0];

  // Replace all instances of [NAME] with the first name
  return questionText.replace(/\[NAME\]/g, firstName);
}

/**
 * Batch replace [NAME] in multiple questions
 * @param questions - Array of question objects with text property
 * @param subjectName - The full name of the survey subject
 * @returns Array of questions with replaced names
 */
export function replaceNameInQuestions<T extends { text: string }>(
  questions: T[],
  subjectName: string | undefined
): T[] {
  return questions.map(question => ({
    ...question,
    text: replaceNamePlaceholder(question.text, subjectName)
  }));
}
