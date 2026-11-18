import { z } from 'zod';

// Board validation
export const createBoardSchema = z.object({
  name: z.string().trim().min(1, 'Board name is required'),
});

export const updateBoardSchema = z.object({
  name: z.string().trim().min(1, 'Board name is required'),
});

// Class validation
export const createClassSchema = z.object({
  name: z.string().trim().min(1, 'Class name is required'),
  boardId: z.string().uuid('Valid boardId is required'),
});

export const updateClassSchema = z.object({
  name: z.string().trim().min(1).optional(),
  boardId: z.string().uuid().optional(),
});

// Subject validation
export const createSubjectSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required'),
  classId: z.string().uuid('Valid classId is required'),
});

export const updateSubjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  classId: z.string().uuid().optional(),
});

// Chapter validation
export const createChapterSchema = z.object({
  name: z.string().trim().min(1, 'Chapter name is required'),
  subjectId: z.string().uuid('Valid subjectId is required'),
  order: z.number().int().positive().optional(),
  isFree: z.boolean().optional(),
});

export const updateChapterSchema = z.object({
  name: z.string().trim().min(1).optional(),
  order: z.number().int().positive().optional(),
  isFree: z.boolean().optional(),
});
