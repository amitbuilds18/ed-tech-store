import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { hasAccess } from '../services/access';

const router = Router();

// Helper to safely get parameter as string
function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || '';
}

// Zod schema for quiz submission
const submitQuizSchema = z.object({
  answers: z.record(z.string(), z.number()),
  timeTakenSeconds: z.number().nonnegative().default(0),
});

// -------------------------------------------------------------
// GET /api/quizzes/chapter/:chapterId
// Fetch DPP summary for a chapter with student's best score
// -------------------------------------------------------------
router.get('/chapter/:chapterId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const chapterId = getParam(req.params.chapterId);
  const userId = req.user!.id;

  // 1. Verify access to chapter
  const allowed = await hasAccess(userId, chapterId);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden: You do not have access to this chapter or its practice problems' });
    return;
  }

  // 2. Fetch quiz record
  const quiz = await prisma.quiz.findUnique({
    where: { chapterId },
    include: {
      chapter: {
        select: {
          id: true,
          name: true,
          order: true,
          isFree: true,
          subject: {
            select: {
              id: true,
              name: true,
              class: {
                select: {
                  id: true,
                  name: true,
                  board: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      _count: {
        select: { questions: true },
      },
      submissions: {
        where: { userId },
        orderBy: { score: 'desc' },
        take: 1,
      },
    },
  });

  if (!quiz) {
    res.status(404).json({ error: 'No practice quiz found for this chapter' });
    return;
  }

  const bestAttempt = quiz.submissions[0] || null;

  res.status(200).json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      durationMinutes: quiz.durationMinutes,
      totalMarks: quiz.totalMarks,
      passingMarks: quiz.passingMarks,
      questionCount: quiz._count.questions,
      chapter: quiz.chapter,
      bestAttempt: bestAttempt
        ? {
            id: bestAttempt.id,
            score: bestAttempt.score,
            totalMarks: bestAttempt.totalMarks,
            accuracy: bestAttempt.accuracy,
            timeTakenSeconds: bestAttempt.timeTakenSeconds,
            submittedAt: bestAttempt.submittedAt,
          }
        : null,
    },
  });
});

// -------------------------------------------------------------
// GET /api/quizzes/:quizId/take
// Start a quiz attempt - returns questions WITHOUT answer keys
// -------------------------------------------------------------
router.get('/:quizId/take', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const quizId = getParam(req.params.quizId);
  const userId = req.user!.id;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      chapter: {
        select: {
          id: true,
          name: true,
          isFree: true,
          subject: {
            select: {
              name: true,
              class: { select: { name: true, board: { select: { name: true } } } },
            },
          },
        },
      },
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          order: true,
          question: true,
          options: true,
          marks: true,
          negativeMarks: true,
          // Exclude correctOptionIndex and explanation for anti-cheat
        },
      },
    },
  });

  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found' });
    return;
  }

  // Verify access control
  const allowed = await hasAccess(userId, quiz.chapter.id);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden: You do not have access to this quiz' });
    return;
  }

  res.status(200).json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      durationMinutes: quiz.durationMinutes,
      totalMarks: quiz.totalMarks,
      passingMarks: quiz.passingMarks,
      chapter: quiz.chapter,
      questions: quiz.questions,
    },
  });
});

