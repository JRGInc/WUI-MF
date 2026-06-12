import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AcademicCapIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/app/providers/AuthProvider';
import { supabase } from '@/shared/services/supabaseClient';
import { trainingContent } from './content/trainingData';
import type { TrainingCourse, TrainingProgress } from '@/shared/types';

export default function TrainingHub() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Record<string, TrainingProgress>>({});
  const [, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadProgress();
    }
  }, [user]);

  async function loadProgress() {
    setIsLoading(true);
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
      } else {
        // Demo mode - no progress saved
        console.log('Using demo mode for training progress');
      }
    } catch (error) {
      console.log('Training progress: using demo mode');
    } finally {
      setIsLoading(false);
    }
  }

  function getCourseProgress(course: TrainingCourse): number {
    const completedLessons = course.lessons.filter(
      (lesson) => progress[lesson.id]?.completed
    ).length;
    return Math.round((completedLessons / course.lessons.length) * 100);
  }

  function getTotalProgress(): number {
    const totalLessons = trainingContent.reduce((acc, c) => acc + c.lessons.length, 0);
    const completedLessons = Object.values(progress).filter((p) => p.completed).length;
    return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  }

  const totalProgress = getTotalProgress();
  const earnedBadges = trainingContent.filter(
    (course) => getCourseProgress(course) === 100 && course.badge
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Training Center
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Learn about wildfire preparedness and earn certification badges.
        </p>
      </div>

      {/* Progress Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-fire-100 dark:bg-fire-900/30">
              <AcademicCapIcon className="w-6 h-6 text-fire-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalProgress}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overall Progress</p>
            </div>
          </div>
          <div className="mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-fire-500 rounded-full transition-all"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Object.values(progress).filter((p) => p.completed).length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Lessons Completed</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <TrophyIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {earnedBadges.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Badges Earned</p>
            </div>
          </div>
        </div>
      </div>

      {/* Earned Badges */}
      {earnedBadges.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Your Badges
          </h2>
          <div className="flex flex-wrap gap-4">
            {earnedBadges.map(
              (course) =>
                course.badge && (
                  <div
                    key={course.id}
                    className="flex flex-col items-center p-4 rounded-lg bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30"
                  >
                    <div className="w-16 h-16 rounded-full bg-yellow-400 flex items-center justify-center mb-2">
                      <TrophyIcon className="w-8 h-8 text-yellow-800" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {course.badge.name}
                    </p>
                  </div>
                )
            )}
          </div>
        </div>
      )}

      {/* Course List */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Available Courses
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {trainingContent.map((course) => {
            const courseProgress = getCourseProgress(course);
            const isCompleted = courseProgress === 100;
            const nextLesson = course.lessons.find((l) => !progress[l.id]?.completed);

            return (
              <Link
                key={course.id}
                to={`/training/${course.id}`}
                className="card p-6 hover:border-fire-500 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-fire-600">
                        {course.title}
                      </h3>
                      {isCompleted && (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {course.description}
                    </p>
                  </div>
                  {course.badge && (
                    <div
                      className={`p-2 rounded-full ${
                        isCompleted
                          ? 'bg-yellow-100 dark:bg-yellow-900/30'
                          : 'bg-gray-100 dark:bg-gray-800'
                      }`}
                    >
                      <TrophyIcon
                        className={`w-5 h-5 ${
                          isCompleted
                            ? 'text-yellow-600'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <AcademicCapIcon className="w-4 h-4" />
                    {course.lessons.length} lessons
                  </div>
                  <div className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    {course.estimatedMinutes} min
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Progress</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {courseProgress}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isCompleted ? 'bg-green-500' : 'bg-fire-500'
                      }`}
                      style={{ width: `${courseProgress}%` }}
                    />
                  </div>
                </div>

                {nextLesson && !isCompleted && (
                  <div className="mt-4 flex items-center gap-2 text-fire-600 text-sm font-medium">
                    <PlayIcon className="w-4 h-4" />
                    Continue: {nextLesson.title}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
