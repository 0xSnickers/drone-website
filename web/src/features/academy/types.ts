export type AcademyCategoryId = 'all' | 'beginner' | 'practice' | 'grading' | 'license';

export interface PreviewCoursePayload {
  title: string;
  summary: string;
  coverImage: string;
}