// -------------------------------------------------------------
// POST /api/quizzes/:quizId/submit
// Submit quiz answers, evaluate, persist submission, return scorecard + solutions
// -------------------------------------------------------------
router.post('/:quizId/submit', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const quizId = getParam(req.params.quizId);
  const userId = req.user!.id;

  const parseResult = submitQuizSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid submission data', details: parseResult.error.format() });
    return;
  }

  const { answers, timeTakenSeconds } = parseResult.data;

  // 1. Fetch quiz with authoritative answer keys
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      chapter: { select: { id: true, name: true } },
      questions: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found' });
    return;
  }

  // 2. Verify access
  const allowed = await hasAccess(userId, quiz.chapter.id);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden: You do not have access to this quiz' });
    return;
  }

  // 3. Score calculation
  let score = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  const reviews = quiz.questions.map((q) => {
    const studentChoice = answers[q.id];
    const isAttempted = studentChoice !== undefined && studentChoice !== null && studentChoice >= 0;
    const isCorrect = isAttempted && studentChoice === q.correctOptionIndex;

    let marksAwarded = 0;
    if (isCorrect) {
      marksAwarded = q.marks;
      score += marksAwarded;
      correctCount++;
    } else if (isAttempted) {
      marksAwarded = -q.negativeMarks;
      score += marksAwarded;
      incorrectCount++;
    } else {
      unattemptedCount++;
    }

    return {
      id: q.id,
      order: q.order,
      question: q.question,
      options: q.options,
      studentAnswerIndex: isAttempted ? studentChoice : null,
      correctAnswerIndex: q.correctOptionIndex,
      isCorrect,
      marksAwarded,
      explanation: q.explanation,
    };
  });

  // Minimum floor for score
  if (score < 0) score = 0;

  const totalAttempted = correctCount + incorrectCount;
  const accuracy = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 1000) / 10 : 0;

  // 4. Save QuizSubmission in DB
  const submission = await prisma.quizSubmission.create({
    data: {
      quizId,
      userId,
      score,
      totalMarks: quiz.totalMarks,
      accuracy,
      timeTakenSeconds,
      answers,
    },
  });

  res.status(200).json({
    submissionId: submission.id,
    quizId: quiz.id,
    title: quiz.title,
    chapterName: quiz.chapter.name,
    score,
    totalMarks: quiz.totalMarks,
    passed: score >= quiz.passingMarks,
    accuracy,
    timeTakenSeconds,
    correctCount,
    incorrectCount,
    unattemptedCount,
    reviews,
  });
});

// -------------------------------------------------------------
// GET /api/quizzes/submissions/:submissionId
// Review a past submission scorecard and solutions
// -------------------------------------------------------------
router.get('/submissions/:submissionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const submissionId = getParam(req.params.submissionId);
  const userId = req.user!.id;

  const submission = await prisma.quizSubmission.findUnique({
    where: { id: submissionId },
    include: {
      quiz: {
        include: {
          chapter: { select: { id: true, name: true } },
          questions: { orderBy: { order: 'asc' } },
        },
      },
    },
  });

  if (!submission) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }

  // Must be owner or admin
  if (submission.userId !== userId && req.user!.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden: You cannot view this submission' });
    return;
  }

  const answers = (submission.answers as Record<string, number>) || {};
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  const reviews = submission.quiz.questions.map((q) => {
    const studentChoice = answers[q.id];
    const isAttempted = studentChoice !== undefined && studentChoice !== null && studentChoice >= 0;
    const isCorrect = isAttempted && studentChoice === q.correctOptionIndex;

    let marksAwarded = 0;
    if (isCorrect) {
      marksAwarded = q.marks;
      correctCount++;
    } else if (isAttempted) {
      marksAwarded = -q.negativeMarks;
      incorrectCount++;
    } else {
      unattemptedCount++;
    }

    return {
      id: q.id,
      order: q.order,
      question: q.question,
      options: q.options,
      studentAnswerIndex: isAttempted ? studentChoice : null,
      correctAnswerIndex: q.correctOptionIndex,
      isCorrect,
      marksAwarded,
      explanation: q.explanation,
    };
  });

  res.status(200).json({
    submissionId: submission.id,
    quizId: submission.quiz.id,
    title: submission.quiz.title,
    chapterName: submission.quiz.chapter.name,
    score: submission.score,
    totalMarks: submission.totalMarks,
    passed: submission.score >= submission.quiz.passingMarks,
    accuracy: submission.accuracy,
    timeTakenSeconds: submission.timeTakenSeconds,
    submittedAt: submission.submittedAt,
    correctCount,
    incorrectCount,
    unattemptedCount,
    reviews,
  });
});

export default router;
