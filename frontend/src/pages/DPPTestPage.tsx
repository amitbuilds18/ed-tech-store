import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Trophy,
  Award,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Question {
  id: string;
  order: number;
  question: string;
  options: string[];
  marks: number;
  negativeMarks: number;
}

interface QuestionReview {
  id: string;
  order: number;
  question: string;
  options: string[];
  studentAnswerIndex: number | null;
  correctAnswerIndex: number;
  isCorrect: boolean;
  marksAwarded: number;
  explanation: string;
}

interface ScoreCard {
  submissionId: string;
  quizId: string;
  title: string;
  chapterName: string;
  score: number;
  totalMarks: number;
  passed: boolean;
  accuracy: number;
  timeTakenSeconds: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  reviews: QuestionReview[];
}

export const DPPTestPage: React.FC = () => {
  const { chapterId } = useParams<{ chapterId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Test state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(15 * 60);
  const [initialDuration, setInitialDuration] = useState<number>(15 * 60);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Result state
  const [scoreCard, setScoreCard] = useState<ScoreCard | null>(null);

  const timerRef = useRef<any>(null);

  // 1. Fetch Quiz for Chapter and initiate test
  useEffect(() => {
    if (!chapterId) return;

    setLoading(true);
    setError(null);

    // First get chapter quiz summary
    fetch(`/api/quizzes/chapter/${chapterId}`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          navigate('/auth');
          throw new Error('Please log in to attempt the DPP test');
        }
        if (res.status === 403) {
          throw new Error('You do not have access to this chapter test. Please enroll or purchase a pass.');
        }
        if (res.status === 404) {
          throw new Error('No Daily Practice Problems (DPP) available for this chapter yet.');
        }
        if (!res.ok) throw new Error('Failed to load quiz');
        return res.json();
      })
      .then((data) => {
        const quiz = data.quiz;
        setQuizData(quiz);

        // Fetch questions without answers for taking the test
        return fetch(`/api/quizzes/${quiz.id}/take`, { credentials: 'include' });
      })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to start quiz attempt');
        return res.json();
      })
      .then((data) => {
        const qList = data.quiz.questions || [];
        setQuestions(qList);
        const durationSecs = (data.quiz.durationMinutes || 15) * 60;
        setTimeRemaining(durationSecs);
        setInitialDuration(durationSecs);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [chapterId, user]);

  // 2. Countdown timer
  useEffect(() => {
    if (loading || scoreCard || !questions.length) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, scoreCard, questions]);

  const handleAutoSubmit = () => {
    handleSubmit(true);
  };

  const handleSelectOption = (optionIndex: number) => {
    if (scoreCard) return; // Read-only after submit
    const currentQ = questions[currentIdx];
    if (!currentQ) return;

    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionIndex,
    }));
  };

  const handleClearChoice = () => {
    const currentQ = questions[currentIdx];
    if (!currentQ) return;

    setUserAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQ.id];
      return copy;
    });
  };

  const handleSubmit = (_auto = false) => {
    if (!quizData || isSubmitting) return;

    setIsSubmitting(true);
    setShowConfirmModal(false);

    const timeTaken = initialDuration - timeRemaining;

    fetch(`/api/quizzes/${quizData.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        answers: userAnswers,
        timeTakenSeconds: Math.max(timeTaken, 1),
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to submit test');
        return res.json();
      })
      .then((data: ScoreCard) => {
        setScoreCard(data);
        if (timerRef.current) clearInterval(timerRef.current);
      })
      .catch((err) => {
        alert(err.message || 'Error submitting test');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleRetake = () => {
    setUserAnswers({});
    setCurrentIdx(0);
    setScoreCard(null);
    setTimeRemaining(initialDuration);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeTaken = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} seconds`;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-gray-700 font-bold text-base">Loading DPP Test...</h3>
        <p className="text-gray-400 text-xs mt-1">Preparing questions and countdown timer</p>
      </div>
    );
  }

  if (error || !quizData) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-white rounded-3xl border border-gray-200 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Practice DPP Notice</h2>
          <p className="text-sm text-gray-600 mb-6">{error || 'Quiz not found'}</p>
          <div className="flex flex-col gap-2">
            <Link
              to="/"
              className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-xs hover:bg-blue-700 transition"
            >
              Back to Catalogue
            </Link>
            <Link
              to="/library"
              className="w-full py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs hover:bg-gray-200 transition"
            >
              Go to My Library
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const answeredCount = Object.keys(userAnswers).length;
  const isTimeCritical = timeRemaining < 3 * 60; // Less than 3 mins
  const isTimeSevere = timeRemaining < 60; // Less than 1 min

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                PW-Style Daily Practice Problem (DPP)
              </span>
              <h1 className="text-sm sm:text-base font-extrabold text-gray-900 truncate max-w-xs sm:max-w-md">
                {quizData.title}
              </h1>
            </div>
          </div>

          {!scoreCard && (
            <div
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-mono text-sm sm:text-base font-bold transition shadow-sm ${
                isTimeSevere
                  ? 'bg-red-500 text-white animate-pulse'
                  : isTimeCritical
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-gray-900 text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatTimer(timeRemaining)}</span>
            </div>
          )}

          {scoreCard && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> DPP Completed
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {!scoreCard ? (
          /* =========================================================
             TEST PLAYER VIEW
             ========================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left/Main Column: Question Card & Controls */}
            <div className="lg:col-span-3 space-y-4">
              {currentQ && (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 relative">
                  {/* Question Header */}
                  <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                        Q{currentIdx + 1}
                      </span>
                      <span className="text-xs font-bold text-gray-500">
                        Question {currentIdx + 1} of {questions.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        +{currentQ.marks} Mark
                      </span>
                      {currentQ.negativeMarks > 0 && (
                        <span className="text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                          -{currentQ.negativeMarks} Neg
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Text */}
                  <p className="text-base sm:text-lg font-medium text-gray-900 leading-relaxed mb-8">
                    {currentQ.question}
                  </p>

                  {/* Options (A, B, C, D) */}
                  <div className="space-y-3 mb-8">
                    {currentQ.options.map((optionText, optIdx) => {
                      const isSelected = userAnswers[currentQ.id] === optIdx;
                      const optionLetter = String.fromCharCode(65 + optIdx); // A, B, C, D

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(optIdx)}
                          className={`w-full text-left p-4 rounded-2xl border transition flex items-center gap-4 ${
                            isSelected
                              ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-600 shadow-sm'
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center flex-shrink-0 transition ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {optionLetter}
                          </div>
                          <span
                            className={`text-sm leading-snug flex-1 ${
                              isSelected ? 'font-bold text-blue-950' : 'text-gray-800'
                            }`}
                          >
                            {optionText}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleClearChoice}
                      disabled={userAnswers[currentQ.id] === undefined}
                      className="text-xs font-semibold text-gray-500 hover:text-red-600 disabled:opacity-30 disabled:pointer-events-none transition"
                    >
                      Clear Selection
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
                        disabled={currentIdx === 0}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-50 disabled:opacity-40 transition flex items-center gap-1.5"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Previous
                      </button>

                      {currentIdx < questions.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => setCurrentIdx((p) => Math.min(questions.length - 1, p + 1))}
                          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition flex items-center gap-1.5"
                        >
                          Next <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowConfirmModal(true)}
                          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Review & Submit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Question Navigator Pill Bar */}
            <div className="space-y-4">
              <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                    Question Navigator
                  </h3>
                  <span className="text-xs font-bold text-blue-600">
                    {answeredCount} / {questions.length} Answered
                  </span>
                </div>

                {/* Grid of Pill Buttons */}
                <div className="grid grid-cols-5 gap-2 mb-6">
                  {questions.map((q, idx) => {
                    const isAnswered = userAnswers[q.id] !== undefined;
                    const isCurrent = idx === currentIdx;

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setCurrentIdx(idx)}
                        className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center transition relative ${
                          isCurrent
                            ? 'ring-2 ring-blue-600 ring-offset-2'
                            : ''
                        } ${
                          isAnswered
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="space-y-2 pt-4 border-t border-gray-100 text-[11px] text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-600 flex-shrink-0" />
                    <span>Answered ({answeredCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gray-200 flex-shrink-0" />
                    <span>Unanswered ({questions.length - answeredCount})</span>
                  </div>
                </div>

                {/* Submit Test Button */}
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isSubmitting}
                  className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-200 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit DPP Test</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
             PW-STYLE SCORECARD & SOLUTIONS VIEW
             ========================================================= */
          <div className="space-y-8">
            {/* Hero Result Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
              <div className="max-w-2xl relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider backdrop-blur-md flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-300" />
                    DPP Result Analysis
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      scoreCard.passed
                        ? 'bg-emerald-500/80 text-white'
                        : 'bg-amber-400 text-amber-950'
                    }`}
                  >
                    {scoreCard.passed ? 'Passed / Target Achieved' : 'Needs Practice'}
                  </span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
                  {scoreCard.title}
                </h2>
                <p className="text-blue-200 text-sm mb-6">
                  {scoreCard.chapterName} &bull; Attempt completed in {formatTimeTaken(scoreCard.timeTakenSeconds)}
                </p>

                {/* Score Big Display */}
                <div className="flex flex-wrap items-baseline gap-6">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-blue-300 font-bold block">
                      Your Score
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-5xl font-black text-white">{scoreCard.score}</span>
                      <span className="text-xl text-blue-300 font-semibold">/ {scoreCard.totalMarks}</span>
                    </div>
                  </div>

                  <div className="border-l border-white/20 pl-6">
                    <span className="text-xs uppercase tracking-wider text-blue-300 font-bold block">
                      Accuracy
                    </span>
                    <span className="text-4xl font-extrabold text-amber-300 mt-1 block">
                      {scoreCard.accuracy}%
                    </span>
                  </div>

                  <div className="border-l border-white/20 pl-6">
                    <span className="text-xs uppercase tracking-wider text-blue-300 font-bold block">
                      Time Taken
                    </span>
                    <span className="text-3xl font-extrabold text-white mt-1 block">
                      {formatTimeTaken(scoreCard.timeTakenSeconds)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-6 rounded-3xl bg-white border border-emerald-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-2xl font-black text-emerald-700 block">{scoreCard.correctCount}</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase">Correct Answers</span>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-2xl font-black text-rose-700 block">{scoreCard.incorrectCount}</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase">Incorrect Answers</span>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-600 flex items-center justify-center">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-2xl font-black text-gray-700 block">{scoreCard.unattemptedCount}</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase">Unattempted</span>
                </div>
              </div>
            </div>

            {/* Retake & Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50 border border-blue-100">
              <span className="text-xs text-blue-900 font-semibold">
                Want to improve your score? You can retake this DPP anytime.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-600 hover:text-white font-bold rounded-xl text-xs border border-blue-200 transition flex items-center gap-1.5 shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retake DPP Test
                </button>
                <Link
                  to="/"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Back to Catalogue
                </Link>
              </div>
            </div>

            {/* Detailed Solutions Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    Step-by-Step Solutions & Detailed Explanations
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Review each question, your chosen option, and the authoritative theoretical derivation.
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-500">
                  {scoreCard.reviews.length} Questions
                </span>
              </div>

              <div className="space-y-4">
                {scoreCard.reviews.map((rev, qIdx) => {
                  return (
                    <div
                      key={rev.id}
                      className={`bg-white rounded-3xl border p-6 sm:p-8 shadow-sm transition ${
                        rev.isCorrect
                          ? 'border-emerald-200'
                          : rev.studentAnswerIndex === null
                          ? 'border-gray-200'
                          : 'border-rose-200'
                      }`}
                    >
                      {/* Review Question Header */}
                      <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-xl bg-gray-900 text-white text-xs font-black flex items-center justify-center">
                            Q{qIdx + 1}
                          </span>
                          <span className="text-xs font-bold text-gray-500">
                            Question {qIdx + 1}
                          </span>
                        </div>

                        <div>
                          {rev.isCorrect ? (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Correct (+{rev.marksAwarded})
                            </span>
                          ) : rev.studentAnswerIndex === null ? (
                            <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold">
                              Unattempted (0 Marks)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Incorrect
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Question Text */}
                      <p className="text-base font-semibold text-gray-900 mb-6">
                        {rev.question}
                      </p>

                      {/* Options Grid */}
                      <div className="space-y-2 mb-6">
                        {rev.options.map((optText, optIdx) => {
                          const isCorrectOpt = optIdx === rev.correctAnswerIndex;
                          const isStudentOpt = optIdx === rev.studentAnswerIndex;
                          const optionLetter = String.fromCharCode(65 + optIdx);

                          let style = 'bg-gray-50 border-gray-200 text-gray-700';
                          if (isCorrectOpt) {
                            style = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/50';
                          } else if (isStudentOpt && !rev.isCorrect) {
                            style = 'bg-rose-50 border-rose-400 text-rose-950 font-medium ring-2 ring-rose-400/50';
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`p-3.5 rounded-2xl border text-xs sm:text-sm flex items-center justify-between gap-3 ${style}`}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                                    isCorrectOpt
                                      ? 'bg-emerald-600 text-white'
                                      : isStudentOpt
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-gray-200 text-gray-700'
                                  }`}
                                >
                                  {optionLetter}
                                </span>
                                <span>{optText}</span>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isCorrectOpt && (
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-600 text-white">
                                    Correct Answer
                                  </span>
                                )}
                                {isStudentOpt && !isCorrectOpt && (
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-600 text-white">
                                    Your Choice
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* PW Explanation Box */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider mb-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          <span>Concept & Step-by-Step Solution:</span>
                        </div>
                        <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-sans">
                          {rev.explanation}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center animate-in fade-in zoom-in duration-150">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <Award className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">Ready to Submit DPP?</h3>
            <p className="text-xs text-gray-500 mb-6">
              You have answered <strong className="text-gray-900">{answeredCount}</strong> of{' '}
              <strong className="text-gray-900">{questions.length}</strong> questions.
              {questions.length - answeredCount > 0 && (
                <span className="text-amber-600 block mt-1">
                  ({questions.length - answeredCount} questions remain unattempted)
                </span>
              )}
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition"
              >
                Back to Test
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-200 transition"
              >
                {isSubmitting ? 'Evaluating...' : 'Yes, Submit Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
