import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/app/providers/AuthProvider';
import { supabase } from '@/shared/services/supabaseClient';
import { showSuccessToast } from '@/shared/stores/toastStore';
import { trainingContent } from '../content/trainingData';
import { QuizComponent } from './QuizComponent';
import type { TrainingProgress } from '@/shared/types';

export default function LessonViewer() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [progress, setProgress] = useState<Record<string, TrainingProgress>>({});

  const course = trainingContent.find((c) => c.id === courseId);
  const lessons = course?.lessons || [];

  useEffect(() => {
    if (lessonId && lessons.length > 0) {
      const index = lessons.findIndex((l) => l.id === lessonId);
      if (index >= 0) setCurrentLessonIndex(index);
    }
  }, [lessonId, lessons]);

  useEffect(() => {
    if (user) loadProgress();
  }, [user]);

  const currentLesson = lessons[currentLessonIndex];

  async function loadProgress() {
    try {
      const { data, error } = await supabase
        .from('training_progress')
        .select('*')
        .eq('user_id', user!.id);

      if (!error && data) {
        const progressMap: Record<string, TrainingProgress> = {};
        data.forEach((p: { lesson_id: string }) => {
          progressMap[p.lesson_id] = p as unknown as TrainingProgress;
        });
        setProgress(progressMap);
      }
    } catch (error) {
      console.log('Using demo mode for lesson progress');
    }
  }

  async function markComplete(quizScore?: number) {
    if (!user || !currentLesson) return;

    try {
      // Try to save to Supabase
      await supabase.from('training_progress').upsert({
        user_id: user.id,
        lesson_id: currentLesson.id,
        completed: true,
        quiz_score: quizScore,
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.log('Demo mode: progress saved locally only');
    }

    // Always update local state
    setProgress((prev) => ({
      ...prev,
      [currentLesson.id]: {
        id: `${user.id}-${currentLesson.id}`,
        userId: user.id,
        lessonId: currentLesson.id,
        completed: true,
        quizScore,
        completedAt: new Date().toISOString(),
      },
    }));

    showSuccessToast('Lesson completed!');
    setShowQuiz(false);

    // Move to next lesson or back to hub
    if (currentLessonIndex < lessons.length - 1) {
      goToNext();
    } else {
      navigate(`/training/${courseId}`);
    }
  }

  const goToPrevious = () => {
    if (currentLessonIndex > 0) {
      const prevLesson = lessons[currentLessonIndex - 1];
      setCurrentLessonIndex(currentLessonIndex - 1);
      setShowQuiz(false);
      navigate(`/training/${courseId}/${prevLesson.id}`);
    }
  };

  const goToNext = () => {
    if (currentLessonIndex < lessons.length - 1) {
      const nextLesson = lessons[currentLessonIndex + 1];
      setCurrentLessonIndex(currentLessonIndex + 1);
      setShowQuiz(false);
      navigate(`/training/${courseId}/${nextLesson.id}`);
    }
  };

  const handleQuizComplete = (score: number, passed: boolean) => {
    if (passed) {
      markComplete(score);
    }
  };

  if (!course || !currentLesson) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Lesson not found</p>
        <Link to="/training" className="btn-primary mt-4 inline-flex">
          Back to Training
        </Link>
      </div>
    );
  }

  const isCompleted = progress[currentLesson.id]?.completed;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          to={`/training/${courseId}`}
          className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Back to {course.title}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentLesson.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Lesson {currentLessonIndex + 1} of {lessons.length}
            </p>
          </div>
          {isCompleted && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircleIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Completed</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-fire-500 rounded-full transition-all"
            style={{
              width: `${((currentLessonIndex + 1) / lessons.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Content */}
      {!showQuiz ? (
        <div className="card p-6 mb-8">
          <div className="prose prose-gray dark:prose-invert max-w-none">
            {currentLesson.content.map((block, index) => {
              if (block.type === 'text') {
                return (
                  <div
                    key={index}
                    dangerouslySetInnerHTML={{
                      __html: block.content
                        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                        .replace(/^\*\*(.*)\*\*/gim, '<strong>$1</strong>')
                        .replace(/^\- (.*$)/gim, '<li>$1</li>')
                        .replace(/\n\n/g, '</p><p>')
                        .replace(/\n/g, '<br />'),
                    }}
                  />
                );
              }

              if (block.type === 'image') {
                return (
                  <figure key={index} className="my-6">
                    <img
                      src={block.content}
                      alt={block.caption || ''}
                      className="w-full rounded-lg"
                    />
                    {block.caption && (
                      <figcaption className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {block.caption}
                      </figcaption>
                    )}
                  </figure>
                );
              }

              return null;
            })}
          </div>
        </div>
      ) : (
        <QuizComponent
          quiz={currentLesson.quiz!}
          onComplete={handleQuizComplete}
          onCancel={() => setShowQuiz(false)}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPrevious}
          disabled={currentLessonIndex === 0}
          className="btn-outline flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-2">
          {currentLesson.quiz && !isCompleted && !showQuiz && (
            <button onClick={() => setShowQuiz(true)} className="btn-primary">
              Take Quiz
            </button>
          )}

          {!currentLesson.quiz && !isCompleted && (
            <button onClick={() => markComplete()} className="btn-primary">
              Mark Complete
            </button>
          )}

          {(isCompleted || !currentLesson.quiz) &&
            currentLessonIndex < lessons.length - 1 && (
              <button
                onClick={goToNext}
                className="btn-primary flex items-center gap-2"
              >
                Next Lesson
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            )}

          {currentLessonIndex === lessons.length - 1 && isCompleted && (
            <Link to="/training" className="btn-primary">
              Finish Course
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
